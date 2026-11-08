"""Companion 0.6.43: one authenticated server slot, revision CAS and reset epoch.
Source-level SQLite tests; operator migration/deployment acceptance is separate.
"""
import json
import secrets
import sys
import unittest
from pathlib import Path
import sqlalchemy as sa
import yaml
from sqlalchemy.orm import sessionmaker

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from looprd_handler import execute


class CompanionCloud(unittest.TestCase):
    def setUp(self):
        spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        self.assertEqual(spec['database']['schemaVersion'],13)
        self.assertIn('reset-companion',spec['management']['actions'])
        self.engine=sa.create_engine('sqlite+pysqlite:///:memory:',poolclass=sa.pool.StaticPool)
        metadata=sa.MetaData()
        for name,model in spec['models'].items():
            fields=[]
            for name2,f in model['fields'].items():
                kind={'integer':sa.Integer,'string':sa.String(f.get('maxLength',128)),
                      'json':sa.JSON,'boolean':sa.Boolean}[f['type']]
                fields.append(sa.Column(name2,kind,primary_key=f.get('primaryKey',False),
                    autoincrement=f.get('generated',False),nullable=not f.get('required',False),
                    unique=f.get('unique',False)))
            sa.Table(name,metadata,*fields)
        metadata.create_all(self.engine)
        self.sessions=sessionmaker(bind=self.engine)

    def tearDown(self):self.engine.dispose()
    def call(self,**body):return execute(body,self.sessions,tokens={},now=1000000)[0]
    def signup(self,name):
        r=self.call(op='register',username=name,password='test password 1234!')
        self.assertTrue(r['ok'],r)
        return r
    def snapshot(self,name):
        base=json.loads((ROOT/'tests/fixtures/companion-0.6.43-valid-v6.json').read_text())
        base['name']=name
        return json.dumps(base,separators=(',',':'))

    def test_two_accounts_cross_device_cas_reset_epoch(self):
        alice=self.signup('alice');bob=self.signup('bob')
        a=self.call(op='companion_get',token=alice['token'])
        self.assertEqual(a['revision'],0);self.assertIsNone(a['snapshot'])
        self.assertEqual(a['schema'],'tavi.companion.cloud/v1')
        self.assertGreaterEqual(len(a['epoch']),16)
        first=self.call(op='companion_put',token=alice['token'],snapshot=self.snapshot('Cat'),
                        epoch=a['epoch'],revision=0)
        self.assertEqual(first['revision'],1)
        self.assertEqual(self.call(op='companion_get',token=alice['token'])['snapshot'],self.snapshot('Cat'))
        stale=self.call(op='companion_put',token=alice['token'],snapshot=self.snapshot('Stale'),
                        epoch=a['epoch'],revision=0)
        self.assertEqual(stale['code'],'COMPANION_CONFLICT')
        b=self.call(op='companion_get',token=bob['token'])
        self.assertIsNone(b['snapshot'])
        self.assertNotEqual(a['epoch'],b['epoch'])
        second=self.call(op='companion_put',token=alice['token'],snapshot=self.snapshot('Cat2'),
                         epoch=a['epoch'],revision=1)
        self.assertEqual(second['revision'],2)
        # Management-only reset rotates the epoch: an offline device cannot resurrect its old pet.
        new_epoch=secrets.token_urlsafe(24)
        with self.sessions.begin() as db:
            db.execute(sa.text('''UPDATE "SocialAccount" SET "companionSnapshot"=NULL,
                "companionRevision"=0,"companionEpoch"=:epoch WHERE handle='alice' '''),{'epoch':new_epoch})
        self.assertEqual(self.call(op='companion_put',token=alice['token'],snapshot=self.snapshot('Old'),
            epoch=a['epoch'],revision=2)['code'],'COMPANION_CONFLICT')
        fresh=self.call(op='companion_get',token=alice['token'])
        self.assertEqual(fresh['epoch'],new_epoch);self.assertEqual(fresh['revision'],0)
        self.assertIsNone(fresh['snapshot'])
        self.assertEqual(self.call(op='companion_get',token=bob['token'])['revision'],0)

    def test_invalid_payloads_and_unauthenticated_requests_fail_closed(self):
        a=self.signup('alice')
        me=self.call(op='companion_get',token=a['token'])
        for snapshot in ['not json', '{}',json.dumps({'schema':'tavi.companion.session/v5','chosen':True,'world':{'form':'cat'}}),
                         json.dumps({'schema':'tavi.companion.session/v6','chosen':False,'world':{'form':'cat'},'name':''}),
                         'x'*9000]:
            self.assertFalse(self.call(op='companion_put',token=a['token'],snapshot=snapshot,
                revision=0,epoch=me['epoch'])['ok'])
        self.assertFalse(self.call(op='companion_get',token='invalid')['ok'])
        self.assertFalse(self.call(op='companion_put',token=a['token'],revision=0,epoch=me['epoch'])['ok'])
        self.assertEqual(self.call(op='companion_get',token=a['token'])['revision'],0)
        # Never accept a caller-supplied account selector.
        self.assertEqual(self.call(op='companion_get',token=a['token'],target='acct_9999')['epoch'],me['epoch'])

if __name__=='__main__':unittest.main()
