"""Publish *only* a manually accepted, exact-commit Tavi Windows/Android candidate.

The preparation workflow has no publishing credentials. This is invoked only by
`Publish approved Tavi release` with an operator confirmation and acceptance ref.
It can fill an existing empty release without changing its tag or other assets.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from zipfile import ZipFile

CONFIRM = 'PUBLISH-TAVI-WINDOWS-ANDROID'
SCOPE = 'windows-android'
REQUIRED_WORKFLOWS = (
    'Verify Social server and client source',
    'Windows desktop app',
    'Android phone app',
    'Tavi browser UI QA',
)
SHA_RE = re.compile(r'[0-9a-f]{40}')
REPO_RE = re.compile(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+')
VERSION_RE = re.compile(r'\d+\.\d+\.\d+')
ACCEPTANCE_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}')


class PublicationBlocked(RuntimeError):
    """Reject an incomplete, unapproved, mismatched or conflicting publication."""


def run_gh(*args, missing_ok=False):
    result = subprocess.run(['gh', *args], text=True, capture_output=True)
    if result.returncode:
        if missing_ok and '404' in result.stderr:
            return None
        raise PublicationBlocked(f'GitHub command {args[:2]} failed: {result.stderr.strip()}')
    return result.stdout


def api(repo, path, missing_ok=False):
    response = run_gh('api', f'repos/{repo}/{path}', missing_ok=missing_ok)
    return json.loads(response) if response is not None else None


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def parse_request(env):
    repo = env.get('GH_REPO', '')
    commit = env.get('CANDIDATE_SHA', '').lower()
    run_id = env.get('CANDIDATE_RUN_ID', '')
    scope = env.get('CANDIDATE_SCOPE', '')
    confirmation = env.get('PUBLICATION_CONFIRMATION', '')
    acceptance = env.get('OPERATOR_ACCEPTANCE_REF', '')
    if not REPO_RE.fullmatch(repo):
        raise PublicationBlocked('Invalid GitHub repository')
    if not SHA_RE.fullmatch(commit):
        raise PublicationBlocked('An exact 40-character candidate SHA is required')
    if not run_id.isdecimal() or int(run_id) < 1:
        raise PublicationBlocked('An exact positive candidate workflow run ID is required')
    if scope != SCOPE:
        raise PublicationBlocked('Only the windows-android candidate scope is publishable in this workflow')
    if confirmation != CONFIRM:
        raise PublicationBlocked('Explicit Windows/Android publication confirmation is missing')
    if not ACCEPTANCE_RE.fullmatch(acceptance):
        raise PublicationBlocked('Operator acceptance evidence/reference is required (8-160 safe characters)')
    return repo, commit, int(run_id), acceptance


def expected_names(version):
    return (
        f'looprd-social-windows-nsis-{version}.zip',
        f'tavi-android-arm64-signed-release-{version}.zip',
        f'tavi-windows-x64-v{version}-setup.exe',
        f'tavi-android-arm64-v{version}.apk',
    )


def inspect_candidate(root, repo, commit):
    """Validate the downloaded artifact and all bundled bytes before mutation."""
    metadata = root / 'release-candidate.json'
    out = root / 'release-assets'
    if not metadata.is_file() or not out.is_dir():
        raise PublicationBlocked('Missing release candidate metadata or release-assets')
    record = json.loads(metadata.read_text(encoding='utf-8'))
    version = record.get('version', '')
    if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
        raise PublicationBlocked('Invalid candidate version')
    expected = set(expected_names(version))
    checksums = record.get('assets_sha256')
    if (record.get('schema') != 'tavi.release-candidate/v1'
        or record.get('repository') != repo
        or record.get('commit_sha') != commit
        or record.get('scope') != SCOPE
        or record.get('status') != 'ci_passed_operator_unverified'
        or record.get('publication_authorized') is not False
        or record.get('operator_acceptance') != 'pending'):
        raise PublicationBlocked('Candidate identity, scope or expected review-only state mismatch')
    if record.get('required_workflows') != list(REQUIRED_WORKFLOWS):
        raise PublicationBlocked('Candidate is missing a required CI workflow')
    runs = record.get('workflow_runs') or {}
    if set(runs) != set(REQUIRED_WORKFLOWS) or any(
        runs[name].get('conclusion') != 'success' or not isinstance(runs[name].get('id'), int)
        for name in REQUIRED_WORKFLOWS
    ):
        raise PublicationBlocked('Candidate workflow evidence incomplete')
    if not isinstance(checksums, dict) or set(checksums) != expected:
        raise PublicationBlocked('Candidate assets differ from expected Windows/Android files')
    if {p.name for p in out.iterdir()} != (expected | {'SHA256SUMS.txt'}):
        raise PublicationBlocked('Candidate directory contains unexpected files or is missing assets')
    for name, digest in checksums.items():
        if not re.fullmatch(r'[a-f0-9]{64}', digest):
            raise PublicationBlocked(f'Invalid SHA-256 for {name}')
        path = out / name
        if not path.is_file() or sha256(path.read_bytes()) != digest:
            raise PublicationBlocked(f'Artifact checksum mismatch: {name}')
    checksums_text = ''.join(f'{checksums[name]}  {name}\n' for name in sorted(checksums))
    if (out / 'SHA256SUMS.txt').read_text(encoding='utf-8') != checksums_text:
        raise PublicationBlocked('SHA256SUMS.txt mismatches candidate metadata')
    # Check that the two convenient standalone installer downloads are identical
    # to the installers inside the source CI artifacts. No renaming or repacking.
    for zipped, direct, extension in (
        (f'looprd-social-windows-nsis-{version}.zip', f'tavi-windows-x64-v{version}-setup.exe', '.exe'),
        (f'tavi-android-arm64-signed-release-{version}.zip', f'tavi-android-arm64-v{version}.apk', '.apk'),
    ):
        with ZipFile(out / zipped) as archive:
            members = [info for info in archive.infolist() if not info.is_dir() and info.filename.lower().endswith(extension)]
            if len(members) != 1 or members[0].file_size < 1_000_000:
                raise PublicationBlocked(f'Candidate ZIP must contain one valid {extension} installer')
            if sha256(archive.read(members[0])) != checksums[direct]:
                raise PublicationBlocked(f'Standalone {extension} does not match original CI artifact')
    return version, out, checksums


def verify_github_evidence(repo, commit, run_id, version):
    candidate = api(repo, f'actions/runs/{run_id}')
    if (candidate.get('name') != 'Prepare Tavi release candidate'
        or candidate.get('event') != 'workflow_dispatch'
        or candidate.get('status') != 'completed'
        or candidate.get('conclusion') != 'success'
        or candidate.get('head_sha', '').lower() != commit):
        raise PublicationBlocked('Candidate workflow run identity or success mismatch')
    artifacts = api(repo, f'actions/runs/{run_id}/artifacts?per_page=100')['artifacts']
    target = f'tavi-candidate-{SCOPE}-{commit}'
    if not any(a.get('name') == target and not a.get('expired', True) for a in artifacts):
        raise PublicationBlocked('Expected non-expired release candidate artifact not found')
    # Ensure the archive describes the version built from the exact source SHA,
    # not an independently supplied version label.
    content = api(repo, f'contents/package.json?ref={commit}')
    if content.get('encoding') != 'base64':
        raise PublicationBlocked('GitHub source version metadata unavailable')
    package = json.loads(base64.b64decode(content['content']))
    if package.get('version') != version:
        raise PublicationBlocked('Candidate version does not match exact source commit')


def verify_release_target(repo, commit, version):
    tag = f'v{version}'
    release = api(repo, f'releases/tags/{tag}', missing_ok=True)
    # GitHub returns HTTP 422 (not 404) for commits/<missing-tag>.
    # Check the tag ref first, then resolve its commit only when it exists.
    tag_ref = api(repo, f'git/ref/tags/{tag}', missing_ok=True)
    tagged_commit = api(repo, f'commits/{tag}') if tag_ref is not None else None
    if tagged_commit is not None:
        if tagged_commit.get('sha', '').lower() != commit:
            raise PublicationBlocked('Existing release tag points at a different commit')
    elif release is not None:
        raise PublicationBlocked('Existing release has no resolvable matching tag')
    else:
        head = api(repo, 'branches/main')['commit']['sha'].lower()
        if head != commit:
            raise PublicationBlocked('New release requires candidate to be current main (older tagged releases may be filled)')
    if release is not None and release.get('draft'):
        raise PublicationBlocked('Existing draft release must be reviewed separately')
    return tag, release


def inspect_existing_assets(repo, tag, release, out, files):
    if release is None:
        return list(files)
    existing = {asset['name']: asset for asset in release.get('assets', [])}
    if len(existing) != len(release.get('assets', [])):
        raise PublicationBlocked('Existing release has ambiguous duplicate filenames')
    missing = []
    for file in files:
        if file.name not in existing:
            missing.append(file)
            continue
        # Existing names are never overwritten. Verify their bytes before treating
        # them as published; divergent content fails closed.
        path = Path('existing-release-assets')
        path.mkdir(exist_ok=True)
        run_gh('release', 'download', tag, '-R', repo, '-p', file.name, '-D', str(path))
        downloaded = path / file.name
        if not downloaded.is_file() or sha256(downloaded.read_bytes()) != sha256(file.read_bytes()):
            raise PublicationBlocked(f'Existing release asset conflicts: {file.name}')
    return missing


def publish(root, env, do_publish=False):
    repo, commit, run_id, acceptance = parse_request(env)
    # Read candidate run metadata, then download exactly that artifact. Fail on
    # duplicate/expired artifacts; no searching for "latest" or prior versions.
    candidate = api(repo, f'actions/runs/{run_id}')
    if (candidate.get('name') != 'Prepare Tavi release candidate'
        or candidate.get('event') != 'workflow_dispatch'
        or candidate.get('status') != 'completed'
        or candidate.get('conclusion') != 'success'
        or candidate.get('head_sha', '').lower() != commit):
        raise PublicationBlocked('Candidate workflow identity mismatch')
    artifacts = api(repo, f'actions/runs/{run_id}/artifacts?per_page=100')['artifacts']
    name = f'tavi-candidate-{SCOPE}-{commit}'
    matches = [a for a in artifacts if a.get('name') == name and not a.get('expired', True)]
    if len(matches) != 1:
        raise PublicationBlocked('Expected exactly one non-expired candidate artifact')
    root.mkdir(exist_ok=False)
    run_gh('run', 'download', str(run_id), '-R', repo, '-n', name, '-D', str(root))
    version, out, _ = inspect_candidate(root, repo, commit)
    verify_github_evidence(repo, commit, run_id, version)
    tag, release = verify_release_target(repo, commit, version)
    files = [out / name for name in expected_names(version)] + [out / 'SHA256SUMS.txt']
    missing = inspect_existing_assets(repo, tag, release, out, files)
    if not do_publish:
        print(f'VERIFIED (NOT PUBLISHED): {tag} from candidate run {run_id}; {len(missing)} assets to add')
        return 0
    if release is None:
        notes = root / 'approved-release-notes.md'
        notes.write_text(
            f'# Tavi {version} — Windows and Android\n\n'
            f'Accepted candidate: `{run_id}` at commit `{commit}`.\n'
            f'Operator acceptance reference: `{acceptance}`.\n\n'
            'This release includes Windows x64 NSIS and signed Android ARM64 installers. '
            'Linux and macOS are not included in this release.\n', encoding='utf-8')
        run_gh('release', 'create', tag, *(str(file) for file in files), '-R', repo,
               '--target', commit, '--title', f'Tavi {tag}', '--notes-file', str(notes))
    elif missing:
        run_gh('release', 'upload', tag, *(str(file) for file in missing), '-R', repo)
    print(f'RELEASE ASSETS PUBLISHED: {tag} candidate={run_id} acceptance={acceptance} added={len(missing)}')
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true', help='Perform approved GitHub write (default: read-only verification)')
    args = parser.parse_args()
    return publish(Path('downloaded-candidate'), os.environ, do_publish=args.publish)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (PublicationBlocked, ValueError, KeyError, OSError, json.JSONDecodeError) as e:
        raise SystemExit(f'PUBLICATION BLOCKED: {e}')
