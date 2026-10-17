"""Server-side permissions, recipient isolation, reply semantics and URL validation."""
import unittest
import sqlalchemy as sa
from test_account_flow import AccountFlow

class InteractionFlow(AccountFlow):
 def test_operator_publishes_recipient_limited_interaction(self):
  admin,alice,bob=[self.reg(n) for n in ('admin','alice','bob')]
  sample={'title':'Bug review','body':'Please review report #19','topic':'bugs.created','actions':[
      {'id':'review','type':'reply','label':'Review','fields':[{'id':'status','type':'select','label':'Status','options':['investigating','resolved']}]},
      {'id':'details','type':'open-url','label':'Open report','url':'https://bugs.example.org/issues/19','presentation':'external-browser'}]}
  self.assertFalse(self.call(op='interaction_publish',token=admin['token'],recipient='alice',interaction=sample)['ok'])
  with self.sessions.begin() as db:
   db.execute(sa.text('UPDATE "SocialAccount" SET "developerEnabled"=1 WHERE "handle"=:handle'),{'handle':'admin'})
  self.assertTrue(self.call(op='interaction_publish',token=admin['token'],recipient='alice',interaction=sample)['ok'])
  self.assertEqual(len(self.call(op='interaction_feed',token=bob['token'])['events']),0)
  items=self.call(op='interaction_feed',token=alice['token'])['events'];self.assertEqual(len(items),1)
  self.assertFalse(self.call(op='interaction_reply',token=bob['token'],id=items[0]['id'],action='review',values={'status':'resolved'})['ok'])
  self.assertFalse(self.call(op='interaction_reply',token=alice['token'],id=items[0]['id'],action='review',values={'status':'not-an-option'})['ok'])
  self.assertTrue(self.call(op='interaction_reply',token=alice['token'],id=items[0]['id'],action='review',values={'status':'investigating'})['ok'])
  self.assertFalse(self.call(op='interaction_reply',token=alice['token'],id=items[0]['id'],action='review',values={'status':'resolved'})['ok'])
  self.assertEqual(self.call(op='interaction_feed',token=alice['token'])['events'][0]['status'],'responded')
 def test_dismiss_event_only_by_recipient_and_idempotent(self):
  admin,alice,bob=[self.reg(n) for n in ('admin','alice','bob')]
  with self.sessions.begin() as db:
   db.execute(sa.text('UPDATE "SocialAccount" SET "developerEnabled"=1 WHERE "handle"=:handle'),{'handle':'admin'})
  interaction={'title':'Review','topic':'bug.created','actions':[{'id':'open','type':'reply','label':'Review','fields':[]}]}
  self.assertTrue(self.call(op='interaction_publish',token=admin['token'],recipient='alice',interaction=interaction)['ok'])
  eid=self.call(op='interaction_feed',token=alice['token'])['events'][0]['id']
  self.assertFalse(self.call(op='interaction_dismiss',token=bob['token'],id=eid)['ok'])
  self.assertFalse(self.call(op='interaction_dismiss',token=alice['token'],id='bad')['ok'])
  self.assertTrue(self.call(op='interaction_dismiss',token=alice['token'],id=eid)['ok'])
  self.assertTrue(self.call(op='interaction_dismiss',token=alice['token'],id=eid)['ok'])
  self.assertEqual(self.call(op='interaction_feed',token=alice['token'])['events'][0]['status'],'dismissed')
  self.assertFalse(self.call(op='interaction_reply',token=alice['token'],id=eid,action='open',values={})['ok'])
 def test_bad_links_fail_closed(self):
  from looprd_handler import validate_interaction
  for url in ('http://example.com','https://localhost/','https://127.0.0.1','https://user:pass@example.org','https://example.org/#x'):
   with self.assertRaises(ValueError):
    validate_interaction({'title':'x','topic':'a.b','actions':[{'id':'link','type':'open-url','label':'Open','url':url}]})
