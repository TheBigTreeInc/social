"""Review-only Windows/Android candidate without weakening the full release gate."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from unittest.mock import patch
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_scope_150', ROOT / 'tools' / 'release-gate.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
SHA = 'a' * 40


def run(name, conclusion='success'):
    return dict(name=name, event='push', head_sha=SHA, head_branch='main',
                run_number=100, run_attempt=1, status='completed', conclusion=conclusion, id=123)


class WindowsAndroidReleaseCandidateTests(unittest.TestCase):
    def test_scopes_remain_separate_and_full_stays_strict(self):
        win = gate.requirements_for_scope('windows-android')
        self.assertEqual(set(win), {
            'Verify Social server and client source', 'Windows desktop app',
            'Android phone app', 'Tavi browser UI QA'})
        self.assertEqual(set(gate.requirements_for_scope('full')), set(gate.REQUIRED))
        self.assertEqual(sum(map(len, win.values())), 2)
        self.assertEqual(sum(map(len, gate.REQUIRED.values())), 6)
        for value in ('', 'no-tests', 'win', '../full', 'all'):
            with self.subTest(value=value), self.assertRaises(gate.CandidateBlocked):
                gate.requirements_for_scope(value)

    def test_unrelated_cancelled_workflows_do_not_block_windows_android(self):
        runs = [run(n, 'cancelled' if n not in gate.SCOPES['windows-android'] else 'success')
                for n in gate.REQUIRED]
        selected = gate.select_successful_push_runs(runs, SHA, gate.SCOPES['windows-android'])
        self.assertEqual(set(selected), set(gate.SCOPES['windows-android']))
        with self.assertRaisesRegex(gate.CandidateBlocked, 'Linux and macOS desktop installers'):
            gate.select_successful_push_runs(runs, SHA, gate.REQUIRED)

    def test_windows_android_still_block_failed_missing_non_push_or_wrong_sha(self):
        required = gate.SCOPES['windows-android']
        for broken in required:
            runs = [run(n, 'failure' if n == broken else 'success') for n in required]
            with self.subTest(broken=broken), self.assertRaisesRegex(gate.CandidateBlocked, 'BLOCKED:'):
                gate.select_successful_push_runs(runs, SHA, required)
            runs = [run(n) for n in required if n != broken]
            with self.subTest(broken=broken), self.assertRaisesRegex(gate.CandidateBlocked, 'MISSING:'):
                gate.select_successful_push_runs(runs, SHA, required)
        all_runs = [run(n) for n in required]
        all_runs[0]['event'] = 'workflow_dispatch'
        with self.assertRaisesRegex(gate.CandidateBlocked, 'MISSING:'):
            gate.select_successful_push_runs(all_runs, SHA, required)
        all_runs[0]['event'] = 'push'
        all_runs[0]['head_sha'] = 'b' * 40
        with self.assertRaisesRegex(gate.CandidateBlocked, 'MISSING:'):
            gate.select_successful_push_runs(all_runs, SHA, required)

    def test_manual_workflow_exposes_scope_without_publication(self):
        yml = (ROOT / '.github/workflows/release.yml').read_text()
        self.assertIn('candidate_scope:', yml)
        self.assertIn('default: windows-android', yml)
        self.assertIn('RELEASE_SCOPE: ${{ inputs.candidate_scope }}', yml)
        self.assertIn('candidate_sha:', yml)
        self.assertIn('actions: read', yml)
        self.assertIn('contents: read', yml)
        for forbidden in ('contents: write', 'gh release create', '  push:', '  workflow_run:'):
            self.assertNotIn(forbidden, yml)

    def test_real_candidate_assembly_two_bundles_two_installers_and_no_publication(self):
        selected = [run(n) for n in gate.SCOPES['windows-android']]
        available = [{'name': n, 'expired': False} for names in gate.SCOPES['windows-android'].values() for n in names]
        exe = b'MZ' + b'X' * 1_100_000
        apk = b'PK' + b'Y' * 1_200_000
        def fake_gh(*args):
            if args[:2] == ('api', 'repos/example/social/branches/main'):
                return SHA
            if args[0] == 'api' and '/actions/runs?' in args[1]:
                return json.dumps({'workflow_runs': selected})
            if args[0] == 'api' and args[1].endswith('/artifacts?per_page=100'):
                return json.dumps({'artifacts': available})
            if args[:2] == ('run', 'download'):
                artifact = args[args.index('-n') + 1]
                folder = Path(args[args.index('-D') + 1])
                (folder / ('tavi-installer.exe' if artifact == 'looprd-social-windows-nsis' else 'tavi-release.apk')).write_bytes(
                    exe if artifact == 'looprd-social-windows-nsis' else apk)
                return ''
            raise AssertionError(args)
        class Process:
            returncode = 0
            stdout = SHA
        with tempfile.TemporaryDirectory() as folder:
            with patch.dict(os.environ, {
                'GH_REPO': 'example/social', 'RELEASE_SHA': SHA, 'RELEASE_SCOPE': 'windows-android',
                'CANDIDATE_CHECK_ONLY': ''}, clear=False), patch.object(gate, 'gh', fake_gh), \
                 patch.object(gate.subprocess, 'run', return_value=Process()):
                previous = Path.cwd()
                try:
                    os.chdir(folder)
                    Path('package.json').write_text('{"version":"0.3.150"}')
                    self.assertEqual(gate.candidate(), 0)
                    zips = list(Path('release-assets').glob('*.zip'))
                    self.assertEqual(len(zips), 2)
                    with ZipFile(next(z for z in zips if 'windows-nsis' in z.name)) as archive:
                        self.assertEqual(len([x for x in archive.namelist() if x.endswith('.exe')]), 1)
                    windows_direct = Path('release-assets/tavi-windows-x64-v0.3.150-setup.exe')
                    self.assertEqual(windows_direct.read_bytes(), exe)
                    direct = Path('release-assets/tavi-android-arm64-v0.3.150.apk')
                    self.assertEqual(direct.read_bytes(), apk)
                    record = json.loads(Path('release-candidate.json').read_text())
                    self.assertEqual(record['scope'], 'windows-android')
                    self.assertFalse(record['publication_authorized'])
                    self.assertEqual(record['operator_acceptance'], 'pending')
                    self.assertEqual(len(record['workflow_runs']), 4)
                    self.assertIn('Linux and macOS desktop installers', record['excluded_workflows'])
                    self.assertEqual(len(record['assets_sha256']), 4)
                    self.assertEqual(len(Path('release-assets/SHA256SUMS.txt').read_text().splitlines()), 4)
                    self.assertIn('Other platform workflows are outside this candidate scope',
                                  Path('release-assets-notes.md').read_text())
                finally:
                    os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
