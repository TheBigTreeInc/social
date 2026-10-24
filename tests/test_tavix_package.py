import hashlib, importlib.util, json, pathlib, tempfile, unittest, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('tavix_package',ROOT/'tools'/'tavix-package.py')
MOD=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(MOD)

class TaviXPackageTests(unittest.TestCase):
 def fixture(self,root):
  (root/'ui').mkdir()
  manifest={'schema':'tavi.extension/v1','id':'org.example.demo','version':'1.0.0','name':'Demo','summary':'TaviX demo','publisher':'example','kind':'app','hostApi':{'min':'1.0.0','maxExclusive':'2.0.0'},'entrypoints':{'panel':'ui/index.html'},'contributions':[{'slot':'app.launcher','id':'demo','label':'Demo','action':'openPanel'}],'permissions':['ui.panel'],'platforms':['web','windows','android']}
  (root/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
  (root/'ui'/'index.html').write_text('<!doctype html><title>Demo</title>',encoding='utf-8')
  return manifest
 def test_deterministic_package_and_archive_integrity(self):
  with tempfile.TemporaryDirectory() as td:
   root=pathlib.Path(td)/'src';root.mkdir();self.fixture(root)
   a=pathlib.Path(td)/'a.tavix';b=pathlib.Path(td)/'b.tavix'
   lock=MOD.pack(root,a);MOD.pack(root,b)
   self.assertEqual(a.read_bytes(),b.read_bytes())
   self.assertEqual(lock['schema'],'tavix.package/v1');self.assertEqual(lock['standard'],'tavix/1.0')
   checked=MOD.validate_archive(a);self.assertEqual(checked['applicationId'],'org.example.demo')
   with zipfile.ZipFile(a) as z:self.assertIn('tavix.lock.json',z.namelist())
 def test_package_rejects_symlinks_and_unknown_runtime_files(self):
  with tempfile.TemporaryDirectory() as td:
   root=pathlib.Path(td);self.fixture(root);(root/'secrets').mkdir();(root/'secrets'/'token.json').write_text('{"token":"secret"}',encoding='utf-8')
   with self.assertRaisesRegex(ValueError,'private/runtime'):MOD.validate(root)

if __name__=='__main__':unittest.main()
