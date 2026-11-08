"""Exact-candidate Windows/Android publication controls and idempotent releases."""
import base64
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'publish-approved-release.py'
spec = importlib.util.spec_from_file_location('tavi_publish_approved_release', MODULE)
pub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pub)
SHA = 'a'*40
REPO = 'TheBigTreeInc/social'
RUN_ID = 42529963171
VERSION = '0.3.150'
ENV = {'GH_REPO': REPO, 'CANDIDATE_SHA': SHA, 'CANDIDATE_RUN_ID': str(RUN_ID),
       'CANDIDATE_SCOPE': 'windows-android', 'PUBLICATION_CONFIRMATION': pub.CONFIRM,
       'OPERATOR_ACCEPTANCE_REF': 'ZipRunner-operator-acceptance-0.3.150'}


def zip_installer(name, body):
    stream = io.BytesIO()
    with ZipFile(stream, 'w') as zipfile:
        zipfile.writestr(name, body)
    return stream.getvalue()


def candidate_at(root, *, tamper=False):
    root.mkdir(parents=True, exist_ok=True)
    out = root/'release-assets'
    out.mkdir()
    windows = b'MZ' + b'W'*1_000_100
    android = b'PK' + b'A'*1_000_100
    files = {
        f'looprd-social-windows-nsis-{VERSION}.zip': zip_installer('tavi-setup.exe', windows),
        f'tavi-android-arm64-signed-release-{VERSION}.zip': zip_installer('android-release.apk', android),
        f'tavi-windows-x64-v{VERSION}-setup.exe': windows,
        f'tavi-android-arm64-v{VERSION}.apk': android,
    }
    checks = {name: pub.sha256(contents) for name, contents in files.items()}
    for name, contents in files.items():
        (out/name).write_bytes(contents)
    (out/'SHA256SUMS.txt').write_text(''.join(f'{checks[name]}  {name}\n' for name in sorted(checks)))
    manifest = {'schema':'tavi.release-candidate/v1', 'repository':REPO,
                'commit_sha':SHA,'version':VERSION,'scope':'windows-android',
                'status':'ci_passed_operator_unverified', 'publication_authorized':False,
                'operator_acceptance':'pending',
                'required_workflows':list(pub.REQUIRED_WORKFLOWS),
                'workflow_runs':{name:{'id':100+i,'attempt':1,'conclusion':'success'}
                                 for i,name in enumerate(pub.REQUIRED_WORKFLOWS)},
                'assets_sha256':checks}
    (root/'release-candidate.json').write_text(json.dumps(manifest))
    if tamper:
        (out/f'tavi-android-arm64-v{VERSION}.apk').write_bytes(b'tampered')
    return manifest


