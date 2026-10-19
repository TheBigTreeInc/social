"""Social-to-Atrium trusted metadata boundary, no operator secrets to users."""
import os
import unittest
from unittest.mock import patch
from io import BytesIO
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from looprd_handler import project_atrium_discovery,fetch_atrium_discovery,execute

CATALOG={'schema':'atrium.trusted-game-catalog/v1','games':[
 {'gameId':'life.loop','publisher':'thebigtreeinc','title':'The Life Loop','status':'reviewed',
  'instances':[{'deploymentId':'main','component':'the-life-loop',
                'apiBaseUrl':'https://private.example.org/looprd/the-life-loop/v1',
                'launchAvailable':True,'launchUrl':'https://game.example.org/index.html','reason':None}]}]}
class Reply:
 status=200
 def __init__(self,raw):self.stream=BytesIO(raw)
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):return self.stream.read(n)

class AtriumCatalogTests(unittest.TestCase):
 def test_projection_removes_private_endpoint_and_never_enables_launch(self):
  g=project_atrium_discovery(CATALOG)
  self.assertEqual(g,[{'gameId':'life.loop','publisher':'thebigtreeinc','title':'The Life Loop',
                       'status':'discovered','instances':1,'hostingConfigured':True,'playable':False}])
  self.assertNotIn('private.example.org',str(g));self.assertNotIn('game.example.org',str(g))
 def test_rejects_unreviewed_duplicate_and_malformed_catalog(self):
  from copy import deepcopy
  for modified in [{'schema':'wrong','games':[]},{'schema':'atrium.trusted-game-catalog/v1','games':'oops'}]:
   with self.assertRaises(ValueError):project_atrium_discovery(modified)
  for path,value in [('status','pending'),('title','bad\nname'),('instances',[]),('gameId','../../evil')]:
   payload=deepcopy(CATALOG);payload['games'][0][path]=value
   with self.assertRaises(ValueError):project_atrium_discovery(payload)
  payload=deepcopy(CATALOG);payload['games'].append(payload['games'][0])
  with self.assertRaises(ValueError):project_atrium_discovery(payload)
 def test_disabled_without_private_runtime_config(self):
  with patch.dict(os.environ,{},clear=True):
   self.assertEqual(fetch_atrium_discovery()['status'],'not_connected')
 def test_private_service_token_not_in_projection_and_no_redirects(self):
  import json
  from looprd_handler import _NoAtriumRedirect
  secret='private_fake_token_only_for_test_123456'
  def respond(req,timeout):
   self.assertEqual(timeout,3.0)
   self.assertEqual(req.get_header('Authorization'),'Bearer '+secret)
   self.assertEqual(req.get_method(),'GET')
   self.assertEqual(req.full_url,'https://atrium.example.org/looprd/atrium/v1/registry/discovery/v2/catalog')
   return Reply(json.dumps(CATALOG).encode())
  with patch.dict(os.environ,{'LOOPRD_TAVI_ATRIUM_DISCOVERY_URL':'https://atrium.example.org/looprd/atrium/v1/registry/discovery/v2/catalog','LOOPRD_TAVI_ATRIUM_READ_TOKEN':secret}):
   with patch.object(_NoAtriumRedirect,'opener') as mocked:
    mocked.return_value.open.side_effect=respond
    result=fetch_atrium_discovery()
  self.assertEqual(result['status'],'connected')
  self.assertEqual(result['games'][0]['gameId'],'life.loop')
  self.assertNotIn(secret,str(result))
 def test_unreachable_and_invalid_cannot_fake_game(self):
  from looprd_handler import _NoAtriumRedirect
  with patch.dict(os.environ,{'LOOPRD_TAVI_ATRIUM_DISCOVERY_URL':'https://atrium.example.org/looprd/atrium/v1/registry/discovery/v2/catalog','LOOPRD_TAVI_ATRIUM_READ_TOKEN':'x'*32}):
   with patch.object(_NoAtriumRedirect,'opener') as mocked:
    mocked.return_value.open.side_effect=TimeoutError('secret='+'x'*32)
    self.assertEqual(fetch_atrium_discovery(),{'ok':True,'schema':'tavi.atrium-discovery/v1','status':'unavailable','games':[]})
   with patch.object(_NoAtriumRedirect,'opener') as mocked:
    mocked.return_value.open.return_value=Reply(b'{"schema":"wrong"}')
    self.assertEqual(fetch_atrium_discovery()['status'],'unavailable')
 def test_no_guest_access_and_no_old_manual_game_side_effect(self):
  from sqlalchemy import create_engine
  from sqlalchemy.orm import sessionmaker
  from unittest.mock import MagicMock
  sessions=MagicMock()
  response,_=execute({'op':'atrium_discovery'},sessions,principal_subject='guest')
  self.assertFalse(response['ok'])
  self.assertIn('Sign in',response['error'])
  from tests.test_looprd_social import SocialLooprdTests,TOKENS
  case=SocialLooprdTests(methodName='test_requires_dev_credential_and_isolates_profiles')
  case.setUp()
  try:
   with patch('looprd_handler.fetch_atrium_discovery',return_value={'ok':True,'schema':'tavi.atrium-discovery/v1','status':'connected','games':[]}):
    granted,_=case.call(op='atrium_discovery')
    self.assertEqual(granted['status'],'connected')
    denied,_=execute({'token':'bad','op':'atrium_discovery'},case.sessions,TOKENS)
    self.assertFalse(denied['ok'])
    mismatched,_=execute({'token':TOKENS['user_alex'],'op':'atrium_discovery'},case.sessions,TOKENS,principal_subject='user_bob')
    self.assertFalse(mismatched['ok'])
  finally:case.tearDown()
