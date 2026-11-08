"""Regression for the LoopRD `specification_invalid` root validator on schema 13.

The reset-companion action was created in the schema-13 update without listing
its three write targets under management.resources.accounts.fields. The actual
LoopRD check_management(...) rejects such a candidate (root-level value_error).
"""
from pathlib import Path
import copy
import importlib.util
import json
import subprocess
import sys
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT/'looprd.yaml'
sys.path.insert(0, str(ROOT/'tools'))
from looprd_management_preflight import validate_management_contract


class ManagementContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = yaml.safe_load(SPEC.read_text(encoding='utf-8'))

    def test_generated_looprd_management_is_valid(self):
        self.assertIsNone(validate_management_contract(self.spec))
        fields=self.spec['management']['resources']['accounts']['fields']
        for name in ('companionSnapshot','companionRevision','companionEpoch'):
            self.assertIn(name, fields)
            self.assertFalse(fields[name].get('editable', False))
            self.assertIn(name, self.spec['models']['SocialAccount']['fields'])
        self.assertEqual(self.spec['management']['actions']['reset-companion']['writes'],{
            'accounts':['companionSnapshot','companionRevision','companionEpoch']})
        self.assertEqual(self.spec['resources']['accounts']['permissions'],{
            'list':['social:operator'],'get':['social:operator']})
        self.assertEqual(self.spec['release'],json.loads((ROOT/'server/looprd-release.json').read_text())['release'])

    def test_missing_companion_fields_reproduces_original_rejection(self):
        before=copy.deepcopy(self.spec)
        for name in ('companionSnapshot','companionRevision','companionEpoch'):
            del before['management']['resources']['accounts']['fields'][name]
        with self.assertRaisesRegex(ValueError,'reset-companion: undeclared managed write fields'):
            validate_management_contract(before)

    def test_any_missing_field_fails_closed(self):
        missing=copy.deepcopy(self.spec)
        del missing['management']['resources']['accounts']['fields']['companionEpoch']
        with self.assertRaisesRegex(ValueError,'companionEpoch'):
            validate_management_contract(missing)

    def test_write_fields_remain_read_only_to_manual_form(self):
        exposed=self.spec['management']['resources']['accounts']['fields']
        for name in ('companionSnapshot','companionRevision','companionEpoch'):
            self.assertEqual(exposed[name]['editable'],False)
        self.assertTrue(exposed['developerEnabled']['editable'])

    def test_generated_source_and_preflight_commands(self):
        for args in [['python','tools/generate-looprd.py','--check'],
                     ['python','tools/looprd_management_preflight.py']]:
            p=subprocess.run([sys.executable,*args[1:]],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(p.returncode,0,p.stdout+'\n'+p.stderr)

if __name__=='__main__': unittest.main()
