"""Release candidate gating must be strict, non-publishing and exact-SHA."""
import importlib.util
import json
import os
import tempfile
from unittest.mock import patch
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'release-gate.py'
spec = importlib.util.spec_from_file_location('tavi_release_gate', MODULE)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
SHA = 'a' * 40


def run(name, *, conclusion='success', status='completed', event='push', sha=SHA, attempt=1):
    return {'name': name, 'event': event, 'head_sha': sha, 'head_branch': 'main',
            'run_number': 3, 'run_attempt': attempt, 'status': status,
            'conclusion': conclusion, 'id': 123}


class ReleaseCandidateTests(unittest.TestCase):
    def test_exact_sha_validation(self):
        with self.assertRaises(gate.CandidateBlocked):
            gate.require_exact_sha('main')
        with self.assertRaises(gate.CandidateBlocked):
            gate.require_exact_sha('abc')
        self.assertEqual(gate.require_exact_sha(SHA.upper()), SHA)

    def test_required_workflows_include_browser_ui(self):
        self.assertIn('Tavi browser UI QA', gate.REQUIRED)
        self.assertEqual(len(gate.REQUIRED), 8)

    def test_missing_workflow_blocks_instead_of_succeeding_silently(self):
        with self.assertRaisesRegex(gate.CandidateBlocked, 'MISSING'):
            gate.select_successful_push_runs([], SHA)

    def test_failed_or_cancelled_workflow_blocks(self):
        for conclusion in ('failure', 'cancelled', 'skipped', None):
            with self.subTest(conclusion=conclusion):
                runs = [run(name, conclusion=conclusion if name == 'Windows desktop app' else 'success')
                        for name in gate.REQUIRED]
                with self.assertRaisesRegex(gate.CandidateBlocked, 'BLOCKED: Windows desktop app'):
                    gate.select_successful_push_runs(runs, SHA)

    def test_in_progress_workflow_blocks(self):
        runs = [run(name, status='in_progress' if name == 'Android phone app' else 'completed')
                for name in gate.REQUIRED]
        with self.assertRaisesRegex(gate.CandidateBlocked, 'Android phone app'):
            gate.select_successful_push_runs(runs, SHA)

    def test_exact_commit_push_only(self):
        for event in ('pull_request', 'workflow_dispatch', 'push'):
            runs = [run(name, event=event, sha=SHA if event != 'push' else 'b'*40)
                    for name in gate.REQUIRED]
            with self.subTest(event=event), self.assertRaisesRegex(gate.CandidateBlocked, 'MISSING'):
                gate.select_successful_push_runs(runs, SHA)

    def test_latest_attempt_must_be_successful(self):
        runs = [run(name) for name in gate.REQUIRED]
        runs.append(run('Windows desktop app', conclusion='failure', attempt=2))
        with self.assertRaisesRegex(gate.CandidateBlocked, 'BLOCKED: Windows desktop app'):
            gate.select_successful_push_runs(runs, SHA)
        runs[-1]['conclusion'] = 'success'
        self.assertEqual(len(gate.select_successful_push_runs(runs, SHA)), 8)


    def test_successful_read_only_check_does_not_create_release_assets(self):
        runs = [run(name) for name in gate.REQUIRED]
        artifacts = [dict(name=name, expired=False)
                     for bundle_names in gate.REQUIRED.values() for name in bundle_names]

        def fake_gh(*args):
            path = args[1]
            if path == 'repos/owner/repo/branches/main':
                return SHA
            if path.startswith('repos/owner/repo/actions/runs?'):
                return json.dumps({'workflow_runs': runs})
            if path.endswith('/artifacts?per_page=100'):
                return json.dumps({'artifacts': artifacts})
            raise AssertionError(f'unexpected gh access: {args}')

        class Proc:
            returncode = 0
            stdout = SHA

        with tempfile.TemporaryDirectory() as folder:
            cwd = Path.cwd()
            try:
                os.chdir(folder)
                Path('package.json').write_text('{"version":"0.3.131"}')
                env = {'GH_REPO': 'owner/repo', 'RELEASE_SHA': SHA,
                       'CANDIDATE_CHECK_ONLY': '1'}
                with patch.dict(os.environ, env), patch.object(gate, 'gh', fake_gh), patch.object(gate.subprocess, 'run', return_value=Proc()):
                    self.assertEqual(gate.candidate(), 0)
                self.assertFalse(Path('release-assets').exists())
                self.assertFalse(Path('release-candidate.json').exists())
            finally:
                os.chdir(cwd)

    def test_candidate_workflow_cannot_publish_or_auto_run(self):
        workflow = (MODULE.parents[1]/'.github/workflows/release.yml').read_text()
        self.assertIn('workflow_dispatch:', workflow)
        self.assertNotIn('workflow_run:', workflow)
        self.assertNotIn('push:', workflow)
        self.assertNotIn('contents: write', workflow)
        self.assertNotIn('gh release create', workflow)
        self.assertIn('tavi-candidate-', workflow)

    def test_pages_is_manual_not_auto_published_on_push(self):
        workflow = (MODULE.parents[1]/'.github/workflows/pages.yml').read_text()
        self.assertIn('workflow_dispatch:', workflow)
        self.assertNotIn('  push:', workflow)
        self.assertNotIn('  workflow_run:', workflow)
        self.assertIn('Explicit publication confirmation missing', workflow)
        self.assertIn('name: github-pages', workflow)
        self.assertIn('required_reviewers', workflow)
        self.assertIn('CANDIDATE_CHECK_ONLY:', workflow)

    def test_version_match_is_newline_portable(self):
        version_test = (MODULE.parents[1]/'client/tests/client-version-source-122.test.mjs').read_text()
        self.assertIn("replaceAll('\\r\\n','\\n')", version_test)

    def test_browser_qa_exercises_context_menu_instead_of_stars(self):
        ui = (MODULE.parents[1]/'client/tools/ui-qa.mjs').read_text()
        self.assertIn("page.keyboard.press('Shift+F10')", ui)
        self.assertIn("name:'Add to Favorites'", ui)
        self.assertNotIn('data-app-favorite="builtin:portrait"', ui)


if __name__ == '__main__':
    unittest.main()
