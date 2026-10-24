"""Approved game-owned match rosters, opt-in and private cross-client room messages."""
import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch
import sqlalchemy as sa

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from test_game_events import GameEventTests, ENV, MATCH
sys.path.insert(0,str(ROOT/'server'))
from game_room_service import handle, room_key
from looprd_handler import execute

class Rooms(GameEventTests):
    def snapshot(self,revision=1,members=None,status='active',game='life.loop',match=MATCH):
        return {'schema':'tavi.game-room-roster/v1','gameId':game,'matchId':match,
                'revision':revision,'status':status,'members':[
            {'issuer':ENV['LOOPRD_TAVI_SOCIAL_ISSUER'],'subject':u['profileId']}
            for u in (members if members is not None else [self.alice,self.bob])]}
    def sync(self,body=None,caller=None,fail_emit=False):
        def emit(db,event):
            if fail_emit:raise RuntimeError('pulse could not be persisted')
            self.calls.append(event)
        ctx=SimpleNamespace(body=body or self.snapshot(),principal=caller or self.sender,
            transaction=self.sessions.begin,emit=emit)
        return asyncio.run(handle(ctx))
    def test_game_authoritative_roster_consent_and_isolation(self):
        self.assertEqual(self.command(self.alice,'game_room_list')['rooms'],[])
        got=self.sync();self.assertTrue(got['accepted'],got)
        room=got['roomId']
        self.assertEqual(room,room_key('the-life-loop','life.loop',MATCH))
        self.assertFalse(self.command(self.alice,'game_room_feed',roomId=room)['ok'])
        self.assertFalse(self.command(self.alice,'game_room_send',roomId=room,text='hello')['ok'])
        self.subscribe(self.alice);self.subscribe(self.bob)
        self.assertEqual(self.command(self.alice,'game_room_list')['rooms'][0]['participants'],2)
        self.assertEqual(self.command(self.bob,'game_room_list')['rooms'][0]['roomId'],room)
        self.assertTrue(self.command(self.alice,'game_room_send',roomId=room,text='  Hello from Alice  ')['ok'])
        a=self.command(self.bob,'game_room_feed',roomId=room)
        self.assertEqual(a['messages'][0]['text'],'Hello from Alice')
        self.assertEqual(a['messages'][0]['displayName'],'alice')
        self.assertFalse(self.command(self.bob,'game_room_feed',roomId='f'*64)['ok'])
        self.assertEqual(len(self.command(self.bob,'game_room_feed',roomId=room,after=a['next'])['messages']),0)
        self.subscribe(self.bob,False)
        self.assertEqual(self.command(self.bob,'game_room_list')['rooms'],[])
        self.assertFalse(self.command(self.bob,'game_room_feed',roomId=room)['ok'])
        self.assertFalse(self.command(self.bob,'game_room_send',roomId=room,text='still in?')['ok'])
    def test_versioned_roster_revoke_closed_and_replay(self):
        self.subscribe(self.alice);self.subscribe(self.bob)
        initial=self.sync();self.assertEqual(initial['delivery'],'created')
        self.assertEqual(self.sync()['delivery'],'duplicate')
        self.assertEqual(self.sync(self.snapshot(1,members=[self.bob]))['reason'],'revision_conflict')
        self.assertEqual(self.sync(self.snapshot(2,members=[self.alice]))['delivery'],'created')
        room=initial['roomId']
        self.assertFalse(self.command(self.bob,'game_room_feed',roomId=room)['ok'])
        self.assertEqual(self.sync()['reason'],'stale_revision')
        self.assertTrue(self.command(self.alice,'game_room_send',roomId=room,text='still playing')['ok'])
        closed=self.sync(self.snapshot(3,members=[],status='closed'))
        self.assertTrue(closed['accepted'])
        self.assertEqual(self.command(self.alice,'game_room_list')['rooms'],[])
        self.assertFalse(self.command(self.alice,'game_room_feed',roomId=room)['ok'])
        self.assertEqual(self.sync(self.snapshot(4,members=[self.alice]))['reason'],'room_already_closed')
    def test_reject_untrusted_and_rollback_on_emit_failure(self):
        self.assertEqual(self.sync(caller=SimpleNamespace(kind='user',subject='the-life-loop'))['reason'],'service_identity_required')
        self.assertEqual(self.sync(caller=SimpleNamespace(kind='service',subject='unapproved'))['reason'],'invalid_or_unapproved_roster')
        self.assertEqual(self.sync(self.snapshot(game='evil.game'))['reason'],'invalid_or_unapproved_roster')
        bad=self.snapshot();bad['members'][0]['issuer']='other'
        self.assertEqual(self.sync(bad)['reason'],'invalid_or_unapproved_roster')
        bad=self.snapshot();bad['members'][1]=bad['members'][0]
        self.assertEqual(self.sync(bad)['reason'],'invalid_or_unapproved_roster')
        with self.assertRaisesRegex(RuntimeError,'pulse'):self.sync(fail_emit=True)
        with self.sessions() as db:
            self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "SocialGameRoom"')).scalar(),0)
        self.assertTrue(self.sync()['accepted'])
    def test_authorized_room_message_notifies_only_other_consented_seats(self):
        from looprd_handler import process_event, principal_id
        self.subscribe(self.alice);self.subscribe(self.bob)
        self.sync()
        room=room_key('the-life-loop','life.loop',MATCH)
        notices=[];emitted=[]
        ctx=SimpleNamespace(body={'op':'game_room_send','roomId':room,
               'text':'private move discussion','token':self.alice['token']},
               principal=SimpleNamespace(kind='user',subject=self.alice['profileId']),
               session_factory=self.sessions,transaction=self.sessions.begin,
               revoke_push=None,
               emit=lambda db,event:emitted.append(event),
               notify=lambda db,target:notices.append(target))
        result=process_event(ctx)
        self.assertTrue(result['ok'],result)
        self.assertEqual(notices,[principal_id(self.bob['profileId'])])
        self.assertEqual(len(emitted),1)
        self.subscribe(self.bob,False)
        ctx.body['text']='private next move'
        import time
        with patch('looprd_handler.time.time',return_value=time.time()+2):
            self.assertTrue(process_event(ctx)['ok'])
        self.assertEqual(len(notices),1)

    def test_not_game_seat_by_consent_alone(self):
        self.subscribe(self.bob)
        room=room_key('the-life-loop','life.loop',MATCH)
        self.assertFalse(self.command(self.bob,'game_room_send',roomId=room,text='unverified seat')['ok'])
        self.sync(self.snapshot(members=[self.alice]))
        self.assertEqual(self.command(self.bob,'game_room_list')['rooms'],[])

