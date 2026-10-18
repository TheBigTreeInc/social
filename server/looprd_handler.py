"""Tavi Social native LoopRD handler with verified identities and durable wake hints.

Embedded in looprd.yaml by tools/generate-looprd.py. Account authentication
and push-device ownership are independently enforced by LoopRD's verifier.
"""
import hashlib
import hmac
import json
import os
import re
import time
import sqlalchemy as sa
from contextlib import nullcontext
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
    query=sa.select(INTERACTION).where(INTERACTION.c.recipient==subject)
    if not account_ecosystem_admin(db,subject):
        query=query.where(sa.not_(INTERACTION.c.publisher.like('service:%')))
    rows=db.execute(query.order_by(INTERACTION.c.id.desc()).limit(80)).mappings().all()
    return {'ok':True,'schema':'tavi.interactions/v1','events':[
      {'id':r['id'],'publisher':r['publisher'],'topic':r['topic'],**r['data'],
       'status':('expired' if r['expires']<=now and r['status']=='open' else r['status']),
       'created':r['created'],'expires':r['expires'],'response':r['response']}
      for r in rows]}

def game_challenge_send(db, subject, body, now):
    # Account-to-account proposal only. Game owns match seats.
    peer=body.get('peer'); game_id=body.get('gameId')
    if (not isinstance(peer,str) or not re.fullmatch(r'acct_[1-9][0-9]{0,18}',peer)
            or peer==subject or not isinstance(game_id,str)
            or not re.fullmatch(r'[a-z][a-z0-9-]{1,47}',game_id)):
        return error('Invalid game challenge')
    game=next((g for g in published_games() if g['id']==game_id),None)
    if not game:return error('Game not published by this server')
    contact=contact_row(db,subject,peer)
    if not contact or contact['status']!='accepted':return error('Only accepted contacts can be challenged')
    count=db.execute(sa.text('''SELECT count(*) FROM "SocialInteraction"
        WHERE publisher=:publisher AND topic='game.challenge.requested'
        AND created>=:after'''),{'publisher':'challenge:'+subject,'after':now-86400}).scalar_one()
    if count>=12:return error('Daily game challenge limit reached')
    active=db.execute(sa.text('''SELECT count(*) FROM "SocialInteraction"
        WHERE publisher=:publisher AND recipient=:peer AND topic='game.challenge.requested'
        AND status='open' AND expires>:now AND json_extract(data,'$.challenge.gameId')=:game'''),
        {'publisher':'challenge:'+subject,'peer':peer,'game':game_id,'now':now}).scalar_one()
    if active:return error('A challenge for this game is already pending')
    account=db.execute(sa.select(ACCOUNT.c.handle).where(ACCOUNT.c.id==int(subject[5:]))).scalar_one_or_none()
    if not account:return error('Account unavailable')
    challenge={'title':'Game challenge · '+game['name'],'topic':'game.challenge.requested',
       'body': account+' challenges you to play '+game['name']+'. Accepting responds to the challenge; the game must create a real match before anyone can play.',
       'actions':[{'id':'accept-challenge','type':'reply','label':'Accept challenge','fields':[]},
                  {'id':'decline-challenge','type':'reply','label':'Decline','fields':[]}],
       'challenge':{'schema':'tavi.game-challenge/v1','sender':subject,'gameId':game_id,'gameName':game['name']}}
    ident=db.execute(sa.insert(INTERACTION).values(recipient=peer,publisher='challenge:'+subject,
         topic=challenge['topic'],title=challenge['title'],data=challenge,status='open',response=None,
         created=now,expires=now+2*86400).returning(INTERACTION.c.id)).scalar_one()
    return {'ok':True,'schema':'tavi.game-challenge/v1','id':ident,'status':'pending','gameId':game_id,'peer':peer}

