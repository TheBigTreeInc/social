"""Inject native Android updater plugin into the generated Tauri Android app.
Idempotent and fail-closed: CI must run this immediately after android init.
"""
from pathlib import Path

REPO=Path(__file__).resolve().parent.parent
ROOT=REPO/'client/src-tauri/gen/android/app/src/main'
SOURCE=REPO/'tools/android-update'
def apply():
    manifest=ROOT/'AndroidManifest.xml'
    if not manifest.exists():raise RuntimeError('Tauri Android project not generated')
    text=manifest.read_text()
    if 'xmlns:android=' not in text or '</application>' not in text:raise RuntimeError('Unexpected Android manifest')
    if 'android.permission.REQUEST_INSTALL_PACKAGES' not in text:
        if '<application' not in text:raise RuntimeError('Android application tag missing')
        text=text.replace('<application', '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>\n    <application',1)
    # PackageInstaller callback must be explicit for Android 14+ mutable PendingIntents
    # and should survive WebView/activity recreation. It is never exported.
    if 'TaviInstallResultReceiver' not in text:
        text=text.replace('</application>',
            '<receiver android:name=".TaviInstallResultReceiver" android:exported="false" />\n    </application>',1)
    manifest.write_text(text)
    candidates=list((ROOT/'java').rglob('MainActivity.kt')) if (ROOT/'java').exists() else []
    if not candidates:raise RuntimeError('Generated Tauri MainActivity.kt not found')
    activity=candidates[0]
    package_line=next((line for line in activity.read_text().splitlines() if line.startswith('package ')),None)
    if not package_line:raise RuntimeError('Generated Android package name unknown')
    directory=activity.parent
    source=(SOURCE/'TaviUpdaterPlugin.kt').read_text().replace('package com.thebigtree.tavi',package_line,1)
    (directory/'TaviUpdaterPlugin.kt').write_text(source)
    callback=(SOURCE/'TaviInstallResultReceiver.kt').read_text().replace('package com.thebigtree.tavi',package_line,1)
    (directory/'TaviInstallResultReceiver.kt').write_text(callback)
    print('Android native installer bridge installed in',directory)
if __name__=='__main__':apply()
