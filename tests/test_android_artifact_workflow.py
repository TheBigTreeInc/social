"""Guard Android release artifact discovery against generated Tauri output-layout drift."""
from pathlib import Path
import ast
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
        tree=ast.parse(gate)
        guarded=[node for node in ast.walk(tree) if isinstance(node,ast.If)
                 and isinstance(node.test,ast.Compare)
                 and isinstance(node.test.left,ast.Call)
                 and isinstance(node.test.left.func,ast.Name)
                 and node.test.left.func.id=='len'
                 and len(node.test.left.args)==1
                 and isinstance(node.test.left.args[0],ast.Name)
                 and node.test.left.args[0].id=='apks'
                 and len(node.test.ops)==1 and isinstance(node.test.ops[0],ast.NotEq)
                 and len(node.test.comparators)==1
                 and isinstance(node.test.comparators[0],ast.Constant)
                 and node.test.comparators[0].value==1]
        self.assertEqual(len(guarded),1,'Release gate must reject APK count != 1')
        self.assertTrue(any(isinstance(child,ast.Raise) for child in guarded[0].body),
                        'Release gate must fail closed on an invalid APK count')
if __name__=='__main__':unittest.main()