def interaction_reply(db,subject,body,now):
    event_id=body.get('id');action=body.get('action');values=body.get('values',{})
    if type(event_id) is not int or not isinstance(action,str) or not isinstance(values,dict):return error('Invalid event response')
    row=db.execute(sa.select(INTERACTION).where(INTERACTION.c.id==event_id,INTERACTION.c.recipient==subject)).mappings().first()
    if not row:return error('Event not found')
    if row['publisher'].startswith('service:') and not account_ecosystem_admin(db,subject):return error('Administrator entitlement revoked')
    if row['status']!='open' or row['expires']<=now:return error('Event already handled or expired')
    allowed=next((x for x in row['data']['actions'] if x['id']==action and x['type']=='reply'),None)
    if not allowed:return error('Action not available')
    fields={f['id']:f for f in allowed['fields']}
    if len(values)>len(fields) or any(k not in fields or not isinstance(v,str) or len(v)>2000 or (fields[k]['type']=='select' and v not in fields[k]['options']) for k,v in values.items()):return error('Invalid field values')
    if row['topic']=='game.challenge.requested':
        challenge=row['data'].get('challenge') if isinstance(row['data'],dict) else None
        sender=row['publisher'].removeprefix('challenge:')
        if (row['publisher']!='challenge:'+sender or not isinstance(challenge,dict)
                or challenge.get('schema')!='tavi.game-challenge/v1'
                or challenge.get('sender')!=sender
                or action not in ('accept-challenge','decline-challenge') or values):
            return error('Invalid game challenge')
        if action=='accept-challenge':
            friend=contact_row(db,subject,sender)
            if not friend or friend['status']!='accepted':return error('Challenge is no longer available')
            if not any(g['id']==challenge.get('gameId') for g in published_games()):
                return error('Game no longer published')
        # The originator gets a separate inbox status update. No match, subscription,
        # game seat or identity grant is created as a side effect of accepting.
        result={'title':'Challenge '+('accepted' if action=='accept-challenge' else 'declined')+' · '+str(challenge.get('gameName','Game'))[:64],
          'topic':'game.challenge.response',
          'body':'Your contact '+('accepted' if action=='accept-challenge' else 'declined')+' the invitation. '+
             ('Open the game to continue; a verified match is still required.' if action=='accept-challenge' else ''),
          'actions':[{'id':'acknowledge','type':'reply','label':'OK','fields':[]}],
          'challenge':{'schema':'tavi.game-challenge/v1','gameId':challenge.get('gameId'),
                       'responder':subject,'decision':action,'challengeId':event_id}}
        db.execute(sa.insert(INTERACTION).values(recipient=sender,publisher='challenge:'+subject,
          topic=result['topic'],title=result['title'],data=result,status='open',response=None,
          created=now,expires=now+7*86400))
    if row['publisher'].startswith('game:') and row['topic']=='game.invite.created':
        game=row['data'].get('game') if isinstance(row['data'],dict) else None
        if not isinstance(game,dict) or action not in ('accept-game','decline-game'):
            return error('Invalid game invitation')
        if action=='accept-game':
            caller=game.get('publisher');gid=game.get('gameId');match=game.get('matchId')
            inviter=game.get('inviter')
            if (not isinstance(caller,str) or not COMPONENT_ID.fullmatch(caller) or
                    not isinstance(gid,str) or not GAME_ID.fullmatch(gid) or
                    not isinstance(match,str) or not MATCH_ID.fullmatch(match) or
                    gid not in approved_game_publishers().get(caller,set()) or
                    not isinstance(inviter,str) or not re.fullmatch(r'acct_[1-9][0-9]{0,18}',inviter)):
                return error('Game invitation no longer available')
            contact=contact_row(db,subject,inviter)
            if not contact or contact['status']!='accepted':return error('Game invitation no longer available')
            keys={'subject':subject,'publisher':caller,'game':gid,'match':match}
            existing=db.execute(sa.text('''SELECT id FROM "SocialGameSubscription" WHERE
                subjectId=:subject AND publisher=:publisher AND gameId=:game AND matchId=:match'''),keys).scalar_one_or_none()
            if existing:
                db.execute(sa.text('UPDATE "SocialGameSubscription" SET enabled=1,updated=:now WHERE id=:id'),{'now':now,'id':existing})
            else:
                db.execute(sa.text('''INSERT INTO "SocialGameSubscription"
                    (subjectId,publisher,gameId,matchId,enabled,updated)
                    VALUES (:subject,:publisher,:game,:match,1,:now)'''),{**keys,'now':now})
    response={'action':action,'values':values,'at':now,'by':subject}
    db.execute(sa.update(INTERACTION).where(INTERACTION.c.id==event_id,INTERACTION.c.recipient==subject,INTERACTION.c.status=='open').values(status='responded',response=response))
    return {'ok':True,'response':response}

def interaction_dismiss(db,subject,body,now):
    event_id=body.get('id')
    if type(event_id) is not int or event_id<1:return error('Invalid event ID')
    row=db.execute(sa.select(INTERACTION).where(INTERACTION.c.id==event_id,INTERACTION.c.recipient==subject)).mappings().first()
    if not row:return error('Event not found')
    if row['publisher'].startswith('service:') and not account_ecosystem_admin(db,subject):return error('Administrator entitlement revoked')
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
    sa.column('developerEnabled',sa.Boolean),sa.column('ecosystemAdmin',sa.Boolean),
    sa.column('recoveryFailures',sa.Integer),sa.column('recoveryLockedUntil',sa.Integer))
RECOVERY = sa.table('SocialRecoveryCode',sa.column('id',sa.Integer),sa.column('subjectId',sa.String),
    sa.column('codeHash',sa.String),sa.column('created',sa.Integer),sa.column('expires',sa.Integer))
RECOVERY_AGE = 180*86400
RECOVERY_FORMAT = re.compile(r'^TAVI-(?:[A-Z2-7]{4}-){7}[A-Z2-7]{4}$')
SESSION = sa.table('SocialSession',sa.column('id',sa.Integer),sa.column('subjectId',sa.String),
    sa.column('tokenHash',sa.String),sa.column('created',sa.Integer),
    sa.column('expires',sa.Integer),sa.column('lastSeen',sa.Integer),sa.column('revoked',sa.Boolean))
