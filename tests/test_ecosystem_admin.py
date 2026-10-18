"""Admin promotion, trusted application events, role revocation and rollback."""
import asyncio
import hashlib
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
import yaml

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from looprd_handler import execute,principal_id
from looprd_verifier import verify,service_identity,GUEST_CREDENTIAL,lookup_session
from admin_event_service import handle as deliver_service,build_interaction
from admin_role_service import handle as lookup_service


class EcosystemAdminTests(unittest.TestCase):
    def setUp(self):
        self.spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        self.engine=sa.create_engine('sqlite+pysqlite:///:memory:',connect_args={'check_same_thread':False},poolclass=sa.pool.StaticPool)
        md=sa.MetaData()
        for name,model in self.spec['models'].items():
            fields=[]
            for field,options in model['fields'].items():
                datatype={'integer':sa.Integer,'string':sa.String(options.get('maxLength',128)),
                    'boolean':sa.Boolean,'json':sa.JSON}[options['type']]
                fields.append(sa.Column(field,datatype,primary_key=options.get('primaryKey',False),
                    autoincrement=options.get('generated',False),nullable=not options.get('required',False),
                    unique=options.get('unique',False)))
            sa.Table(name,md,*fields)
        md.create_all(self.engine)
        self.sessions=sessionmaker(self.engine)
        self.calls=[]
        self.principal=SimpleNamespace(kind='service',subject='looprd-life')

    def tearDown(self):
        self.engine.dispose()

    def register(self,name):
        result=execute({'op':'register','username':name,'password':'long password 123!'},self.sessions,tokens={})[0]
        self.assertTrue(result['ok'],result)
        return result

    def promote(self,account,on=True):
        action=self.spec['management']['actions']['promote-admin' if on else 'revoke-admin']
        namespace={}
        exec(action['source'],namespace)
        class Context:
            recordId=int(account['profileId'][5:])
            def update(inner,resource,identity,values):
                assert resource=='accounts'
                assert identity==inner.recordId
                assert set(values)=={'ecosystemAdmin'}
                with self.sessions.begin() as db:
                    db.execute(sa.text('UPDATE "SocialAccount" SET "ecosystemAdmin"=:value WHERE id=:id'),
                        {'value':values['ecosystemAdmin'],'id':identity})
        namespace['handle'](Context())

    def service(self,body,fail_emit=False):
        def emit(session,event):
            if fail_emit:
                raise RuntimeError('durable outbox down')
            self.calls.append(('emit',event))
        def notify(session,recipient):
            self.calls.append(('notify',recipient))
        ctx=SimpleNamespace(principal=self.principal,body=body,transaction=self.sessions.begin,
                            emit=emit,notify=notify,session_factory=self.sessions)
        return asyncio.run(deliver_service(ctx))

    def feed(self,account):
        return execute({'op':'interaction_feed','token':account['token']},self.sessions,tokens={})[0]

    def test_declaration_is_private_and_password_hash_not_managed(self):
        spec=self.spec
        self.assertIn('management.data',spec['requires'])
        self.assertEqual(spec['database']['schemaVersion'],8)
        self.assertEqual(spec['resources']['accounts']['permissions']['list'],['social:operator'])
        self.assertEqual(spec['resources']['accounts']['permissions']['get'],['social:operator'])
        self.assertNotIn('passwordHash',spec['resources']['accounts']['projection'])
        self.assertNotIn('passwordHash',spec['management']['resources']['accounts']['fields'])
        self.assertFalse(spec['management']['resources']['accounts']['fields']['ecosystemAdmin'].get('editable',False))
        self.assertNotIn('social:operator',lookup_session.__globals__['USER_SCOPES'])
        self.assertNotIn('social:service',lookup_session.__globals__['USER_SCOPES'])

    def test_default_role_is_false_and_cannot_be_self_promoted(self):
        account=self.register('alice')
        self.assertFalse(self.feed(account)['events'])
        me=execute({'op':'me','token':account['token'],'ecosystemAdmin':True},self.sessions,tokens={})[0]
        self.assertFalse(me['permissions']['ecosystemAdmin'])
        self.assertFalse(execute({'op':'save_profile','token':account['token'],
            'profile':{'schema':'looprd.social.profile/v1','displayName':'Alice','ecosystemAdmin':True}},
            self.sessions,tokens={})[0]['ok'])
        self.promote(account)
        self.assertTrue(execute({'op':'me','token':account['token']},self.sessions,tokens={})[0]['permissions']['ecosystemAdmin'])
        self.promote(account,False)
        self.assertFalse(execute({'op':'me','token':account['token']},self.sessions,tokens={})[0]['permissions']['ecosystemAdmin'])

    def test_service_secret_only_mapped_private_component(self):
        token='z'*50
        with patch.dict(os.environ,{'LOOPRD_SOCIAL_SERVICE_SECRETS_JSON':json.dumps({'looprd-life':'tavi/services/life'})}):
            reader=lambda ref: token if ref=='tavi/services/life' else ''
            claimed=service_identity(token,reader)
            self.assertEqual(claimed['kind'],'service')
            self.assertEqual(claimed['subject'],'looprd-life')
            self.assertEqual(claimed['scopes'],['social:service'])
            self.assertIsNone(service_identity('wrong'*10,reader))
            self.assertIsNone(service_identity(GUEST_CREDENTIAL,reader))
            async def run(fn,*args):return fn(*args)
            identity=asyncio.run(verify(SimpleNamespace(credential=token,secret=reader,run=run,session_factory=self.sessions)))
            self.assertEqual(identity['subject'],'looprd-life')
            self.assertNotIn('social:operator',identity['scopes'])
        self.assertIsNone(service_identity(token,lambda ref: token))

    def test_only_promoted_accounts_receive_service_notifications_and_revoke_hides(self):
        alice,bob,carol=[self.register(name) for name in ('alice','bob','carol')]
        self.promote(alice)
        self.promote(bob)
        result=self.service({'topic':'life.bugs.new','title':'Life bug #42',
          'body':'Review a reported issue','url':'https://life.example.com/reports/42','ttlSeconds':3600})
        self.assertEqual(result,{'accepted':True,'recipients':2})
        self.assertEqual([item for kind,item in self.calls if kind=='notify'],
                         [principal_id(alice['profileId']),principal_id(bob['profileId'])])
        self.assertEqual(len([item for kind,item in self.calls if kind=='emit']),1)
        self.assertEqual(len(self.feed(alice)['events']),1)
        self.assertEqual(len(self.feed(bob)['events']),1)
        self.assertEqual(len(self.feed(carol)['events']),0)
        event=self.feed(alice)['events'][0]
        self.assertEqual(event['publisher'],'service:looprd-life')
        self.assertEqual(event['actions'][0]['type'],'open-url')
        self.promote(alice,False)
        self.assertEqual(self.feed(alice)['events'],[])
        denied=execute({'op':'interaction_reply','token':alice['token'],'id':event['id'],
                        'action':'acknowledge','values':{}},self.sessions,tokens={})[0]
        self.assertFalse(denied['ok'])
        self.assertEqual(len(self.feed(bob)['events']),1)

    def test_ack_event_can_be_answered_and_private_role_lookup(self):
        alice,bob=self.register('alice'),self.register('bob')
        self.promote(alice)
        result=self.service({'topic':'server.maintenance','title':'Maintenance notice'})
        self.assertEqual(result['recipients'],1)
        event=self.feed(alice)['events'][0]
        self.assertEqual(event['actions'][0]['type'],'reply')
        response=execute({'op':'interaction_reply','token':alice['token'],'id':event['id'],
            'action':'acknowledge','values':{}},self.sessions,tokens={})[0]
        self.assertTrue(response['ok'],response)
        self.assertEqual(asyncio.run(lookup_service(SimpleNamespace(principal=self.principal,
                          body={'subject':alice['profileId']},session_factory=self.sessions))),{'admin':True})
        self.assertEqual(asyncio.run(lookup_service(SimpleNamespace(principal=self.principal,
                          body={'subject':bob['profileId']},session_factory=self.sessions))),{'admin':False})
        self.promote(alice,False)
        self.assertEqual(asyncio.run(lookup_service(SimpleNamespace(principal=self.principal,
                          body={'subject':alice['profileId']},session_factory=self.sessions))),{'admin':False})

    def test_rejects_unsafe_links_and_transaction_rolls_back(self):
        alice=self.register('alice')
        self.promote(alice)
        for url in ('http://example.com','https://localhost/admin',
                    'https://127.0.0.1/admin','https://example.com/#token','https://a.local/health'):
            self.assertIsNone(build_interaction({'topic':'life.report','title':'Bad', 'url':url}),url)
            self.assertEqual(self.service({'topic':'life.report','title':'Bad','url':url})['accepted'],False)
        with self.assertRaisesRegex(RuntimeError,'durable outbox down'):
            self.service({'topic':'life.report','title':'Rollback'},fail_emit=True)
        self.assertFalse(self.feed(alice)['events'])
        with self.sessions() as db:
            self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "SocialInteraction"')).scalar(),0)
            self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "SocialPulse"')).scalar(),0)

    def test_legacy_schema_adds_disabled_role_without_erasing_data(self):
        with self.engine.begin() as db:
            db.execute(sa.text('CREATE TABLE IF NOT EXISTS "PreviousAccount" (id INTEGER PRIMARY KEY, handle VARCHAR(32))'))
            db.execute(sa.text("INSERT INTO PreviousAccount (id,handle) VALUES (1,'legacy')"))
        previous=sa.create_engine('sqlite+pysqlite:///:memory:')
        try:
            with previous.begin() as db:
                db.execute(sa.text('CREATE TABLE "SocialAccount" (id INTEGER PRIMARY KEY, "handle" VARCHAR(32) NOT NULL, "developerEnabled" BOOLEAN NOT NULL)'))
                db.execute(sa.text("INSERT INTO \"SocialAccount\" VALUES (1,'alice',1)"))
                db.execute(sa.text(next(m for m in self.spec['database']['migrations'] if m['version']==6)['statements'][0]))
                self.assertEqual(db.execute(sa.text('SELECT "ecosystemAdmin" FROM "SocialAccount"')).scalar(),0)
                self.assertEqual(db.execute(sa.text('SELECT "developerEnabled" FROM "SocialAccount"')).scalar(),1)
        finally:
            previous.dispose()

if __name__=='__main__':unittest.main()
