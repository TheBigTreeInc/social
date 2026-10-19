"""Guard the ZipRunner 1.2.304.129 post-update stamp contract before shipping."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
MAX_TESTS = 20


class ZipRunnerPostUpdateStampTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stamp = json.loads((ROOT / '.ziprunner-post-update-tests.json').read_text(encoding='utf-8'))
        cls.tests = cls.stamp['tests']

    def test_ziprunner_cap_is_enforced(self):
        self.assertEqual(self.stamp['schema'], 'ziprunner.post-update-tests.v1')
        self.assertGreater(len(self.tests), 0)
        self.assertLessEqual(len(self.tests), MAX_TESTS)

    def test_test_identities_are_unique_and_commands_usable(self):
        ids = [row['semantic_id'] for row in self.tests]
        self.assertEqual(len(ids), len(set(ids)))
        for row in self.tests:
            self.assertEqual(row['kind'], 'command')
            self.assertTrue(isinstance(row.get('command'), str) and row['command'].strip())
            self.assertEqual(row['rerun_policy'], 'every_update')

    def test_full_node_and_atrium_discovery_coverage_remains(self):
        commands = {row['command'] for row in self.tests}
        self.assertIn('npm run test', commands)
        self.assertIn('python -m unittest discover -s tests -p test_atrium_catalog.py -v', commands)
        self.assertIn('node --test client/tests/atrium-discovery.test.mjs', commands)
        self.assertIn('python tools/generate-looprd.py --check', commands)

    def test_stamp_matches_source_version(self):
        version = json.loads((ROOT / 'package.json').read_text())['version']
        self.assertEqual(self.stamp['version'], version)
        # Client-only Tavi releases may advance independently of the existing
        # LoopRD Social service release (no server descriptor/deployment change).
        server_version = json.loads((ROOT / 'server/looprd-release.json').read_text())['release']
        self.assertLessEqual(tuple(map(int, server_version.split('.'))), tuple(map(int, version.split('.'))))