class GameRoomMigration(TestCase):
    def test_schema9_to_10_preserves_account_and_existing_message(self):
        """Add only the new tables to an existing Social v9 database."""
        import yaml
        spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        assert spec['database']['schemaVersion']==12
        engine=sa.create_engine('sqlite+pysqlite:///:memory:')
        try:
            with engine.begin() as db:
                db.execute(sa.text('CREATE TABLE "SocialAccount" ("id" INTEGER PRIMARY KEY,"handle" TEXT,"passwordHash" TEXT)'))
                db.execute(sa.text("INSERT INTO \"SocialAccount\" VALUES (1,'alice','hash')"))
                db.execute(sa.text('CREATE TABLE "SocialDirectMessage" ("id" INTEGER PRIMARY KEY,"leftId" TEXT,"rightId" TEXT,"senderId" TEXT,"content" TEXT,"created" INTEGER)'))
                db.execute(sa.text("INSERT INTO \"SocialDirectMessage\" VALUES (1,'acct_1','acct_2','acct_1','untouched',100)"))
                statements=next(m['statements'] for m in spec['database']['migrations'] if m['version']==10)
                for statement in statements:db.execute(sa.text(statement))
                assert db.execute(sa.text('SELECT handle FROM "SocialAccount"')).scalar_one()=='alice'
                assert db.execute(sa.text('SELECT content FROM "SocialDirectMessage"')).scalar_one()=='untouched'
                for table in ['SocialGameRoom','SocialGameRoomMember','SocialGameRoomMessage']:
                    assert db.execute(sa.text('SELECT COUNT(*) FROM "'+table+'"')).scalar_one()==0
        finally:engine.dispose()
