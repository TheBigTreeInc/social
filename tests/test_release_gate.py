"""Release gate safety regressions: never create a release on incomplete CI."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'release-gate.py'
spec = importlib.util.spec_from_file_location('tavi_release_gate', MODULE)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class ReleaseGateTests(unittest.TestCase):
    def run_gate(self, runs, *, branch='abc', release_exists=False):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'package.json').write_text('{"version":"0.3.33"}')
            def fake_gh(*args):
                if 'branches/main' in args[1]: return branch
                if '/actions/runs?' in args[1]: return json.dumps({'workflow_runs': runs})
                raise AssertionError(f'Unexpected API: {args}')
            class Completed:
                returncode = 0 if release_exists else 1
            old = Path.cwd()
            os.chdir(root)
            try:
                with patch.dict(os.environ, {'GH_REPO':'owner/repo','RELEASE_SHA':'abc'}), patch.object(gate, 'gh', fake_gh), patch.object(gate.subprocess, 'run', return_value=Completed()):
                    self.assertEqual(gate.gate(), 0)
                    self.assertFalse((root / 'release-assets-notes.md').exists())
            finally:
                os.chdir(old)
    def test_no_release_when_required_workflows_missing(self):
        self.run_gate([])
    def test_no_release_when_main_advanced(self):
        self.run_gate([], branch='newer')
    def test_no_release_when_version_already_published(self):
        self.run_gate([], release_exists=True)
    def test_no_release_when_workflow_failed(self):
        self.run_gate([{'name':'Verify Social server and client source','event':'push','head_sha':'abc','head_branch':'main','run_number':1,'run_attempt':1,'status':'completed','conclusion':'failure'}])

if __name__ == '__main__': unittest.main()
