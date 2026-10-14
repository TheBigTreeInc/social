"""Looprd Social v0.2.0 native Looprd handler (DEVELOPMENT ONLY).

Self-contained in looprd.yaml by tools/generate-looprd.py.
The verified Looprd v1 handler contract provides ctx.body, ctx.session_factory
and ctx.publish. No unverified request-header assumptions are used.
"""
import hashlib
import hmac
import json
import os
import re
import time
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

SCHEMA = 'looprd.social.profile/v1'
APPEARANCE_SCHEMA = 'modular-portraits.identity/v1'
SOCIAL = 'looprd-social'
PROFILE = sa.table('SocialProfile',
    sa.column('id', sa.Integer), sa.column('subjectId', sa.String),
    sa.column('data', sa.JSON), sa.column('revision', sa.Integer),
    sa.column('updated', sa.Integer))
MESSAGE = sa.table('SocialMessage',
    sa.column('id', sa.Integer), sa.column('subjectId', sa.String),
    sa.column('displayName', sa.String), sa.column('content', sa.String),
    sa.column('created', sa.Integer))
PULSE = sa.table('SocialPulse', sa.column('id', sa.Integer),sa.column('signal', sa.Integer))
SUBJECT = re.compile(r'^[a-zA-Z0-9_-]{8,72}$')
SLOT = re.compile(r'^[a-z0-9-]{1,64}$')
COLOR = re.compile(r'^#[a-fA-F0-9]{6}$')


def error(message):
    return {'ok':False,'error':message}


def configured_tokens():
    """Dev identity->token mapping; provision via runtime environment/secret only."""
    raw = os.environ.get('LOOPRD_SOCIAL_DEV_TOKENS_JSON', '')
    try:
        found = json.loads(raw)
    except (ValueError,TypeError):
        return {}
    if not isinstance(found,dict):
        return {}
    return {name:token for name,token in found.items()
            if isinstance(name,str) and SUBJECT.fullmatch(name)
            and isinstance(token,str) and len(token)>=24 and len(token)<=256}


def authorize(token, tokens):
    if not isinstance(token,str) or not 24<=len(token)<=256:
        return None
    value=hashlib.sha256(token.encode('utf8')).digest()
    identity=None
    for name,secret in tokens.items():
        if isinstance(secret,str) and hmac.compare_digest(value,hashlib.sha256(secret.encode('utf8')).digest()):
            identity=name
    return identity


def clean_profile(subject, input):
    if not isinstance(input,dict) or input.get('schema',SCHEMA)!=SCHEMA:
        raise ValueError('Invalid shared profile')
    if set(input)-{'schema','profileId','displayName','appearance'}:
        raise ValueError('Game state or unrecognized profile fields are not allowed')
    if input.get('profileId') not in (None,subject):
        raise ValueError('Cannot write another profile')
    value=input.get('displayName')
    if not isinstance(value,str):
        raise ValueError('Display name required')
    name=re.sub(r'[\x00-\x1f\x7f<>]','',value).strip()[:24]
    if not name:
        raise ValueError('Display name required')
    appearance=input.get('appearance')
    if appearance is not None:
        if (not isinstance(appearance,dict) or appearance.get('schema')!=APPEARANCE_SCHEMA
                or appearance.get('pack') not in ('everyday-illustrated','dominion-pixel')
                or type(appearance.get('revision')) is not int or appearance['revision']!=1):
            raise ValueError('Invalid portrait identity')
        choices=appearance.get('choices')
        colors=appearance.get('colors')
        if (not isinstance(choices,dict) or not isinstance(colors,dict)
                or len(choices)>60 or len(colors)>60
                or not all(isinstance(k,str) and SLOT.fullmatch(k) and isinstance(v,str) and SLOT.fullmatch(v) for k,v in choices.items())
                or not all(isinstance(k,str) and SLOT.fullmatch(k) and isinstance(v,str) and COLOR.fullmatch(v) for k,v in colors.items())):
            raise ValueError('Invalid portrait attributes')
        try:
            if len(json.dumps(appearance,separators=(',',':'),ensure_ascii=False))>16384:
                raise ValueError('Portrait payload exceeds limit')
        except (ValueError,TypeError):
            raise ValueError('Invalid portrait payload')
    return {'schema':SCHEMA,'profileId':subject,'displayName':name,'appearance':appearance}


