"""Reviewed game component -> individual Tavi account turn delivery.

Never use this for arbitrary recipient targeting. A player must have explicitly
subscribed to (publisher, game, match) through their authenticated Social session.
The caller is an operator-admitted LoopRD service credential, not a user token.
"""
import hashlib
import json
import os
import re
import time
from urllib.parse import urlencode, urlsplit

import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

GAME_ID = re.compile(r'^[a-z][a-z0-9.]{1,95}$')
MATCH_ID = re.compile(r'^[A-Za-z0-9_-]{12,128}$')
EVENT_ID = re.compile(r'^[A-Za-z0-9_-]{8,96}$')
COMPONENT_ID = re.compile(r'^[a-z][a-z0-9-]{1,47}$')
SUBJECT = re.compile(r'^acct_[1-9][0-9]{0,18}$')
ALLOWED_KINDS = {'turn.ready', 'turn.reminder', 'match.completed', 'invite.created'}


def configured_publishers():
    """Operator-only allowlist of game IDs per service caller. Empty = deny."""
    try:
        data = json.loads(os.environ.get('LOOPRD_TAVI_GAME_CALLERS_JSON', '{}'))
    except (ValueError, TypeError):
        return {}
    if not isinstance(data, dict) or len(data) > 32:
        return {}
    return {key: tuple(value) for key, value in data.items()
            if isinstance(key, str) and COMPONENT_ID.fullmatch(key)
            and isinstance(value, list) and 0 < len(value) <= 32
            and all(isinstance(item, str) and GAME_ID.fullmatch(item) for item in value)}


def approved_game_label(game_id):
    # Operator-reviewed presentation metadata; never accept title/body from game payload.
    try:
        names = json.loads(os.environ.get('LOOPRD_TAVI_GAME_LABELS_JSON', '{}'))
    except (ValueError, TypeError):
        return game_id
    if not isinstance(names, dict) or len(names) > 100:
        return game_id
    name = names.get(game_id)
    return name.strip() if isinstance(name, str) and 1 <= len(name.strip()) <= 64 and not any(ord(c) < 32 for c in name) else game_id


def approved_atrium_url(game_id, match_id):
    """Derive navigation from a private operator binding, never from game payload."""
    base = os.environ.get('LOOPRD_TAVI_ATRIUM_BASE_URL', '')
    if not base or len(base) > 512 or any(ord(c) < 33 or c == '\\' for c in base):
        return None
    try:
        url = urlsplit(base)
        if (url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment
                or url.port not in (None, 443) or not base.endswith('/')
                or url.hostname in ('localhost', 'localhost.localdomain') or url.hostname.endswith(('.localhost', '.local', '.internal'))):
            return None
        import ipaddress
        try:
            ip = ipaddress.ip_address(url.hostname)
            if not ip.is_global:
                return None
        except ValueError:
            pass
    except (ValueError, TypeError):
        return None
    # An opaque match reference is NOT a room access token. Atrium must authorize it.
    return base + '?' + urlencode({'game': game_id, 'match': match_id})


def game_interaction(kind, game_id, match_id, caller, event_id=None, turn_index=None):
    title = {'turn.ready': "It's your turn", 'turn.reminder': 'Turn reminder',
             'match.completed': 'Game completed', 'invite.created': 'Game invitation'}[kind]
    title += ' · ' + approved_game_label(game_id)
    link = approved_atrium_url(game_id, match_id)
    actions = ([{'id':'accept-game','type':'reply','label':'Accept invitation','fields':[]},
                {'id':'decline-game','type':'reply','label':'Decline','fields':[]}] if kind=='invite.created' else
               [{'id': 'open-atrium', 'type': 'open-url', 'label': 'Open in Atrium',
                 'url': link, 'presentation': 'external-browser'}] if link else
               [{'id': 'acknowledge', 'type': 'reply', 'label': 'Acknowledge', 'fields': []}])
    return {'title': title, 'topic': 'game.' + kind, 'body': (('A friend invited you to play. Accept to receive game updates.' if kind=='invite.created' else 'Open Atrium to continue.') if link else
            'Atrium is not configured on this Social server yet.'), 'actions': actions,
            'game': {'schema': 'tavi.game-event/v1', 'kind': kind, 'gameId': game_id,
                     'matchId': match_id, 'publisher': caller, 'eventId': event_id,
                     'turnIndex': turn_index}}


def validate_event(body, caller):
    expected={'schema','eventId','kind','gameId','matchId','turnIndex','recipient'}
    if not isinstance(body, dict) or set(body) != (expected | {'inviter'} if body.get('kind')=='invite.created' else expected):
        return None
    recipient = body.get('recipient')
    issuer = os.environ.get('LOOPRD_TAVI_SOCIAL_ISSUER', '')
    if (body.get('schema') != 'tavi.game-event/v1' or body.get('kind') not in ALLOWED_KINDS
            or not isinstance(body.get('gameId'), str) or not GAME_ID.fullmatch(body['gameId'])
            or not isinstance(body.get('matchId'), str) or not MATCH_ID.fullmatch(body['matchId'])
            or not isinstance(body.get('eventId'), str) or not EVENT_ID.fullmatch(body['eventId'])
            or type(body.get('turnIndex')) is not int or not 0 <= body['turnIndex'] <= 10000000
            or not isinstance(recipient, dict) or set(recipient) != {'issuer', 'subject'}
            or not isinstance(recipient.get('subject'), str) or not SUBJECT.fullmatch(recipient['subject'])
            or not issuer or len(issuer) > 128 or recipient.get('issuer') != issuer
            or body['gameId'] not in configured_publishers().get(caller, ())
            or (body['kind']=='invite.created' and (not isinstance(body.get('inviter'),dict)
                or set(body['inviter'])!={'issuer','subject'}
                or body['inviter'].get('issuer') != issuer
                or not isinstance(body['inviter'].get('subject'),str)
                or not SUBJECT.fullmatch(body['inviter']['subject'])))):
        return None
    return body


