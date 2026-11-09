"""Version-derived, exact-commit, operator-dispatched Windows/Android release.

Reuses the existing strict artifact and tag checks. The workflow must supply
an environment approval; this script never accepts arbitrary version/run IDs.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


# Filename contains hyphens; load the existing publisher as a local module.
import importlib.util
spec = importlib.util.spec_from_file_location('approved_publisher', Path(__file__).with_name('publish-approved-release.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


def publish_local(root, env, do_publish=False):
    repo = env.get('GH_REPO', '')
    commit = env.get('CANDIDATE_SHA', '').lower()
    if not publisher.REPO_RE.fullmatch(repo) or not publisher.SHA_RE.fullmatch(commit):
        raise publisher.PublicationBlocked('Invalid repository or exact candidate SHA')
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip().lower() != commit:
        raise publisher.PublicationBlocked('Checkout differs from prepared candidate')
    record = json.loads((root / 'release-candidate.json').read_text())
    version, out, _ = publisher.inspect_candidate(root, repo, commit)
    # Revalidate required successful push runs against live GitHub metadata.
    for name, entry in record['workflow_runs'].items():
        run = publisher.api(repo, f'actions/runs/{entry["id"]}')
        if (run.get('name') != name or run.get('head_sha', '').lower() != commit
            or run.get('head_branch') != 'main' or run.get('event') != 'push'
            or run.get('status') != 'completed' or run.get('conclusion') != 'success'):
            raise publisher.PublicationBlocked(f'Invalid source workflow: {name}')
    # This release can only target the version in the checked-out source.
    source_version = json.loads(Path('package.json').read_text())['version']
    if version != source_version:
        raise publisher.PublicationBlocked('Candidate version differs from checked-out source')
    tag, release = publisher.verify_release_target(repo, commit, version)
    files = [out / name for name in publisher.expected_names(version)] + [out / 'SHA256SUMS.txt']
    missing = publisher.inspect_existing_assets(repo, tag, release, out, files)
    if not do_publish:
        print(f'VERIFIED (NOT PUBLISHED): {tag}, {len(missing)} missing assets')
        return 0
    if release is None:
        notes = root / 'approved-release-notes.md'
        notes.write_text(f'# Tavi {version} — Windows and Android\n\n'
                         f'Exact source commit: `{commit}`.\n\n'
                         'Released through the manually dispatched, environment-gated Release Tavi workflow.\n'
                         'Includes Windows x64 NSIS and signed Android ARM64 installers.\n', encoding='utf-8')
        publisher.run_gh('release', 'create', tag, *(str(p) for p in files), '-R', repo,
                         '--target', commit, '--title', f'Tavi {tag}', '--notes-file', str(notes))
    elif missing:
        publisher.run_gh('release', 'upload', tag, *(str(p) for p in missing), '-R', repo)
    print(f'PUBLISHED {tag}: {len(missing)} assets added')
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    try:
        sys.exit(publish_local(Path('downloaded-candidate'), os.environ, args.publish))
    except (publisher.PublicationBlocked, ValueError, KeyError, OSError) as error:
        sys.exit(f'PUBLICATION BLOCKED: {error}')
