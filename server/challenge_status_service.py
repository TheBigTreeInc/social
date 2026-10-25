"""Trusted read-only challenge verification for Atrium lobby admission.

Never exposes a user-token API and never grants seats or starts matches.
"""
import os
import re
import time
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

SUBJECT = re.compile(r'^acct_[1-9][0-9]{0,18}$')
COMPONENT = re.compile(r'^[a-z][a-z0-9-]{1,47}$')
GAME = re.compile(r'^[a-z][a-z0-9-]{1,47}$')


def verify(ctx):
    caller = getattr(ctx.principal, 'subject', None)
    if getattr(ctx.principal, 'kind', None) != 'service' or not isinstance(caller, str) or not COMPONENT.fullmatch(caller):
        return {'ok': False, 'reason': 'service_identity_required'}
    # A verified service principal alone is insufficient. Operator explicitly admits Atrium.
    allowed = {s.strip() for s in os.getenv('LOOPRD_TAVI_CHALLENGE_READ_CALLERS', '').split(',') if s.strip()}
    if caller not in allowed or caller != 'atrium':
        return {'ok': False, 'reason': 'caller_not_approved'}
    body = ctx.body
    if (not isinstance(body, dict) or set(body) != {'schema', 'challengeId', 'gameId', 'sender', 'recipient'}
            or body['schema'] != 'tavi.challenge-status-query/v1'
            or type(body['challengeId']) is not int or not 0 < body['challengeId'] <= 9223372036854775807
            or not isinstance(body['gameId'], str) or not GAME.fullmatch(body['gameId'])
            or not isinstance(body['sender'], str) or not SUBJECT.fullmatch(body['sender'])
            or not isinstance(body['recipient'], str) or not SUBJECT.fullmatch(body['recipient'])
            or body['sender'] == body['recipient']):
        return {'ok': False, 'reason': 'invalid_request'}
    with ctx.transaction() as db:
        row = db.execute(sa.text('''SELECT recipient,publisher,topic,data,status,response,expires
           FROM "SocialInteraction" WHERE id=:id'''), {'id': body['challengeId']}).mappings().first()
        # Non-existence and participant mismatch intentionally have same reply.
        if not row or row['recipient'] != body['recipient'] or row['publisher'] != 'challenge:' + body['sender'] or row['topic'] != 'game.challenge.requested':
            return {'ok': False, 'reason': 'challenge_not_found'}
        data = row['data']
        import json
        if isinstance(data, str):
            try: data = json.loads(data)
            except ValueError: data = None
        detail = data.get('challenge') if isinstance(data, dict) else None
        if (not isinstance(detail, dict) or detail.get('schema') != 'tavi.game-challenge/v1'
                or detail.get('sender') != body['sender'] or detail.get('gameId') != body['gameId']):
            return {'ok': False, 'reason': 'challenge_not_found'}
        status = 'pending'
        if row['status'] == 'open':
            if row['expires'] <= int(time.time()): status = 'expired'
        elif row['status'] == 'responded':
            response = row['response']
            if isinstance(response, str):
                try: response = json.loads(response)
                except ValueError: response = None
            action = response.get('action') if isinstance(response, dict) else None
            status = {'accept-challenge':'accepted', 'decline-challenge':'declined'}.get(action, 'unavailable')
        else:
            status = 'unavailable'
        # Accepted means only that a Social response was recorded; no Life authorization.
        return {'ok': True, 'schema': 'tavi.challenge-status/v1', 'challengeId': body['challengeId'],
                'gameId': body['gameId'], 'sender': body['sender'], 'recipient': body['recipient'],
                'status': status}


async def handle(ctx):
    return await run_in_threadpool(verify, ctx)
