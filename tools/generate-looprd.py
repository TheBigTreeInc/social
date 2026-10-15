#!/usr/bin/env python3
"""Embed the tested social handler in a deployable Looprd v1 component YAML."""
from pathlib import Path
import sys
import json
import yaml
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text())['version']
source=(root/'server/looprd_handler.py').read_text(encoding='utf8')
def string(max_len,required=False,unique=False):
    return dict(type='string',maxLength=max_len,**({'required':True} if required else {}),**({'unique':True} if unique else {}))
def integer(required=False,primary=False,generated=False):
    return dict(type='integer',**({'required':True} if required else {}),**({'primaryKey':True} if primary else {}),**({'generated':True} if generated else {}))
spec={
 'apiVersion':'looprd/v1','component':'looprd-social','release':version,'api':{'version':'v1'},
 'auth':{'mode':'public'},
 'limits':{'requestsPerMinute':180,'authAttemptsPerMinute':90,'burstPerSecond':15,'maxInFlight':30},
  'database':{'backend':'sqlite','schemaVersion':3,'migrations':[{'version':2,'statements':[
  'CREATE TABLE "SocialAccount" ("id" INTEGER PRIMARY KEY, "handle" VARCHAR(32) NOT NULL UNIQUE, "passwordHash" VARCHAR(255) NOT NULL, "created" INTEGER NOT NULL, "failedAttempts" INTEGER NOT NULL, "lockedUntil" INTEGER NOT NULL)',
  'CREATE TABLE "SocialSession" ("id" INTEGER PRIMARY KEY, "subjectId" VARCHAR(72) NOT NULL, "tokenHash" VARCHAR(64) NOT NULL UNIQUE, "created" INTEGER NOT NULL, "expires" INTEGER NOT NULL, "lastSeen" INTEGER NOT NULL, "revoked" BOOLEAN NOT NULL)',
  'CREATE TABLE "SocialContact" ("id" INTEGER PRIMARY KEY, "leftId" VARCHAR(72) NOT NULL, "rightId" VARCHAR(72) NOT NULL, "requestedBy" VARCHAR(72) NOT NULL, "status" VARCHAR(16) NOT NULL, "created" INTEGER NOT NULL)',
  'CREATE UNIQUE INDEX "SocialContact_pair" ON "SocialContact" ("leftId", "rightId")',
  'CREATE TABLE "SocialDirectMessage" ("id" INTEGER PRIMARY KEY, "leftId" VARCHAR(72) NOT NULL, "rightId" VARCHAR(72) NOT NULL, "senderId" VARCHAR(72) NOT NULL, "content" VARCHAR(1000) NOT NULL, "created" INTEGER NOT NULL)',
  'CREATE INDEX "SocialDirectMessage_pair" ON "SocialDirectMessage" ("leftId", "rightId", "id")'
  ]},{'version':3,'statements':[
  'ALTER TABLE "SocialAccount" ADD COLUMN "developerEnabled" BOOLEAN NOT NULL DEFAULT 0'
  ]}]},
 'models':{
    'SocialProfile':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True,True),'data':{'type':'json','required':True},'revision':integer(True),'updated':integer(True)}},
    'SocialMessage':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'displayName':string(24,True),'content':string(320,True),'created':integer(True)}},
    'SocialPulse':{'fields':{'id':integer(primary=True,generated=True),'signal':integer(True)}},
    'SocialAccount':{'fields':{'id':integer(primary=True,generated=True),'handle':string(32,True,True),'passwordHash':string(255,True),'created':integer(True),'failedAttempts':integer(True),'lockedUntil':integer(True),'developerEnabled':{'type':'boolean','required':True}}},
    'SocialSession':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'tokenHash':string(64,True,True),'created':integer(True),'expires':integer(True),'lastSeen':integer(True),'revoked':{'type':'boolean','required':True}}},
    'SocialContact':{'fields':{'id':integer(primary=True,generated=True),'leftId':string(72,True),'rightId':string(72,True),'requestedBy':string(72,True),'status':string(16,True),'created':integer(True)},'indexes':[{'name':'SocialContact_pair','fields':['leftId','rightId'],'unique':True}]},
    'SocialDirectMessage':{'fields':{'id':integer(primary=True,generated=True),'leftId':string(72,True),'rightId':string(72,True),'senderId':string(72,True),'content':string(1000,True),'created':integer(True)},'indexes':[{'name':'SocialDirectMessage_pair','fields':['leftId','rightId','id']}]}
    },
 'resources':{'pulses':{'model':'SocialPulse','path':'/pulses','operations':['get']}},
 'websocket':{'path':'/events','resources':['pulses']},
 'handlers':[
    {'path':'/social','method':'POST','kind':'python','source':source},
    {'path':'/info','kind':'response','response':{'protocol':'looprd.social/1','auth':'social-accounts','registration':'see-capabilities','features':['contacts','direct-messages','lobby','portraits','server-gated-developer-tools'],'release':version}},
 ]}
output='# Generated from server/looprd_handler.py. Do not edit by hand.\n'+yaml.safe_dump(spec,sort_keys=False,allow_unicode=True,width=110)
if '--check' in sys.argv:
    if (root/'looprd.yaml').read_text(encoding='utf8')!=output:
        raise SystemExit('looprd.yaml is stale: run python tools/generate-looprd.py')
    print('Looprd descriptor and handler in sync')
else:
    (root/'looprd.yaml').write_text(output,encoding='utf8')
    print('Generated native Looprd social component',version)
