"""One-use, account-bound, game-scoped proof redemption for trusted local LoopRD services.

A redeemed grant proves the account authenticated to this Social issuer. The game
MUST separately authorize match invitations, seat ownership, and game actions.
Grants never embed Social bearer tokens. Calls are same-runtime ctx.call only.
"""
import hashlib
import os
import re
import time

import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

GAME = re.compile(r'^[a-z][a-z0-9.]{1,95}$')
MATCH = re.compile(r'^[A-Za-z0-9_-]{12,128}$')
COMPONENT = re.compile(r'^[a-z][a-z0-9-]{1,47}$')


def redeem(ctx):
    caller = getattr(ctx.principal, 'subject', None)
    if getattr(ctx.principal, 'kind', None) != 'service' or not isinstance(caller, str) or not COMPONENT.fullmatch(caller):
        return {'accepted': False, 'reason': 'not_available'}
    body = ctx.body
    if (type(body) is not dict or set(body) != {'grant', 'gameId', 'matchId'}
            or not isinstance(body.get('grant'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{42,128}', body['grant'])
            or not isinstance(body.get('gameId'), str) or not GAME.fullmatch(body['gameId'])
            or not isinstance(body.get('matchId'), str) or not MATCH.fullmatch(body['matchId'])):
        return {'accepted': False, 'reason': 'not_available'}
    # Revoking an operator-approved publisher prevents even unexpired grants.
    try:
        import json
        allowed = json.loads(os.environ.get('LOOPRD_TAVI_GAME_CALLERS_JSON', '{}'))
        if not isinstance(allowed, dict) or body['gameId'] not in allowed.get(caller, []):
            return {'accepted':False,'reason':'not_available'}
    except (ValueError, TypeError):
        return {'accepted':False,'reason':'not_available'}
    issuer = os.environ.get('LOOPRD_TAVI_SOCIAL_ISSUER', '')
    if not issuer or len(issuer) > 128:
        return {'accepted': False, 'reason': 'not_available'}
    now = int(time.time())
    with ctx.transaction() as session:
        row = session.execute(sa.text('''SELECT subjectId, sessionHash, gameId, matchId, publisher, expires, consumed
             FROM "SocialGameGrant" WHERE tokenHash=:digest'''),
             {'digest': hashlib.sha256(body['grant'].encode('ascii')).hexdigest()}).mappings().first()
        if (not row or row['consumed'] or row['expires'] <= now or row['publisher'] != caller
                or row['gameId'] != body['gameId'] or row['matchId'] != body['matchId']):
            return {'accepted': False, 'reason': 'not_available'}
        active = session.execute(sa.text('''SELECT id FROM "SocialSession" WHERE subjectId=:subject
            AND tokenHash=:token AND revoked=0 AND expires>:now'''),
            {'subject': row['subjectId'], 'token': row['sessionHash'], 'now': now}).first()
        subscribed = session.execute(sa.text('''SELECT id FROM "SocialGameSubscription" WHERE subjectId=:subject
            AND publisher=:publisher AND gameId=:game AND matchId=:match AND enabled=1'''),
            {'subject':row['subjectId'], 'publisher':caller, 'game':row['gameId'], 'match':row['matchId']}).first()
        if not active or not subscribed:
            return {'accepted':False,'reason':'not_available'}
        changed = session.execute(sa.text('''UPDATE "SocialGameGrant" SET consumed=1
            WHERE tokenHash=:digest AND consumed=0 AND expires>:now'''),
            {'digest':hashlib.sha256(body['grant'].encode('ascii')).hexdigest(),'now':now})
        if changed.rowcount != 1:
            return {'accepted':False,'reason':'not_available'}
        return {'accepted':True,'issuer':issuer,'subject':row['subjectId'],
                'gameId':row['gameId'],'matchId':row['matchId'],'scope':'game:identify'}


async def handle(ctx):
    return await run_in_threadpool(redeem,ctx)
