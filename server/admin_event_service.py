"""Trusted service-contract handler delivering a Tavi inbox event to ecosystem admins.

The Social verified verifier authenticates the calling component as kind=service.
No Tavi user can call this endpoint with their ordinary account credential.
"""
import hashlib
import json
import ipaddress
import re
import time
from urllib.parse import urlsplit

import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

MAX_ADMIN_RECIPIENTS = 100


def safe_https_url(value):
    if not isinstance(value, str) or len(value) > 2048 or any(ord(c) < 33 or c == '\\' for c in value):
        return False
    try:
        url = urlsplit(value)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or url.fragment or url.port not in (None, 443):
            return False
        host=url.hostname.lower()
        if host in ('localhost', 'localhost.localdomain') or host.endswith(('.localhost', '.local', '.internal')):
            return False
        try:
            ip=ipaddress.ip_address(host)
            if not ip.is_global:
                return False
        except ValueError:
            pass
        return True
    except (ValueError, TypeError):
        return False


def build_interaction(body):
    topic=body.get('topic')
    title=body.get('title')
    description=body.get('body','')
    link=body.get('url')
    ttl=body.get('ttlSeconds',86400)
    if (not isinstance(topic,str) or not re.fullmatch(r'[a-z][a-z0-9_.-]{1,79}',topic)
            or not isinstance(title,str) or not 1 <= len(title) <= 120
            or not isinstance(description,str) or len(description)>2000
            or any(ord(char)<32 or ord(char)==127 for char in topic+title)
            or type(ttl) is not int or not 60 <= ttl <= 604800):
        return None
    if link is not None and not safe_https_url(link):
        return None
    actions=[{'id':'open-link','type':'open-url','label':'Open details',
              'url':link,'presentation':'external-browser'}] if link else [
              {'id':'acknowledge','type':'reply','label':'Acknowledge','fields':[]}]
    return {'topic':topic,'title':title,'body':description,'actions':actions},ttl


def principal_id(subject):
    return hashlib.sha256(('tavi-social\0'+subject).encode('utf8')).hexdigest()


def deliver(ctx):
    if getattr(ctx.principal,'kind',None)!='service' or not re.fullmatch(r'[a-z][a-z0-9-]{1,47}',ctx.principal.subject or ''):
        return {'accepted':False,'recipients':0,'reason':'service_identity_required'}
    constructed=build_interaction(ctx.body or {})
    if constructed is None:
        return {'accepted':False,'recipients':0,'reason':'invalid_interaction'}
    data,ttl=constructed
    now=int(time.time())
    with ctx.transaction() as session:
        admins=session.execute(sa.text('SELECT id FROM "SocialAccount" WHERE "ecosystemAdmin" = 1 ORDER BY id LIMIT :limit'),
            {'limit':MAX_ADMIN_RECIPIENTS+1}).scalars().all()
        if len(admins)>MAX_ADMIN_RECIPIENTS:
            return {'accepted':False,'recipients':0,'reason':'recipient_limit'}
        if not admins:
            return {'accepted':True,'recipients':0}
        for account_id in admins:
            subject='acct_'+str(account_id)
            session.execute(sa.text('''INSERT INTO "SocialInteraction" ("recipient","publisher","topic","title","data","status","response","created","expires")
                VALUES (:recipient,:publisher,:topic,:title,:data,'open',NULL,:created,:expires)'''),
                {'recipient':subject,'publisher':'service:'+ctx.principal.subject,
                 'topic':data['topic'],'title':data['title'],
                 'data':json.dumps(data),'created':now,'expires':now+ttl})
        row=session.execute(sa.text('SELECT signal FROM "SocialPulse" WHERE id=1')).first()
        signal=(row[0] if row else 0)+1
        if row:
            session.execute(sa.text('UPDATE "SocialPulse" SET signal=:signal WHERE id=1'),{'signal':signal})
        else:
            session.execute(sa.text('INSERT INTO "SocialPulse" (id,signal) VALUES (1,:signal)'),{'signal':signal})
        ctx.emit(session,{'resource':'pulses','action':'updated','id':1,'data':{'id':1,'signal':signal}})
        for account_id in admins:
            ctx.notify(session,principal_id('acct_'+str(account_id)))
    return {'accepted':True,'recipients':len(admins)}


async def handle(ctx):
    return await run_in_threadpool(deliver,ctx)
