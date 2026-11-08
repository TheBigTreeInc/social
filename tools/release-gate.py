"""Read-only, explicitly scoped, exact-commit release candidate preparation.

Called explicitly from workflow_dispatch. This script checks the current main SHA,
requires all build/test workflows to pass for the same push commit, then collects
artifacts and SHA256 evidence. It does NOT tag, publish, deploy or call release APIs.

Requires gh CLI with actions:read and contents:read. Missing/failed CI exits nonzero
so GitHub's status cannot misleadingly report a successful candidate.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from zipfile import ZipFile, ZIP_DEFLATED, is_zipfile

REQUIRED = {
    'Verify Social server and client source': (),
    'Windows desktop app': ('looprd-social-windows-nsis',),
    'Android phone app': ('tavi-android-arm64-signed-release',),
    'Linux and macOS desktop installers': ('tavi-linux-amd64-deb', 'tavi-macos-apple-silicon-dmg'),
    'Web browser client and JavaScript SDK': ('social-web-client',),
    'SDK cross-platform checks': (),
    'SDK source packages and OpenClaw bridge': ('tavi-sdk-and-openclaw-source-packages',),
    'Tavi browser UI QA': (),
}

# A Windows + Android release may be accepted independently of future Linux/macOS
# deliverables. Keep the original full gate available and strict.
SCOPES = {
    'windows-android': {name: REQUIRED[name] for name in (
        'Verify Social server and client source',
        'Windows desktop app',
        'Android phone app',
        'Tavi browser UI QA',
    )},
    'full': REQUIRED,
}

def requirements_for_scope(scope):
    if scope not in SCOPES:
        raise CandidateBlocked('Unsupported release candidate scope')
    return SCOPES[scope]


class CandidateBlocked(RuntimeError):
    """Required verification is missing, incomplete, stale or unsuccessful."""


def gh(*args):
    p = subprocess.run(['gh', *args], text=True, capture_output=True)
    if p.returncode:
        raise RuntimeError(f'gh {args[0]} failed: {p.stderr.strip()}')
    return p.stdout


def require_exact_sha(sha):
    if not re.fullmatch(r'[0-9a-fA-F]{40}', sha):
        raise CandidateBlocked('Expected an exact 40-character commit SHA')
    return sha.lower()


def select_successful_push_runs(runs, sha, required=None):
    """Fail closed on latest attempt of any required workflow; never use PR/manual/tag runs."""
    if required is None:
        required = REQUIRED  # existing full-scope caller compatibility
    selected = {}
    for name in required:
        candidates = [r for r in runs if r.get('name') == name and r.get('event') == 'push'
                      and r.get('head_sha', '').lower() == sha and r.get('head_branch') == 'main']
        if not candidates:
            raise CandidateBlocked(f'MISSING: {name} has no main push run for this commit')
        latest = max(candidates, key=lambda r: (r.get('run_number', 0), r.get('run_attempt', 0)))
        if latest.get('status') != 'completed' or latest.get('conclusion') != 'success':
            raise CandidateBlocked(f'BLOCKED: {name} is {latest.get("status")}/{latest.get("conclusion")}')
        selected[name] = latest
    return selected


def candidate():
    repo = os.environ['GH_REPO']
    sha = require_exact_sha(os.environ['RELEASE_SHA'])
    scope = os.environ.get('RELEASE_SCOPE', 'full')
    required = requirements_for_scope(scope)
    version = json.loads(Path('package.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise CandidateBlocked('Candidate version must be stable x.y.z')
    head = gh('api', f'repos/{repo}/branches/main', '--jq', '.commit.sha').strip().lower()
    if head != sha:
        raise CandidateBlocked('STALE: candidate must be the current main commit, no auto-promotion')
    checkout = subprocess.run(['git', 'rev-parse', 'HEAD'], text=True, capture_output=True)
    if checkout.returncode or checkout.stdout.strip().lower() != sha:
        raise CandidateBlocked('Checked-out source SHA does not match the requested candidate')

    response = json.loads(gh('api', f'repos/{repo}/actions/runs?head_sha={sha}&per_page=100'))
    selected = select_successful_push_runs(response['workflow_runs'], sha, required)

    # Ensure all artifact metadata exists before downloading anything.
    downloads = []
    for name, artifacts in required.items():
        if not artifacts:
            continue
        run = selected[name]
        available = json.loads(gh('api', f'repos/{repo}/actions/runs/{run["id"]}/artifacts?per_page=100'))['artifacts']
        for artifact_name in artifacts:
            found = next((a for a in available if a['name'] == artifact_name and not a.get('expired', False)), None)
            if not found:
                raise CandidateBlocked(f'MISSING: {name} artifact {artifact_name}')
            downloads.append((run['id'], artifact_name))

    if os.environ.get('CANDIDATE_CHECK_ONLY') == '1':
        print(f'CI VERIFIED (NOT PUBLISHED): {scope} {version} {sha}')
        return 0

    out = Path('release-assets')
    out.mkdir(exist_ok=False)  # refuse to mix stale artifacts from previous attempts
    for run_id, name in downloads:
        dest = out / name
        dest.mkdir()
        gh('run', 'download', str(run_id), '-R', repo, '-n', name, '-D', str(dest))
        if not any(p.is_file() and p.stat().st_size for p in dest.rglob('*')):
            raise CandidateBlocked(f'EMPTY: downloaded artifact {name}')

    for directory in list(out.iterdir()):
        if not directory.is_dir():
            continue
        target = out / f'{directory.name}-{version}.zip'
        with ZipFile(target, 'w', ZIP_DEFLATED) as z:
            for file in sorted(directory.rglob('*')):
                if file.is_file():
                    z.write(file, file.relative_to(directory))
        if not is_zipfile(target):
            raise CandidateBlocked(f'Invalid bundle {target.name}')
        shutil.rmtree(directory)

    # Check that the actual native installer is present exactly once, not merely
    # that a successful Actions job uploaded an arbitrarily named file.
    windows_bundle = out / f'looprd-social-windows-nsis-{version}.zip'
    with ZipFile(windows_bundle) as bundle:
        exes = [n for n in bundle.namelist() if n.lower().endswith('.exe') and not n.endswith('/')]
        if len(exes) != 1:
            raise CandidateBlocked('Windows NSIS artifact must contain exactly one installer EXE')
        direct_exe = out / f'tavi-windows-x64-v{version}-setup.exe'
        direct_exe.write_bytes(bundle.read(exes[0]))
    if direct_exe.stat().st_size < 1_000_000:
        raise CandidateBlocked('Windows NSIS installer unexpectedly small')

    android_bundle = out / f'tavi-android-arm64-signed-release-{version}.zip'
    with ZipFile(android_bundle) as bundle:
        apks = [n for n in bundle.namelist() if n.endswith('.apk')]
        if len(apks) != 1:
            raise CandidateBlocked('Signed Android release must contain exactly one APK')
        direct_apk = out / f'tavi-android-arm64-v{version}.apk'
        direct_apk.write_bytes(bundle.read(apks[0]))
    if direct_apk.stat().st_size < 1_000_000:
        raise CandidateBlocked('Android APK unexpectedly small')
    expected_zips = sum(len(artifacts) for artifacts in required.values())
    if len(list(out.glob('*.zip'))) != expected_zips:
        raise CandidateBlocked(f'Expected exactly {expected_zips} candidate ZIP bundles for {scope}')

    assets = sorted(p for p in out.iterdir() if p.is_file())
    checksums = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in assets}
    (out / 'SHA256SUMS.txt').write_text(''.join(f'{digest}  {name}\n' for name, digest in checksums.items()))
    record = {
        'schema': 'tavi.release-candidate/v1',
        'repository': repo,
        'commit_sha': sha,
        'version': version,
        'scope': scope,
        'required_workflows': list(required),
        'excluded_workflows': [name for name in REQUIRED if name not in required],
        'status': 'ci_passed_operator_unverified',
        'publication_authorized': False,
        'operator_acceptance': 'pending',
        'workflow_runs': {name: {'id': run['id'], 'attempt': run.get('run_attempt', 1),
                                 'conclusion': run['conclusion']} for name, run in selected.items()},
        'assets_sha256': checksums,
    }
    Path('release-candidate.json').write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')
    excluded_notice = ('Other platform workflows are outside this candidate scope; they are NOT accepted or released.\n\n'
                       if scope == 'windows-android' else 'Full eight-workflow candidate scope; no required platform workflow was omitted.\n\n')
    Path('release-assets-notes.md').write_text(
        f'# Tavi {version} — {scope} review-only candidate\n\n'
        + f'Exact main commit: `{sha}`. Required {scope} CI workflows passed: '
        + ', '.join(required) + '.\n'
        + excluded_notice
        + 'This package has NOT passed native operator acceptance. It is NOT a published release.\n'
        + 'Inspect build artifacts and checksums, perform ZipRunner Windows/Android acceptance,\n'
        + 'and request separate explicit publication approval if ever required.\n'
    )
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as f:
            f.write('ready=true\n')
    print(f'CANDIDATE READY (NOT PUBLISHED): {scope} {version} {sha}')
    return 0


# Keep original function import name for existing callers/tests.
def gate():
    return candidate()


if __name__ == '__main__':
    try:
        sys.exit(gate())
    except (CandidateBlocked, RuntimeError, ValueError, KeyError) as error:
        print(f'CANDIDATE BLOCKED: {error}', file=sys.stderr)
        sys.exit(1)
