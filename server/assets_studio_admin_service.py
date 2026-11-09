"""Trusted Social -> Assets Studio broker. No caller-selected service URL or credentials.

This handler is designed for a separate user-scoped /asset-studio LoopRD DAPI.
It never accepts an app ID, admin flag, service token or actor from the body.
The canonical Assets component verifies the signed delegation independently.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

OPERATIONS=frozenset(('status','stage.begin','stage.chunk','stage.commit','stage.abort',
                      'records.list','records.get','price.propose','publish','revoke'))
PUBLISH=frozenset(('price.propose','publish','revoke'))
INGEST=frozenset(('stage.begin','stage.chunk','stage.commit','stage.abort'))
SENSITIVE=PUBLISH
ALNUM=re.compile(r'^[A-Za-z0-9_-]{16,128}$')
SHA=re.compile(r'^[a-f0-9]{64}$')
FILE=re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.tavia$')
SUBJECT=re.compile(r'^acct_[1-9][0-9]{0,18}$')
SECRET_REF=re.compile(r'^[A-Za-z0-9_./-]{1,200}$')
STATES=frozenset(('staged','published','revoked','failed'))

class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')

def _int(v,lower,upper):
    return type(v) is int and lower<=v<=upper

def _str(v,pattern):
    return isinstance(v,str) and bool(pattern.fullmatch(v))

def validate(operation,params):
    """A strict, auditable projection of TaviX registry-admin request schema v1."""
    if operation not in OPERATIONS or not isinstance(params,dict):
        raise ValueError('invalid_request')
    patterns={'recordId':lambda v:_str(v,ALNUM),'uploadId':lambda v:_str(v,ALNUM),
        'idempotencyKey':lambda v:_str(v,ALNUM),'sha256':lambda v:_str(v,SHA),
        'fileName':lambda v:_str(v,FILE),'byteLength':lambda v:_int(v,1,67108864),
        'offset':lambda v:_int(v,0,67108863),'expectedRevision':lambda v:_int(v,1,2147483647),
        'priceGold':lambda v:_int(v,0,1000000),
        'dataBase64':lambda v:isinstance(v,str) and 4<=len(v)<=349528 and bool(re.fullmatch(r'[A-Za-z0-9+/]+={0,2}',v)),
        'reason':lambda v:isinstance(v,str) and 10<=len(v)<=500,
        'state':lambda v:v in STATES,'limit':lambda v:_int(v,1,100),
        'cursor':lambda v:isinstance(v,str) and 1<=len(v)<=256}
    req={
        'status':(),
        'stage.begin':('fileName','byteLength','sha256','idempotencyKey'),
        'stage.chunk':('uploadId','offset','dataBase64'),
        'stage.commit':('uploadId','sha256','idempotencyKey'),
        'stage.abort':('uploadId',),
        'records.list':(),
        'records.get':('recordId',),
        'price.propose':('recordId','expectedRevision','priceGold','idempotencyKey'),
        'publish':('recordId','expectedRevision','idempotencyKey'),
        'revoke':('recordId','expectedRevision','reason','idempotencyKey')}
    optional={'records.list':('state','limit','cursor')}
    allowed=set(req[operation])|set(optional.get(operation,()))
    if not set(req[operation]).issubset(params) or set(params)-allowed:
        raise ValueError('invalid_request')
    if any(not patterns[k](v) for k,v in params.items()):
        raise ValueError('invalid_request')
    return params

def current_admin(session_factory,subject):
    if not _str(subject,SUBJECT):return False
    with session_factory() as db:
        return db.execute(sa.text('SELECT "ecosystemAdmin" FROM "SocialAccount" WHERE id=:id'),
            {'id':int(subject[5:])}).scalar() == 1

def _endpoint():
    url=os.environ.get('LOOPRD_TAVI_ASSETS_STUDIO_URL','')
    if not isinstance(url,str) or len(url)>1024:return None
    parsed=urlsplit(url)
    if (parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or
            parsed.query or parsed.fragment or parsed.path.endswith('/') or not parsed.path.endswith('/studio')):
        return None
    return url

def _secret(ctx,key):
    ref=os.environ.get(key,'')
    if not SECRET_REF.fullmatch(ref) or '..' in ref.split('/') or ref.startswith('/'):
        return None
    try:
        value=ctx.secret(ref)
        return value.strip() if isinstance(value,str) and len(value.strip())>=32 else None
    except (AttributeError,ValueError,OSError,KeyError):return None

def _credentials(ctx,op):
    key=('LOOPRD_TAVI_ASSETS_INGEST_SECRET_REF' if op in INGEST else
         'LOOPRD_TAVI_ASSETS_PUBLISH_SECRET_REF')
    return _secret(ctx,key),_secret(ctx,'LOOPRD_TAVI_ASSETS_DELEGATION_SECRET_REF')

def _send(url,token,body):
    content=canonical(body)
    if len(content)>400000:return {'ok':False,'error':'invalid_request'}
    request=Request(url,content,{'Content-Type':'application/json',
                                'Authorization':'Bearer '+token,'Accept':'application/json'},method='POST')
    try:
        with build_opener(_NoRedirect()).open(request,timeout=12) as response:
            if response.status!=200:return {'ok':False,'error':'unavailable'}
            data=response.read(1_000_001)
            if len(data)>1_000_000:return {'ok':False,'error':'unavailable'}
            answer=json.loads(data)
            if not isinstance(answer,dict):return {'ok':False,'error':'unavailable'}
            return answer
    except (HTTPError,URLError,OSError,ValueError,TimeoutError):
        return {'ok':False,'error':'unavailable'}

def dispatch(ctx,now=None,transport=_send):
    """Read principal from LoopRD verifier, recheck administrator row per operation."""
    principal=getattr(ctx,'principal',None)
    if getattr(principal,'kind',None)!='user':return {'ok':False,'error':'permission_denied'}
    if 'social:api' not in (getattr(principal,'scopes',()) or ()):
        return {'ok':False,'error':'permission_denied'}
    subject=getattr(principal,'subject',None)
    if not current_admin(ctx.session_factory,subject):
        return {'ok':False,'error':'permission_denied'}
    body=getattr(ctx,'body',None)
    if not isinstance(body,dict) or set(body)-{'schema','operation','params','hostApproved'} or body.get('schema')!='tavi.social.asset-studio/v1':
        return {'ok':False,'error':'invalid_request'}
    op=body.get('operation');params=body.get('params')
    try:validate(op,params)
    except (ValueError,TypeError):return {'ok':False,'error':'invalid_request'}
    # A native confirmation is mandatory for the extension-mediated path. The
    # trusted server never treats this Boolean as an authorization claim: the
    # Social account role and exact signed service delegation remain necessary.
    if op in SENSITIVE and body.get('hostApproved') is not True:
        return {'ok':False,'error':'confirmation_required'}
    if op not in SENSITIVE and 'hostApproved' in body:
        return {'ok':False,'error':'invalid_request'}
    url=_endpoint();token,delegation_secret=_credentials(ctx,op)
    if not url or not token or not delegation_secret or not callable(ctx.session_factory):
        return {'ok':False,'error':'unavailable'}
    # Only a verified, non-revoked Social session may sign a delegation. No
    # browser-provided actor, source, admin flag or service destination is used.
    session_id=getattr(principal,'sessionId',None)
    if session_id is None:return {'ok':False,'error':'permission_denied'}
    issued=int(time.time() if now is None else now)
    delegation={'schema':'tavi.assets.studio-delegation/v1',
        'audience':'tavi-assets/studio/v1','actor':subject,'sessionDigest':hashlib.sha256(str(session_id).encode()).hexdigest(),
        'operation':op,'requestSha256':hashlib.sha256(canonical(params)).hexdigest(),
        'issuedAt':issued,'expiresAt':issued+45,'nonce':secrets.token_urlsafe(24),
        'hostApproved':op in SENSITIVE}
    signed=dict(delegation,signature=hmac.new(delegation_secret.encode(),canonical(delegation),hashlib.sha256).hexdigest())
    result=transport(url,token,{'schema':'tavi.assets.studio-request/v1','operation':op,
                                'params':params,'delegation':signed})
    if not isinstance(result,dict) or result.get('ok') is not True:
        error=result.get('error') if isinstance(result,dict) else None
        return {'ok':False,'error':error if error in {'permission_denied','not_found','invalid_request',
                'revision_conflict','validation_failed','unavailable','not_staged','already_published'} else 'unavailable'}
    # Refuse to return backend tokens or unsolicited results. Registry response
    # schema is contract-validated by the Assets component and TaviX client.
    value=result.get('result')
    if not isinstance(value,dict) or len(canonical(value))>800000:
        return {'ok':False,'error':'unavailable'}
    return {'ok':True,'result':value}

async def handle(ctx):
    return await run_in_threadpool(dispatch,ctx)
