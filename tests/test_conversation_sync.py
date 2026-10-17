"""Server-authoritative read state, summary privacy and multi-device mailbox behavior."""
import unittest
from test_account_flow import AccountFlow


class ConversationSyncTests(unittest.TestCase):
 def setUp(self):
  self.fixture=AccountFlow('test_capabilities_and_validation')
  self.fixture.setUp()
  self.call=self.fixture.call
  self.reg=self.fixture.reg
  self.alice=self.reg('alice'); self.bob=self.reg('bob');self.eve=self.reg('eve')
  self.assertTrue(all(u['ok'] for u in (self.alice,self.bob,self.eve)))
  self.a=self.alice['token'];self.b=self.bob['token'];self.e=self.eve['token']
  self.aid=self.alice['profileId'];self.bid=self.bob['profileId'];self.eid=self.eve['profileId']
  self.assertTrue(self.call(op='contact_request',token=self.a,username='bob')['ok'])
  self.assertTrue(self.call(op='contact_accept',token=self.b,peer=self.aid)['ok'])
 def tearDown(self):self.fixture.tearDown()
 def test_conversation_summary_shared_read_across_sessions(self):
  second=self.call(op='login',username='bob',password='long password 123!')
  self.assertTrue(second['ok'])
  empty=self.call(op='dm_conversations',token=self.b)
  self.assertEqual(empty['schema'],'tavi.dm-summaries/v1')
  self.assertEqual(empty['conversations'][0]['unread'],0)
  self.assertTrue(self.call(op='dm_send',token=self.a,peer=self.bid,text='Hello')['ok'])
  inbox=self.call(op='dm_conversations',token=second['token'])['conversations'][0]
  self.assertEqual(inbox['unread'],1);self.assertEqual(inbox['latest']['text'],'Hello')
  self.assertEqual(inbox['latest']['authorId'],self.aid)
  message_id=inbox['latest']['id']
  ack=self.call(op='dm_mark_read',token=self.b,peer=self.aid,upToId=message_id)
  self.assertEqual(ack['readId'],message_id)
  sync=self.call(op='dm_conversations',token=second['token'])['conversations'][0]
  self.assertEqual(sync['readId'],message_id);self.assertEqual(sync['unread'],0)
  self.assertEqual(self.call(op='dm_mark_read',token=self.b,peer=self.aid,upToId=message_id)['readId'],message_id)
  self.assertEqual(self.call(op='dm_mark_read',token=second['token'],peer=self.aid,upToId=0)['readId'],message_id)
  from looprd_handler import execute
  sent,_=execute({'op':'dm_send','token':self.a,'peer':self.bid,'text':'Again'},self.fixture.sessions,tokens={},now=1000002)
  self.assertTrue(sent['ok'],sent)
  self.assertEqual(self.call(op='dm_conversations',token=second['token'])['conversations'][0]['unread'],1)
 def test_no_cross_account_visibility_or_forged_cursors(self):
  self.assertFalse(self.call(op='dm_mark_read',token=self.e,peer=self.aid,upToId=1)['ok'])
  self.assertEqual(self.call(op='dm_conversations',token=self.e)['conversations'],[])
  self.assertTrue(self.call(op='dm_send',token=self.a,peer=self.bid,text='Private')['ok'])
  mid=self.call(op='dm_conversations',token=self.b)['conversations'][0]['latest']['id']
  for invalid in (-1,True,'1',mid+1,2**54):
   self.assertFalse(self.call(op='dm_mark_read',token=self.b,peer=self.aid,upToId=invalid)['ok'],invalid)
  self.assertEqual(self.call(op='dm_conversations',token=self.b)['conversations'][0]['unread'],1)
  self.assertTrue(self.call(op='contact_remove',token=self.b,peer=self.aid)['ok'])
  self.assertEqual(self.call(op='dm_conversations',token=self.b)['conversations'],[])
  self.assertFalse(self.call(op='dm_mark_read',token=self.b,peer=self.aid,upToId=mid)['ok'])
 def test_message_scope_and_subject_isolation(self):
  self.assertTrue(self.call(op='dm_send',token=self.a,peer=self.bid,text='To Bob')['ok'])
  b_mail=self.call(op='dm_conversations',token=self.b)['conversations'][0]
  self.assertEqual(self.call(op='dm_conversations',token=self.a)['conversations'][0]['unread'],0)
  mid=b_mail['latest']['id']
  self.assertTrue(self.call(op='dm_mark_read',token=self.b,peer=self.aid,upToId=mid)['ok'])
  self.assertEqual(self.call(op='dm_conversations',token=self.a)['conversations'][0]['readId'],0)
  self.assertTrue(self.call(op='logout',token=self.b)['ok'])
  self.assertFalse(self.call(op='dm_conversations',token=self.b)['ok'])
 def test_two_friends_are_ordered_and_unread_isolated(self):
  d=self.reg('dave');self.assertTrue(d['ok'])
  self.assertTrue(self.call(op='contact_request',token=d['token'],username='bob')['ok'])
  self.assertTrue(self.call(op='contact_accept',token=self.b,peer=d['profileId'])['ok'])
  self.assertTrue(self.call(op='dm_send',token=self.a,peer=self.bid,text='From Alice')['ok'])
  from looprd_handler import execute
  sent,_=execute({'op':'dm_send','token':d['token'],'peer':self.bid,'text':'From Dave'},self.fixture.sessions,tokens={},now=1000002)
  self.assertTrue(sent['ok'])
  conversations=self.call(op='dm_conversations',token=self.b)['conversations']
  self.assertEqual([x['peer'] for x in conversations],[d['profileId'],self.aid])
  self.assertEqual([x['unread'] for x in conversations],[1,1])
  self.assertTrue(self.call(op='dm_mark_read',token=self.b,peer=self.aid,upToId=conversations[1]['latest']['id'])['ok'])
  self.assertEqual([x['unread'] for x in self.call(op='dm_conversations',token=self.b)['conversations']],[1,0])
 def test_migration_statements_preserve_existing_dm_rows(self):
  import sqlite3
  db=sqlite3.connect(':memory:')
  migrations=self.fixture.spec['database']['migrations']
  for step in migrations:
   if step['version']==5:
    existing=db.execute('SELECT name FROM sqlite_master WHERE name="SocialDirectMessage"').fetchone()
    self.assertIsNotNone(existing)
    db.execute('INSERT INTO SocialDirectMessage (id,leftId,rightId,senderId,content,created) VALUES (1,?,?,?,?,?)',
               (self.aid,self.bid,self.aid,'unmodified',1000000))
   for stmt in step['statements']:db.execute(stmt)
  self.assertEqual(db.execute('SELECT content FROM SocialDirectMessage WHERE id=1').fetchone()[0],'unmodified')
  self.assertIsNotNone(db.execute('SELECT name FROM sqlite_master WHERE name="SocialConversationRead"').fetchone())
  db.close()
 def test_migration_adds_read_table_without_rewriting_messages(self):
  spec=self.fixture.spec
  self.assertEqual(spec['database']['schemaVersion'],6)
  new=[m for m in spec['database']['migrations'] if m['version']==5][0]
  self.assertEqual(len(new['statements']),2)
  self.assertTrue(all('SocialConversationRead' in stmt for stmt in new['statements']))

if __name__=='__main__':unittest.main()
