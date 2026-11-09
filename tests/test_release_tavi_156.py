import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('one_shot', Path(__file__).parents[1] / 'tools/release-tavi.py')
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class ReleaseTaviTests(unittest.TestCase):
    def test_reject_invalid_commit(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(mod.publisher.PublicationBlocked):
                mod.publish_local(Path(temp), {'GH_REPO': 'TheBigTreeInc/social', 'CANDIDATE_SHA': 'not-a-sha'})

    def test_reject_checkout_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(mod.subprocess, 'check_output', return_value='0' * 40):
                with self.assertRaisesRegex(mod.publisher.PublicationBlocked, 'Checkout differs'):
                    mod.publish_local(Path(temp), {'GH_REPO': 'TheBigTreeInc/social', 'CANDIDATE_SHA': '1' * 40})

    def test_workflow_is_manually_triggered(self):
        yaml = (Path(__file__).parents[1] / '.github/workflows/release-tavi.yml').read_text()
        for value in ('workflow_dispatch:', 'environment: tavi-public-release', 'release-gate.py',
                      'release-tavi.py --publish', 'actions/download-artifact@v4'):
            with self.subTest(value=value):
                self.assertIn(value, yaml)
        self.assertNotIn('candidate_sha:', yaml)


if __name__ == '__main__':
    unittest.main()
