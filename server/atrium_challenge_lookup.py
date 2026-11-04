"""Atrium's privileged original Tavi challenge lookup (game-neutral).

Only a host-verified, operator-approved service principal may call this route.
A response proves a stored Social interaction, NOT a game seat or match grant.
The issuer is an operator binding, never accepted from browser input.
"""
import json
import os
import re
import time
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

ACTOR = re.compile(r'acct_[1-9][0-9]{0,18}\Z')
GAME = re.compile(r'[a-z][a-z0-9-]{1,47}\Z')
ISSUER = re.compile(r'[A-Za-z0-9._:/-]{1,128}\Z')
SCHEMA = 'atrium.social-challenge-status/v1'


def _authorized(ctx):
    principal = getattr(ctx, 'principal', None)
    caller = getattr(principal, 'subject', None)
    if getattr(principal, 'kind', None) != 'service' or caller != 'atrium':
        return False
    allowed = {part.strip() for part in os.getenv('LOOPRD_TAVI_CHALLENGE_READ_CALLERS', '').split(',') if part.strip()}
    return caller in allowed


def _issuer():
    value = os.getenv('LOOPRD_TAVI_SOCIAL_ISSUER', '').strip()
    return value if ISSUER.fullmatch(value) else None


def _object(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return None
    return value if type(value) is dict else None


def verify(ctx):
    if not _authorized(ctx):
        return {'ok': False, 'reason': 'caller_not_approved'}
    issuer = _issuer()
    if issuer is None:
        return {'ok': False, 'reason': 'issuer_binding_required'}
    body = getattr(ctx, 'body', None)
    if (type(body) is not dict or set(body) != {'schema', 'challengeId'}
            or body['schema'] != SCHEMA or type(body['challengeId']) is not int
            or not 1 <= body['challengeId'] <= 9223372036854775807):
        return {'ok': False, 'reason': 'invalid_request'}
    with ctx.transaction() as db:
        row = db.execute(sa.text('''SELECT recipient,publisher,topic,data,status,response,expires
            FROM "SocialInteraction" WHERE id=:id'''), {'id': body['challengeId']}).mappings().first()
        if not row or row['topic'] != 'game.challenge.requested' or not isinstance(row['publisher'], str):
            return {'ok': False, 'reason': 'challenge_not_found'}
        publisher = row['publisher']
        if not publisher.startswith('challenge:'):
            return {'ok': False, 'reason': 'challenge_not_found'}
        sender = publisher[len('challenge:'):]
        recipient = row['recipient']
        data = _object(row['data'])
        detail = data.get('challenge') if data else None
        if (not ACTOR.fullmatch(sender) or not isinstance(recipient, str)
                or not ACTOR.fullmatch(recipient) or sender == recipient
                or type(detail) is not dict or detail.get('schema') != 'tavi.game-challenge/v1'
                or detail.get('sender') != sender or not isinstance(detail.get('gameId'), str)
                or not GAME.fullmatch(detail['gameId'])):
            return {'ok': False, 'reason': 'challenge_not_found'}
        if row['status'] == 'open':
            status = 'expired' if row['expires'] <= int(time.time()) else 'pending'
        elif row['status'] == 'responded':
            response = _object(row['response'])
            action = response.get('action') if response else None
            if response is None or response.get('by') != recipient:
                return {'ok': False, 'reason': 'challenge_unavailable'}
            status = {'accept-challenge': 'accepted', 'decline-challenge': 'declined'}.get(action)
            if status is None:
                return {'ok': False, 'reason': 'challenge_unavailable'}
        elif row['status'] == 'dismissed':
            status = 'cancelled'
        else:
            return {'ok': False, 'reason': 'challenge_unavailable'}
        return {'schema': SCHEMA, 'challengeId': body['challengeId'], 'issuer': issuer,
                'sender': sender, 'recipient': recipient, 'gameId': detail['gameId'],
                'status': status, 'original': True}


async def handle(ctx):
    return await run_in_threadpool(verify, ctx)
