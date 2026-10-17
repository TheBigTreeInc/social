"""Guard Android release artifact discovery against generated Tauri output-layout drift."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class AndroidArtifactWorkflowTests(unittest.TestCase):
    def test_release_apk_is_checked_from_tauri_universal_directory(self):
        workflow=(ROOT/'.github/workflows/android.yml').read_text()
        self.assertIn('apk/universal/release/app-universal-release.apk',workflow)
        self.assertIn('apksigner" verify --verbose --print-certs',workflow)
        self.assertIn('outputs/tavi-release/*.apk',workflow)
        self.assertNotIn('outputs/apk/release/*.apk',workflow)
    def test_release_gate_expects_one_apk(self):
        gate=(ROOT/'tools/release-gate.py').read_text()
        self.assertIn('if len(apks)!=1:',gate)
if __name__=='__main__':unittest.main()
