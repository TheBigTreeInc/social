"""Read-only exact-commit release candidate preparation.

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


def select_successful_push_runs(runs, sha):
    """Fail closed on latest attempt of any required workflow; never use PR/manual/tag runs."""
    selected = {}
    for name in REQUIRED:
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
    selected = select_successful_push_runs(response['workflow_runs'], sha)

    # Ensure all artifact metadata exists before downloading anything.
    downloads = []
    for name, artifacts in REQUIRED.items():
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
        print(f'CI VERIFIED (NOT PUBLISHED): {version} {sha}')
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

    android_bundle = out / f'tavi-android-arm64-signed-release-{version}.zip'
    with ZipFile(android_bundle) as bundle:
        apks = [n for n in bundle.namelist() if n.endswith('.apk')]
        if len(apks) != 1:
            raise CandidateBlocked('Signed Android release must contain exactly one APK')
        direct_apk = out / f'tavi-android-arm64-v{version}.apk'
        direct_apk.write_bytes(bundle.read(apks[0]))
    if direct_apk.stat().st_size < 1_000_000:
        raise CandidateBlocked('Android APK unexpectedly small')
    if len(list(out.glob('*.zip'))) != 6:
        raise CandidateBlocked('Expected exactly six candidate ZIP bundles')

    assets = sorted(p for p in out.iterdir() if p.is_file())
    checksums = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in assets}
    (out / 'SHA256SUMS.txt').write_text(''.join(f'{digest}  {name}\n' for name, digest in checksums.items()))
    record = {
        'schema': 'tavi.release-candidate/v1',
        'repository': repo,
        'commit_sha': sha,
        'version': version,
        'status': 'ci_passed_operator_unverified',
        'publication_authorized': False,
        'operator_acceptance': 'pending',
        'workflow_runs': {name: {'id': run['id'], 'attempt': run.get('run_attempt', 1),
                                 'conclusion': run['conclusion']} for name, run in selected.items()},
        'assets_sha256': checksums,
    }
    Path('release-candidate.json').write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')
    Path('release-assets-notes.md').write_text(
        f'# Tavi {version} — review-only release candidate\n\n'
        f'Exact main commit: `{sha}`. All eight required CI workflows passed for this commit.\n\n'
        'This package has NOT passed native operator acceptance. It is NOT a published release.\n'
        'Inspect build artifacts and checksums, perform ZipRunner Windows/Android acceptance,\n'
        'and request separate explicit publication approval if ever required.\n'
    )
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as f:
            f.write('ready=true\n')
    print(f'CANDIDATE READY (NOT PUBLISHED): {version} {sha}')
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
