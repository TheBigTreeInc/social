"""Source-level regression for the Looprd v1 Pydantic schema constraints."""
from pathlib import Path
import yaml
root=Path(__file__).resolve().parents[1]
spec=yaml.safe_load((root/'looprd.yaml').read_text())
assert spec['component']=='looprd-social'
assert spec['database']['schemaVersion']==10
assert [m['version'] for m in spec['database']['migrations']]==[2,3,4,5,6,7,8,9,10]
for name,model in spec['models'].items():
    keys=[(k,v) for k,v in model['fields'].items() if v.get('primaryKey',False)]
    assert len(keys)==1,(name,keys)
    field=keys[0][1]
    assert field.get('type')=='integer' and field.get('generated') is True,(name,keys)
for handler in spec['handlers']:
    if handler['kind']=='python': compile(handler['source'],handler['path'],'exec')
print('PASS: Social descriptor generated-key, migration and Python syntax checks')
