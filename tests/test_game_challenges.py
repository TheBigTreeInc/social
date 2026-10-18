"""Account-to-account game challenge: never a Life seat or game-service invitation."""
import os
import unittest
from unittest.mock import patch
from test_account_flow import AccountFlow

CATALOG='[{"id":"life","name":"Life","url":"https://life.example.org/","embedded":true}]'

class GameChallengeFlow(unittest.TestCase):
 call=AccountFlow.call
 reg=AccountFlow.reg
 def setUp(self):
  AccountFlow.setUp(self)
  self.env=patch.dict(os.environ,{'TAVI_GAME_CATALOG_JSON':CATALOG})
  self.env.start()
  self.alice=self.reg('alice');self.bot=self.reg('pegas');self.other=self.reg('other')
 def tearDown(self):
  self.env.stop();AccountFlow.tearDown(self)
 def friends(self):
  self.assertTrue(self.call(op='contact_request',token=self.alice['token'],username='pegas')['ok'])
  self.assertTrue(self.call(op='contact_accept',token=self.bot['token'],peer=self.alice['profileId'])['ok'])
 def issue(self,peer=None,game='life'):
  return self.call(op='game_challenge_send',token=self.alice['token'],peer=peer or self.bot['profileId'],gameId=game)
 def test_challenge_requires_accepted_contacts_and_published_game(self):
  self.assertFalse(self.issue()['ok'])
  self.friends()
  self.assertFalse(self.issue(self.alice['profileId'])['ok'])
  self.assertFalse(self.issue(self.other['profileId'])['ok'])
  self.assertFalse(self.issue(game='unlisted')['ok'])
  result=self.issue();self.assertTrue(result['ok'],result)
  self.assertEqual(result['status'],'pending')
  self.assertFalse(self.issue()['ok'])
  self.assertFalse(self.call(op='interaction_feed',token=self.other['token'])['events'])
  feed=self.call(op='interaction_feed',token=self.bot['token'])['events']
  self.assertEqual(feed[0]['topic'],'game.challenge.requested')
  self.assertEqual(feed[0]['challenge']['sender'],self.alice['profileId'])
  self.assertEqual({a['id'] for a in feed[0]['actions']},{'accept-challenge','decline-challenge'})
  self.assertNotIn('token',str(feed))
 def test_accept_is_one_use_and_not_a_match(self):
  self.friends();r=self.issue();ref=r['id']
  self.assertFalse(self.call(op='interaction_reply',token=self.other['token'],id=ref,action='accept-challenge',values={})['ok'])
  self.assertFalse(self.call(op='interaction_reply',token=self.bot['token'],id=ref,action='accept-game',values={})['ok'])
  accepted=self.call(op='interaction_reply',token=self.bot['token'],id=ref,action='accept-challenge',values={})
  self.assertTrue(accepted['ok'],accepted)
  self.assertFalse(self.call(op='interaction_reply',token=self.bot['token'],id=ref,action='accept-challenge',values={})['ok'])
  notifications=self.call(op='interaction_feed',token=self.alice['token'])['events']
  self.assertEqual(len(notifications),1)
  self.assertEqual(notifications[0]['topic'],'game.challenge.response')
  self.assertEqual(notifications[0]['challenge']['decision'],'accept-challenge')
  self.assertEqual(notifications[0]['challenge']['challengeId'],ref)
  self.assertEqual(self.call(op='game_room_list',token=self.bot['token'])['rooms'],[])
  self.assertFalse(self.call(op='game_grant_issue',token=self.bot['token'],publisher='the-life-loop',gameId='life.loop',matchId='match_0123456789')['ok'])
 def test_decline_removed_contact_and_unpublished_game(self):
  self.friends();ref=self.issue()['id']
  self.assertTrue(self.call(op='contact_remove',token=self.alice['token'],peer=self.bot['profileId'])['ok'])
  self.assertFalse(self.call(op='interaction_reply',token=self.bot['token'],id=ref,action='accept-challenge',values={})['ok'])
  self.assertTrue(self.call(op='interaction_reply',token=self.bot['token'],id=ref,action='decline-challenge',values={})['ok'])
  self.assertEqual(self.call(op='interaction_feed',token=self.alice['token'])['events'][0]['challenge']['decision'],'decline-challenge')
 def test_daily_rate_limit(self):
  self.friends()
  for i in range(12):
   self.assertTrue(self.issue()['ok'])
   event=self.call(op='interaction_feed',token=self.bot['token'])['events'][0]
   self.assertTrue(self.call(op='interaction_reply',token=self.bot['token'],id=event['id'],action='decline-challenge',values={})['ok'])
  self.assertFalse(self.issue()['ok'])
