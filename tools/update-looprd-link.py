#!/usr/bin/env python3
"""Write ZipRunner's optional project↔LoopRD identity/hash link (no secrets)."""
from hashlib import sha256
from json import dumps
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'looprd.yaml'
link={'schema':'ziprunner.looprd-link/v1','project':'looprd-social', 'component':'looprd-social',
      'specification':'looprd.yaml','specification_sha256':sha256(path.read_bytes()).hexdigest()}
(ROOT/'ziprunner.looprd.json').write_text(dumps(link,indent=2)+'\n', encoding='utf-8')
print('Wrote ziprunner.looprd.json for Social descriptor')
