"""Multi-device sessions, friend permissions, and old-data migration contract."""
import sys
import unittest
from pathlib import Path
import sqlalchemy as sa
import yaml
from sqlalchemy.orm import sessionmaker
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from looprd_handler import execute

class AccountFlow(unittest.TestCase):
 def setUp(self):
  self.spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
  self.engine=sa.create_engine('sqlite+pysqlite:///:memory:')
  md=sa.MetaData()
  for name,model in self.spec['models'].items():
   cols=[]
   for key,field in model['fields'].items():
    kind={'integer':sa.Integer,'string':sa.String(field.get('maxLength',128)),'json':sa.JSON,'boolean':sa.Boolean}[field['type']]
    cols.append(sa.Column(key,kind,primary_key=field.get('primaryKey',False),autoincrement=field.get('generated',False),nullable=not field.get('required',False),unique=field.get('unique',False)))
   sa.Table(name,md,*cols)
  md.create_all(self.engine);self.sessions=sessionmaker(self.engine)
 def tearDown(self):self.engine.dispose()
 def call(self,**kw):return execute(kw,self.sessions,tokens={},now=1000000)[0]
 def reg(self,name):return self.call(op='register',username=name,password='long password 123!')
 def test_create_login_two_devices_revocation_and_private_profile(self):
  a=self.reg('alice');self.assertTrue(a['ok'],a)
  self.assertNotIn('password',str(a))
  self.assertNotIn('long password 123!',str(self.spec))
  self.assertFalse(self.reg('alice')['ok'])
  self.assertFalse(self.call(op='login',username='alice',password='wrong password')['ok'])
  b=self.call(op='login',username='ALICE',password='long password 123!')
  self.assertTrue(b['ok'],b);self.assertNotEqual(a['token'],b['token'])
  me=self.call(op='me',token=b['token']);self.assertEqual(me['profile']['profileId'],a['profileId'])
  self.assertTrue(self.call(op='logout',token=a['token'])['ok'])
  self.assertFalse(self.call(op='me',token=a['token'])['ok'])
  self.assertTrue(self.call(op='me',token=b['token'])['ok'])
 def test_friend_request_consent_and_direct_message_privacy(self):
  a,b,c=[self.reg(x) for x in ['alice','bob','charlie']]
  self.assertTrue(all(p['ok'] for p in [a,b,c]))
  self.assertFalse(self.call(op='dm_send',token=a['token'],peer=b['profileId'],text='No consent')['ok'])
  self.assertTrue(self.call(op='contact_request',token=a['token'],username='bob')['ok'])
  self.assertFalse(self.call(op='contact_accept',token=a['token'],peer=b['profileId'])['ok'])
  pending=self.call(op='contact_list',token=b['token'])['contacts']
  self.assertEqual(pending[0]['direction'],'incoming')
  self.assertTrue(self.call(op='contact_accept',token=b['token'],peer=a['profileId'])['ok'])
  self.assertTrue(self.call(op='dm_send',token=a['token'],peer=b['profileId'],text='Hello Bob')['ok'])
  self.assertFalse(self.call(op='dm_feed',token=c['token'],peer=a['profileId'])['ok'])
  msgs=self.call(op='dm_feed',token=b['token'],peer=a['profileId'])['messages']
  self.assertEqual(msgs[0]['text'],'Hello Bob')
  self.assertTrue(self.call(op='contact_remove',token=b['token'],peer=a['profileId'])['ok'])
  self.assertFalse(self.call(op='dm_feed',token=a['token'],peer=b['profileId'])['ok'])
 def test_capabilities_and_validation(self):
  cap=self.call(op='capabilities');self.assertTrue(cap['accounts'] and cap['contacts'])
  self.assertFalse(self.call(op='register',username='??',password='long password 123!')['ok'])
  self.assertFalse(self.call(op='register',username='too_short_pw',password='abc')['ok'])
  self.assertEqual(self.spec['database']['schemaVersion'],10)
  self.assertEqual([m['version'] for m in self.spec['database']['migrations']],[2,3,4,5,6,7,8,9,10])
 def test_registration_can_be_disabled_without_disabling_login(self):
  from unittest.mock import patch
  a=self.reg('alice');self.assertTrue(a['ok'])
  with patch.dict('os.environ',{'LOOPRD_SOCIAL_ALLOW_REGISTRATION':'false'}):
   self.assertFalse(self.reg('bob')['ok'])
   self.assertFalse(self.call(op='capabilities')['registration'])
   self.assertTrue(self.call(op='login',username='alice',password='long password 123!')['ok'])
 def test_old_development_token_cannot_impersonate_new_account_subject(self):
  a=self.reg('alice')
  forged=execute({'op':'me','token':'x'*32},self.sessions,tokens={a['profileId']:'x'*32},now=1000000)[0]
  self.assertFalse(forged['ok'])
 def test_failed_login_lockouts(self):
  self.reg('alice')
  for _ in range(5):self.assertFalse(self.call(op='login',username='alice',password='definitely wrong 123')['ok'])
  locked=self.call(op='login',username='alice',password='long password 123!')
  self.assertEqual(locked['code'],'LOGIN_LOCKED')
 def test_developer_permission_is_db_granted_and_current_on_every_request(self):
  a=self.reg('alice');other=self.reg('bob')
  self.assertFalse(self.call(op='me',token=a['token'])['permissions']['developer'])
  self.assertFalse(self.call(op='developer_diagnostics',token=a['token'])['ok'])
  self.assertEqual(self.call(op='developer_diagnostics',token=a['token'])['code'],'DEVELOPER_ACCESS_DENIED')
  with self.sessions.begin() as db:
   db.execute(sa.text('UPDATE "SocialAccount" SET "developerEnabled"=1 WHERE "handle"=:handle'), {"handle":"alice"})
  me=self.call(op='me',token=a['token'])
  self.assertTrue(me['permissions']['developer'])
  diagnostics=self.call(op='developer_diagnostics',token=a['token'])
  self.assertTrue(diagnostics['ok'])
  self.assertEqual(diagnostics['schema'],'looprd.social.developer-diagnostics/v1')
  self.assertEqual(diagnostics['counts']['accounts'],2)
  self.assertNotIn(a['token'],str(diagnostics))
  self.assertNotIn('passwordHash',str(diagnostics))
  self.assertNotIn('hello',str(diagnostics))
  self.assertFalse(self.call(op='developer_diagnostics',token=other['token'])['ok'])
  second=self.call(op='login',username='alice',password='long password 123!')
  self.assertTrue(self.call(op='developer_diagnostics',token=second['token'])['ok'])
  with self.sessions.begin() as db:
   db.execute(sa.text('UPDATE "SocialAccount" SET "developerEnabled"=0 WHERE "handle"=:handle'), {"handle":"alice"})
  self.assertFalse(self.call(op='developer_diagnostics',token=a['token'])['ok'])
  self.assertFalse(self.call(op='developer_diagnostics',token=second['token'])['ok'])
  self.assertFalse(self.call(op='me',token=a['token'])['permissions']['developer'])
 def test_developer_access_does_not_accept_self_promotion_or_legacy_tokens(self):
  a=self.reg('alice')
  forged=self.call(op='save_profile',token=a['token'],
    profile={'schema':'looprd.social.profile/v1','profileId':a['profileId'],
             'displayName':'Alice','developerEnabled':True})
  self.assertFalse(forged['ok'])
  me=self.call(op='me',token=a['token'],developerEnabled=True,permissions={'developer':True})
  self.assertFalse(me['permissions']['developer'])
  with self.sessions.begin() as db:
   db.execute(sa.text('UPDATE "SocialAccount" SET "developerEnabled"=1 WHERE "handle"=:handle'), {"handle":"alice"})
  forged=execute({'op':'developer_diagnostics','token':'z'*32,'subject':a['profileId']},self.sessions,
      tokens={'legacy_dev':'z'*32},now=1000000)[0]
  self.assertFalse(forged['ok'])
 def test_previous_v2_accounts_migrate_disabled_and_keep_sessions(self):
  old=sa.create_engine('sqlite+pysqlite:///:memory:')
  try:
   with old.begin() as db:
    db.execute(sa.text('CREATE TABLE "SocialAccount" (id INTEGER PRIMARY KEY, handle VARCHAR(32) UNIQUE NOT NULL, passwordHash VARCHAR(255) NOT NULL, created INTEGER NOT NULL, failedAttempts INTEGER NOT NULL, lockedUntil INTEGER NOT NULL)'))
    db.execute(sa.text("INSERT INTO SocialAccount VALUES (1,'alice','opaque-hash',1,0,0)"))
    db.execute(sa.text('CREATE TABLE "SocialSession" (id INTEGER PRIMARY KEY, "subjectId" VARCHAR(72) NOT NULL, "tokenHash" VARCHAR(64) NOT NULL UNIQUE, created INTEGER NOT NULL, expires INTEGER NOT NULL, "lastSeen" INTEGER NOT NULL, revoked BOOLEAN NOT NULL)'))
    db.execute(sa.text("INSERT INTO SocialSession VALUES (1,'acct_1','hash',1,2000000,1000000,0)"))
    for stmt in self.spec['database']['migrations'][1]['statements']:db.execute(sa.text(stmt))
    row=db.execute(sa.text('SELECT "developerEnabled" FROM "SocialAccount" WHERE id=1')).scalar()
    self.assertEqual(row,0)
    self.assertEqual(db.execute(sa.text('SELECT "subjectId" FROM "SocialSession"')).scalar(),'acct_1')
  finally:old.dispose()
 def test_old_schema_migration_is_additive(self):
  old=sa.create_engine('sqlite+pysqlite:///:memory:')
  try:
   with old.begin() as db:
    db.execute(sa.text('CREATE TABLE "SocialProfile" (id INTEGER PRIMARY KEY, "subjectId" VARCHAR(72), data JSON, revision INTEGER, updated INTEGER)'))
    db.execute(sa.text('CREATE TABLE "SocialMessage" (id INTEGER PRIMARY KEY, "subjectId" VARCHAR(72), "displayName" VARCHAR(24), content VARCHAR(320), created INTEGER)'))
    db.execute(sa.text('CREATE TABLE "SocialPulse" (id INTEGER PRIMARY KEY, signal INTEGER)'))
    db.execute(sa.text('INSERT INTO "SocialMessage" ("subjectId","displayName",content,created) VALUES (\'old_user\',\'User\',\'hello from v1\',123)'))
   with old.begin() as db:
    for stmt in self.spec['database']['migrations'][0]['statements']:db.execute(sa.text(stmt))
    self.assertEqual(db.execute(sa.text('SELECT content FROM "SocialMessage"')).scalar(),'hello from v1')
    self.assertTrue(db.execute(sa.text("SELECT name FROM sqlite_master WHERE name='SocialAccount'")).scalar())
  finally:old.dispose()

if __name__=='__main__':unittest.main()
