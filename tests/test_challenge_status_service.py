"""Verified Atrium challenge read; not an authorization or match grant."""
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from test_game_challenges import GameChallengeFlow
from challenge_status_service import verify

class ChallengeStatusTests(GameChallengeFlow):
 def setUp(self):
  super().setUp()
  self.permission=patch.dict(os.environ,{'LOOPRD_TAVI_CHALLENGE_READ_CALLERS':'atrium'})
  self.permission.start()
 def tearDown(self):
  self.permission.stop(); super().tearDown()
 def lookup(self,challenge_id, sender=None, recipient=None, principal=None, game='life'):
  request={'schema':'tavi.challenge-status-query/v1','challengeId':challenge_id,'gameId':game,
           'sender':sender or self.alice['profileId'],'recipient':recipient or self.bot['profileId']}
  ctx=SimpleNamespace(body=request,principal=principal or SimpleNamespace(kind='service',subject='atrium'),transaction=self.sessions.begin)
  with patch('challenge_status_service.time.time',return_value=1000000):return verify(ctx)
 def test_pending_accepted_declined_and_not_a_seat(self):
  self.friends(); id=self.issue()['id']
  self.assertEqual(self.lookup(id)['status'],'pending')
  self.assertTrue(self.call(op='interaction_reply',token=self.bot['token'],id=id,action='accept-challenge',values={})['ok'])
  self.assertEqual(self.lookup(id)['status'],'accepted')
  self.assertEqual(self.call(op='game_room_list',token=self.bot['token'])['rooms'],[])
  id2=self.issue()['id']
  self.call(op='interaction_reply',token=self.bot['token'],id=id2,action='decline-challenge',values={})
  self.assertEqual(self.lookup(id2)['status'],'declined')
 def test_caller_and_subject_validation(self):
  self.friends();id=self.issue()['id']
  self.assertEqual(self.lookup(id,recipient=self.other['profileId'])['reason'],'challenge_not_found')
  self.assertEqual(self.lookup(id,game='chess')['reason'],'challenge_not_found')
  self.assertEqual(self.lookup(id,principal=SimpleNamespace(kind='user',subject='atrium'))['reason'],'service_identity_required')
  self.assertEqual(self.lookup(id,principal=SimpleNamespace(kind='service',subject='the-life-loop'))['reason'],'caller_not_approved')
  with patch.dict(os.environ,{'LOOPRD_TAVI_CHALLENGE_READ_CALLERS':''}):
   self.assertEqual(self.lookup(id)['reason'],'caller_not_approved')
 def test_expiration_and_contract(self):
  self.friends();id=self.issue()['id']
  with patch('challenge_status_service.time.time',return_value=1000000+2*86400+1):
   ctx=SimpleNamespace(body={'schema':'tavi.challenge-status-query/v1','challengeId':id,'gameId':'life','sender':self.alice['profileId'],'recipient':self.bot['profileId']},principal=SimpleNamespace(kind='service',subject='atrium'),transaction=self.sessions.begin)
   self.assertEqual(verify(ctx)['status'],'expired')
  spec=json.loads(json.dumps(self.spec))
  entry=next(x for x in spec['handlers'] if x['path']=='/ecosystem/challenge-status')
  self.assertTrue(entry['contract']['serviceOnly']);self.assertEqual(entry['contract']['allowedCallers'],['atrium'])
  self.assertNotIn('token',str(self.lookup(id)))

if __name__=='__main__':unittest.main()
