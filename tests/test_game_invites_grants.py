"""Invitation/one-use game proof regression gates; use real SQL uniqueness constraints."""
import asyncio
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch
import os
import sqlalchemy as sa
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from test_game_events import GameEventTests, ENV, MATCH
sys.path.insert(0,str(ROOT/'server'))
from game_grant_service import handle as redeem_grant

class InvitationsAndGrants(GameEventTests):
    """Reuses the real Social fixture and its authentication/interaction helpers."""
    def make_friends(self):
        self.assertTrue(self.command(self.alice,'contact_request',username='bob')['ok'])
        self.assertTrue(self.command(self.bob,'contact_accept',peer=self.alice['profileId'])['ok'])
    def invite(self,event='trusted_invite_001',recipient=None,inviter=None,**updates):
        b=self.body(recipient=recipient or self.bob,event=event,kind='invite.created',turnIndex=0)
        b['inviter']={'issuer':ENV['LOOPRD_TAVI_SOCIAL_ISSUER'],
                      'subject':(inviter or self.alice)['profileId']}
        return {**b,**updates}
    def redeem(self, token, game='life.loop', match=MATCH, principal=None):
        ctx=SimpleNamespace(principal=principal or self.sender,
            body={'grant':token,'gameId':game,'matchId':match},transaction=self.sessions.begin)
        return asyncio.run(redeem_grant(ctx))

    def test_invite_requires_accepted_contacts_and_real_service(self):
        self.assertEqual(self.deliver(self.invite())['reason'],'not_accepted_contacts')
        self.make_friends()
        self.assertEqual(self.deliver(self.invite(),principal=SimpleNamespace(kind='user',subject='the-life-loop'))['reason'], 'service_identity_required')
        self.assertEqual(self.deliver(self.invite())['delivery'],'created')
        self.assertEqual(self.deliver(self.invite())['delivery'],'duplicate')
        events=self.command(self.bob,'game_event_feed',after=0)['events']
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]['topic'],'game.invite.created')
        self.assertEqual([a['id'] for a in events[0]['actions']],['accept-game','decline-game'])
        self.assertEqual(self.command(self.alice,'game_event_feed',after=0)['events'],[])
        self.assertFalse(self.command(self.bob,'game_grant_issue',publisher='the-life-loop',gameId='life.loop',matchId=MATCH)['ok'])
        self.assertEqual(self.deliver(self.invite(event='trusted_invite_002',inviter=self.bob))['reason'],'not_accepted_contacts')

    def test_accept_enables_notifications_and_grant_is_one_use(self):
        self.make_friends()
        self.assertEqual(self.deliver(self.invite())['delivery'],'created')
        invitation=self.command(self.bob,'game_event_feed',after=0)['events'][0]
        ack=self.command(self.bob,'interaction_reply',id=invitation['id'],action='accept-game',values={})
        self.assertTrue(ack['ok'],ack)
        self.assertFalse(self.command(self.bob,'interaction_reply',id=invitation['id'],action='accept-game',values={})['ok'])
        first=self.command(self.bob,'game_grant_issue',publisher='the-life-loop',gameId='life.loop',matchId=MATCH)
        self.assertTrue(first['ok'],first)
        self.assertEqual(len(first['grant']),43)
        self.assertNotIn(first['grant'],str(self.command(self.bob,'game_event_feed',after=0)))
        self.assertFalse(self.redeem(first['grant'],game='wrong.game')['accepted'])
        self.assertFalse(self.redeem(first['grant'],match='another_match_123')['accepted'])
        self.assertFalse(self.redeem(first['grant'],principal=SimpleNamespace(kind='service',subject='evil-game'))['accepted'])
        good=self.redeem(first['grant'])
        self.assertEqual(good,{'accepted':True,'issuer':'social-local-issuer','subject':self.bob['profileId'],
                               'gameId':'life.loop','matchId':MATCH,'scope':'game:identify'})
        self.assertFalse(self.redeem(first['grant'])['accepted'])
        # The interaction acceptance does not assert the recipient owns a game seat.
        self.assertNotIn('seat',good)
        self.assertEqual(self.deliver(self.body(recipient=self.bob,event='turn_event_bob01'))['delivery'],'created')

    def test_decline_revocation_and_logout_reject_grants(self):
        self.make_friends()
        self.deliver(self.invite())
        ref=self.command(self.bob,'game_event_feed',after=0)['events'][0]['id']
        self.assertTrue(self.command(self.bob,'interaction_reply',id=ref,action='decline-game',values={})['ok'])
        self.assertFalse(self.command(self.bob,'game_grant_issue',publisher='the-life-loop',gameId='life.loop',matchId=MATCH)['ok'])
        self.subscribe(self.bob)
        grant=self.command(self.bob,'game_grant_issue',publisher='the-life-loop',gameId='life.loop',matchId=MATCH)
        self.assertTrue(grant['ok'])
        self.subscribe(self.bob,False)
        self.assertFalse(self.redeem(grant['grant'])['accepted'])
        self.subscribe(self.bob)
        second=self.command(self.bob,'game_grant_issue',publisher='the-life-loop',gameId='life.loop',matchId=MATCH)
        self.assertTrue(second['ok'])
        self.assertTrue(self.command(self.bob,'logout')['ok'])
        self.assertFalse(self.redeem(second['grant'])['accepted'])

    def test_invite_not_accepted_after_friendship_removed(self):
        self.make_friends()
        self.deliver(self.invite())
        ref=self.command(self.bob,'game_event_feed',after=0)['events'][0]['id']
        self.assertTrue(self.command(self.alice,'contact_remove',peer=self.bob['profileId'])['ok'])
        result=self.command(self.bob,'interaction_reply',id=ref,action='accept-game',values={})
        self.assertFalse(result['ok'])

    def test_user_session_not_accepted_as_service_credential(self):
        self.subscribe(self.alice)
        grant=self.command(self.alice,'game_grant_issue',publisher='the-life-loop',gameId='life.loop',matchId=MATCH)
        self.assertFalse(self.redeem(grant['grant'],principal=SimpleNamespace(kind='user',subject='the-life-loop'))['accepted'])
        self.assertFalse(self.redeem('x'*43)['accepted'])
