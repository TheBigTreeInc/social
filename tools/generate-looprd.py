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
 'database':{'backend':'sqlite','schemaVersion':1},
 'models':{
    'SocialProfile':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True,True),'data':{'type':'json','required':True},'revision':integer(True),'updated':integer(True)}},
    'SocialMessage':{'fields':{'id':integer(primary=True,generated=True),'subjectId':string(72,True),'displayName':string(24,True),'content':string(320,True),'created':integer(True)}},
    'SocialPulse':{'fields':{'id':integer(primary=True,generated=True),'signal':integer(True)}}},
 'resources':{'pulses':{'model':'SocialPulse','path':'/pulses','operations':['get']}},
 'websocket':{'path':'/events','resources':['pulses']},
 'handlers':[
    {'path':'/social','method':'POST','kind':'python','source':source},
    {'path':'/info','kind':'response','response':{'protocol':'looprd.social/1','auth':'development credentials only','status':'not production identity issuer'}},
 ]}
output='# Generated from server/looprd_handler.py. Do not edit by hand.\n'+yaml.safe_dump(spec,sort_keys=False,allow_unicode=True,width=110)
if '--check' in sys.argv:
    if (root/'looprd.yaml').read_text(encoding='utf8')!=output:
        raise SystemExit('looprd.yaml is stale: run python tools/generate-looprd.py')
    print('Looprd descriptor and handler in sync')
else:
    (root/'looprd.yaml').write_text(output,encoding='utf8')
    print('Generated native Looprd social component',version)
