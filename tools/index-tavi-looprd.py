#!/usr/bin/env python3
"""Generate a public Tavi App Store index from nested publisher looprd.yaml files.

Only explicitly marked tavi.extension descriptor sections are indexed. This
never reads or publishes LoopRD auth, routes, migrations or private deployment
information and never deploys a component. PyYAML is a developer dependency.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

try:
    import yaml
except ImportError as exc:
    raise SystemExit('Install PyYAML for the publisher index tool: python -m pip install PyYAML') from exc

ALLOWED_EXTENSIONS = {'.html', '.js', '.css', '.png', '.svg', '.webp', '.json'}
ASSET_LIMIT = 1_000_000
TOTAL_LIMIT = 10_000_000

def https_base(value, label):
    u = urlparse(value)
    if u.scheme != 'https' or not u.netloc or u.username or u.password or u.query or u.fragment or u.port:
        raise ValueError(f'{label} must be an HTTPS URL without port, credentials, query or fragment')
    return value.rstrip('/') + '/'

def asset_path(folder, rel):
    if not isinstance(rel, str) or not rel or rel.startswith('/') or '\\' in rel or any(part in ('', '.', '..') for part in rel.split('/')):
        raise ValueError('Unsafe relative extension path')
    resolved = (folder / rel).resolve()
    if not resolved.is_relative_to(folder.resolve()) or not resolved.is_file() or resolved.is_symlink():
        raise ValueError(f'Extension asset missing or escaped source folder: {rel}')
    if resolved.suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Unsupported extension asset type: {rel}')
    return resolved

def generate(root, base_url, source_url, name):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError('Publisher root must be an existing directory')
    base_url = https_base(base_url, 'Distribution base')
    source_url = https_base(source_url, 'Public source repository').rstrip('/')
    results = []
    seen = set()
    # A publisher may place several apps at different nested positions.
    for descriptor in sorted(root.rglob('looprd.yaml')):
        if not descriptor.is_file() or descriptor.is_symlink() or not descriptor.resolve().is_relative_to(root):
            continue
        if descriptor.stat().st_size > 160_000:
            raise ValueError(f'Descriptor too large: {descriptor}')
        obj = yaml.safe_load(descriptor.read_text(encoding='utf-8'))
        if not isinstance(obj, dict):
            raise ValueError(f'Invalid YAML descriptor: {descriptor}')
        extra = obj.get('tavi')
        if not isinstance(extra, dict) or 'extension' not in extra:
            continue
        tavi = extra['extension']
        if obj.get('apiVersion') != 'looprd/v1' or not isinstance(obj.get('component'), str) or not obj['component']:
            raise ValueError(f'Invalid nested LoopRD identity: {descriptor}')
        if not isinstance(tavi, dict) or set(tavi) != {'manifest', 'license'}:
            raise ValueError(f'Invalid tavi.extension metadata: {descriptor}')
        license_id = tavi['license']
        if not isinstance(license_id, str) or not license_id or len(license_id)>50 or any(not (c.isalnum() or c in '.-+') for c in license_id):
            raise ValueError('Invalid SPDX license identifier')
        folder = descriptor.parent
        mf = asset_path(folder, tavi['manifest'])
        manifest = json.loads(mf.read_text(encoding='utf-8'))
        if not isinstance(manifest, dict) or manifest.get('schema') != 'tavi.extension/v1':
            raise ValueError(f'Invalid extension manifest: {mf}')
        ident = manifest.get('id')
        if not isinstance(ident, str) or not ident or ident in seen:
            raise ValueError(f'Invalid or duplicate extension ID: {ident}')
        seen.add(ident)
        if manifest.get('version') != str(obj.get('release')):
            raise ValueError(f'LoopRD release and Tavi manifest version mismatch: {ident}')
        entrypoint = manifest.get('entrypoints', {}).get('panel')
        asset_path(folder, entrypoint)
        if manifest.get('icon'):
            asset_path(folder, manifest['icon'])
        # Hash exactly what the publisher ships below the descriptor folder,
        # including its metadata; no independent claims from a public workflow.
        contents = [x for x in folder.rglob('*') if x.is_file() and not x.is_symlink()]
        total = 0
        digester = hashlib.sha256()
        for asset in sorted(contents):
            rel = asset.relative_to(folder).as_posix()
            if asset.suffix not in ALLOWED_EXTENSIONS and asset.name != 'looprd.yaml':
                raise ValueError(f'Unexpected file in extension package: {rel}')
            if any(part.startswith('.') for part in asset.relative_to(folder).parts):
                raise ValueError(f'Hidden file in extension package: {rel}')
            content = asset.read_bytes()
            if len(content) > ASSET_LIMIT:
                raise ValueError(f'Extension asset too large: {rel}')
            total += len(content)
            if total > TOTAL_LIMIT:
                raise ValueError('Extension bundle too large')
            digester.update(rel.encode('utf-8') + b'\x00' + len(content).to_bytes(8, 'big') + content)
        relative = folder.relative_to(root).as_posix()
        prefix = '' if relative == '.' else relative + '/'
        results.append({'manifest':manifest,'entrypoint':base_url + prefix + entrypoint,
                        'source':source_url,'license':license_id,
                        'release':{'revision':digester.hexdigest()}})
    return {'schema':'tavi.repository/v1','name':name,'extensions':results}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, help='Publisher source root containing nested looprd.yaml')
    parser.add_argument('--base-url', required=True, help='Reviewed public HTTPS asset root; not stored in looprd.yaml')
    parser.add_argument('--source-url', required=True, help='Public source repository URL')
    parser.add_argument('--name', default='Tavi community extensions')
    parser.add_argument('--output', required=True)
    a=parser.parse_args()
    catalog=generate(a.root,a.base_url,a.source_url,a.name)
    target=Path(a.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Indexed {len(catalog["extensions"])} extension(s) into {target}')
if __name__=='__main__':
    main()