CONTACT = sa.table('SocialContact',sa.column('id',sa.Integer),sa.column('leftId',sa.String),
    sa.column('rightId',sa.String),sa.column('requestedBy',sa.String),
    sa.column('status',sa.String),sa.column('created',sa.Integer))
DM = sa.table('SocialDirectMessage',sa.column('id',sa.Integer),sa.column('leftId',sa.String),
    sa.column('rightId',sa.String),sa.column('senderId',sa.String),
    sa.column('content',sa.String),sa.column('created',sa.Integer))
READ = sa.table('SocialConversationRead',sa.column('id',sa.Integer),sa.column('subjectId',sa.String),
    sa.column('peerId',sa.String),sa.column('readId',sa.Integer),sa.column('updated',sa.Integer))
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
    # Backstop to LoopRD's per-origin/auth rate limits; a configurable GLOBAL
    # budget deliberately stores no IPs. For busy public instances increase it.
    try: hourly_cap=int(os.getenv('LOOPRD_SOCIAL_REGISTRATION_HOURLY_MAX','60'))
    except ValueError: hourly_cap=60
    hourly_cap=max(1,min(1000,hourly_cap))
    hourly=db.execute(sa.select(sa.func.count()).select_from(ACCOUNT).where(ACCOUNT.c.created>=now-3600)).scalar_one()
    if hourly>=hourly_cap:
        return {'ok':False,'error':'Registration is temporarily busy. Please try again later.','code':'REGISTRATION_RATE_LIMITED'}
    if db.execute(sa.select(ACCOUNT.c.id).where(ACCOUNT.c.handle==handle)).first():
        return {'ok':False,'error':'This username is already registered','code':'USERNAME_TAKEN'}
    digest=password_digest(password)
    if password.casefold().strip()==handle or handle in password.casefold() and len(password)<20:
        raise ValueError('Choose a password unrelated to your username')
    id_=db.execute(sa.insert(ACCOUNT).values(handle=handle,passwordHash=digest,created=now,
        failedAttempts=0,lockedUntil=0,developerEnabled=False,ecosystemAdmin=False,
        recoveryFailures=0,recoveryLockedUntil=0).returning(ACCOUNT.c.id)).scalar_one()
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

def _recovery_code():
    # 160 random bits. Display only in a successful authenticated response;
    # databases, logs and push payloads never store the plaintext code.
    raw=base64.b32encode(secrets.token_bytes(20)).decode('ascii')
    return 'TAVI-'+'-'.join(raw[i:i+4] for i in range(0,32,4))

def recovery_codes_create(db,subject,body,now):
    account=db.execute(sa.select(ACCOUNT).where(ACCOUNT.c.id==int(subject[5:]))).mappings().first()
    if not account or not verify_password(body.get('password'),account['passwordHash']):
        return {'ok':False,'error':'Current password is incorrect','code':'PASSWORD_INVALID'}
    if account['lockedUntil']>now:
        return {'ok':False,'error':'Try again after your sign-in lock expires','code':'LOGIN_LOCKED'}
    codes=[_recovery_code() for _ in range(8)]
    db.execute(sa.delete(RECOVERY).where(RECOVERY.c.subjectId==subject))
    for code in codes:
        db.execute(sa.insert(RECOVERY).values(subjectId=subject,
          codeHash=hashlib.sha256(code.encode()).hexdigest(),created=now,expires=now+RECOVERY_AGE))
    return {'ok':True,'schema':'tavi.recovery-codes/v1','codes':codes,'expiresAt':now+RECOVERY_AGE}

def recovery_codes_status(db,subject,now):
    rows=db.execute(sa.select(RECOVERY.c.expires).where(
      RECOVERY.c.subjectId==subject,RECOVERY.c.expires>now)).all()
    return {'ok':True,'schema':'tavi.recovery-status/v1','remaining':len(rows),
        'expiresAt':min((x[0] for x in rows),default=None)}

def recovery_codes_revoke(db,subject,body):
    account=db.execute(sa.select(ACCOUNT.c.passwordHash).where(
        ACCOUNT.c.id==int(subject[5:]))).scalar_one_or_none()
    if account is None or not verify_password(body.get('password'),account):
        return {'ok':False,'error':'Current password is incorrect','code':'PASSWORD_INVALID'}
    db.execute(sa.delete(RECOVERY).where(RECOVERY.c.subjectId==subject))
    return {'ok':True,'revoked':True}

