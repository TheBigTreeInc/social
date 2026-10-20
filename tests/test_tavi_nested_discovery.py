"""Publisher-only nested looprd.yaml -> public extension index regression tests."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

try:
    import yaml  # noqa
except ImportError:
    yaml = None

TOOL=Path(__file__).resolve().parents[1]/'tools'/'index-tavi-looprd.py'
FIXTURE=Path(__file__).resolve().parents[1]/'docs'/'extension-examples'/'nested-publisher'

@unittest.skipUnless(yaml is not None, 'PyYAML optional publisher development dependency')
class NestedPublisherTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location('index_tavi_looprd',TOOL)
        cls.module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_generates_deterministic_public_index_without_deployment_address_in_source(self):
        generated=self.module.generate(FIXTURE,'https://publisher.example/extensions/','https://github.com/example/publisher','Publisher')
        self.assertEqual(generated['schema'],'tavi.repository/v1')
        self.assertEqual(len(generated['extensions']),1)
        item=generated['extensions'][0]
        self.assertEqual(item['manifest']['id'],'org.tavi.examples.notepad')
        self.assertEqual(len(item['release']['revision']),64)
        self.assertEqual(item['entrypoint'],'https://publisher.example/extensions/extensions/org.tavi.examples.notepad/ui/index.html')
        self.assertEqual(self.module.generate(FIXTURE,'https://publisher.example/extensions/','https://github.com/example/publisher','Publisher'),generated)
        nested=(FIXTURE/'extensions/org.tavi.examples.notepad/looprd.yaml').read_text()
        self.assertNotIn('publisher.example',nested)

    def test_changed_asset_updates_revision_even_when_manifest_version_same(self):
        with tempfile.TemporaryDirectory() as root:
            destination=Path(root)/'source'
            shutil.copytree(FIXTURE,destination)
            before=self.module.generate(destination,'https://publisher.example/','https://github.com/example/publisher','X')
            asset=destination/'extensions/org.tavi.examples.notepad/ui/index.html'
            asset.write_text(asset.read_text()+'\n<!-- changed -->\n')
            after=self.module.generate(destination,'https://publisher.example/','https://github.com/example/publisher','X')
            self.assertNotEqual(before['extensions'][0]['release']['revision'],after['extensions'][0]['release']['revision'])

    def test_mismatched_release_and_unsafe_paths_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            destination=Path(root)/'source'
            shutil.copytree(FIXTURE,destination)
            descriptor=destination/'extensions/org.tavi.examples.notepad/looprd.yaml'
            original=descriptor.read_text()
            descriptor.write_text(original.replace('release: 1.0.0','release: 2.0.0'))
            with self.assertRaisesRegex(ValueError,'mismatch'):
                self.module.generate(destination,'https://publisher.example/','https://github.com/example/publisher','X')
            descriptor.write_text(original.replace('manifest: manifest.json','manifest: ../secret.json'))
            with self.assertRaisesRegex(ValueError,'Unsafe'):
                self.module.generate(destination,'https://publisher.example/','https://github.com/example/publisher','X')
            with self.assertRaisesRegex(ValueError,'HTTPS'):
                self.module.generate(FIXTURE,'http://publisher.example/','https://github.com/example/publisher','X')

if __name__=='__main__':unittest.main()
