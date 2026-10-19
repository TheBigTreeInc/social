"""Basic shipped contract checks. Full Draft 2020-12 checks run when jsonschema exists."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCHEMAS=['tavi.shared-resource.v1.schema.json','tavi.shared-event.v1.schema.json',
         'tavi.ledger-transfer.v1.schema.json','tavi.service.v1.schema.json',
         'tavi.extension.v2.schema.json']

class SharedContractsTest(unittest.TestCase):
 def test_schemas_parse_and_do_not_allow_extra_properties(self):
  for name in SCHEMAS:
   with self.subTest(name=name):
    schema=json.loads((ROOT/'schemas'/name).read_text())
    self.assertEqual(schema['$schema'],'https://json-schema.org/draft/2020-12/schema')
    self.assertIs(schema['additionalProperties'],False)
    self.assertEqual(schema['type'],'object')

 def test_v2_manifest_is_distinct_from_installed_v1(self):
  future=json.loads((ROOT/'docs/extension-examples/companions.v2.future.json').read_text())
  current=json.loads((ROOT/'client/public/tavi-extensions/org.tavi.examples.notepad/manifest.json').read_text())
  self.assertEqual(future['schema'],'tavi.extension/v2')
  self.assertEqual(current['schema'],'tavi.extension/v1')
  self.assertEqual(future['serviceBindings'][0]['component'],'tavi-companions')

 def test_examples_conform_to_full_json_schema_where_available(self):
  try:
   from jsonschema import Draft202012Validator
  except ImportError:
   self.skipTest('Full JSON Schema validation requires optional jsonschema dependency')
  examples={'tavi.service.v1.schema.json':'companions-service.example.json',
            'tavi.extension.v2.schema.json':'companions.v2.future.json'}
  for schema_name,example_name in examples.items():
   with self.subTest(name=example_name):
    schema=json.loads((ROOT/'schemas'/schema_name).read_text())
    example=json.loads((ROOT/'docs/extension-examples'/example_name).read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(example)

 def test_ledger_schema_rejects_fractional_or_zero_transfer(self):
  try:
   from jsonschema import Draft202012Validator, ValidationError
  except ImportError:
   self.skipTest('Full JSON Schema validation requires optional jsonschema dependency')
  schema=json.loads((ROOT/'schemas/tavi.ledger-transfer.v1.schema.json').read_text())
  ok={'schema':'tavi.ledger-transfer/v1','recipientSubject':'acct_other',
      'currencyId':'tavi:cash','amountMinor':'250','idempotencyKey':'life-match-347-award-v2'}
  Draft202012Validator(schema).validate(ok)
  for amount in ('0','2.5','-1',250):
   with self.subTest(amount=amount):
    with self.assertRaises(ValidationError):
     Draft202012Validator(schema).validate(dict(ok,amountMinor=amount))

if __name__=='__main__': unittest.main()
