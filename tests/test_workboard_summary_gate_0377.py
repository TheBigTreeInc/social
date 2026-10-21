"""Pre-overlay ZipRunner workboard field compatibility for exact source ZIPs."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('tavi_social_zip_preflight', ROOT/'tools/check-social-package.py')
PREFLIGHT=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREFLIGHT)

class WorkboardSummaryGateTests(unittest.TestCase):
    def test_all_shipped_workboard_items_have_ziprunner_valid_summaries(self):
        board=json.loads((ROOT/'.ziprunner-workboard-update.json').read_text(encoding='utf-8'))
        rows=board['implemented']+board['remaining']
        self.assertEqual(board['version'],'0.3.77')
        self.assertEqual(len(rows),121)
        self.assertEqual(len({row['id'] for row in rows}),len(rows))
        for row in rows:
            self.assertIsInstance(row.get('summary'),str,row['id'])
            self.assertTrue(row['summary'].strip(),row['id'])
            self.assertLessEqual(len(row['summary']),2000,row['id'])

    def test_archive_preflight_rejects_missing_blank_and_overlong_summary(self):
        for section in ('implemented','remaining'):
            for value in (None,'','  ','x'*2001):
                with self.subTest(section=section, value_kind=repr(value)[:24]):
                    board={'schema':'ziprunner.workboard-update.v1','project':'looprd-social','version':'0.3.77',
                        'implemented':[{'id':'TAVI-VALID','summary':'Existing source candidate','operator_checks':['QA']}],
                        'remaining':[]}
                    row={'id':'TAVI-TEST','operator_checks':['QA']}
                    if value is not None:
                        row['summary']=value
                    board[section].append(row)
                    with tempfile.TemporaryDirectory() as td:
                        zippath=pathlib.Path(td)/'bad.zip'
                        with zipfile.ZipFile(zippath,'w') as z:
                            for filename in PREFLIGHT.REQUIRED - {'.ziprunner-workboard-update.json'}:
                                z.writestr(filename,'{}' if filename.endswith('.json') else 'placeholder')
                            z.writestr('.ziprunner-workboard-update.json',json.dumps(board))
                        with self.assertRaisesRegex(ValueError,'summary must be non-empty'):
                            PREFLIGHT.verify(zippath)

if __name__ == '__main__': unittest.main()