def recover_account(db,body,now):
    # Generic responses for nonexistent names, incorrect codes, expired codes,
    # and recovery lockouts. A recovery proof cannot be a guessed account ID.
    denied={'ok':False,'error':'Recovery code invalid or expired','code':'RECOVERY_DENIED'}
    try: handle=username(body.get('username'))
    except ValueError: return denied
    code=body.get('recoveryCode')
    if not isinstance(code,str) or not RECOVERY_FORMAT.fullmatch(code):return denied
    account=db.execute(sa.select(ACCOUNT).where(ACCOUNT.c.handle==handle)).mappings().first()
    if not account:return denied
    if account['recoveryLockedUntil']>now:return denied
    subject='acct_'+str(account['id'])
    code_hash=hashlib.sha256(code.encode()).hexdigest()
    match=db.execute(sa.select(RECOVERY.c.id).where(RECOVERY.c.subjectId==subject,
        RECOVERY.c.codeHash==code_hash,RECOVERY.c.expires>now)).scalar_one_or_none()
    if match is None:
        n=account['recoveryFailures']+1
        db.execute(sa.update(ACCOUNT).where(ACCOUNT.c.id==account['id']).values(
            recoveryFailures=n,recoveryLockedUntil=now+900 if n>=5 else 0))
        return denied
    new_password=body.get('newPassword')
    password_hash=password_digest(new_password)
    if verify_password(new_password,account['passwordHash']):
        return {'ok':False,'error':'Choose a new password different from the previous one','code':'PASSWORD_REUSED'}
    if new_password.casefold().strip()==handle or handle in new_password.casefold() and len(new_password)<20:
        return {'ok':False,'error':'Choose a password unrelated to your username','code':'PASSWORD_WEAK'}
    # Claim this single-use code atomically. Parallel redeem attempts may have
    # passed the initial read but only one may delete-and-return it.
    claimed=db.execute(sa.delete(RECOVERY).where(RECOVERY.c.subjectId==subject,
        RECOVERY.c.codeHash==code_hash,RECOVERY.c.expires>now).returning(RECOVERY.c.id)).scalar_one_or_none()
    if claimed is None:return denied
    db.execute(sa.update(ACCOUNT).where(ACCOUNT.c.id==account['id']).values(
        passwordHash=password_hash,failedAttempts=0,lockedUntil=0,
        recoveryFailures=0,recoveryLockedUntil=0))
    # Revoke all device sessions and all one-use codes (including unused ones),
    # then create one fresh session for the recovering account.
    db.execute(sa.update(SESSION).where(SESSION.c.subjectId==subject).values(revoked=True))
    db.execute(sa.delete(RECOVERY).where(RECOVERY.c.subjectId==subject))
    return {'ok':True,'schema':'tavi.account-recovered/v1','profileId':subject,
            **new_session(db,subject,now)}

def logout(db,token):
    if isinstance(token,str):
        db.execute(sa.update(SESSION).where(SESSION.c.tokenHash==hashlib.sha256(token.encode()).hexdigest()).values(revoked=True))
    return {'ok':True}

# Social-specific development privilege: operator-set DB entitlement, never a
# LoopRD management role. Checked on EVERY privileged request and profile refresh.
# Development tokens cannot get this privilege, even when their subject resembles
# a registered user; no public API path changes the flag.
SOCIAL_RELEASE = '0.3.47'
SOCIAL_SCHEMA_VERSION = 9

def account_developer_permission(db, subject):
    if not isinstance(subject, str) or not re.fullmatch(r'acct_[1-9][0-9]{0,18}', subject):
        return False
    account = db.execute(sa.select(ACCOUNT.c.developerEnabled).where(
        ACCOUNT.c.id == int(subject[5:]))).first()
    return account is not None and account[0] is True

