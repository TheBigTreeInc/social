"""Atrium's privileged current-relationship lookup; no cached friendship claims.

Queries the Social-owned contact table on each request. A prior accepted
challenge does not override a subsequently removed/blocked relationship.
"""
import os
import re
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

ACTOR = re.compile(r'acct_[1-9][0-9]{0,18}\Z')
ISSUER = re.compile(r'[A-Za-z0-9._:/-]{1,128}\Z')
SCHEMA = 'atrium.social-contact-status/v1'


def verify(ctx):
    principal = getattr(ctx, 'principal', None)
    caller = getattr(principal, 'subject', None)
    allowed = {s.strip() for s in os.getenv('LOOPRD_TAVI_CHALLENGE_READ_CALLERS', '').split(',') if s.strip()}
    if getattr(principal, 'kind', None) != 'service' or caller != 'atrium' or caller not in allowed:
        return {'ok': False, 'reason': 'caller_not_approved'}
    issuer = os.getenv('LOOPRD_TAVI_SOCIAL_ISSUER', '').strip()
    if not ISSUER.fullmatch(issuer):
        return {'ok': False, 'reason': 'issuer_binding_required'}
    body = getattr(ctx, 'body', None)
    if (type(body) is not dict or set(body) != {'schema','issuer','sender','recipient'}
            or body['schema'] != SCHEMA or body['issuer'] != issuer
            or not isinstance(body['sender'], str) or not ACTOR.fullmatch(body['sender'])
            or not isinstance(body['recipient'], str) or not ACTOR.fullmatch(body['recipient'])
            or body['sender'] == body['recipient']):
        return {'ok': False, 'reason': 'invalid_request'}
    left, right = sorted((body['sender'], body['recipient']))
    with ctx.transaction() as db:
        row = db.execute(sa.text('''SELECT status FROM "SocialContact"
            WHERE "leftId"=:left AND "rightId"=:right'''),
            {'left':left,'right':right}).mappings().first()
    return {'schema': SCHEMA, 'issuer': issuer, 'sender':body['sender'],
            'recipient':body['recipient'], 'accepted': bool(row and row['status'] == 'accepted')}


async def handle(ctx):
    return await run_in_threadpool(verify, ctx)
