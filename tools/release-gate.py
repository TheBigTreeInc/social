"""Release only when all required workflows passed for the same current main SHA.

Requires gh CLI with actions:read and contents:write permissions. No tag is
created here; publication happens only after every artifact was downloaded.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

REQUIRED = {
    'Verify Social server and client source': (),
    'Windows desktop app': ('looprd-social-windows-nsis',),
    'Android phone app': ('tavi-android-arm64-signed-release',),
    'Linux and macOS desktop installers': ('tavi-linux-amd64-deb', 'tavi-macos-apple-silicon-dmg'),
    'Web browser client and JavaScript SDK': ('social-web-client',),
    'SDK cross-platform checks': (),
    'SDK source packages and OpenClaw bridge': ('tavi-sdk-and-openclaw-source-packages',),
    'Tavi browser UI QA': (),  # Required: UI must pass before any release is published.
}

def gh(*args):
    p = subprocess.run(['gh', *args], text=True, capture_output=True)
    if p.returncode:
        raise RuntimeError(f'gh {args[0]} failed: {p.stderr.strip()}')
    return p.stdout

def gate():
    repo = os.environ['GH_REPO']
    sha = os.environ['RELEASE_SHA']
    version = json.loads(Path('package.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Release version must be a stable semver x.y.z')
    if gh('api', f'repos/{repo}/branches/main', '--jq', '.commit.sha').strip() != sha:
        print('SKIP: a newer commit is on main; release only current main')
        return 0
    tag = f'v{version}'
    check = subprocess.run(['gh', 'release', 'view', tag, '-R', repo], capture_output=True)
    if check.returncode == 0:
        print(f'SKIP: {tag} is already published')
        return 0
    # Exact SHA and push event are required. PR/manual/tag builds never satisfy gate.
    runs = json.loads(gh('api', f'repos/{repo}/actions/runs?head_sha={sha}&per_page=100'))['workflow_runs']
    selected = {}
    for name in REQUIRED:
        candidates = [r for r in runs if r['name'] == name and r['event'] == 'push'
                      and r['head_sha'] == sha and r['head_branch'] == 'main']
        if not candidates:
            print(f'WAIT: {name} has not run for {sha}')
            return 0
        latest = max(candidates, key=lambda r: (r['run_number'], r['run_attempt']))
        if latest['status'] != 'completed':
            print(f'WAIT: {name} is still {latest["status"]}')
            return 0
        if latest['conclusion'] != 'success':
            print(f'BLOCK: {name} concluded {latest["conclusion"]}')
            return 0
        selected[name] = latest
    out = Path('release-assets')
    out.mkdir(exist_ok=True)
    for name, artifacts in REQUIRED.items():
        if not artifacts:
            continue
        run = selected[name]
        available = json.loads(gh('api', f'repos/{repo}/actions/runs/{run["id"]}/artifacts?per_page=100'))['artifacts']
        for artifact_name in artifacts:
            found = next((a for a in available if a['name'] == artifact_name and not a['expired']), None)
            if not found:
                print(f'WAIT: {name} missing artifact {artifact_name}')
                return 0
            dest = out / artifact_name
            dest.mkdir(exist_ok=True)
            gh('run', 'download', str(run['id']), '-R', repo, '-n', artifact_name, '-D', str(dest))
            if not any(p.is_file() and p.stat().st_size for p in dest.rglob('*')):
                raise RuntimeError(f'Artifact {artifact_name} was empty')
    # Flatten names for release assets; avoid collisions between artifacts.
    import zipfile
    for directory in list(out.iterdir()):
        if not directory.is_dir():
            continue
        target = out / f'{directory.name}-{version}.zip'
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
            for file in sorted(directory.rglob('*')):
                if file.is_file():
                    z.write(file, file.relative_to(directory))
        if not zipfile.is_zipfile(target):
            raise RuntimeError(f'Invalid asset {target}')
        import shutil
        shutil.rmtree(directory)
    # Direct APK for in-client Android update; keep ZIP for reproducible source artifacts.
    import hashlib
    android_bundle=out/f'tavi-android-arm64-signed-release-{version}.zip'
    with zipfile.ZipFile(android_bundle) as bundle:
        apks=[n for n in bundle.namelist() if n.endswith('.apk')]
        if len(apks)!=1:
            raise RuntimeError('Signed Android release must contain exactly one APK')
        direct_apk=out/f'tavi-android-arm64-v{version}.apk'
        direct_apk.write_bytes(bundle.read(apks[0]))
    if direct_apk.stat().st_size < 1_000_000:
        raise RuntimeError('Android APK unexpectedly small')
    checksums=''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(out.iterdir()) if p.is_file())
    (out/'SHA256SUMS.txt').write_text(checksums)
    if len(list(out.glob('*.zip'))) != 6:
        raise RuntimeError('Expected 6 release bundles')
    lines = [f'Automated release of Tavi {version} from `{sha}`.', '',
             'All required tests and platform builds succeeded for the same commit.', '',
             'Downloads include Windows NSIS, signed Android ARM64 release APK, Linux DEB, macOS DMG,',
             'web client, and SDK/OpenClaw sources. Each asset is a ZIP containing the original build output.',
             '', 'GitHub Pages deployment is independent and is not part of this release gate.',
             'Android requires a consistent release keystore and user approval to install; existing debug installations cannot be upgraded in place by the new release key. macOS may require manual approval because builds are unsigned.']
    Path('release-assets-notes.md').write_text('\n'.join(lines) + '\n')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('ready=true\n')
    print(f'READY: {tag} from {sha}')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(gate())
    except Exception as e:
        print(f'RELEASE GATE ERROR: {e}', file=sys.stderr)
        sys.exit(1)
