"""Tavi verified session isolation and transaction-bound push recipient tests."""
import asyncio
import hashlib
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
import yaml

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from looprd_handler import execute,handle,principal_id
from looprd_verifier import GUEST_CREDENTIAL, lookup_session,verify

class PushIdentityTests(unittest.TestCase):
    def setUp(self):
        self.spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        self.engine=sa.create_engine('sqlite+pysqlite:///:memory:',connect_args={'check_same_thread':False},poolclass=sa.pool.StaticPool)
        md=sa.MetaData()
        for name,model in self.spec['models'].items():
            columns=[]
            for field_name,field in model['fields'].items():
                typ={'integer':sa.Integer,'string':sa.String(field.get('maxLength',128)),
                     'json':sa.JSON,'boolean':sa.Boolean}[field['type']]
                columns.append(sa.Column(field_name,typ,primary_key=field.get('primaryKey',False),
                             autoincrement=field.get('generated',False),nullable=not field.get('required',False),
                             unique=field.get('unique',False)))
            sa.Table(name,md,*columns)
        md.create_all(self.engine)
        self.sessions=sessionmaker(self.engine)
        self.calls=[]
    def tearDown(self):self.engine.dispose()
    def account(self,handle):
        return execute({'op':'register','username':handle,'password':'long password 1234'},self.sessions,tokens={})[0]
    def call(self,subject,body,fail_emit=False):
        def emit(db,value):
            if fail_emit:raise RuntimeError('durable event store unavailable')
            self.calls.append(('event',value))
        def notify(db,recipient):self.calls.append(('notify',recipient))
        context=SimpleNamespace(body=body,principal=SimpleNamespace(subject=subject),
              session_factory=self.sessions,transaction=self.sessions.begin,emit=emit,notify=notify)
        return asyncio.run(handle(context))
    def test_descriptor_declares_supported_verified_and_push_contracts(self):
        spec=self.spec
        self.assertEqual(spec['auth']['mode'],'verified')
        self.assertEqual(spec['auth']['realm'],'tavi-social')
        self.assertEqual(spec['push']['transport'],'unifiedpush')
        self.assertIn('push:manage',spec['auth']['scopes'])
        self.assertIn('push.unifiedpush',spec['requires'])
        self.assertEqual(spec['realtime']['delivery'],'durable')
        self.assertEqual(spec['database']['schemaVersion'],12)
        self.assertEqual(spec['auth']['verifier']['source'],(ROOT/'server/looprd_verifier.py').read_text())
        self.assertIn('http://tauri.localhost',spec['cors']['allowedOrigins'])
        self.assertEqual(spec['resources']['pulses']['permissions']['get'],['events:read'])
        self.assertEqual(spec['websocket']['permissions']['pulses'],['events:read'])
    def test_guest_cannot_use_account_or_device_scopes(self):
        async def run(function,*args):return function(*args)
        principal=asyncio.run(verify(SimpleNamespace(credential=GUEST_CREDENTIAL,
                                       session_factory=self.sessions,run=run)))
        self.assertEqual(principal['scopes'],['social:api'])
        self.assertNotIn('push:manage',principal['scopes'])
        self.assertFalse(self.call('guest',{'op':'dm_send','peer':'acct_99','text':'forged'})['ok'])
        self.assertTrue(self.call('guest',{'op':'capabilities'})['ok'])
    def test_active_account_session_is_looprd_principal_not_client_claim(self):
        alex=self.account('alice'); bob=self.account('bob')
        record=lookup_session(self.sessions,alex['token'])
        self.assertEqual(record['subject'],alex['profileId'])
        self.assertIn('push:manage',record['scopes'])
        self.assertEqual(principal_id(alex['profileId']),hashlib.sha256(('tavi-social\0'+alex['profileId']).encode()).hexdigest())
        bad=self.call(bob['profileId'],{'op':'me','token':alex['token']})
        self.assertFalse(bad['ok'])
        self.assertTrue(self.call(alex['profileId'],{'op':'me','token':alex['token']})['ok'])
        self.assertFalse(self.call(alex['profileId'],{'op':'login','username':'alice','password':'password'})['ok'])
        self.assertIsNone(lookup_session(self.sessions,'not-a-token'))
    def test_dm_atomic_event_and_verified_recipient_push(self):
        alice=self.account('alice');bob=self.account('bob')
        self.assertTrue(self.call(alice['profileId'],{'op':'contact_request','token':alice['token'],'username':'bob'})['ok'])
        self.assertIn(('notify',principal_id(bob['profileId'])),self.calls)
        self.calls.clear()
        self.assertTrue(self.call(bob['profileId'],{'op':'contact_accept','token':bob['token'],'peer':alice['profileId']})['ok'])
        self.calls.clear()
        response=self.call(alice['profileId'],{'op':'dm_send','token':alice['token'],'peer':bob['profileId'],'text':'Hello Bob'})
        self.assertTrue(response['ok'])
        self.assertEqual(sum(1 for kind,_ in self.calls if kind=='event'),1)
        self.assertEqual([v for k,v in self.calls if k=='notify'],[principal_id(bob['profileId'])])
        message=self.call(bob['profileId'],{'op':'dm_feed','token':bob['token'],'peer':alice['profileId']})
        self.assertEqual(message['messages'][0]['text'],'Hello Bob')
    def test_event_storage_failure_rolls_back_message(self):
        alice=self.account('alice');bob=self.account('bob')
        execute({'op':'contact_request','token':alice['token'],'username':'bob'},self.sessions,tokens={})
        execute({'op':'contact_accept','token':bob['token'],'peer':alice['profileId']},self.sessions,tokens={})
        with self.assertRaisesRegex(RuntimeError,'event store unavailable'):
            self.call(alice['profileId'],{'op':'dm_send','token':alice['token'],
                        'peer':bob['profileId'],'text':'must roll back'},fail_emit=True)
        self.assertEqual(self.call(bob['profileId'],{'op':'dm_feed','token':bob['token'],
                        'peer':alice['profileId']})['messages'],[])
        self.assertFalse(self.calls)
    def test_logout_revokes_verified_session_for_next_http_request(self):
        user=self.account('alice')
        self.assertTrue(self.call(user['profileId'],{'op':'logout','token':user['token']})['ok'])
        self.assertIsNone(lookup_session(self.sessions,user['token']))

if __name__=='__main__':unittest.main()
