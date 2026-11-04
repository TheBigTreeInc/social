"""Checkers M1: two real Social account fixtures, no Checkers rules or invented seat.

This proves source-level service responses expected by Atrium 0.5.43+;
no network deployment, Checkers match engine, Tavi client or operator approval.
"""
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'server'))
import test_account_flow as social_fixture
from atrium_challenge_lookup import verify as challenge_verify
from atrium_contact_lookup import verify as contact_verify

ISSUER = 'looprd-social-fixture'
CATALOG = json.dumps([{'id':'checkers','name':'Checkers','url':'https://game.example.org/','embedded':True}])


class CheckersM1SocialContractTests(unittest.TestCase):
    call = social_fixture.AccountFlow.call
    reg = social_fixture.AccountFlow.reg

    def setUp(self):
        social_fixture.AccountFlow.setUp(self)
        self.env = patch.dict(os.environ, {
            'TAVI_GAME_CATALOG_JSON':CATALOG,
            'LOOPRD_TAVI_CHALLENGE_READ_CALLERS':'atrium',
            'LOOPRD_TAVI_SOCIAL_ISSUER':ISSUER,
        })
        self.env.start()
        self.alice = self.reg('alice')
        self.bob = self.reg('bob')
        self.other = self.reg('other')
        self.principal = SimpleNamespace(kind='service',subject='atrium')

    def tearDown(self):
        self.env.stop()
        social_fixture.AccountFlow.tearDown(self)

    def friends(self):
        self.assertTrue(self.call(op='contact_request',token=self.alice['token'],username='bob')['ok'])
        self.assertTrue(self.call(op='contact_accept',token=self.bob['token'],peer=self.alice['profileId'])['ok'])

    def challenge(self, id, **change):
        body = {'schema':'atrium.social-challenge-status/v1','challengeId':id}
        body.update(change)
        ctx = SimpleNamespace(body=body,principal=self.principal,transaction=self.sessions.begin)
        with patch('atrium_challenge_lookup.time.time',return_value=1000000):
            return challenge_verify(ctx)

    def contact(self, sender=None, recipient=None, **change):
        body = {'schema':'atrium.social-contact-status/v1', 'issuer':ISSUER,
                'sender':sender or self.alice['profileId'],
                'recipient':recipient or self.bob['profileId']}
        body.update(change)
        ctx = SimpleNamespace(body=body,principal=self.principal,transaction=self.sessions.begin)
        return contact_verify(ctx)

    def issue(self):
        result=self.call(op='game_challenge_send',token=self.alice['token'],peer=self.bob['profileId'],gameId='checkers')
        self.assertTrue(result['ok'],result)
        return result['id']

    def test_checkers_challenge_is_catalog_gated_friends_only(self):
        self.assertFalse(self.call(op='game_challenge_send',token=self.alice['token'],peer=self.bob['profileId'],gameId='checkers')['ok'])
        self.friends()
        self.assertFalse(self.call(op='game_challenge_send',token=self.alice['token'],peer=self.bob['profileId'],gameId='life')['ok'])
        self.assertFalse(self.call(op='game_challenge_send',token=self.alice['token'],peer=self.other['profileId'],gameId='checkers')['ok'])
        id=self.issue()
        looked=self.challenge(id)
        self.assertEqual(looked, {'schema':'atrium.social-challenge-status/v1','challengeId':id,
                                  'issuer':ISSUER,'sender':self.alice['profileId'],
                                  'recipient':self.bob['profileId'],'gameId':'checkers',
                                  'status':'pending','original':True})
        self.assertNotIn('token',str(looked).lower())

    def test_accept_status_and_current_friendship_are_independent(self):
        self.friends()
        id=self.issue()
        self.assertEqual(self.contact()['accepted'],True)
        self.assertTrue(self.call(op='interaction_reply',token=self.bob['token'],id=id,
                                  action='accept-challenge',values={})['ok'])
        self.assertEqual(self.challenge(id)['status'],'accepted')
        self.assertEqual(self.call(op='game_room_list',token=self.bob['token'])['rooms'],[])
        self.assertFalse(self.call(op='game_grant_issue',token=self.bob['token'],
                                   publisher='atrium',gameId='checkers',matchId='match_0123456789')['ok'])
        self.assertTrue(self.call(op='contact_remove',token=self.alice['token'],
                                  peer=self.bob['profileId'])['ok'])
        self.assertFalse(self.contact()['accepted'])
        # An accepted historical challenge is NOT a currently authorized relationship.
        self.assertEqual(self.challenge(id)['status'],'accepted')

    def test_decline_dismiss_and_expired_challenges_fail_closed_for_admission(self):
        self.friends()
        id=self.issue()
        self.assertTrue(self.call(op='interaction_reply',token=self.bob['token'],id=id,
                                  action='decline-challenge',values={})['ok'])
        self.assertEqual(self.challenge(id)['status'],'declined')
        id=self.issue()
        self.assertTrue(self.call(op='interaction_dismiss',token=self.bob['token'],id=id)['ok'])
        self.assertEqual(self.challenge(id)['status'],'cancelled')
        id=self.issue()
        with patch('atrium_challenge_lookup.time.time',return_value=1000000+2*86400+1):
            ctx=SimpleNamespace(body={'schema':'atrium.social-challenge-status/v1','challengeId':id},
                 principal=self.principal,transaction=self.sessions.begin)
            self.assertEqual(challenge_verify(ctx)['status'],'expired')

    def test_wrong_principal_and_operator_binding_reject(self):
        self.friends();id=self.issue()
        ctx=SimpleNamespace(body={'schema':'atrium.social-challenge-status/v1','challengeId':id},
                            principal=SimpleNamespace(kind='user',subject='atrium'),transaction=self.sessions.begin)
        self.assertEqual(challenge_verify(ctx)['reason'],'caller_not_approved')
        ctx.principal=SimpleNamespace(kind='service',subject='other')
        self.assertEqual(challenge_verify(ctx)['reason'],'caller_not_approved')
        with patch.dict(os.environ,{'LOOPRD_TAVI_CHALLENGE_READ_CALLERS':''}):
            self.assertEqual(self.challenge(id)['reason'],'caller_not_approved')
            self.assertEqual(self.contact()['reason'],'caller_not_approved')
        with patch.dict(os.environ,{'LOOPRD_TAVI_SOCIAL_ISSUER':''}):
            self.assertEqual(self.challenge(id)['reason'],'issuer_binding_required')
            self.assertEqual(self.contact()['reason'],'issuer_binding_required')

    def test_forged_client_fields_and_unrelated_events_cannot_prove_challenge(self):
        self.friends();id=self.issue()
        self.assertEqual(self.challenge(id,gameId='checkers')['reason'],'invalid_request')
        self.assertEqual(self.challenge(True)['reason'],'invalid_request')
        self.assertEqual(self.challenge(id+999)['reason'],'challenge_not_found')
        self.assertEqual(self.contact(issuer='forged')['reason'],'invalid_request')
        self.assertEqual(self.contact(sender=self.alice['profileId'],recipient=self.alice['profileId'])['reason'],'invalid_request')
        self.assertEqual(self.contact(sender=self.other['profileId'])['accepted'],False)

    def test_generated_looprd_contracts_are_gated_and_game_neutral(self):
        handlers={x['path']:x for x in self.spec['handlers']}
        expected=('/ecosystem/atrium-challenge-status','/ecosystem/atrium-contact-status')
        for route in expected:
            item=handlers[route]
            self.assertEqual(item['scopes'],['social:service'])
            self.assertTrue(item['contract']['serviceOnly'])
            self.assertEqual(item['contract']['allowedCallers'],['atrium'])
            self.assertNotIn('CheckersEngine',item['source'])
            self.assertNotIn('src.checkers',item['source'])
        self.assertIn('/ecosystem/challenge-status',handlers)
        self.assertEqual(handlers[expected[0]]['contract']['request']['properties']['schema']['enum'],
                         ['atrium.social-challenge-status/v1'])

if __name__=='__main__':
    unittest.main()
