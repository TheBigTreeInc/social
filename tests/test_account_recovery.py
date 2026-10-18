"""LRS-004: offline account recovery, session revocation and registration limits."""
import asyncio
import hashlib
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
import sqlalchemy as sa
import yaml
from sqlalchemy.orm import sessionmaker
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from looprd_handler import execute, handle, principal_id

class RecoveryFlow(unittest.TestCase):
    def setUp(self):
        self.spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        self.engine=sa.create_engine('sqlite+pysqlite:///:memory:',connect_args={'check_same_thread':False},poolclass=sa.pool.StaticPool)
        meta=sa.MetaData()
        for name,model in self.spec['models'].items():
            columns=[]
            for key,f in model['fields'].items():
                klass={'integer':sa.Integer,'string':sa.String(f.get('maxLength',128)),
                    'json':sa.JSON,'boolean':sa.Boolean}[f['type']]
                columns.append(sa.Column(key,klass,primary_key=f.get('primaryKey',False),
                    autoincrement=f.get('generated',False),nullable=not f.get('required',False),
                    unique=f.get('unique',False)))
            sa.Table(name,meta,*columns)
        meta.create_all(self.engine)
        self.sessions=sessionmaker(bind=self.engine)
    def tearDown(self):self.engine.dispose()
    def call(self,**body):return execute(body,self.sessions,tokens={},now=1000000)[0]
    def signup(self,name='alice'):
        r=self.call(op='register',username=name,password='test password 1234!')
        self.assertTrue(r['ok'],r)
        return r
    def test_codes_are_random_one_time_opaque_and_never_in_database(self):
        a=self.signup()
        r=self.call(op='recovery_codes_create',token=a['token'],password='test password 1234!')
        self.assertTrue(r['ok'],r)
        self.assertEqual(len(r['codes']),8)
        self.assertEqual(len(set(r['codes'])),8)
        self.assertTrue(all(code.startswith('TAVI-') and len(code)==44 for code in r['codes']))
        status=self.call(op='recovery_codes_status',token=a['token'])
        self.assertEqual(status['remaining'],8)
        with self.sessions.begin() as db:
            values=db.execute(sa.text('SELECT "codeHash" FROM "SocialRecoveryCode"')).scalars().all()
            self.assertEqual({hashlib.sha256(c.encode()).hexdigest() for c in r['codes']},set(values))
        b=self.call(op='login',username='alice',password='test password 1234!')
        self.assertTrue(b['ok'])
        result=self.call(op='recover_account',username='alice',recoveryCode=r['codes'][0],newPassword='completely new password 12345!')
        self.assertTrue(result['ok'],result)
        self.assertFalse(self.call(op='me',token=a['token'])['ok'])
        self.assertFalse(self.call(op='me',token=b['token'])['ok'])
        self.assertTrue(self.call(op='me',token=result['token'])['ok'])
        self.assertFalse(self.call(op='recover_account',username='alice',recoveryCode=r['codes'][0],newPassword='another new password 12345!')['ok'])
        self.assertFalse(self.call(op='recover_account',username='alice',recoveryCode=r['codes'][1],newPassword='another new password 12345!')['ok'])
        self.assertFalse(self.call(op='login',username='alice',password='test password 1234!')['ok'])
        self.assertTrue(self.call(op='login',username='alice',password='completely new password 12345!')['ok'])
        self.assertEqual(self.call(op='recovery_codes_status',token=result['token'])['remaining'],0)
    def test_wrong_password_no_session_no_code_generation_and_rotation(self):
        a=self.signup()
        self.assertFalse(self.call(op='recovery_codes_create',token=a['token'],password='wrong password 1234!')['ok'])
        self.assertFalse(self.call(op='recovery_codes_create',password='test password 1234!')['ok'])
        self.assertFalse(self.call(op='recovery_codes_create',token='x'*50,password='test password 1234!')['ok'])
        old=self.call(op='recovery_codes_create',token=a['token'],password='test password 1234!')['codes']
        new=self.call(op='recovery_codes_create',token=a['token'],password='test password 1234!')['codes']
        self.assertNotEqual(old,new)
        self.assertFalse(self.call(op='recover_account',username='alice',recoveryCode=old[0],newPassword='new and strong password 1234!')['ok'])
        self.assertTrue(self.call(op='recovery_codes_revoke',token=a['token'],password='test password 1234!')['ok'])
        self.assertEqual(self.call(op='recovery_codes_status',token=a['token'])['remaining'],0)
        self.assertFalse(self.call(op='recover_account',username='alice',recoveryCode=new[0],newPassword='new and strong password 1234!')['ok'])
    def test_recipient_isolation_generic_error_and_expiry(self):
        a=self.signup('alice');b=self.signup('bob')
        codes=self.call(op='recovery_codes_create',token=a['token'],password='test password 1234!')['codes']
        for handle in ['bob','nobody','INVALID USER']:
            res=self.call(op='recover_account',username=handle,recoveryCode=codes[0],newPassword='new and strong password 1234!')
            self.assertEqual(res['code'],'RECOVERY_DENIED')
        self.assertFalse(self.call(op='recovery_codes_create',token=b['token'],password='not his password')['ok'])
        with self.sessions.begin() as db:
            db.execute(sa.text('UPDATE "SocialRecoveryCode" SET "expires"=1000000'))
        self.assertEqual(self.call(op='recover_account',username='alice',recoveryCode=codes[0],newPassword='new and strong password 1234!')['code'],'RECOVERY_DENIED')
    def test_lockout_and_password_validation_do_not_consume_codes(self):
        a=self.signup(); codes=self.call(op='recovery_codes_create',token=a['token'],password='test password 1234!')['codes']
        wrong=codes[0][:-1]+('A' if codes[0][-1]!='A' else 'B')
        for _ in range(5):self.assertEqual(self.call(op='recover_account',username='alice',recoveryCode=wrong,newPassword='new and strong password 1234!')['code'],'RECOVERY_DENIED')
        self.assertEqual(self.call(op='recover_account',username='alice',recoveryCode=codes[0],newPassword='new and strong password 1234!')['code'],'RECOVERY_DENIED')
        with self.sessions.begin() as db:
            db.execute(sa.text('UPDATE "SocialAccount" SET "recoveryLockedUntil"=0,"recoveryFailures"=0 WHERE handle=\'alice\''))
        self.assertFalse(self.call(op='recover_account',username='alice',recoveryCode=codes[0],newPassword='tiny')['ok'])
        self.assertTrue(self.call(op='recover_account',username='alice',recoveryCode=codes[0],newPassword='new and strong password 1234!')['ok'])
    def test_registration_hourly_backstop_and_disabled_recovery(self):
        self.signup('alice')
        with patch.dict(os.environ, {'LOOPRD_SOCIAL_REGISTRATION_HOURLY_MAX':'1'}):
            c=self.call(op='register',username='bob',password='new and strong password 1234!')
            self.assertEqual(c['code'],'REGISTRATION_RATE_LIMITED')
        self.assertTrue(self.call(op='register',username='bob',password='new and strong password 1234!')['ok'])
        with patch.dict(os.environ, {'LOOPRD_SOCIAL_ALLOW_REGISTRATION':'false'}):
            self.assertFalse(self.call(op='register',username='charlie',password='new and strong password 1234!')['ok'])
            self.assertFalse(self.call(op='recover_account',username='alice',recoveryCode='TAVI-'+('AAAA-'*7)+'AAAA',newPassword='new and strong password 1234!')['ok'])
    def test_atomic_recovery_revokes_push_devices_with_session_reset(self):
        a=self.signup()
        code=self.call(op='recovery_codes_create',token=a['token'],password='test password 1234!')['codes'][0]
        revoke=[]
        ctx=SimpleNamespace(body={'op':'recover_account','username':'alice','recoveryCode':code,
          'newPassword':'new and strong password 1234!'},principal=SimpleNamespace(subject='guest'),
          session_factory=self.sessions,transaction=self.sessions.begin,
          revoke_push=lambda db,pid:revoke.append(pid),emit=lambda *args:None,
          notify=lambda *args:None)
        with patch('looprd_handler.time.time',return_value=1000000):
            result=asyncio.run(handle(ctx))
        self.assertTrue(result['ok'],result)
        self.assertEqual(revoke,[principal_id(a['profileId'])])
        self.assertFalse(self.call(op='me',token=a['token'])['ok'])
        self.assertFalse(self.call(op='recover_account',username='alice',recoveryCode=code,
          newPassword='another new password 1234!')['ok'])

    def test_migration_8_to_9_preserves_legacy_accounts_and_sessions(self):
        # Exercise the generated SQL against pre-existing v8 data rather than
        # accepting a new-table create_all fixture as migration evidence.
        engine=sa.create_engine('sqlite+pysqlite:///:memory:')
        try:
            with engine.begin() as db:
                db.execute(sa.text('CREATE TABLE "SocialAccount" ("id" INTEGER PRIMARY KEY,"handle" VARCHAR(32) NOT NULL UNIQUE,"passwordHash" VARCHAR(255) NOT NULL,"created" INTEGER NOT NULL,"failedAttempts" INTEGER NOT NULL,"lockedUntil" INTEGER NOT NULL,"developerEnabled" BOOLEAN NOT NULL,"ecosystemAdmin" BOOLEAN NOT NULL)'))
                db.execute(sa.text("INSERT INTO \"SocialAccount\" VALUES (1,'alice','oldhash',123,0,0,0,0)"))
                db.execute(sa.text('CREATE TABLE "SocialSession" ("id" INTEGER PRIMARY KEY,"subjectId" VARCHAR(72) NOT NULL,"tokenHash" VARCHAR(64) NOT NULL UNIQUE,"created" INTEGER NOT NULL,"expires" INTEGER NOT NULL,"lastSeen" INTEGER NOT NULL,"revoked" BOOLEAN NOT NULL)'))
                db.execute(sa.text("INSERT INTO \"SocialSession\" VALUES (1,'acct_1','session-hash',123,900000,456,0)"))
                for stmt in next(m for m in self.spec['database']['migrations'] if m['version']==9)['statements']:
                    db.execute(sa.text(stmt))
                row=db.execute(sa.text('SELECT "handle","passwordHash","recoveryFailures","recoveryLockedUntil" FROM "SocialAccount" WHERE id=1')).one()
                self.assertEqual(tuple(row),('alice','oldhash',0,0))
                self.assertEqual(db.execute(sa.text('SELECT "subjectId" FROM "SocialSession"')).scalar_one(),'acct_1')
                self.assertEqual(db.execute(sa.text('SELECT COUNT(*) FROM "SocialRecoveryCode"')).scalar_one(),0)
        finally:engine.dispose()
    def test_additive_schema(self):
        self.assertEqual(self.spec['database']['schemaVersion'],10)
        self.assertIn(9,[m['version'] for m in self.spec['database']['migrations']])
        with self.engine.begin() as db:
            code=db.execute(sa.text('SELECT name FROM sqlite_master WHERE name=\'SocialRecoveryCode\'')).scalar()
            self.assertEqual(code,'SocialRecoveryCode')

if __name__=='__main__':unittest.main()