class PublishApprovedReleaseTests(unittest.TestCase):
    def test_requires_confirmation_scope_acceptance_and_exact_run(self):
        pub.parse_request(ENV)
        for field, bad in [('PUBLICATION_CONFIRMATION','YES'),
                           ('CANDIDATE_SHA','main'), ('CANDIDATE_RUN_ID','0'),
                           ('CANDIDATE_SCOPE','full'), ('OPERATOR_ACCEPTANCE_REF','')]:
            with self.subTest(field=field), self.assertRaises(pub.PublicationBlocked):
                pub.parse_request({**ENV,field:bad})

    def test_candidate_checksum_and_metadata_match(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir)/'candidate'
            candidate_at(root)
            version, out, sha=pub.inspect_candidate(root,REPO,SHA)
            self.assertEqual(version,VERSION)
            self.assertEqual(len(sha),4)
            self.assertTrue((out/'SHA256SUMS.txt').exists())

    def test_modified_bytes_are_rejected(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir)/'candidate'
            candidate_at(root,tamper=True)
            with self.assertRaisesRegex(pub.PublicationBlocked,'checksum mismatch'):
                pub.inspect_candidate(root,REPO,SHA)

    def test_modified_standalone_installer_is_rejected_even_with_updated_hash(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir)/'candidate'
            manifest=candidate_at(root)
            p=root/'release-assets'/f'tavi-android-arm64-v{VERSION}.apk'
            p.write_bytes(b'PK'+b'Q'*1_000_100)
            manifest['assets_sha256'][p.name]=pub.sha256(p.read_bytes())
            (root/'release-candidate.json').write_text(json.dumps(manifest))
            (p.parent/'SHA256SUMS.txt').write_text(''.join(f'{manifest["assets_sha256"][name]}  {name}\n' for name in sorted(manifest['assets_sha256'])))
            with self.assertRaisesRegex(pub.PublicationBlocked,'does not match original CI artifact'):
                pub.inspect_candidate(root,REPO,SHA)

    def test_manifest_requires_all_four_required_workflows(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir)/'candidate'
            record=candidate_at(root)
            record['required_workflows'].remove('Tavi browser UI QA')
            (root/'release-candidate.json').write_text(json.dumps(record))
            with self.assertRaisesRegex(pub.PublicationBlocked,'required CI workflow'):
                pub.inspect_candidate(root,REPO,SHA)

    def test_existing_wrong_tag_is_rejected(self):
        with patch.object(pub, 'api', side_effect=[{'tag_name':'v0.3.150','assets':[]}, {'sha':'b'*40}]):
            with self.assertRaisesRegex(pub.PublicationBlocked,'different commit'):
                pub.verify_release_target(REPO,SHA,VERSION)

    def test_existing_matching_tag_can_be_filled_even_when_main_advanced(self):
        with patch.object(pub, 'api', side_effect=[{'tag_name':'v0.3.150','assets':[]}, {'sha':SHA}]) as call:
            tag, release=pub.verify_release_target(REPO,SHA,VERSION)
            self.assertEqual(tag,'v0.3.150')
            self.assertIsNotNone(release)
            self.assertEqual(call.call_count,2)  # No need to compare to current main

    def test_missing_release_cannot_be_created_for_old_commit(self):
        with patch.object(pub,'api',side_effect=[None,None,{'commit':{'sha':'b'*40}}]):
            with self.assertRaisesRegex(pub.PublicationBlocked,'current main'):
                pub.verify_release_target(REPO,SHA,VERSION)

    def test_workflow_manual_and_separate_publish_permissions(self):
        wf=(MODULE.parents[1]/'.github/workflows/publish-approved-release.yml').read_text()
        self.assertIn('workflow_dispatch:',wf)
        self.assertNotIn('  push:',wf)
        self.assertNotIn('  workflow_run:',wf)
        self.assertIn('contents: write',wf)
        self.assertIn('name: tavi-public-release',wf)
        self.assertIn('needs: verify',wf)
        self.assertIn('python tools/publish-approved-release.py --publish',wf)
        original=(MODULE.parents[1]/'.github/workflows/release.yml').read_text()
        self.assertNotIn('contents: write', original)
        self.assertNotIn('gh release create', original)

    def test_only_adds_missing_assets_to_existing_release(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir)/'candidate'
            candidate_at(root)
            out=root/'release-assets'
            files=[out/name for name in pub.expected_names(VERSION)]+[out/'SHA256SUMS.txt']
            existing={'tag_name':'v0.3.150','assets':[{'name':files[0].name}]}
            old=os.getcwd()
            try:
                os.chdir(dir)
                def fake_gh(*args,**kwargs):
                    if args[:2]==('release','download'):
                        Path('existing-release-assets').mkdir(exist_ok=True)
                        (Path('existing-release-assets')/files[0].name).write_bytes(files[0].read_bytes())
                        return ''
                    raise AssertionError('Unexpected GH call')
                with patch.object(pub,'run_gh',side_effect=fake_gh):
                    missing=pub.inspect_existing_assets(REPO, 'v0.3.150', existing, out, files)
                self.assertEqual(len(missing),4)
                self.assertNotIn(files[0],missing)
            finally:
                os.chdir(old)

    def test_conflicting_existing_release_asset_blocks_without_clobbering(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir)/'candidate'
            candidate_at(root)
            out=root/'release-assets'
            file=out/f'tavi-android-arm64-v{VERSION}.apk'
            old=os.getcwd()
            try:
                os.chdir(dir)
                def fake_gh(*args,**kwargs):
                    (Path('existing-release-assets')).mkdir(exist_ok=True)
                    (Path('existing-release-assets')/file.name).write_bytes(b'wrong existing bytes')
                    return ''
                with patch.object(pub,'run_gh',side_effect=fake_gh):
                    with self.assertRaisesRegex(pub.PublicationBlocked,'conflicts'):
                        pub.inspect_existing_assets(REPO,'v0.3.150',{'assets':[{'name':file.name}]},out,[file])
            finally:
                os.chdir(old)

    def test_integrated_verify_is_read_only_and_publish_appends_existing_release(self):
        from shutil import copytree
        with tempfile.TemporaryDirectory() as dir:
            base=Path(dir)
            fixture=base/'fixture'
            candidate_at(fixture)
            operations=[]
            run_meta={'name':'Prepare Tavi release candidate', 'event':'workflow_dispatch',
                      'status':'completed','conclusion':'success','head_sha':SHA}
            artifact={'artifacts':[{'name':f'tavi-candidate-windows-android-{SHA}', 'expired':False}]}
            version_contents=base64.b64encode(json.dumps({'version':VERSION}).encode()).decode()
            def fake_api(repo, path, missing_ok=False):
                if path==f'actions/runs/{RUN_ID}':return run_meta
                if path==f'actions/runs/{RUN_ID}/artifacts?per_page=100':return artifact
                if path==f'contents/package.json?ref={SHA}':return {'encoding':'base64','content':version_contents}
                if path==f'releases/tags/v{VERSION}':return {'tag_name':f'v{VERSION}', 'assets':[], 'draft':False}
                if path==f'commits/v{VERSION}':return {'sha':SHA}
                raise AssertionError(path)
            def fake_gh(*args,**kwargs):
                operations.append(args)
                if args[:2]==('run','download'):
                    destination=Path(args[args.index('-D')+1])
                    copytree(fixture, destination, dirs_exist_ok=True)
                    return ''
                if args[:2]==('release','upload'):
                    self.assertEqual(args[2],f'v{VERSION}')
                    self.assertEqual(len(args[3:-2]),5)
                    self.assertNotIn('--clobber',args)
                    return ''
                raise AssertionError(args)
            with patch.object(pub,'api',side_effect=fake_api), patch.object(pub,'run_gh',side_effect=fake_gh):
                self.assertEqual(pub.publish(base/'verified', ENV, do_publish=False),0)
                self.assertEqual([x[0:2] for x in operations],[('run','download')])
                self.assertEqual(pub.publish(base/'accepted', ENV, do_publish=True),0)
                self.assertEqual([x[0:2] for x in operations],[('run','download'),('run','download'),('release','upload')])

    def test_integrated_rejects_wrong_tag_without_upload(self):
        from shutil import copytree
        with tempfile.TemporaryDirectory() as dir:
            base=Path(dir);fixture=base/'fixture';candidate_at(fixture)
            operations=[]
            def fake_api(repo,path,missing_ok=False):
                if path==f'actions/runs/{RUN_ID}':return {'name':'Prepare Tavi release candidate','event':'workflow_dispatch', 'status':'completed','conclusion':'success','head_sha':SHA}
                if path==f'actions/runs/{RUN_ID}/artifacts?per_page=100':return {'artifacts':[{'name':f'tavi-candidate-windows-android-{SHA}','expired':False}]}
                if path==f'contents/package.json?ref={SHA}':return {'encoding':'base64','content':base64.b64encode(json.dumps({'version':VERSION}).encode()).decode()}
                if path==f'releases/tags/v{VERSION}':return {'tag_name':f'v{VERSION}','assets':[]}
                if path==f'commits/v{VERSION}':return {'sha':'b'*40}
                raise AssertionError(path)
            def fake_gh(*args,**kwargs):
                operations.append(args)
                if args[:2]==('run','download'):
                    copytree(fixture,Path(args[args.index('-D')+1]),dirs_exist_ok=True)
                    return ''
                raise AssertionError('Unexpected GitHub release write')
            with patch.object(pub,'api',side_effect=fake_api), patch.object(pub,'run_gh',side_effect=fake_gh):
                with self.assertRaisesRegex(pub.PublicationBlocked,'different commit'):
                    pub.publish(base/'accepted',ENV,do_publish=True)
            self.assertEqual([x[:2] for x in operations],[('run','download')])

    def test_exact_candidate_run_metadata_and_source_version_are_required(self):
        data={'name':'Prepare Tavi release candidate','event':'workflow_dispatch',
              'status':'completed','conclusion':'success','head_sha':SHA}
        artifacts={'artifacts':[{'name':f'tavi-candidate-windows-android-{SHA}','expired':False}]}
        contents=base64.b64encode(json.dumps({'version':VERSION}).encode()).decode()
        with patch.object(pub,'api',side_effect=[data,artifacts,{'encoding':'base64','content':contents}]):
            pub.verify_github_evidence(REPO,SHA,RUN_ID,VERSION)
        data['conclusion']='failure'
        with patch.object(pub,'api',side_effect=[data]):
            with self.assertRaisesRegex(pub.PublicationBlocked,'identity or success'):
                pub.verify_github_evidence(REPO,SHA,RUN_ID,VERSION)

if __name__=='__main__':
    unittest.main()