if __name__=='__main__':unittest.main()

class AtriumSharedBackendTests(unittest.TestCase):
 def test_same_backend_origin_derives_catalog_route_and_keeps_token_private(self):
  import json
  from looprd_handler import _NoAtriumRedirect
  origin='https://api.example.org'
  secret='tavi_private_read_token_1234567890'
  def respond(req,timeout):
   self.assertEqual(req.full_url,origin+'/looprd/atrium/v1/registry/discovery/v2/catalog')
   self.assertEqual(req.get_header('Authorization'),'Bearer '+secret)
   self.assertEqual(timeout,3.0)
   return Reply(json.dumps(CATALOG).encode())
  with patch.dict(os.environ,{'LOOPRD_TAVI_ATRIUM_BACKEND_ORIGIN':origin,
       'LOOPRD_TAVI_ATRIUM_DISCOVERY_URL':'', 'LOOPRD_TAVI_ATRIUM_READ_TOKEN':secret}):
   with patch.object(_NoAtriumRedirect,'opener') as mocked:
    mocked.return_value.open.side_effect=respond
    result=fetch_atrium_discovery()
  self.assertEqual(result['status'],'connected')
  self.assertEqual(result['games'][0]['title'],'The Life Loop')
  self.assertNotIn(secret,str(result));self.assertNotIn(origin,str(result))
 def test_shared_backend_never_uses_untrusted_private_or_arbitrary_routes(self):
  from looprd_handler import _NoAtriumRedirect
  with patch.dict(os.environ,{'LOOPRD_TAVI_ATRIUM_BACKEND_ORIGIN':'http://127.0.0.1:8080',
       'LOOPRD_TAVI_ATRIUM_DISCOVERY_URL':'','LOOPRD_TAVI_ATRIUM_READ_TOKEN':'x'*32}):
   with patch.object(_NoAtriumRedirect,'opener') as mocked:
    self.assertEqual(fetch_atrium_discovery()['status'],'unavailable')
    mocked.assert_not_called()
  for untrusted in ('https://api.example.org/evil','https://admin:pass@api.example.org',
                    'https://api.example.org?anything=1','https://api.example.org:8443'):
   with patch.dict(os.environ,{'LOOPRD_TAVI_ATRIUM_BACKEND_ORIGIN':untrusted,
        'LOOPRD_TAVI_ATRIUM_DISCOVERY_URL':'','LOOPRD_TAVI_ATRIUM_READ_TOKEN':'x'*32}):
    with patch.object(_NoAtriumRedirect,'opener') as mocked:
     self.assertEqual(fetch_atrium_discovery()['status'],'unavailable')
     mocked.assert_not_called()
 def test_shared_backend_requires_a_read_key(self):
  with patch.dict(os.environ,{'LOOPRD_TAVI_ATRIUM_BACKEND_ORIGIN':'https://api.example.org',
       'LOOPRD_TAVI_ATRIUM_DISCOVERY_URL':'','LOOPRD_TAVI_ATRIUM_READ_TOKEN':''}):
   self.assertEqual(fetch_atrium_discovery()['status'],'not_connected')
