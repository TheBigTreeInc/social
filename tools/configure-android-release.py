"""Patch Tauri-generated Android Gradle Kotlin DSL to use an existing release keystore.
Never prints secrets; fails closed when the expected signing block is missing.
"""
import os
from pathlib import Path
import sys

REQUIRED = ('TAVI_ANDROID_KEYSTORE_PATH','TAVI_ANDROID_KEYSTORE_PASSWORD',
            'TAVI_ANDROID_KEY_ALIAS','TAVI_ANDROID_KEY_PASSWORD')

def configure(source):
    if source.count('signingConfigs {') or source.count('signingConfig = signingConfigs.getByName("release")'):
        raise ValueError('Refusing to overwrite an existing signing configuration')
    if 'android {' not in source or 'buildTypes {' not in source or 'getByName("release") {' not in source:
        raise ValueError('Unexpected Tauri Android Gradle layout; update signing integration')
    signing = """
    signingConfigs {
        create("taviRelease") {
            storeFile = file(System.getenv("TAVI_ANDROID_KEYSTORE_PATH"))
            storePassword = System.getenv("TAVI_ANDROID_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("TAVI_ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("TAVI_ANDROID_KEY_PASSWORD")
        }
    }
"""
    source=source.replace('android {','android {'+signing,1)
    source=source.replace('getByName("release") {','getByName("release") {\n            signingConfig = signingConfigs.getByName("taviRelease")',1)
    return source

if __name__=='__main__':
    missing=[k for k in REQUIRED if not os.getenv(k)]
    if missing:sys.exit('Missing required Android signing environment: '+', '.join(missing))
    target=Path(__file__).resolve().parent.parent/'client/src-tauri/gen/android/app/build.gradle.kts'
    if not target.is_file():sys.exit('Android Gradle project not generated')
    target.write_text(configure(target.read_text()))
    print('Android release signing configured using GitHub secrets')
