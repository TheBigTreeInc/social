#!/usr/bin/env python3
"""Embed the tested social handler in a deployable Looprd v1 component YAML."""
from pathlib import Path
import sys
import json
import yaml
root=Path(__file__).resolve().parent.parent
# The server release is independent of client-only Tavi packaging versions.
version=json.loads((root/'server/looprd-release.json').read_text())['release']
source=(root/'server/looprd_handler.py').read_text(encoding='utf8')
verifier=(root/'server/looprd_verifier.py').read_text(encoding='utf8')
admin_events=(root/'server/admin_event_service.py').read_text(encoding='utf8')
admin_role=(root/'server/admin_role_service.py').read_text(encoding='utf8')
game_events=(root/'server/game_event_service.py').read_text(encoding='utf8')
game_grants=(root/'server/game_grant_service.py').read_text(encoding='utf8')
def string(max_len,required=False,unique=False):
    return dict(type='string',maxLength=max_len,**({'required':True} if required else {}),**({'unique':True} if unique else {}))
def integer(required=False,primary=False,generated=False):
    return dict(type='integer',**({'required':True} if required else {}),**({'primaryKey':True} if primary else {}),**({'generated':True} if generated else {}))
spec={
 'apiVersion':'looprd/v1','component':'looprd-social','release':version,'api':{'version':'v1'},
 'cors':{'allowedOrigins':['https://thebigtreeinc.github.io','http://tauri.localhost']},
 'requires':['auth.verified','events.transactional','events.replay','push.unifiedpush','management.data','service.contracts','reports.bugs'],
 'auth':{'mode':'verified','realm':'tavi-social',
         'scopes':['social:api','events:read','push:manage','social:service','social:operator'],
         'verifier':{'kind':'python','source':verifier}},
 'realtime':{'delivery':'durable','retentionSeconds':86400},
 'push':{'transport':'unifiedpush','scopes':['push:manage'],
         'deviceLifetimeSeconds':86400,'maxDevicesPerPrincipal':8},
 'limits':{'requestsPerMinute':180,'authAttemptsPerMinute':90,'burstPerSecond':15,'maxInFlight':30},
  'database':{'backend':'sqlite','schemaVersion':9,'migrations':[{'version':2,'statements':[
  'CREATE TABLE "SocialAccount" ("id" INTEGER PRIMARY KEY, "handle" VARCHAR(32) NOT NULL UNIQUE, "passwordHash" VARCHAR(255) NOT NULL, "created" INTEGER NOT NULL, "failedAttempts" INTEGER NOT NULL, "lockedUntil" INTEGER NOT NULL)',
  'CREATE TABLE "SocialSession" ("id" INTEGER PRIMARY KEY, "subjectId" VARCHAR(72) NOT NULL, "tokenHash" VARCHAR(64) NOT NULL UNIQUE, "created" INTEGER NOT NULL, "expires" INTEGER NOT NULL, "lastSeen" INTEGER NOT NULL, "revoked" BOOLEAN NOT NULL)',
  'CREATE TABLE "SocialContact" ("id" INTEGER PRIMARY KEY, "leftId" VARCHAR(72) NOT NULL, "rightId" VARCHAR(72) NOT NULL, "requestedBy" VARCHAR(72) NOT NULL, "status" VARCHAR(16) NOT NULL, "created" INTEGER NOT NULL)',
  'CREATE UNIQUE INDEX "SocialContact_pair" ON "SocialContact" ("leftId", "rightId")',
  'CREATE TABLE "SocialDirectMessage" ("id" INTEGER PRIMARY KEY, "leftId" VARCHAR(72) NOT NULL, "rightId" VARCHAR(72) NOT NULL, "senderId" VARCHAR(72) NOT NULL, "content" VARCHAR(1000) NOT NULL, "created" INTEGER NOT NULL)',
  'CREATE INDEX "SocialDirectMessage_pair" ON "SocialDirectMessage" ("leftId", "rightId", "id")'
  ]},{'version':3,'statements':[
  'ALTER TABLE "SocialAccount" ADD COLUMN "developerEnabled" BOOLEAN NOT NULL DEFAULT 0'
  ]},{'version':4,'statements':[
  'CREATE TABLE "SocialInteraction" ("id" INTEGER PRIMARY KEY, "recipient" VARCHAR(72) NOT NULL, "publisher" VARCHAR(72) NOT NULL, "topic" VARCHAR(96) NOT NULL, "title" VARCHAR(120) NOT NULL, "data" JSON NOT NULL, "status" VARCHAR(16) NOT NULL, "response" JSON, "created" INTEGER NOT NULL, "expires" INTEGER NOT NULL)',
  'CREATE INDEX "SocialInteraction_recipient" ON "SocialInteraction" ("recipient", "id")'
  ]},{'version':5,'statements':[
  'CREATE TABLE "SocialConversationRead" ("id" INTEGER PRIMARY KEY, "subjectId" VARCHAR(72) NOT NULL, "peerId" VARCHAR(72) NOT NULL, "readId" INTEGER NOT NULL, "updated" INTEGER NOT NULL)',
  'CREATE UNIQUE INDEX "SocialConversationRead_subject_peer" ON "SocialConversationRead" ("subjectId", "peerId")'
  ]},{'version':6,'statements':[
  'ALTER TABLE "SocialAccount" ADD COLUMN "ecosystemAdmin" BOOLEAN NOT NULL DEFAULT 0'
  ]},{'version':7,'statements':[
  'CREATE TABLE "SocialGameSubscription" ("id" INTEGER PRIMARY KEY, "subjectId" VARCHAR(72) NOT NULL, "publisher" VARCHAR(48) NOT NULL, "gameId" VARCHAR(96) NOT NULL, "matchId" VARCHAR(128) NOT NULL, "enabled" BOOLEAN NOT NULL, "updated" INTEGER NOT NULL)',
  'CREATE TABLE "SocialGameDelivery" ("id" INTEGER PRIMARY KEY, "publisher" VARCHAR(48) NOT NULL, "eventId" VARCHAR(96) NOT NULL, "recipient" VARCHAR(72) NOT NULL, "digest" VARCHAR(64) NOT NULL, "interactionId" INTEGER NOT NULL, "created" INTEGER NOT NULL)',
  'CREATE INDEX "SocialGameSubscription_subject" ON "SocialGameSubscription" ("subjectId","enabled")',
  'CREATE UNIQUE INDEX "SocialGameSubscription_unique" ON "SocialGameSubscription" ("subjectId","publisher","gameId","matchId")',
  'CREATE UNIQUE INDEX "SocialGameDelivery_unique" ON "SocialGameDelivery" ("publisher","eventId","recipient")'
  ]},{'version':8,'statements':[
  'CREATE TABLE "SocialGameGrant" ("id" INTEGER PRIMARY KEY, "tokenHash" VARCHAR(64) NOT NULL UNIQUE, "sessionHash" VARCHAR(64) NOT NULL, "subjectId" VARCHAR(72) NOT NULL, "publisher" VARCHAR(48) NOT NULL, "gameId" VARCHAR(96) NOT NULL, "matchId" VARCHAR(128) NOT NULL, "created" INTEGER NOT NULL, "expires" INTEGER NOT NULL, "consumed" BOOLEAN NOT NULL)',
  'CREATE INDEX "SocialGameGrant_subject" ON "SocialGameGrant" ("subjectId","expires")'
  ]},{'version':9,'statements':[
  'ALTER TABLE "SocialAccount" ADD COLUMN "recoveryFailures" INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE "SocialAccount" ADD COLUMN "recoveryLockedUntil" INTEGER NOT NULL DEFAULT 0',
  'CREATE INDEX "SocialAccount_created" ON "SocialAccount" ("created")',
  'CREATE TABLE "SocialRecoveryCode" ("id" INTEGER PRIMARY KEY, "subjectId" VARCHAR(72) NOT NULL, "codeHash" VARCHAR(64) NOT NULL UNIQUE, "created" INTEGER NOT NULL, "expires" INTEGER NOT NULL)',
  'CREATE INDEX "SocialRecoveryCode_subject" ON "SocialRecoveryCode" ("subjectId","expires")'
  ]}]},
 'models':{
    'SocialProfile':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True,True),'data':{'type':'json','required':True},'revision':integer(True),'updated':integer(True)}},
    'SocialMessage':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'displayName':string(24,True),'content':string(320,True),'created':integer(True)}},
    'SocialPulse':{'fields':{'id':integer(primary=True,generated=True),'signal':integer(True)}},
    'SocialAccount':{'fields':{'id':integer(primary=True,generated=True),'handle':string(32,True,True),'passwordHash':string(255,True),'created':integer(True),'failedAttempts':integer(True),'lockedUntil':integer(True),'developerEnabled':{'type':'boolean','required':True},'ecosystemAdmin':{'type':'boolean','required':True},'recoveryFailures':integer(True),'recoveryLockedUntil':integer(True)},'indexes':[{'name':'SocialAccount_created','fields':['created']}]},
    'SocialRecoveryCode':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'codeHash':string(64,True,True),'created':integer(True),'expires':integer(True)},'indexes':[{'name':'SocialRecoveryCode_subject','fields':['subjectId','expires']}]},
    'SocialSession':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'tokenHash':string(64,True,True),'created':integer(True),'expires':integer(True),'lastSeen':integer(True),'revoked':{'type':'boolean','required':True}}},
    'SocialContact':{'fields':{'id':integer(primary=True,generated=True),'leftId':string(72,True),'rightId':string(72,True),'requestedBy':string(72,True),'status':string(16,True),'created':integer(True)},'indexes':[{'name':'SocialContact_pair','fields':['leftId','rightId'],'unique':True}]},
    'SocialInteraction':{'fields':{'id':integer(primary=True,generated=True),'recipient':string(72,True),'publisher':string(72,True),'topic':string(96,True),'title':string(120,True),'data':{'type':'json','required':True},'status':string(16,True),'response':{'type':'json'},'created':integer(True),'expires':integer(True)},'indexes':[{'name':'SocialInteraction_recipient','fields':['recipient','id']}]},
    'SocialGameGrant':{'fields':{'id':integer(primary=True,generated=True),'tokenHash':string(64,True,True),
         'sessionHash':string(64,True),'subjectId':string(72,True),'publisher':string(48,True),
         'gameId':string(96,True),'matchId':string(128,True),'created':integer(True),'expires':integer(True),
         'consumed':{'type':'boolean','required':True}},'indexes':[{'name':'SocialGameGrant_subject','fields':['subjectId','expires']}]},
    'SocialGameSubscription':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'publisher':string(48,True),'gameId':string(96,True),'matchId':string(128,True),'enabled':{'type':'boolean','required':True},'updated':integer(True)},'indexes':[{'name':'SocialGameSubscription_subject','fields':['subjectId','enabled']},{'name':'SocialGameSubscription_unique','fields':['subjectId','publisher','gameId','matchId'],'unique':True}]},
    'SocialGameDelivery':{'fields':{'id':integer(primary=True,generated=True),'publisher':string(48,True),'eventId':string(96,True),'recipient':string(72,True),'digest':string(64,True),'interactionId':integer(True),'created':integer(True)},'indexes':[{'name':'SocialGameDelivery_unique','fields':['publisher','eventId','recipient'],'unique':True}]},
    'SocialConversationRead':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'peerId':string(72,True),'readId':integer(True),'updated':integer(True)},'indexes':[{'name':'SocialConversationRead_subject_peer','fields':['subjectId','peerId'],'unique':True}]},
    'SocialDirectMessage':{'fields':{'id':integer(primary=True,generated=True),'leftId':string(72,True),'rightId':string(72,True),'senderId':string(72,True),'content':string(1000,True),'created':integer(True)},'indexes':[{'name':'SocialDirectMessage_pair','fields':['leftId','rightId','id']}]}
    },
 'resources':{'pulses':{'model':'SocialPulse','path':'/pulses','operations':['get'],
                          'permissions':{'get':['events:read']}},
              'accounts':{'model':'SocialAccount','path':'/operator-accounts','operations':['list','get'],
                  'permissions':{'list':['social:operator'],'get':['social:operator']},
                  'projection':['id','handle','created','developerEnabled','ecosystemAdmin']}},
 'management':{'resources':{'accounts':{'label':'Tavi accounts','titleField':'handle',
     'fields':{'handle':{'label':'Username'},'created':{'label':'Registered at'},
               'developerEnabled':{'label':'Developer access','editable':True},
               'ecosystemAdmin':{'label':'Ecosystem administrator'}}}},
     'actions':{'promote-admin':{'label':'Promote to ecosystem admin','resource':'accounts',
              'description':'Grant administrator event delivery to this Tavi account.',
              'writes':{'accounts':['ecosystemAdmin']},
              'source':"def handle(ctx):\n    ctx.update('accounts', ctx.recordId, {'ecosystemAdmin': True})\n"},
               'revoke-admin':{'label':'Revoke ecosystem admin','resource':'accounts',
              'description':'Stop administrator event access for this Tavi account.',
              'writes':{'accounts':['ecosystemAdmin']},
              'source':"def handle(ctx):\n    ctx.update('accounts', ctx.recordId, {'ecosystemAdmin': False})\n"}}},
 'websocket':{'path':'/events','resources':['pulses'],
              'permissions':{'pulses':['events:read']}},
 'handlers':[
    {'path':'/social','method':'POST','kind':'python','scopes':['social:api'],'source':source},
    {'path':'/ecosystem/admin-notify','method':'POST','kind':'python','scopes':['social:service'],
     'source':admin_events,'contract':{
       'name':'tavi-admin-notify','version':1,'serviceOnly':True,
       'request':{'type':'object','required':['topic','title'],'additionalProperties':False,
           'properties':{'topic':{'type':'string','minLength':2,'maxLength':80},
                         'title':{'type':'string','minLength':1,'maxLength':120},
                         'body':{'type':'string','maxLength':2000},
                         'url':{'type':'string','maxLength':2048},
                         'ttlSeconds':{'type':'integer','minimum':60,'maximum':604800}}},
       'response':{'type':'object','required':['accepted','recipients'],
           'additionalProperties':False,'properties':{'accepted':{'type':'boolean'},
             'recipients':{'type':'integer','minimum':0},'reason':{'type':'string','maxLength':48}}}}},
    {'path':'/ecosystem/game-event','method':'POST','kind':'python','scopes':['social:service'],
     'source':game_events,'contract':{
       'name':'tavi-game-event','version':1,'serviceOnly':True,
       'request':{'type':'object','required':['schema','eventId','kind','gameId','matchId','turnIndex','recipient'],
           'additionalProperties':False,
           'properties':{'schema':{'type':'string','enum':['tavi.game-event/v1']},
               'eventId':{'type':'string','minLength':8,'maxLength':96},
               'kind':{'type':'string','enum':['turn.ready','turn.reminder','match.completed','invite.created']},
               'gameId':{'type':'string','minLength':2,'maxLength':96},
               'matchId':{'type':'string','minLength':12,'maxLength':128},
               'turnIndex':{'type':'integer','minimum':0},
               'recipient':{'type':'object','required':['issuer','subject'],'additionalProperties':False,
                   'properties':{'issuer':{'type':'string','minLength':1,'maxLength':128},
                                 'subject':{'type':'string','minLength':6,'maxLength':72}}},
               'inviter':{'type':'object','required':['issuer','subject'],'additionalProperties':False,
                   'properties':{'issuer':{'type':'string','minLength':1,'maxLength':128},
                                 'subject':{'type':'string','minLength':6,'maxLength':72}}}}},
       'response':{'type':'object','required':['accepted','delivery'],'additionalProperties':False,
           'properties':{'accepted':{'type':'boolean'},
               'delivery':{'type':'string','enum':['created','duplicate','rejected']},
               'reason':{'type':'string','maxLength':80}}}}},
    {'path':'/ecosystem/game-grant-redeem','method':'POST','kind':'python','scopes':['social:service'],
     'source':game_grants,'contract':{
       'name':'tavi-game-grant-redeem','version':1,'serviceOnly':True,
       'request':{'type':'object','required':['grant','gameId','matchId'],'additionalProperties':False,
         'properties':{'grant':{'type':'string','minLength':42,'maxLength':128},
             'gameId':{'type':'string','minLength':2,'maxLength':96},
             'matchId':{'type':'string','minLength':12,'maxLength':128}}},
       'response':{'type':'object','required':['accepted'],'additionalProperties':False,
         'properties':{'accepted':{'type':'boolean'},'reason':{'type':'string','maxLength':80},
           'issuer':{'type':'string','maxLength':128},'subject':{'type':'string','maxLength':72},
           'gameId':{'type':'string','maxLength':96},'matchId':{'type':'string','maxLength':128},
           'scope':{'type':'string','maxLength':40}}}}},
    {'path':'/ecosystem/admin-role','method':'POST','kind':'python','scopes':['social:service'],
     'source':admin_role,'contract':{
       'name':'tavi-admin-role','version':1,'serviceOnly':True,
       'request':{'type':'object','required':['subject'],'additionalProperties':False,
           'properties':{'subject':{'type':'string','minLength':6,'maxLength':72}}},
       'response':{'type':'object','required':['admin'],'additionalProperties':False,
           'properties':{'admin':{'type':'boolean'}}}}},
    {'path':'/info','kind':'response','scopes':['social:api'],'response':{'protocol':'looprd.social/1','auth':'social-accounts','registration':'see-capabilities','features':['contacts','direct-messages','lobby','portraits','server-gated-developer-tools','game-event-inbox-v1','game-invites-v1','game-grants-v1','recovery-codes-v1'],'release':version}},
 ]}
output='# Generated from server/looprd_handler.py. Do not edit by hand.\n'+yaml.safe_dump(spec,sort_keys=False,allow_unicode=True,width=110)
if '--check' in sys.argv:
    if (root/'looprd.yaml').read_text(encoding='utf8')!=output:
        raise SystemExit('looprd.yaml is stale: run python tools/generate-looprd.py')
    print('Looprd descriptor and handler in sync')
else:
    (root/'looprd.yaml').write_text(output,encoding='utf8')
    print('Generated native Looprd social component',version)