def principal_id(subject):
    return hashlib.sha256(('tavi-social\0' + subject).encode()).hexdigest()


def deliver(ctx):
    caller = getattr(ctx.principal, 'subject', None)
    if getattr(ctx.principal, 'kind', None) != 'service' or not isinstance(caller, str) or not COMPONENT_ID.fullmatch(caller):
        return {'accepted': False, 'delivery': 'rejected', 'reason': 'service_identity_required'}
    body = validate_event(ctx.body, caller)
    if body is None:
        return {'accepted': False, 'delivery': 'rejected', 'reason': 'invalid_or_unapproved_event'}
    recipient = body['recipient']['subject']
    now = int(time.time())
    fingerprint = hashlib.sha256(json.dumps(body, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    with ctx.transaction() as session:
        prior = session.execute(sa.text('''SELECT digest FROM "SocialGameDelivery"
            WHERE publisher=:publisher AND eventId=:eventId AND recipient=:recipient'''),
            {'publisher': caller, 'eventId': body['eventId'], 'recipient': recipient}).scalar_one_or_none()
        if prior is not None:
            if prior != fingerprint:
                return {'accepted': False, 'delivery': 'rejected', 'reason': 'event_id_conflict'}
            return {'accepted': True, 'delivery': 'duplicate'}
        # An invitation is explicitly initiated by an approved game service on behalf
        # of an existing accepted contact. It never enrolls a recipient automatically.
        if body['kind']=='invite.created':
            inviter=body['inviter']['subject']
            if inviter==recipient:
                return {'accepted':False,'delivery':'rejected','reason':'not_accepted_contacts'}
            left,right=sorted((inviter,recipient))
            contact=session.execute(sa.text('''SELECT id FROM "SocialContact" WHERE leftId=:left
                AND rightId=:right AND status='accepted' '''),{'left':left,'right':right}).first()
            if not contact:
                return {'accepted':False,'delivery':'rejected','reason':'not_accepted_contacts'}
        # Proof of consent is an authenticated Social subscription, NOT knowledge of an account ID.
        eligible = session.execute(sa.text('''SELECT id FROM "SocialGameSubscription"
            WHERE subjectId=:subject AND publisher=:publisher AND gameId=:gameId
              AND matchId=:matchId AND enabled=1'''),
            {'subject': recipient, 'publisher': caller, 'gameId': body['gameId'], 'matchId': body['matchId']}).first()
        if not eligible and body['kind']!='invite.created':
            return {'accepted': False, 'delivery': 'rejected', 'reason': 'recipient_not_subscribed'}
        data = game_interaction(body['kind'], body['gameId'], body['matchId'], caller,
                                body['eventId'], body['turnIndex'])
        if body['kind']=='invite.created':
            data['game']['inviter']=body['inviter']['subject']
        stored = session.execute(sa.text('''INSERT INTO "SocialInteraction"
            (recipient,publisher,topic,title,data,status,response,created,expires)
            VALUES (:recipient,:publisher,:topic,:title,:data,'open',NULL,:created,:expires)
            RETURNING id'''), {'recipient': recipient, 'publisher': 'game:' + caller,
                               'topic': data['topic'], 'title': data['title'], 'data': json.dumps(data),
                               'created': now, 'expires': now + (7 if body['kind']=='invite.created' else 366) * 86400}).scalar_one()
        session.execute(sa.text('''INSERT INTO "SocialGameDelivery" (publisher,eventId,recipient,digest,interactionId,created)
            VALUES (:publisher,:eventId,:recipient,:digest,:interactionId,:created)'''),
            {'publisher': caller, 'eventId': body['eventId'], 'recipient': recipient,
             'digest': fingerprint, 'interactionId': stored, 'created': now})
        row = session.execute(sa.text('SELECT signal FROM "SocialPulse" WHERE id=1')).first()
        if row:
            signal = row[0] + 1
            session.execute(sa.text('UPDATE "SocialPulse" SET signal=:n WHERE id=1'), {'n': signal})
        else:
            signal = 1
            session.execute(sa.text('INSERT INTO "SocialPulse" (id,signal) VALUES (1,1)'))
        ctx.emit(session, {'resource': 'pulses', 'action': 'updated', 'id': 1, 'data': {'id': 1, 'signal': signal}})
        if ctx.notify is not None:
            ctx.notify(session, principal_id(recipient))
    return {'accepted': True, 'delivery': 'created'}


async def handle(ctx):
    return await run_in_threadpool(deliver, ctx)
