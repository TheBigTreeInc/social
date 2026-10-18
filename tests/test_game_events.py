"""First Tavi game-turn integration: consent, trusted service, persistence, dedupe."""
import asyncio
import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import sqlalchemy as sa
import yaml
from sqlalchemy.orm import sessionmaker

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'server'))
from looprd_handler import execute
from game_event_service import handle, principal_id, approved_atrium_url

ENV={
    'LOOPRD_TAVI_GAME_CALLERS_JSON': '{"the-life-loop":["life.loop"]}',
    'LOOPRD_TAVI_SOCIAL_ISSUER': 'social-local-issuer',
    'LOOPRD_TAVI_GAME_LABELS_JSON': '{"life.loop":"The Life Loop"}',
    'LOOPRD_TAVI_ATRIUM_BASE_URL': 'https://example.org/atrium/',
}
MATCH='match_test_012345'

class GameEventTests(TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ, ENV)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        self.engine=sa.create_engine('sqlite+pysqlite:///:memory:',connect_args={'check_same_thread':False},poolclass=sa.pool.StaticPool)
        metadata=sa.MetaData()
        for name,model in self.spec['models'].items():
            cols=[]
            for key,field in model['fields'].items():
                cls={'integer':sa.Integer,'string':sa.String(field.get('maxLength',128)),
                     'boolean':sa.Boolean,'json':sa.JSON}[field['type']]
                cols.append(sa.Column(key,cls,primary_key=field.get('primaryKey',False),
                                      autoincrement=field.get('generated',False),
                                      nullable=not field.get('required',False),unique=field.get('unique',False)))
            sa.Table(name,metadata,*cols)
        metadata.create_all(self.engine)
        # Tests must enforce the SQL uniqueness expected from migrations.
        with self.engine.begin() as db:
            for migration in self.spec['database']['migrations']:
                for statement in migration['statements']:
                    if statement.startswith('CREATE ') and ' INDEX ' in statement:db.execute(sa.text(statement))
        self.sessions=sessionmaker(self.engine)
        self.calls=[]
        self.sender=SimpleNamespace(kind='service',subject='the-life-loop')
        self.alice=self.user('alice')
        self.bob=self.user('bob')

    def tearDown(self):self.engine.dispose()
    def user(self,name):
        u=execute({'op':'register','username':name,'password':'long passphrase123!'},self.sessions,tokens={})[0]
        self.assertTrue(u['ok'],u)
        return u
    def command(self,user,op,**args):
        return execute({'op':op,'token':user['token'],**args},self.sessions,tokens={})[0]
    def subscribe(self,user=None,enabled=True):
        return self.command(user or self.alice,'game_subscription_set',
            publisher='the-life-loop',gameId='life.loop',matchId=MATCH,enabled=enabled)
    def body(self,recipient=None,event='turn_event_001',**override):
        return {'schema':'tavi.game-event/v1','kind':'turn.ready','gameId':'life.loop','matchId':MATCH,
                'eventId':event,'turnIndex':42,'recipient':{'issuer':'social-local-issuer',
                'subject':(recipient or self.alice)['profileId']},**override}
    def deliver(self,body=None,principal=None,broken=None):
        def emit(session,event):
            if broken=='emit':raise RuntimeError('broken event storage')
            self.calls.append(('emit',event))
        def notify(session,recipient):
            if broken=='notify':raise RuntimeError('broken push queue')
            self.calls.append(('notify',recipient))
        ctx=SimpleNamespace(principal=principal or self.sender,body=body or self.body(),
            transaction=self.sessions.begin,emit=emit,notify=notify)
        return asyncio.run(handle(ctx))

    def test_subscription_required_service_scoped_and_deduplicated(self):
        self.assertEqual(self.deliver()['reason'],'recipient_not_subscribed')
        self.assertTrue(self.subscribe()['enabled'])
        got=self.deliver();self.assertEqual(got['delivery'],'created')
        self.assertEqual(self.deliver()['delivery'],'duplicate')
        self.assertEqual(len([x for x in self.calls if x[0]=='notify']),1)
        self.assertEqual(self.calls[-1],('notify',principal_id(self.alice['profileId'])))
        self.assertEqual(len(self.command(self.alice,'interaction_feed')['events']),1)
        self.assertEqual(len(self.command(self.bob,'interaction_feed')['events']),0)
        page=self.command(self.alice,'game_event_feed',after=0)
        self.assertEqual(page['schema'],'tavi.game-events/v1')
        self.assertEqual(page['events'][0]['game']['turnIndex'],42)
        self.assertEqual(page['events'][0]['title'], "It's your turn · The Life Loop")
        self.assertEqual(page['events'][0]['actions'][0]['url'],'https://example.org/atrium/?game=life.loop&match=match_test_012345')
        self.assertFalse(self.command(self.bob,'game_event_feed',after=0)['events'])
        self.assertEqual(self.command(self.alice,'game_event_feed',after=page['next'])['events'],[])
        self.assertEqual(self.deliver(self.body(turnIndex=43))['reason'],'event_id_conflict')

    def test_revocation_bad_origin_and_wrong_identity(self):
        self.assertTrue(self.subscribe()['ok'])
        self.assertFalse(self.subscribe(enabled=False)['enabled'])
        self.assertEqual(self.deliver()['reason'],'recipient_not_subscribed')
        self.assertFalse(self.command(self.bob,'game_subscription_set',publisher='unknown-game',
            gameId='life.loop',matchId=MATCH,enabled=True)['ok'])
        self.assertFalse(self.command(self.bob,'game_subscription_set',publisher='the-life-loop',
            gameId='life.loop',matchId='x',enabled=True)['ok'])
        self.assertEqual(self.deliver(self.body(recipient=self.bob))['reason'],'recipient_not_subscribed')
        self.assertEqual(self.deliver({**self.body(), 'recipient':{'issuer':'foreign','subject':self.alice['profileId']}})['reason'],'invalid_or_unapproved_event')
        self.assertEqual(self.deliver(principal=SimpleNamespace(kind='user',subject='the-life-loop'))['reason'],'service_identity_required')
        self.assertEqual(self.deliver(self.body(gameId='other.loop'))['reason'],'invalid_or_unapproved_event')
        self.assertEqual(self.deliver(self.body(kind='invite.created'))['reason'],'invalid_or_unapproved_event')

    def test_transactional_rollback_and_safe_fallback(self):
        self.subscribe()
        with self.assertRaisesRegex(RuntimeError,'broken event storage'):self.deliver(broken='emit')
        with self.sessions() as db:
            self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "SocialGameDelivery"')).scalar(),0)
            self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "SocialInteraction"')).scalar(),0)
        with self.assertRaisesRegex(RuntimeError,'broken push queue'):self.deliver(broken='notify')
        self.assertEqual(self.deliver()['delivery'],'created')
        with patch.dict(os.environ,{'LOOPRD_TAVI_ATRIUM_BASE_URL':'https://127.0.0.1/private'}):
            self.assertIsNone(approved_atrium_url('life.loop',MATCH))
            self.assertEqual(self.deliver(self.body(event='turn_event_002'))['delivery'],'created')
            self.assertEqual(self.command(self.alice,'game_event_feed',after=0)['events'][-1]['actions'][0]['type'],'reply')

    def test_migration_additive_and_new_service_contract(self):
        self.assertEqual(self.spec['database']['schemaVersion'],8)
        self.assertEqual([m['version'] for m in self.spec['database']['migrations']],[2,3,4,5,6,7,8])
        handlers=[x for x in self.spec['handlers'] if x['path']=='/ecosystem/game-event']
        self.assertEqual(handlers[0]['contract']['name'],'tavi-game-event')
        self.assertEqual(handlers[0]['contract']['version'],1)
        self.assertTrue(handlers[0]['contract']['serviceOnly'])
        self.assertEqual(handlers[0]['scopes'],['social:service'])
        self.assertNotIn('game:play',self.spec['auth']['scopes'])
