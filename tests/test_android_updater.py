"""Test the generated Android project overlay without an Android SDK."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'tools/configure-android-updater.py'
spec=importlib.util.spec_from_file_location('tavi_android_overlay',SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AndroidUpdaterOverlayTests(unittest.TestCase):
    def test_overlay_injects_provider_and_native_plugin_idempotently(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp)/'app/src/main'
            app=base/'java/inc/thebigtree/looprdsocial'
            app.mkdir(parents=True)
            (base/'AndroidManifest.xml').write_text('''<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="Tavi"></application></manifest>''')
            (app/'MainActivity.kt').write_text('package inc.thebigtree.looprdsocial\nclass MainActivity {}\n')
            with patch.object(module,'ROOT',base):
                module.apply()
                module.apply()
            manifest=(base/'AndroidManifest.xml').read_text()
            self.assertEqual(manifest.count('android.permission.REQUEST_INSTALL_PACKAGES'),1)
            self.assertEqual(manifest.count('androidx.core.content.FileProvider'),0)
            self.assertEqual(manifest.count('TaviInstallResultReceiver'),1)
            self.assertIn('android:exported="false"',manifest)
            self.assertNotIn('${applicationId}.taviupdates',manifest)
            plugin=(app/'TaviUpdaterPlugin.kt').read_text()
            self.assertIn('package inc.thebigtree.looprdsocial',plugin)
            self.assertIn('import app.tauri.plugin.JSObject',plugin)
            self.assertNotIn('import app.tauri.JSObject',plugin)
            self.assertIn('DownloadManager.Request',plugin)
            self.assertIn('PackageInstaller.SessionParams',plugin)
            self.assertIn('TaviInstallResultReceiver::class.java',plugin)
            resultReceiver=(app/'TaviInstallResultReceiver.kt').read_text()
            self.assertIn('PackageInstaller.STATUS_PENDING_USER_ACTION',resultReceiver)
            self.assertIn('FLAG_ACTIVITY_NEW_TASK',resultReceiver)
            self.assertIn('fun testRelease(invoke: Invoke)',plugin)
            self.assertIn('fun updateStatus(invoke: Invoke)',plugin)
            self.assertIn('sameSigner(current, candidate)',plugin)
            self.assertNotIn('Intent.ACTION_VIEW)',plugin)
            self.assertIn('parseArgs(InstallReleaseArgs::class.java)',plugin)
            self.assertFalse((base/'res/xml/tavi_update_paths.xml').exists())

    def test_missing_generated_project_is_error(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(module,'ROOT',Path(temp)):
                with self.assertRaisesRegex(RuntimeError,'not generated'):
                    module.apply()

if __name__=='__main__':unittest.main()