def event_signal(db):
    current=db.execute(sa.select(PULSE).where(PULSE.c.id==1)).mappings().first()
    count=(current['signal'] if current else 0)+1
    if current:
        db.execute(sa.update(PULSE).where(PULSE.c.id==1).values(signal=count))
    else:
        db.execute(sa.insert(PULSE).values(id=1,signal=count))
    # Public websocket payload intentionally excludes identity, profile and chat.
    return {'component':SOCIAL,'resource':'pulses','action':'updated','id':1,
            'data':{'id':1,'signal':count}}


def execute(body,sessions,tokens=None,now=None):
    """Returns (response, optional notification), after SQLite commit."""
    if not isinstance(body,dict):
        return error('Invalid request'),None
    tokens=configured_tokens() if tokens is None else tokens
    subject=authorize(body.get('token'),tokens)
    if not subject:
        return error('Invalid development credential'),None
    op=body.get('op')
    now=int(time.time()) if now is None else int(now)
    try:
        with sessions.begin() as db:
            stored=db.execute(sa.select(PROFILE).where(PROFILE.c.subjectId==subject)).mappings().first()
            current=stored['data'] if stored else {'schema':SCHEMA,'profileId':subject,
                      'displayName':subject,'appearance':None}
            if op=='me':
                return {'ok':True,'profile':current,'revision':stored['revision'] if stored else 0},None
            if op=='save_profile':
                p=clean_profile(subject,body.get('profile'))
                before=stored['revision'] if stored else 0
                if body.get('ifRevision') is not None and body.get('ifRevision')!=before:
                    return error('Profile revision conflict'),None
                if stored:
                    db.execute(sa.update(PROFILE).where(PROFILE.c.subjectId==subject).values(
                        data=p,revision=before+1,updated=now))
                else:
                    db.execute(sa.insert(PROFILE).values(subjectId=subject,data=p,
                        revision=1,updated=now))
                return {'ok':True,'profile':p,'revision':before+1},event_signal(db)
            if op=='chat_feed':
                rows=db.execute(sa.select(MESSAGE).where(MESSAGE.c.created>=now-7*86400)
                    .order_by(MESSAGE.c.id.desc()).limit(50)).mappings().all()
                messages=[{'id':m['id'],'authorId':m['subjectId'],'displayName':m['displayName'],
                           'text':m['content'],'at':m['created']} for m in reversed(rows)]
                return {'ok':True,'schema':'looprd.social.chat/v1','messages':messages},None
            if op=='chat_send':
                content=body.get('text')
                if not isinstance(content,str) or not 1<=len(content.strip())<=320 or re.search(r'[\x00-\x08\x0e-\x1f\x7f]',content):
                    return error('Invalid chat message'),None
                last=db.execute(sa.select(MESSAGE.c.created).where(MESSAGE.c.subjectId==subject)
                    .order_by(MESSAGE.c.id.desc()).limit(1)).scalar_one_or_none()
                if last is not None and now-last<2:
                    return error('Chat cooldown: wait 2 seconds'),None
                db.execute(sa.insert(MESSAGE).values(subjectId=subject,
                    displayName=current['displayName'],content=content.strip(),created=now))
                new_id=db.execute(sa.select(MESSAGE.c.id).order_by(MESSAGE.c.id.desc()).limit(1)).scalar_one()
                # Bounded 7-day/100-message history. No game states or tokens retained.
                db.execute(sa.delete(MESSAGE).where(MESSAGE.c.created<now-7*86400))
                keep=db.execute(sa.select(MESSAGE.c.id).order_by(MESSAGE.c.id.desc()).limit(100)).scalars().all()
                if keep:db.execute(sa.delete(MESSAGE).where(MESSAGE.c.id.not_in(keep)))
                message={'id':new_id,'authorId':subject,
                    'displayName':current['displayName'],'text':content.strip(),'at':now}
                return {'ok':True,'message':message},event_signal(db)
            if op=='game_ticket':
                return error('Game tickets require trusted OIDC and game-service validation; not implemented'),None
            return error('Unknown operation'),None
    except (ValueError,TypeError) as exc:
        return error(str(exc)),None


async def handle(ctx):
    result,event=await run_in_threadpool(execute,ctx.body,ctx.session_factory)
    if event is not None:
        ctx.publish(event)
    return result
