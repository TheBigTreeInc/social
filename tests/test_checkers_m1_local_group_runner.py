"""Local group orchestrator unit regressions; NOT two-client game QA evidence."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
module_path = ROOT / 'tools' / 'checkers_m1_local_group.py'
spec = importlib.util.spec_from_file_location('dgn_m1_local_group', module_path)
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


class ExactSourcePreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def mkzip(self, project, version='0.5.62', special=None, add=None):
        info = qa.SPECS[project]
        prefix = 'atrium' if project == 'atrium' else 'looprd-social'
        filename = self.base / f'{prefix}-{version}-test-ziprunner.zip'
        if project == 'atrium':
            filename = self.base / f'atrium-{version}-ziprunner.zip'
        files = dict.fromkeys(info['mandatory'], '// source test fixture placeholder\n')
        files['package.json'] = json.dumps({'name': project, 'version': version})
        files['looprd.yaml'] = 'handlers: []\n'
        if special:
            files.update(special)
        if add:
            files.update(add)
        with ZipFile(filename, 'w') as archive:
            for name, payload in files.items():
                archive.writestr(name, payload)
        return filename

    def test_social_exact_package_preflight(self):
        z = self.mkzip('looprd-social', '0.3.123')
        meta = qa.inspect_zip(z, 'looprd-social')
        self.assertEqual(meta['version'], '0.3.123')
        self.assertEqual(meta['sha256'], hashlib.sha256(z.read_bytes()).hexdigest())
        self.assertTrue(meta['source_boundaries_checked'])

    def test_atrium_exact_package_preflight(self):
        meta = qa.inspect_zip(self.mkzip('atrium'), 'atrium')
        self.assertEqual(meta['version'], '0.5.62')

    def test_ziprunner_hashed_stable_filenames_accepted(self):
        z = self.mkzip('atrium')
        stable = self.base / 'atrium-0.5.62-ziprunner-0123456789abcdef.zip'
        z.rename(stable)
        self.assertEqual(qa.inspect_zip(stable, 'atrium')['version'], '0.5.62')
        social = self.mkzip('looprd-social', '0.3.123')
        renamed = self.base / 'looprd-social-0.3.123-test-ziprunner-0123456789abcdef.zip'
        social.rename(renamed)
        self.assertEqual(qa.inspect_zip(renamed, 'looprd-social')['version'], '0.3.123')

    def test_atrium_stable_zip_copy_is_byte_identical_for_own_runner(self):
        z = self.mkzip('atrium')
        stable = self.base / 'atrium-0.5.62-ziprunner-0123456789abcdef.zip'
        z.rename(stable)
        info = qa.inspect_zip(stable, 'atrium')
        evidence = self.base / 'atrium-qa.json'
        def fake_subprocess(command, **kw):
            expected = Path(command[3])
            self.assertEqual(expected.name, 'atrium-0.5.62-ziprunner.zip')
            self.assertEqual(hashlib.sha256(expected.read_bytes()).hexdigest(), info['sha256'])
            evidence.write_text(json.dumps({
                'schema':'atrium.checkers-group-test/v1','project':'atrium',
                'version':'0.5.62','scope':'EXACT_PACKAGE_EXTRACTED',
                'input_zip_sha256':info['sha256'],'passed':True,
                'production_activated':False,'operator_accepted':False,
                'network':'disposable_loopback_http','executed':6,
                'assertions':[{'status':'passed'} for _ in range(6)]}))
            return type('Result', (), {'returncode':0})()
        with patch.object(qa.subprocess, 'run', side_effect=fake_subprocess):
            summary=qa.run_component(stable, info, evidence, self.base / 'scratch')
        self.assertEqual(summary['assertions_passed'], 6)

    def test_reject_archive_traversal(self):
        z = self.mkzip('atrium', add={'../unsafe.py': 'x'})
        with self.assertRaisesRegex(qa.GroupQAError, 'unsafe_archive_member'):
            qa.inspect_zip(z, 'atrium')

    def test_reject_filename_version_mismatch(self):
        z = self.mkzip('atrium')
        z.rename(self.base/'atrium-0.5.60-ziprunner.zip')
        with self.assertRaisesRegex(qa.GroupQAError, 'filename_version_mismatch'):
            qa.inspect_zip(self.base/'atrium-0.5.60-ziprunner.zip', 'atrium')

    def test_reject_missing_engine(self):
        z = self.base/'atrium-0.5.62-ziprunner.zip'
        with ZipFile(z, 'w') as archive:
            archive.writestr('package.json', '{"name":"atrium","version":"0.5.62"}')
        with self.assertRaisesRegex(qa.GroupQAError, 'missing_required_source'):
            qa.inspect_zip(z, 'atrium')

    def test_reject_social_client_game_authority(self):
        z = self.mkzip('looprd-social', '0.3.123',
                       special={'client/src/main.js':'var game = new CheckersEngine();'})
        with self.assertRaisesRegex(qa.GroupQAError, 'social_client_has_checkers_authority'):
            qa.inspect_zip(z, 'looprd-social')

    def test_reject_generic_atrium_game_rules(self):
        z = self.mkzip('atrium', special={'looprd.yaml':'def legal_moves(board):\n  pass\n'})
        with self.assertRaisesRegex(qa.GroupQAError, 'atrium_generic_root_has_game_rules'):
            qa.inspect_zip(z, 'atrium')

    def test_blocked_summary_on_evidence_execution_failure(self):
        s = self.mkzip('looprd-social', '0.3.123')
        a = self.mkzip('atrium')
        with patch.object(qa, 'run_component', side_effect=qa.GroupQAError('fixture_failure')):
            result = qa.execute(s, a, self.base/'result.json')
        self.assertFalse(result['passed'])
        self.assertEqual(result['error'], 'fixture_failure')
        self.assertFalse(json.loads((self.base/'result.json').read_text())['operator_accepted'])

    def test_group_evidence_does_not_claim_live(self):
        s = self.mkzip('looprd-social', '0.3.123')
        a = self.mkzip('atrium')
        def verified_component(_z, item, _p, _d):
            return {'scope':'EXACT_PACKAGE_EXTRACTED', 'passed':True, 'assertions_passed':9,
                    'evidence_sha256':'abc', 'network':'disposable_loopback_http'}
        with patch.object(qa, 'run_component', side_effect=verified_component):
            result = qa.execute(s, a, self.base/'result.json')
        self.assertTrue(result['passed'])
        self.assertFalse(result['real_tavi_browser_match_proven'])
        self.assertFalse(result['github_used'])
        self.assertFalse(result['public_release_authorized'])

    def test_environment_excludes_credentials(self):
        with patch.dict(qa.os.environ, {'GH_TOKEN':'secret','LOOPRD_AUTH':'secret',
                                        'TAVI_PRIVATE_KEY':'secret','PATH':'safe'}, clear=True):
            env=qa._environment()
        self.assertEqual(env['PATH'],'safe')
        self.assertNotIn('GH_TOKEN',env)
        self.assertNotIn('LOOPRD_AUTH',env)
        self.assertNotIn('TAVI_PRIVATE_KEY',env)


if __name__ == '__main__':
    unittest.main()
