"""Native Looprd handler integration, using exactly the SQL model in looprd.yaml."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
import yaml

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from looprd_handler import execute, authorize

TOKENS={'user_alex':'a'*32,'user_bob':'b'*32}

class SocialLooprdTests(unittest.TestCase):
 def setUp(self):
  self.spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
  self.engine=sa.create_engine('sqlite+pysqlite:///:memory:')
  metadata=sa.MetaData()
  for name,model in self.spec['models'].items():
   cols=[]
   for key,field in model['fields'].items():
    kind={'integer':sa.Integer,'string':sa.String(field.get('maxLength',128)),'json':sa.JSON,'boolean':sa.Boolean}[field['type']]
    cols.append(sa.Column(key,kind,primary_key=field.get('primaryKey',False),
      autoincrement=field.get('generated',False),nullable=not field.get('required',False),
      unique=field.get('unique',False)))
   sa.Table(name,metadata,*cols)
  metadata.create_all(self.engine)
  self.sessions=sessionmaker(self.engine)
 def tearDown(self):self.engine.dispose()
 def call(self,as_user='user_alex',now=1000000,**data):
  return execute({'token':TOKENS[as_user],**data},self.sessions,TOKENS,now=now)
 def test_native_descriptor_matches_exact_embedded_source_and_private_resources(self):
  s=self.spec
  self.assertEqual(s['apiVersion'],'looprd/v1')
  self.assertEqual(s['component'],'looprd-social')
  self.assertEqual(s['release'], json.loads((ROOT/'server/looprd-release.json').read_text())['release'])
  self.assertEqual(s['handlers'][0]['path'],'/social')
  self.assertEqual(s['handlers'][0]['source'],(ROOT/'server/looprd_handler.py').read_text())
  self.assertEqual(s['resources']['pulses']['operations'],['get'])
  self.assertEqual(s['websocket']['path'],'/events')
  self.assertNotIn('SocialProfile',[v['model'] for v in s['resources'].values()])
  self.assertNotIn('SocialMessage',[v['model'] for v in s['resources'].values()])
 def test_requires_dev_credential_and_isolates_profiles(self):
  self.assertEqual(authorize('bad',TOKENS),None)
  result,_=execute({'op':'me','token':'wrong'},self.sessions,TOKENS)
  self.assertFalse(result['ok'])
  p,_=self.call(op='me')
  self.assertEqual(p['profile']['profileId'],'user_alex')
  submitted={'schema':'looprd.social.profile/v1','displayName':'Alex', 'appearance':None}
  result,event=self.call(op='save_profile',profile=submitted,ifRevision=0)
  self.assertTrue(result['ok'])
  self.assertEqual(result['revision'],1)
  self.assertEqual(event['data']['id'],1)
  self.assertNotIn('Alex',str(event))
  self.assertNotIn('token',str(event))
  bob,_=self.call(as_user='user_bob',op='me')
  self.assertEqual(bob['profile']['displayName'],'user_bob')
  again,_=self.call(op='me')
  self.assertEqual(again['profile']['displayName'],'Alex')
  conflict,_=self.call(op='save_profile',profile=submitted,ifRevision=0)
  self.assertFalse(conflict['ok'])
 def test_profile_is_presentation_only_and_rejects_forged_fields(self):
  examples=[
   {'displayName':'Evil','profileId':'user_bob'},
   {'displayName':'Evil','money':999999},
   {'displayName':'Evil','appearance':{'schema':'modular-portraits.identity/v1','pack':'bad','revision':1,'choices':{},'colors':{}}},
   {'displayName':'Evil','appearance':{'schema':'modular-portraits.identity/v1','pack':'dominion-pixel','revision':1,'choices':{'hair':'../../etc/passwd'},'colors':{}}},
  ]
  for data in examples:
   response,_=self.call(op='save_profile',profile=data)
   self.assertFalse(response['ok'],data)
  good={'displayName':'Pixel','appearance':{'schema':'modular-portraits.identity/v1','pack':'dominion-pixel','revision':1,
    'choices':{'hair':'short','body':'compact'},'colors':{'skin':'#aabbcc'}}}
  response,_=self.call(op='save_profile',profile=good)
  self.assertTrue(response['ok'])
  self.assertEqual(response['profile']['appearance']['choices']['body'],'compact')
 def test_numeric_portrait_code_sync_is_canonical_and_non_destructive(self):
  from looprd_handler import valid_portrait_code
  code='229339173637451342422556259991010379162806200079620818744175464631779840998257666745902813043757393046312471610425942788336631437795834446214811746561882308690991'
  self.assertEqual(valid_portrait_code(code),code)
  first,_=self.call(op='save_profile',profile={'displayName':'Alex','portraitCode':code},ifRevision=0)
  self.assertTrue(first['ok'],first)
  self.assertEqual(first['profile']['portraitCode'],code)
  synced,_=self.call(op='me')
  self.assertEqual(synced['profile']['portraitCode'],code)
  rename,_=self.call(op='save_profile',profile={'displayName':'Alice'},ifRevision=1)
  self.assertEqual(rename['profile']['portraitCode'],code)
  bob,_=self.call(as_user='user_bob',op='me')
  self.assertIsNone(bob['profile']['portraitCode'])
  for invalid in [3,'01', 'notdigits', '', '1', '2', '0'*50, code+'0',code[:-1], '9'*600]:
   response,_=self.call(op='save_profile',profile={'displayName':'Test','portraitCode':invalid})
   self.assertFalse(response['ok'], invalid)
  self.assertEqual(self.call(op='me')[0]['profile']['portraitCode'],code)

 def test_chat_is_bounded_isolated_from_game_and_limited_by_time(self):
  sent,event=self.call(op='chat_send',text='Hello social lobby!')
  self.assertTrue(sent['ok'])
  self.assertNotIn('Hello',str(event))
  early,_=self.call(op='chat_send',text='spam',now=1000001)
  self.assertFalse(early['ok'])
  second,_=self.call(as_user='user_bob',op='chat_send',text='Hi Alex')
  self.assertTrue(second['ok'])
  feed,_=self.call(op='chat_feed')
  self.assertEqual([x['text'] for x in feed['messages']],['Hello social lobby!','Hi Alex'])
  self.assertEqual([x['authorId'] for x in feed['messages']],['user_alex','user_bob'])
  # Past 7 days messages no longer appear in feed.
  expired,_=self.call(op='chat_feed',now=1000000+7*86400+1)
  self.assertEqual(expired['messages'],[])
 def test_no_automatic_game_room_ticket(self):
  result,event=self.call(op='game_ticket',game='the-life-loop')
  self.assertFalse(result['ok']);self.assertIsNone(event)
  self.assertIn('not implemented',result['error'])
 def test_no_embedded_dev_secrets(self):
  text=(ROOT/'looprd.yaml').read_text()
  for token in TOKENS.values():self.assertNotIn(token,text)
  self.assertNotIn('dev_demo_user',text)

if __name__=='__main__':unittest.main()