def account_ecosystem_admin(db, subject):
    """Lookup current entitlement from authoritative server rows on every access."""
    if not isinstance(subject,str) or not re.fullmatch(r'acct_[1-9][0-9]{0,18}', subject):
        return False
    record=db.execute(sa.select(ACCOUNT.c.ecosystemAdmin).where(
        ACCOUNT.c.id==int(subject[5:]))).first()
    return record is not None and record[0] is True

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
        # Display names are profile choices; handles are stable account identifiers.
        # Only return the peer's profile data for an existing contact relationship.
        profile=db.execute(sa.select(PROFILE.c.data).where(PROFILE.c.subjectId==peer)).scalar_one_or_none()
        chosen=profile.get('displayName') if isinstance(profile,dict) else None
        display_name=chosen if isinstance(chosen,str) and 1<=len(chosen)<=24 else account[0]
        result.append({'id':peer,'username':account[0],'displayName':display_name,'status':link['status'],
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

def conversation_summaries(db, subject, now):
    """One mailbox request instead of polling every friend for their DM feed.

    Only accepted contacts participate; read cursors are owned by the authenticated
    subject, not supplied by clients. The latest-message query is bounded to the
    same 30-day horizon as dm_feed, and returns no unaccepted contact content.
    """
    pairs=db.execute(sa.select(CONTACT.c.leftId,CONTACT.c.rightId).where(
        CONTACT.c.status=='accepted',sa.or_(CONTACT.c.leftId==subject,CONTACT.c.rightId==subject))).all()
    peers={right if left==subject else left for left,right in pairs}
    if not peers:
        return {'ok':True,'schema':'tavi.dm-summaries/v1','conversations':[]}
    reads={r['peerId']:r['readId'] for r in db.execute(sa.select(READ).where(
        READ.c.subjectId==subject,READ.c.peerId.in_(peers))).mappings().all()}
    other=sa.case((DM.c.leftId==subject,DM.c.rightId),else_=DM.c.leftId)
    base=sa.and_(sa.or_(DM.c.leftId==subject,DM.c.rightId==subject),
                 DM.c.created>=now-30*86400,other.in_(peers))
    latest=db.execute(sa.select(other.label('peer'),sa.func.max(DM.c.id).label('id'))
        .where(base).group_by(other)).all()
    latest_rows={r['id']:r for r in db.execute(sa.select(DM).where(
        DM.c.id.in_([item.id for item in latest]))).mappings().all()} if latest else {}
    unread_rows=db.execute(sa.select(other.label('peer'),sa.func.count(DM.c.id).label('unread'))
        .select_from(DM.outerjoin(READ,sa.and_(READ.c.subjectId==subject,READ.c.peerId==other)))
        .where(base,DM.c.senderId!=subject,DM.c.id>sa.func.coalesce(READ.c.readId,0))
        .group_by(other)).all()
    unread={r.peer:r.unread for r in unread_rows}
    last_by_peer={r.peer:latest_rows.get(r.id) for r in latest}
    conversations=[]
    for peer in peers:
        record=last_by_peer.get(peer)
        recent=({'id':record['id'],'authorId':record['senderId'],'text':record['content'],
                 'at':record['created']} if record else None)
        conversations.append({'peer':peer,'readId':reads.get(peer,0),
            'unread':min(99,unread.get(peer,0)), 'latest':recent})
    conversations.sort(key=lambda x:(-(x['latest']['id'] if x['latest'] else 0),x['peer']))
    return {'ok':True,'schema':'tavi.dm-summaries/v1','conversations':conversations}


def mark_direct_read(db,subject,peer,up_to,now):
    if not isinstance(peer,str) or not re.fullmatch(r'acct_[0-9]{1,19}',peer):
        return error('Invalid contact')
    if type(up_to) is not int or up_to<0 or up_to>2**53-1:
        return error('Invalid read cursor')
    link=contact_row(db,subject,peer)
    if not link or link['status']!='accepted':return error('Contact is not accepted')
    existing=db.execute(sa.select(READ).where(READ.c.subjectId==subject,READ.c.peerId==peer)).mappings().first()
    previous=existing['readId'] if existing else 0
    advanced=up_to>previous
    if advanced:
        left,right=pair(subject,peer)
        found=db.execute(sa.select(DM.c.id).where(
            DM.c.id==up_to,DM.c.leftId==left,DM.c.rightId==right)).first()
        if not found:return error('Read cursor is not a message in this conversation')
        if existing:
            db.execute(sa.update(READ).where(READ.c.id==existing['id'],READ.c.readId<up_to).values(readId=up_to,updated=now))
        else:
            db.execute(sa.insert(READ).values(subjectId=subject,peerId=peer,readId=up_to,updated=now))
        previous=db.execute(sa.select(READ.c.readId).where(READ.c.subjectId==subject,READ.c.peerId==peer)).scalar_one()
    return {'ok':True,'readId':previous,'advanced':advanced}


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


# Account-consented game notifications: only the account can opt in to a match.
GAME_ID = re.compile(r'^[a-z][a-z0-9.]{1,95}$')
MATCH_ID = re.compile(r'^[A-Za-z0-9_-]{12,128}$')
COMPONENT_ID = re.compile(r'^[a-z][a-z0-9-]{1,47}$')

def approved_game_publishers():
    try: mapping=json.loads(os.getenv('LOOPRD_TAVI_GAME_CALLERS_JSON','{}'))
    except (ValueError,TypeError):return {}
    if not isinstance(mapping,dict) or len(mapping)>32:return {}
    return {k:set(v) for k,v in mapping.items() if isinstance(k,str) and COMPONENT_ID.fullmatch(k)
            and isinstance(v,list) and 0<len(v)<=32 and all(isinstance(g,str) and GAME_ID.fullmatch(g) for g in v)}

def set_game_subscription(db,subject,body,now):
    if not re.fullmatch(r'acct_[1-9][0-9]{0,18}',subject):return error('Verified user required')
    publisher=body.get('publisher'); game=body.get('gameId'); match=body.get('matchId'); enabled=body.get('enabled')
    if (not isinstance(publisher,str) or not COMPONENT_ID.fullmatch(publisher)
            or not isinstance(game,str) or not GAME_ID.fullmatch(game)
            or not isinstance(match,str) or not MATCH_ID.fullmatch(match)
            or type(enabled) is not bool or game not in approved_game_publishers().get(publisher,set())):
        return error('Game subscription not approved')
    keys={'subject':subject,'publisher':publisher,'game':game,'match':match}
    existing=db.execute(sa.text('''SELECT id FROM "SocialGameSubscription"
        WHERE subjectId=:subject AND publisher=:publisher AND gameId=:game AND matchId=:match'''),keys).scalar_one_or_none()
    if existing is not None:
        db.execute(sa.text('UPDATE "SocialGameSubscription" SET enabled=:enabled,updated=:now WHERE id=:id'),
                   {'enabled':enabled,'now':now,'id':existing})
    else:
        db.execute(sa.text('''INSERT INTO "SocialGameSubscription"
            (subjectId,publisher,gameId,matchId,enabled,updated)
            VALUES (:subject,:publisher,:game,:match,:enabled,:now)'''),
            {**keys,'enabled':enabled,'now':now})
    return {'ok':True,'schema':'tavi.game-subscription/v1','enabled':enabled}

def issue_game_grant(db, subject, body, now):
    """Issue a one-use proof of this exact signed-in account, NOT a game-seat grant."""
    import secrets
    caller=body.get('publisher');game=body.get('gameId');match=body.get('matchId')
    token=body.get('token')
    if (not isinstance(subject,str) or not re.fullmatch(r'acct_[1-9][0-9]{0,18}', subject)
            or not isinstance(caller,str) or not COMPONENT_ID.fullmatch(caller)
            or not isinstance(game,str) or not GAME_ID.fullmatch(game)
            or not isinstance(match,str) or not MATCH_ID.fullmatch(match)
            or game not in approved_game_publishers().get(caller,set())
            or session_identity(db,token,now)!=subject):
        return error('Game identity grant unavailable')
    eligible=db.execute(sa.text("""SELECT id FROM "SocialGameSubscription" WHERE subjectId=:subject
        AND publisher=:publisher AND gameId=:game AND matchId=:match AND enabled=1"""),
        {'subject':subject,'publisher':caller,'game':game,'match':match}).first()
    if not eligible:return error('Game identity grant unavailable')
    # Account/grant quotas avoid using the durable grant table as an unbounded token store.
    db.execute(sa.text('DELETE FROM "SocialGameGrant" WHERE expires<=:now OR consumed=1'),{'now':now})
    active=db.execute(sa.text('SELECT count(*) FROM "SocialGameGrant" WHERE subjectId=:subject AND consumed=0'),
                      {'subject':subject}).scalar_one()
    if active>=8:return error('Too many active game grants')
    value=secrets.token_urlsafe(32)
    db.execute(sa.text("""INSERT INTO "SocialGameGrant"
        (tokenHash,sessionHash,subjectId,publisher,gameId,matchId,created,expires,consumed)
        VALUES (:hash,:session,:subject,:publisher,:game,:match,:created,:expires,0)"""),
        {'hash':hashlib.sha256(value.encode('ascii')).hexdigest(),
         'session':hashlib.sha256(token.encode()).hexdigest(),'subject':subject,'publisher':caller,
         'game':game,'match':match,'created':now,'expires':now+300})
    return {'ok':True,'schema':'tavi.game-grant/v1','grant':value,
            'expiresAt':now+300,'audience':caller,'gameId':game,'matchId':match}


def game_event_feed(db,subject,body):
    after=body.get('after',0)
    if type(after) is not int or after<0:return error('Invalid feed cursor')
    rows=db.execute(sa.text('''SELECT id,publisher,topic,title,data,status,response,created,expires
        FROM "SocialInteraction" WHERE recipient=:subject AND publisher LIKE 'game:%' AND id>:after
        ORDER BY id ASC LIMIT 101'''),{'subject':subject,'after':after}).mappings().all()
    entries=[]
    for row in rows[:100]:
        item=dict(row)
        if isinstance(item['data'],str):item['data']=json.loads(item['data'])
        entries.append({'id':item['id'],'publisher':item['publisher'],'topic':item['topic'],
                       **item['data'],'status':item['status'],'created':item['created'],'expires':item['expires']})
    return {'ok':True,'schema':'tavi.game-events/v1','events':entries,'next':entries[-1]['id'] if entries else after,
            'hasMore':len(rows)>100}

# Game-owned seat rosters are synchronized through the separate service-only
# tavi-game-room-roster/v1 contract. A subscription is consent, not proof of a seat.
ROOM_KEY = re.compile(r'^[a-f0-9]{64}$')


def accessible_game_room(db, subject, room_id):
    if not isinstance(room_id,str) or not ROOM_KEY.fullmatch(room_id):return None
    return db.execute(sa.text('''SELECT r.roomKey,r.publisher,r.gameId,r.matchId,r.revision
      FROM "SocialGameRoom" r
      JOIN "SocialGameRoomMember" m ON m.roomKey=r.roomKey AND m.subjectId=:subject
      JOIN "SocialGameSubscription" s ON s.subjectId=:subject AND s.publisher=r.publisher
        AND s.gameId=r.gameId AND s.matchId=r.matchId AND s.enabled=1
      WHERE r.roomKey=:room AND r.status=:active'''),{'subject':subject,'room':room_id,'active':'active'}).mappings().first()


def game_room_list(db,subject):
    rows=db.execute(sa.text('''SELECT r.roomKey,r.publisher,r.gameId,r.matchId,r.revision,
        (SELECT COUNT(*) FROM "SocialGameRoomMember" c WHERE c.roomKey=r.roomKey) AS participants
      FROM "SocialGameRoom" r
      JOIN "SocialGameRoomMember" m ON m.roomKey=r.roomKey AND m.subjectId=:subject
      JOIN "SocialGameSubscription" s ON s.subjectId=:subject AND s.publisher=r.publisher
        AND s.gameId=r.gameId AND s.matchId=r.matchId AND s.enabled=1
      WHERE r.status='active' ORDER BY r.updated DESC,r.roomKey LIMIT 100'''),{'subject':subject,'active':'active'}).mappings().all()
    return {'ok':True,'schema':'tavi.game-rooms/v1','rooms':[
        {'roomId':r['roomKey'],'publisher':r['publisher'],'gameId':r['gameId'],
         'matchId':r['matchId'],'revision':r['revision'],'participants':r['participants']} for r in rows]}


def game_room_feed(db,subject,body):
    row=accessible_game_room(db,subject,body.get('roomId'))
    if not row:return error('Game room unavailable')
    after=body.get('after',0)
    if type(after) is not int or not 0<=after<=9223372036854775807:return error('Invalid message cursor')
    direction='DESC' if after==0 else 'ASC'
    rows=db.execute(sa.text(f'''SELECT m.id,m.senderId,m.content,m.created,a.handle
      FROM "SocialGameRoomMessage" m
      LEFT JOIN "SocialAccount" a ON m.senderId='acct_' || a.id
      WHERE m.roomKey=:room AND m.id>:after ORDER BY m.id {direction} LIMIT 80'''),
      {'room':row['roomKey'],'after':after}).mappings().all()
    if after==0:rows=list(reversed(rows))
    return {'ok':True,'schema':'tavi.game-room-messages/v1','roomId':row['roomKey'],
            'messages':[{'id':r['id'],'authorId':r['senderId'],'displayName':r['handle'] or 'Player',
                         'text':r['content'],'at':r['created']} for r in rows],
            'next':rows[-1]['id'] if rows else after,'hasMore':len(rows)==80}


def game_room_send(db,subject,body,now):
    room=accessible_game_room(db,subject,body.get('roomId'))
    if not room:return error('Game room unavailable')
    content=body.get('text')
    if (not isinstance(content,str) or not 1<=len(content.strip())<=1000 or
        re.search(r'[\x00-\x08\x0e-\x1f\x7f]',content)):
        return error('Invalid room message')
    last=db.execute(sa.text('''SELECT created FROM "SocialGameRoomMessage" WHERE roomKey=:room
        AND senderId=:sender ORDER BY id DESC LIMIT 1'''),{'room':room['roomKey'],'sender':subject}).scalar_one_or_none()
    if last is not None and now-last<1:return error('Room message cooldown: retry shortly')
    ident=db.execute(sa.text('''INSERT INTO "SocialGameRoomMessage"
      (roomKey,senderId,content,created) VALUES (:room,:sender,:text,:now) RETURNING id'''),
      {'room':room['roomKey'],'sender':subject,'text':content.strip(),'now':now}).scalar_one()
    return {'ok':True,'messageId':ident}


def atrium_app_url():
    base=os.getenv('LOOPRD_TAVI_ATRIUM_BASE_URL','')
    if not base or len(base)>512 or not base.endswith('/') or any(ord(c)<33 or c=='\\' for c in base):return None
    from urllib.parse import urlsplit
    import ipaddress
    try:
        u=urlsplit(base)
        if u.scheme!='https' or not u.hostname or u.username or u.password or u.query or u.fragment or u.port not in (None,443):return None
        if u.hostname in ('localhost','localhost.localdomain') or u.hostname.endswith(('.localhost','.local','.internal')):return None
        try:
            if not ipaddress.ip_address(u.hostname).is_global:return None
        except ValueError:pass
    except (ValueError,TypeError):return None
    return base

def execute(body,sessions,tokens=None,now=None,db=None,principal_subject=None):
    """Returns (response, optional notification), after SQLite commit."""
    if not isinstance(body,dict):
        return error('Invalid request'),None
    tokens=configured_tokens() if tokens is None else tokens
    op=body.get('op')
    now=int(time.time()) if now is None else int(now)
    try:
        with (nullcontext(db) if db is not None else sessions.begin()) as db:
            if principal_subject is not None:
                # The public guest is only permitted to discover or obtain an account.
                if principal_subject == 'guest':
                    if op not in ('game_catalog','capabilities','register','login','recover_account'):
                        return error('Sign in to Social first'),None
                else:
                    if op in ('register','login','recover_account'):
                        return error('Sign out before creating another session'),None
                    if not isinstance(body.get('token'),str) or session_identity(db,body['token'],now) != principal_subject:
                        return error('Session identity does not match verified principal'),None
            if op=='game_catalog':
                return {'ok':True,'schema':'tavi.game-catalog/v1','games':published_games()},None
            if op=='capabilities':
                return {'ok':True,'schema':'looprd.social.capabilities/v1',
                    'accounts':True,'registration':os.getenv('LOOPRD_SOCIAL_ALLOW_REGISTRATION','true').lower() in ('true','1','yes'),
                    'recoveryCodes':True,'gameRooms':True,'contacts':True,'directMessages':True,'conversationSummaries':True,'readSync':True,'sessionSeconds':SESSION_AGE,
                    'push':{'schema':'looprd-push/v1','transport':'unifiedpush','deviceRegistration':True,
                            'requiresVerifiedSession':True},
                    'atriumUrl':atrium_app_url()},None
            if op=='register':
                return register(db,body,now),None
            if op=='login':
                return login(db,body,now),None
            if op=='recover_account':
                return recover_account(db,body,now),None
            subject=session_identity(db,body.get('token'),now) or authorize(body.get('token'),tokens)
            if not subject:
                return error('Sign in to Social first'),None
            if op=='recovery_codes_create':
                return recovery_codes_create(db,subject,body,now),None
            if op=='recovery_codes_status':
                return recovery_codes_status(db,subject,now),None
            if op=='recovery_codes_revoke':
                return recovery_codes_revoke(db,subject,body),None
            if op=='interaction_feed':
                return interaction_feed(db,subject,now),None
            if op=='game_challenge_send':
                result=game_challenge_send(db,subject,body,now)
                return result,event_signal(db) if result['ok'] else None
            if op=='game_subscription_set':
                return set_game_subscription(db,subject,body,now),None
            if op=='game_grant_issue':
                return issue_game_grant(db,subject,body,now),None
            if op=='game_room_list':
                return game_room_list(db,subject),None
            if op=='game_room_feed':
                return game_room_feed(db,subject,body),None
            if op=='game_room_send':
                result=game_room_send(db,subject,body,now)
                return result,event_signal(db) if result['ok'] else None
            if op=='game_event_feed':
                return game_event_feed(db,subject,body),None
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
            if op=='dm_conversations':
                return conversation_summaries(db,subject,now),None
            if op=='dm_mark_read':
                result=mark_direct_read(db,subject,body.get('peer'),body.get('upToId'),now)
                return result,event_signal(db) if result['ok'] and result['advanced'] else None
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
                    'permissions':{'developer':account_developer_permission(db,subject),
                                   'ecosystemAdmin':account_ecosystem_admin(db,subject)}},None
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


def principal_id(subject):
    """Exactly LoopRD's verified realm+subject ID formula, not a client-supplied ID."""
    return hashlib.sha256(('tavi-social\0' + subject).encode('utf8')).hexdigest()


def process_event(ctx):
    """Use the same transaction for application writes, event and push outbox."""
    body=ctx.body
    op=body.get('op') if isinstance(body,dict) else None
    principal=ctx.principal.subject
    with ctx.transaction() as db:
        result,event=execute(body,ctx.session_factory,db=db,principal_subject=principal)
        # Account recovery invalidates the existing account's push endpoints as
        # well as bearer sessions. A queued content-free hint must not keep
        # waking a device whose account credential was revoked.
        if result.get('ok') and op=='recover_account' and ctx.revoke_push:
            ctx.revoke_push(db,principal_id(result['profileId']))
        if result.get('ok') and event is not None:
            ctx.emit(db,{k:v for k,v in event.items() if k!='component'})
            recipient=None
            if op=='dm_send':
                recipient=body.get('peer')
            elif op=='contact_request':
                recipient=account_subject(db,username(body.get('username')))
            elif op in ('contact_accept','contact_remove'):
                recipient=body.get('peer')
            elif op=='interaction_publish':
                recipient=account_subject(db,username(body.get('recipient')))
            if op=='game_room_send':
                # Send a content-free wake only to current, consenting game seats.
                # A roomId in a client request does not authorize any account.
                room=accessible_game_room(db,principal,body.get('roomId'))
                if room:
                    peers=db.execute(sa.text('''SELECT m.subjectId FROM "SocialGameRoomMember" m
                        JOIN "SocialGameSubscription" s ON s.subjectId=m.subjectId
                          AND s.publisher=:publisher AND s.gameId=:game AND s.matchId=:match AND s.enabled=1
                        WHERE m.roomKey=:room AND m.subjectId!=:sender'''),
                        {'publisher':room['publisher'],'game':room['gameId'],'match':room['matchId'],
                         'room':room['roomKey'],'sender':principal}).scalars().all()
                    for peer in peers: ctx.notify(db,principal_id(peer))
            if recipient and recipient != principal and re.fullmatch(r'acct_[0-9]{1,19}',recipient):
                ctx.notify(db,principal_id(recipient))
    return result


async def handle(ctx):
    op=ctx.body.get('op') if isinstance(ctx.body,dict) else None
    changing=op in {'game_challenge_send','interaction_reply','interaction_dismiss','interaction_publish',
                    'contact_request','contact_accept','contact_remove','dm_mark_read',
                    'dm_send','game_room_send','save_profile','chat_send','recover_account'}
    if changing:
        return await run_in_threadpool(process_event,ctx)
    result,event=await run_in_threadpool(execute,ctx.body,ctx.session_factory,principal_subject=ctx.principal.subject)
    # login/register create an account-specific session; the identity is checked on
    # the *next* request. No push is sent for guest operations or regular reads.
    return result
