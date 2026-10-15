#!/usr/bin/env python3
"""Standalone preliminary source-archive checks for LoopRD Social/ZipRunner.

This does NOT replace pac-labs/ziprunner-spec's upstream validator.
"""
import json
import hashlib
import re
import sys
import zipfile
from pathlib import PurePosixPath

EXPECTED='looprd-social'
REQUIRED={'.ziprunner-workboard-update.json','project.zr','looprd-social.zr','ziprunner-manifest.json',
          'ziprunner.looprd.json','looprd.yaml','server/looprd_handler.py','tools/generate-looprd.py',
          'client/package.json','client/src/main.js','client/sdk/looprd-social.js','docs/DESIGN.adoc','docs/JAVASCRIPT_CLIENT.adoc','.github/workflows/web.yml','client/src-tauri/tauri.conf.json',
          '.github/workflows/windows.yml','.github/workflows/android.yml','.github/workflows/portrait-updates.yml'}

def verify(path):
    with zipfile.ZipFile(path) as arc:
        names=arc.namelist()
        if len(set(names))!=len(names):raise ValueError('Duplicate ZIP entry')
        if not REQUIRED.issubset(names):raise ValueError('Missing required files: '+str(REQUIRED-set(names)))
        for f in arc.infolist():
            p=PurePosixPath(f.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in f.filename or f.filename.startswith('/'):
                raise ValueError('Unsafe archive path: '+f.filename)
            if (f.external_attr >> 16)&0o170000==0o120000:
                raise ValueError('Symlink entry: '+f.filename)
            if f.filename.startswith(('.git/','.data/','secrets/','client/node_modules/','client/src-tauri/target/')) or '__pycache__' in p.parts or f.filename.endswith(('.pyc','.pyo')):
                raise ValueError('Private/build-state file: '+f.filename)
        def load(name):return json.loads(arc.read(name))
        board=load('.ziprunner-workboard-update.json')
        if len(arc.read('.ziprunner-workboard-update.json'))>262144:raise ValueError('Oversize workboard')
        if board.get('schema')!='ziprunner.workboard-update.v1' or board.get('project')!=EXPECTED or not board.get('implemented'):
            raise ValueError('Invalid project workboard')
        tasks=board['implemented']+board.get('remaining',[])
        ids=[x['id'] for x in tasks]
        if len(ids)!=len(set(ids)) or not all(re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}',v) for v in ids):
            raise ValueError('Invalid workboard task IDs')
        for item in board['implemented']:
            if not item.get('operator_checks'):raise ValueError('Missing operator checks')
        recipe=load('project.zr');man=load('ziprunner-manifest.json');link=load('ziprunner.looprd.json')
        if recipe.get('project_key')!=EXPECTED or man['project']['key']!=EXPECTED or board['version']!=man['project']['version']:
            raise ValueError('Package identity/version mismatch')
        if link.get('schema')!='ziprunner.looprd-link/v1' or link.get('project')!=EXPECTED or link.get('component')!=EXPECTED or link['specification']!='looprd.yaml':
            raise ValueError('Invalid LoopRD link')
        if hashlib.sha256(arc.read('looprd.yaml')).hexdigest()!=link['specification_sha256']:
            raise ValueError('LoopRD YAML hash mismatch')
        if man['schema']!='ziprunner.update-manifest/v1':raise ValueError('Wrong supplemental manifest')
        planned={x['id'] for x in man['planned_work']}
        done={x['id'] for x in man['done_work']}
        todo={x['id'] for x in man['todo_work']}
        if done&todo or done|todo!=planned:raise ValueError('Inconsistent manifest work IDs')
        if not all(e['ref'] in names or e['ref'].startswith('https://') for item in man['done_work'] for e in item['evidence']):
            raise ValueError('Manifest evidence missing from archive')
        print(f'Source archive validated (local preflight): {path}, {len(names)} files, {EXPECTED} {board["version"]}')

if __name__=='__main__':
    try:verify(sys.argv[1])
    except (ValueError,KeyError,IndexError,zipfile.BadZipFile) as e:raise SystemExit('Package check failed: '+str(e))
