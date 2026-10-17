"""Looprd Social v0.3.2 native Looprd handler.

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
PORTRAIT_NUMBER = re.compile(r'^[1-9][0-9]{0,511}$')
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


# Tavi interactive events: persistent, server-authorized, bounded payloads.
INTERACTION = sa.table('SocialInteraction', sa.column('id', sa.Integer),
    sa.column('recipient', sa.String), sa.column('publisher', sa.String),
    sa.column('topic', sa.String), sa.column('title', sa.String),
    sa.column('data', sa.JSON), sa.column('status', sa.String),
    sa.column('response', sa.JSON), sa.column('created', sa.Integer),
    sa.column('expires', sa.Integer))
ACTION_ID = re.compile(r'^[a-z][a-z0-9_-]{0,47}$')

def validate_interaction(raw):
    if not isinstance(raw,dict):raise ValueError('Interaction must be an object')
    title=raw.get('title'); topic=raw.get('topic'); actions=raw.get('actions')
    if not isinstance(title,str) or not 1<=len(title)<=120 or re.search(r'[\x00-\x1f]',title):raise ValueError('Invalid event title')
    if not isinstance(topic,str) or not re.fullmatch(r'[a-z][a-z0-9_.-]{1,80}',topic):raise ValueError('Invalid event topic')
    if not isinstance(actions,list) or not 1<=len(actions)<=6:raise ValueError('Provide 1–6 actions')
    cleaned=[]; used=set()
    for item in actions:
        if not isinstance(item,dict):raise ValueError('Invalid action')
        aid=item.get('id'); kind=item.get('type'); label=item.get('label')
        if not isinstance(aid,str) or not ACTION_ID.fullmatch(aid) or aid in used:raise ValueError('Invalid action ID')
        if kind not in ('reply','open-url'):raise ValueError('Unsupported action type')
        if not isinstance(label,str) or not 1<=len(label)<=48:raise ValueError('Invalid action label')
        entry={'id':aid,'type':kind,'label':label}
        if kind=='open-url':
            from urllib.parse import urlsplit
            url=item.get('url')
            try:
                u=urlsplit(url) if isinstance(url,str) else None
                if not u or u.scheme!='https' or not u.hostname or u.username or u.password or u.fragment or len(url)>2048 or u.port not in (None,443):raise ValueError()
                import ipaddress
                try: ip=ipaddress.ip_address(u.hostname)
                except ValueError: ip=None
                if (ip is not None and not ip.is_global) or u.hostname in ('localhost','localhost.localdomain') or u.hostname.endswith(('.localhost','.local','.internal')):raise ValueError()
            except (ValueError,TypeError):raise ValueError('Invalid external HTTPS URL')
            entry['url']=url; entry['presentation']=item.get('presentation') if item.get('presentation') in ('external-browser','native-webview') else 'external-browser'
        else:
            fields=item.get('fields',[])
            if not isinstance(fields,list) or len(fields)>6:raise ValueError('Invalid reply fields')
            parsed=[]
            for field in fields:
                if not isinstance(field,dict) or not isinstance(field.get('id'),str) or not ACTION_ID.fullmatch(field['id']) or field.get('type') not in ('text','textarea','select'):raise ValueError('Invalid reply field')
                entryfield={'id':field['id'],'type':field['type'],'label':str(field.get('label',field['id']))[:60]}
                if field['type']=='select':
                    options=field.get('options')
                    if not isinstance(options,list) or not 1<=len(options)<=12 or not all(isinstance(x,str) and 1<=len(x)<=80 for x in options):raise ValueError('Invalid field options')
                    entryfield['options']=options
                parsed.append(entryfield)
            entry['fields']=parsed
        cleaned.append(entry);used.add(aid)
    message=raw.get('body','')
    if not isinstance(message,str) or len(message)>2000:raise ValueError('Invalid event body')
    return {'title':title,'body':message,'topic':topic,'actions':cleaned}

def interaction_feed(db,subject,now):
    rows=db.execute(sa.select(INTERACTION).where(INTERACTION.c.recipient==subject).order_by(INTERACTION.c.id.desc()).limit(80)).mappings().all()
    return {'ok':True,'schema':'tavi.interactions/v1','events':[
      {'id':r['id'],'publisher':r['publisher'],'topic':r['topic'],**r['data'],
       'status':('expired' if r['expires']<=now and r['status']=='open' else r['status']),
       'created':r['created'],'expires':r['expires'],'response':r['response']}
      for r in rows]}

def interaction_reply(db,subject,body,now):
    event_id=body.get('id');action=body.get('action');values=body.get('values',{})
    if type(event_id) is not int or not isinstance(action,str) or not isinstance(values,dict):return error('Invalid event response')
    row=db.execute(sa.select(INTERACTION).where(INTERACTION.c.id==event_id,INTERACTION.c.recipient==subject)).mappings().first()
    if not row:return error('Event not found')
    if row['status']!='open' or row['expires']<=now:return error('Event already handled or expired')
    allowed=next((x for x in row['data']['actions'] if x['id']==action and x['type']=='reply'),None)
    if not allowed:return error('Action not available')
    fields={f['id']:f for f in allowed['fields']}
    if len(values)>len(fields) or any(k not in fields or not isinstance(v,str) or len(v)>2000 or (fields[k]['type']=='select' and v not in fields[k]['options']) for k,v in values.items()):return error('Invalid field values')
    response={'action':action,'values':values,'at':now,'by':subject}
    db.execute(sa.update(INTERACTION).where(INTERACTION.c.id==event_id,INTERACTION.c.recipient==subject,INTERACTION.c.status=='open').values(status='responded',response=response))
    return {'ok':True,'response':response}

def interaction_dismiss(db,subject,body,now):
    event_id=body.get('id')
    if type(event_id) is not int or event_id<1:return error('Invalid event ID')
    row=db.execute(sa.select(INTERACTION).where(INTERACTION.c.id==event_id,INTERACTION.c.recipient==subject)).mappings().first()
    if not row:return error('Event not found')
    if row['status']=='dismissed':return {'ok':True,'status':'dismissed'}
    if row['status']!='open' or row['expires']<=now:return error('Event already handled or expired')
    response={'action':'dismiss','at':now,'by':subject}
    db.execute(sa.update(INTERACTION).where(INTERACTION.c.id==event_id,INTERACTION.c.recipient==subject,INTERACTION.c.status=='open').values(status='dismissed',response=response))
    return {'ok':True,'status':'dismissed'}

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
            if isinstance(name,str) and SUBJECT.fullmatch(name) and not re.fullmatch(r'acct_[0-9]+',name)
            and isinstance(token,str) and len(token)>=24 and len(token)<=256}


def authorize(token, tokens):
    if not isinstance(token,str) or not 24<=len(token)<=256:
        return None
    value=hashlib.sha256(token.encode('utf8')).digest()
    identity=None
    for name,secret in tokens.items():
        if not re.fullmatch(r'acct_[0-9]+',name) and isinstance(secret,str) and hmac.compare_digest(value,hashlib.sha256(secret.encode('utf8')).digest()):
            identity=name
    return identity


def valid_portrait_code(code):
    """Validate portable numeric portrait v1 framing, without owning online artwork IDs.

    TheBigTreeInc/assets owns the registry and rendering. Social stores only the
    canonical decimal *text*; no JavaScript number coercion or asset downloads.
    """
    if not isinstance(code, str) or not PORTRAIT_NUMBER.fullmatch(code):
        raise ValueError('Portrait code must be canonical decimal text')
    number = int(code)
    value = number.to_bytes((number.bit_length()+7)//8, 'big')
    pos = 0
    def read(size):
        nonlocal pos
        if pos+size > len(value):
            raise ValueError('Truncated portrait code')
        part = int.from_bytes(value[pos:pos+size], 'big')
        pos += size
        return part
    if read(1) != 1:
        raise ValueError('Unsupported portrait encoding')
    count = read(1)
    if not 5 <= count <= 11:
        raise ValueError('Invalid portrait part count')
    parts = {}
    previous = 0
    for _ in range(count):
        kind = read(2)
        identity = read(4)
        if not 1 <= kind <= 11 or kind <= previous or not identity:
            raise ValueError('Invalid portrait part identity')
        parts[kind] = identity
        previous = kind
    if not {1,2,3,4,6}.issubset(parts):
        raise ValueError('Missing required portrait parts')
    if read(1) != 7:
        raise ValueError('Invalid portrait colour count')
    for color in range(1,8):
        if read(2) != color:
            raise ValueError('Invalid portrait colour order')
        read(3)
    if pos != len(value) or str(number) != code:
        raise ValueError('Noncanonical portrait code')
    return code


def clean_profile(subject, input):
    if not isinstance(input,dict) or input.get('schema',SCHEMA)!=SCHEMA:
        raise ValueError('Invalid shared profile')
    if set(input)-{'schema','profileId','displayName','appearance','portraitCode'}:
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
    portrait_code = input.get('portraitCode')
    if portrait_code is not None:
        portrait_code = valid_portrait_code(portrait_code)
    return {'schema':SCHEMA,'profileId':subject,'displayName':name,'appearance':appearance,'portraitCode':portrait_code}


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



import base64
import hashlib
import hmac
import os
import re
import secrets
import time
import sqlalchemy as sa

ACCOUNT = sa.table('SocialAccount', sa.column('id',sa.Integer),sa.column('handle',sa.String),
    sa.column('passwordHash',sa.String),sa.column('created',sa.Integer),
    sa.column('failedAttempts',sa.Integer),sa.column('lockedUntil',sa.Integer),
    sa.column('developerEnabled',sa.Boolean))
SESSION = sa.table('SocialSession',sa.column('id',sa.Integer),sa.column('subjectId',sa.String),
    sa.column('tokenHash',sa.String),sa.column('created',sa.Integer),
    sa.column('expires',sa.Integer),sa.column('lastSeen',sa.Integer),sa.column('revoked',sa.Boolean))
CONTACT = sa.table('SocialContact',sa.column('id',sa.Integer),sa.column('leftId',sa.String),
    sa.column('rightId',sa.String),sa.column('requestedBy',sa.String),
    sa.column('status',sa.String),sa.column('created',sa.Integer))
DM = sa.table('SocialDirectMessage',sa.column('id',sa.Integer),sa.column('leftId',sa.String),
    sa.column('rightId',sa.String),sa.column('senderId',sa.String),
    sa.column('content',sa.String),sa.column('created',sa.Integer))
HANDLE = re.compile(r'^[a-z][a-z0-9_]{2,23}$')
SESSION_AGE = 30*86400
DUMMY_SALT = b'looprd-social-dummy-salt'

def username(value):
    if not isinstance(value,str) or not HANDLE.fullmatch(value.strip().lower()):
        raise ValueError('Username must be 3–24 letters, digits or underscores and start with a letter')
    return value.strip().lower()

def password_digest(password,salt=None):
    if not isinstance(password,str) or not 12<=len(password)<=128:
        raise ValueError('Password must contain 12–128 characters')
    salt = salt or secrets.token_bytes(16)
    digest=hashlib.scrypt(password.encode(),salt=salt,n=16384,r=8,p=1,maxmem=32*1024*1024)
    return 'scrypt16384$'+base64.urlsafe_b64encode(salt).decode().rstrip('=')+'$'+digest.hex()

def verify_password(password,stored):
    try:
        tag,salt,text=stored.split('$')
        if tag!='scrypt16384' or not isinstance(password,str) or len(password)>128:
            return False
        raw=base64.urlsafe_b64decode(salt+'='*(-len(salt)%4))
        guess=hashlib.scrypt(password.encode(),salt=raw,n=16384,r=8,p=1,maxmem=32*1024*1024)
        return hmac.compare_digest(guess,bytes.fromhex(text))
    except (ValueError,TypeError,OverflowError):
        return False

def new_session(db,subject,now):
    value=secrets.token_urlsafe(32)
    db.execute(sa.insert(SESSION).values(subjectId=subject,tokenHash=hashlib.sha256(value.encode()).hexdigest(),
        created=now,expires=now+SESSION_AGE,lastSeen=now,revoked=False))
    return {'token':value,'expiresAt':now+SESSION_AGE}

def session_identity(db,token,now):
    if not isinstance(token,str) or not 32<=len(token)<=256:
        return None
    hashed=hashlib.sha256(token.encode()).hexdigest()
    session=db.execute(sa.select(SESSION).where(SESSION.c.tokenHash==hashed,
        SESSION.c.revoked.is_(False),SESSION.c.expires>now)).mappings().first()
    if not session:
        return None
    # Batched presence freshness; no speculative persistence when not authenticated.
    if now-session['lastSeen']>=30:
        db.execute(sa.update(SESSION).where(SESSION.c.id==session['id']).values(lastSeen=now))
    return session['subjectId']

def register(db,body,now):
    if os.getenv('LOOPRD_SOCIAL_ALLOW_REGISTRATION','true').lower() not in ('true','1','yes'):
        return {'ok':False,'error':'Registration is disabled on this Social server','code':'REGISTRATION_DISABLED'}
    handle=username(body.get('username'))
    password=body.get('password')
    if db.execute(sa.select(ACCOUNT.c.id).where(ACCOUNT.c.handle==handle)).first():
        return {'ok':False,'error':'This username is already registered','code':'USERNAME_TAKEN'}
    digest=password_digest(password)
    id_=db.execute(sa.insert(ACCOUNT).values(handle=handle,passwordHash=digest,created=now,
        failedAttempts=0,lockedUntil=0,developerEnabled=False).returning(ACCOUNT.c.id)).scalar_one()
    subject='acct_'+str(id_)
    db.execute(sa.insert(PROFILE).values(subjectId=subject,
        data={'schema':SCHEMA,'profileId':subject,'displayName':handle,'appearance':None,'portraitCode':None},
        revision=1,updated=now))
    return {'ok':True,**new_session(db,subject,now),'profileId':subject}

def login(db,body,now):
    # Never reveal whether a username exists. Persistent per-account backoff and
    # generic LoopRD per-IP rate limits both apply to public authentication.
    try: handle=username(body.get('username'))
    except ValueError: handle=None
    record=db.execute(sa.select(ACCOUNT).where(ACCOUNT.c.handle==handle)).mappings().first() if handle else None
    password=body.get('password')
    if record is None:
        if isinstance(password,str) and 12<=len(password)<=128:
            hashlib.scrypt(password.encode(),salt=DUMMY_SALT,n=16384,r=8,p=1,maxmem=32*1024*1024)
        return {'ok':False,'error':'Invalid username or password','code':'INVALID_LOGIN'}
    if record['lockedUntil']>now:
        return {'ok':False,'error':'Too many attempts; try again later','code':'LOGIN_LOCKED'}
    if not verify_password(password,record['passwordHash']):
        attempts=record['failedAttempts']+1
        db.execute(sa.update(ACCOUNT).where(ACCOUNT.c.id==record['id']).values(
            failedAttempts=attempts,lockedUntil=now+900 if attempts>=5 else 0))
        return {'ok':False,'error':'Invalid username or password','code':'INVALID_LOGIN'}
    db.execute(sa.update(ACCOUNT).where(ACCOUNT.c.id==record['id']).values(failedAttempts=0,lockedUntil=0))
    subject='acct_'+str(record['id'])
    return {'ok':True,**new_session(db,subject,now),'profileId':subject}

def logout(db,token):
    if isinstance(token,str):
        db.execute(sa.update(SESSION).where(SESSION.c.tokenHash==hashlib.sha256(token.encode()).hexdigest()).values(revoked=True))
    return {'ok':True}

# Social-specific development privilege: operator-set DB entitlement, never a
# LoopRD management role. Checked on EVERY privileged request and profile refresh.
# Development tokens cannot get this privilege, even when their subject resembles
# a registered user; no public API path changes the flag.
SOCIAL_RELEASE = '0.3.2'
SOCIAL_SCHEMA_VERSION = 3

def account_developer_permission(db, subject):
    if not isinstance(subject, str) or not re.fullmatch(r'acct_[1-9][0-9]{0,18}', subject):
        return False
    account = db.execute(sa.select(ACCOUNT.c.developerEnabled).where(
        ACCOUNT.c.id == int(subject[5:]))).first()
    return account is not None and account[0] is True

def developer_diagnostics(db, subject, now):
    """Deliberately aggregate-only: never include credentials, messages, or raw SQL."""
    if not account_developer_permission(db, subject):
        return {'ok': False, 'error': 'Developer tools are not enabled for this account',
                'code': 'DEVELOPER_ACCESS_DENIED'}
    models = (('accounts', ACCOUNT), ('profiles', PROFILE), ('contacts', CONTACT),
              ('directMessages', DM), ('lobbyMessages', MESSAGE))
    counts = {label: db.execute(sa.select(sa.func.count()).select_from(table)).scalar_one()
              for label, table in models}
    counts['activeSessions'] = db.execute(sa.select(sa.func.count()).select_from(SESSION)
        .where(SESSION.c.revoked.is_(False), SESSION.c.expires > now)).scalar_one()
    return {'ok': True, 'schema': 'looprd.social.developer-diagnostics/v1',
        'component': SOCIAL, 'release': SOCIAL_RELEASE,
        'apiVersion': 'looprd/v1', 'databaseSchemaVersion': SOCIAL_SCHEMA_VERSION,
        'serverTime': now, 'counts': counts,
        'features': ['accounts', 'contacts', 'direct-messages', 'lobby', 'portraits',
                     'server-gated-developer-tools']}

def pair(a,b): return tuple(sorted((a,b)))

def contact_row(db,subject,other):
    left,right=pair(subject,other)
    return db.execute(sa.select(CONTACT).where(CONTACT.c.leftId==left,CONTACT.c.rightId==right)).mappings().first()

def account_subject(db,handle):
    row=db.execute(sa.select(ACCOUNT.c.id).where(ACCOUNT.c.handle==handle)).first()
    return 'acct_'+str(row[0]) if row else None

def contact_list(db,subject,now):
    contacts=db.execute(sa.select(CONTACT).where(sa.or_(CONTACT.c.leftId==subject,CONTACT.c.rightId==subject))).mappings().all()
    result=[]
    for link in contacts:
        peer=link['rightId'] if link['leftId']==subject else link['leftId']
        if not peer.startswith('acct_'): continue
        account=db.execute(sa.select(ACCOUNT.c.handle).where(ACCOUNT.c.id==int(peer[5:]))).first()
        if not account:continue
        online=db.execute(sa.select(SESSION.c.id).where(SESSION.c.subjectId==peer,
            SESSION.c.lastSeen>=now-100,SESSION.c.expires>now,SESSION.c.revoked.is_(False)).limit(1)).first() is not None
        result.append({'id':peer,'username':account[0],'status':link['status'],
            'direction':'outgoing' if link['requestedBy']==subject else 'incoming',
            'online':online,'game':None})
    return {'ok':True,'contacts':sorted(result,key=lambda v:(v['status']!='accepted',not v['online'],v['username']))}

def contact_request(db,subject,handle,now):
    peer=account_subject(db,username(handle))
    if not peer or peer==subject:return {'ok':False,'error':'User not found or unavailable'}
    existing=contact_row(db,subject,peer)
    if existing:return {'ok':False,'error':'Contact request already exists'}
    left,right=pair(subject,peer)
    db.execute(sa.insert(CONTACT).values(leftId=left,rightId=right,requestedBy=subject,status='pending',created=now))
    return {'ok':True}

def contact_action(db,subject,peer,action):
    if not isinstance(peer,str) or not re.fullmatch(r'acct_[0-9]{1,19}',peer):
        return {'ok':False,'error':'Invalid contact'}
    row=contact_row(db,subject,peer)
    if not row:return {'ok':False,'error':'Contact not found'}
    if action=='contact_accept':
        if row['status']!='pending' or row['requestedBy']==subject:
            return {'ok':False,'error':'No incoming request to accept'}
        db.execute(sa.update(CONTACT).where(CONTACT.c.id==row['id']).values(status='accepted'))
    elif action=='contact_remove':
        db.execute(sa.delete(CONTACT).where(CONTACT.c.id==row['id']))
    return {'ok':True}

def direct_messages(db,subject,peer,now):
    row=contact_row(db,subject,peer)
    if not row or row['status']!='accepted':return {'ok':False,'error':'Contact is not accepted'}
    left,right=pair(subject,peer)
    rows=db.execute(sa.select(DM).where(DM.c.leftId==left,DM.c.rightId==right,DM.c.created>=now-30*86400)
        .order_by(DM.c.id.desc()).limit(100)).mappings().all()
    return {'ok':True,'messages':[{'id':m['id'],'authorId':m['senderId'], 'text':m['content'], 'at':m['created']}
        for m in reversed(rows)]}

def direct_send(db,subject,peer,content,now):
    if not isinstance(content,str) or not 1<=len(content.strip())<=1000 or re.search(r'[\x00-\x08\x0e-\x1f\x7f]',content):
        return {'ok':False,'error':'Message must be 1–1000 safe characters'}
    row=contact_row(db,subject,peer)
    if not row or row['status']!='accepted':return {'ok':False,'error':'Contact is not accepted'}
    left,right=pair(subject,peer)
    prev=db.execute(sa.select(DM.c.created).where(DM.c.senderId==subject).order_by(DM.c.id.desc()).limit(1)).scalar_one_or_none()
    if prev is not None and now-prev<1:return {'ok':False,'error':'Please slow down'}
    db.execute(sa.insert(DM).values(leftId=left,rightId=right,senderId=subject,content=content.strip(),created=now))
    return {'ok':True}


def published_games():
    """Operator-published HTTPS game catalog; never supplied by clients.

    Deployment sets TAVI_GAME_CATALOG_JSON to an array of entries. Invalid entries
    fail closed; credentials, arbitrary protocols and local-network URLs are not allowed.
    """
    from urllib.parse import urlsplit
    try:
        entries=json.loads(os.getenv('TAVI_GAME_CATALOG_JSON','[]'))
    except (ValueError,TypeError):
        return []
    if not isinstance(entries,list):return []
    games=[]; seen=set()
    for item in entries[:40]:
        if not isinstance(item,dict):continue
        key=item.get('id'); name=item.get('name'); url=item.get('url')
        if not isinstance(key,str) or not re.fullmatch(r'[a-z][a-z0-9-]{1,47}',key) or key in seen:continue
        if not isinstance(name,str) or not 1<=len(name.strip())<=64:continue
        if not isinstance(url,str) or len(url)>2048:continue
        try:
            parsed=urlsplit(url)
            host=(parsed.hostname or '').lower()
            if parsed.scheme!='https' or not host or parsed.username or parsed.password or parsed.fragment or parsed.port not in (None,443):continue
            if host in ('localhost','localhost.localdomain') or host.endswith(('.local','.internal','.localhost')):continue
            import ipaddress
            try:
                if not ipaddress.ip_address(host).is_global:continue
            except ValueError:pass
        except ValueError:continue
        seen.add(key)
        games.append({'id':key,'name':name.strip(),'type':'web','url':url,'embedded':item.get('embedded') is True,'external':True})
    return games


def execute(body,sessions,tokens=None,now=None):
    """Returns (response, optional notification), after SQLite commit."""
    if not isinstance(body,dict):
        return error('Invalid request'),None
    tokens=configured_tokens() if tokens is None else tokens
    op=body.get('op')
    now=int(time.time()) if now is None else int(now)
    try:
        with sessions.begin() as db:
            if op=='game_catalog':
                return {'ok':True,'schema':'tavi.game-catalog/v1','games':published_games()},None
            if op=='capabilities':
                return {'ok':True,'schema':'looprd.social.capabilities/v1',
                    'accounts':True,'registration':os.getenv('LOOPRD_SOCIAL_ALLOW_REGISTRATION','true').lower() in ('true','1','yes'),
                    'contacts':True,'directMessages':True,'sessionSeconds':SESSION_AGE},None
            if op=='register':
                return register(db,body,now),None
            if op=='login':
                return login(db,body,now),None
            subject=session_identity(db,body.get('token'),now) or authorize(body.get('token'),tokens)
            if not subject:
                return error('Sign in to Social first'),None
            if op=='interaction_feed':
                return interaction_feed(db,subject,now),None
            if op=='interaction_reply':
                result=interaction_reply(db,subject,body,now)
                return result,event_signal(db) if result['ok'] else None
            if op=='interaction_dismiss':
                result=interaction_dismiss(db,subject,body,now)
                return result,event_signal(db) if result['ok'] else None
            if op=='interaction_publish':
                # Development/initial integration publisher: only operator-authorized developer accounts.
                if not account_developer_permission(db,subject):
                    return error('Publisher permission denied'),None
                recipient=body.get('recipient')
                if not isinstance(recipient,str) or not re.fullmatch(r'[a-z][a-z0-9_]{2,23}',recipient):return error('Invalid recipient'),None
                target=db.execute(sa.select(ACCOUNT.c.id).where(ACCOUNT.c.handle==recipient)).first()
                if not target:return error('Recipient not found'),None
                clean=validate_interaction(body.get('interaction'))
                expiry=now+min(7*86400,max(60,int(body.get('ttlSeconds',86400))))
                db.execute(sa.insert(INTERACTION).values(recipient='acct_'+str(target[0]),publisher=subject,
                    topic=clean['topic'],title=clean['title'],data=clean,status='open',response=None,created=now,expires=expiry))
                return {'ok':True},event_signal(db)
            if op=='developer_diagnostics':
                # Do not trust a client-supplied username or privilege claim.
                return developer_diagnostics(db,subject,now),None
            if op=='logout':
                return logout(db,body.get('token')),None
            if op=='contact_list':
                return contact_list(db,subject,now),None
            if op=='contact_request':
                result=contact_request(db,subject,body.get('username'),now)
                return result,event_signal(db) if result['ok'] else None
            if op in ('contact_accept','contact_remove'):
                result=contact_action(db,subject,body.get('peer'),op)
                return result,event_signal(db) if result['ok'] else None
            if op=='dm_feed':
                return direct_messages(db,subject,body.get('peer'),now),None
            if op=='dm_send':
                result=direct_send(db,subject,body.get('peer'),body.get('text'),now)
                return result,event_signal(db) if result['ok'] else None
            stored=db.execute(sa.select(PROFILE).where(PROFILE.c.subjectId==subject)).mappings().first()
            current=stored['data'] if stored else {'schema':SCHEMA,'profileId':subject,
                      'displayName':subject,'appearance':None,'portraitCode':None}
            if op=='me':
                return {'ok':True,'profile':current,'revision':stored['revision'] if stored else 0,
                    'permissions':{'developer':account_developer_permission(db,subject)}},None
            if op=='save_profile':
                incoming=body.get('profile')
                if isinstance(incoming,dict) and stored and 'portraitCode' not in incoming:
                    # Older clients can still rename accounts without removing v3 portraits.
                    incoming={**incoming,'portraitCode':current.get('portraitCode')}
                p=clean_profile(subject,incoming)
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
                return error('Game tickets require application-owned verified identity and game-service validation; not implemented'),None
            return error('Unknown operation'),None
    except sa.exc.IntegrityError:
        return error('Account or contact already exists'),None
    except (ValueError,TypeError) as exc:
        return error(str(exc)),None


async def handle(ctx):
    result,event=await run_in_threadpool(execute,ctx.body,ctx.session_factory)
    if event is not None:
        ctx.publish(event)
    return result
