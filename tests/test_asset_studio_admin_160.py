import hashlib
import hmac
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
import assets_studio_admin_service as module

class FakeSessions:
 def __call__(self):return self
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def execute(self,stmt,params):
  self.params=params
  return SimpleNamespace(scalar=lambda:1 if params.get('id')==2 else 0)

class FakeContext:
 def __init__(self,subject='acct_2',kind='user'):
  self.principal=SimpleNamespace(subject=subject,kind=kind,scopes=['social:api'],sessionId='session-123')
  self.body={'schema':'tavi.social.asset-studio/v1','operation':'status','params':{}}
  self.session_factory=FakeSessions()
  self.secret=lambda ref:'Z'*64

ENV={'LOOPRD_TAVI_ASSETS_STUDIO_URL':'https://looprd.example/looprd/tavi-assets/v1/studio',
 'LOOPRD_TAVI_ASSETS_INGEST_SECRET_REF':'assets-ingest','LOOPRD_TAVI_ASSETS_PUBLISH_SECRET_REF':'assets-publish',
 'LOOPRD_TAVI_ASSETS_DELEGATION_SECRET_REF':'assets-delegation'}

class AdminTransportTests(unittest.TestCase):
 def test_denied_to_nonadmin_and_services_before_transport(self):
  for ctx in [FakeContext('acct_5'),FakeContext(kind='service'),FakeContext('guest'),FakeContext('acct_0')]:
   calls=[]
   with patch.dict(os.environ,ENV):
    answer=module.dispatch(ctx,transport=lambda *x:calls.append(x))
   self.assertEqual(answer['error'],'permission_denied');self.assertFalse(calls)
 def test_fails_closed_without_config_and_for_unsafe_destination(self):
  for cfg in [{},{**ENV,'LOOPRD_TAVI_ASSETS_STUDIO_URL':'http://localhost:8080/studio'},
              {**ENV,'LOOPRD_TAVI_ASSETS_STUDIO_URL':'https://user:pass@evil.example/studio'}]:
   with patch.dict(os.environ,cfg,clear=True):
    self.assertEqual(module.dispatch(FakeContext())['error'],'unavailable')
 def test_signed_delegation_binds_actor_session_payload_and_scope(self):
  calls=[]
  def intercept(url,token,body):
   calls.append((url,token,body))
   assertion=dict(body['delegation']);sig=assertion.pop('signature')
   self.assertEqual(hmac.new(b'Z'*64,module.canonical(assertion),hashlib.sha256).hexdigest(),sig)
   self.assertEqual(assertion['actor'],'acct_2')
   self.assertEqual(assertion['audience'],'tavi-assets/studio/v1')
   self.assertEqual(assertion['requestSha256'],hashlib.sha256(module.canonical(body['params'])).hexdigest())
   return {'ok':True,'result':{'schema':'tavix.registry-admin.status/v1','allowedOperations':['status'],'apiVersion':'1.0.0'}}
  with patch.dict(os.environ,ENV):
   result=module.dispatch(FakeContext(),now=123456789,transport=intercept)
  self.assertTrue(result['ok']);self.assertEqual(len(calls),1)
  self.assertEqual(calls[0][0],ENV['LOOPRD_TAVI_ASSETS_STUDIO_URL'])
 def test_confirmation_flag_and_malformed_payload_rejected(self):
  for extra in [{'hostApproved':True},{'actor':'acct_2'},{'params':{'token':'oops'}},
                {'operation':'publish','params':{'recordId':'a'*24,'expectedRevision':2,'idempotencyKey':'b'*24}}]:
   ctx=FakeContext();ctx.body.update(extra)
   with patch.dict(os.environ,ENV):
    result=module.dispatch(ctx,transport=lambda *args:self.fail('transport should not run'))
   self.assertIn(result['error'],('invalid_request','confirmation_required'))
 def test_price_zero_is_valid_and_price_outside_bounds_denied(self):
  params={'recordId':'a'*24,'expectedRevision':2,'priceGold':0,'idempotencyKey':'b'*24}
  self.assertEqual(module.validate('price.propose',params),params)
  for bad in [-1,1000001,1.5,True]:
   with self.assertRaises(ValueError):module.validate('price.propose',{**params,'priceGold':bad})
 def test_no_app_id_or_untrusted_approval(self):
  ctx=FakeContext();ctx.body['appId']='org.tavi.tools.asset-studio'
  with patch.dict(os.environ,ENV):
   self.assertEqual(module.dispatch(ctx)['error'],'invalid_request')
 def test_generated_descriptor_is_verified_user_scoped(self):
  import yaml
  descriptor=yaml.safe_load((ROOT/'looprd.yaml').read_text())
  endpoint=[h for h in descriptor['handlers'] if h['path']=='/asset-studio']
  self.assertEqual(len(endpoint),1);self.assertEqual(endpoint[0]['scopes'],['social:api'])
  self.assertIn('current_admin',endpoint[0]['source'])
  self.assertIn('tavi.assets.studio-delegation/v1',endpoint[0]['source'])
  self.assertEqual(descriptor['database']['schemaVersion'],13)

if __name__=='__main__':unittest.main()
