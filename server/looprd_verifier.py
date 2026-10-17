"""LoopRD verified identity adapter for Tavi Social sessions.

The public guest credential is an *unprivileged protocol marker*, not a secret.
It only permits sign-up/sign-in/discovery through the Social handler. Normal
sessions are checked against the database on every HTTP request, and LoopRD
binds devices to the stable realm/subject principal.
"""
import hashlib
import hmac
import time
import json
import os
import re
import sqlalchemy as sa

GUEST_CREDENTIAL = "tavi_guest_v1"  # public, unprivileged, NOT an authentication secret
SOCIAL_SCOPES = ['social:api']
USER_SCOPES = ['social:api', 'events:read', 'push:manage']
SERVICE_SCOPES = ['social:service']


def lookup_session(session_factory, credential):
    if not isinstance(credential, str) or not 32 <= len(credential) <= 256:
        return None
    digest = hashlib.sha256(credential.encode('utf8')).hexdigest()
    now = time.time()
    with session_factory() as db:
        row = db.execute(sa.text('''SELECT id, subjectId, expires FROM "SocialSession"
            WHERE tokenHash = :digest AND revoked = 0 AND expires > :now
            LIMIT 1'''), {'digest': digest, 'now': now}).mappings().first()
    if not row or not isinstance(row['subjectId'], str) or not row['subjectId'].startswith('acct_'):
        return None
    return {'subject': row['subjectId'], 'label': 'Tavi user', 'kind': 'user',
            'sessionId': str(row['id']), 'expiresAt': float(row['expires']),
            'scopes': USER_SCOPES}


def configured_service_refs():
    """Private operator mapping: component IDs -> names of mounted secret references."""
    try:
        mapping=json.loads(os.environ.get('LOOPRD_SOCIAL_SERVICE_SECRETS_JSON','{}'))
    except (ValueError,TypeError):
        return {}
    if not isinstance(mapping,dict) or len(mapping)>32:
        return {}
    return {name:ref for name,ref in mapping.items()
        if isinstance(name,str) and re.fullmatch(r'[a-z][a-z0-9-]{1,47}',name)
        and isinstance(ref,str) and re.fullmatch(r'[a-zA-Z0-9_./-]{1,200}',ref)
        and '..' not in ref.split('/') and not ref.startswith('/')}


def service_identity(credential, secret_reader):
    if not isinstance(credential,str) or not 32 <= len(credential) <= 256:
        return None
    received=hashlib.sha256(credential.encode('utf8')).digest()
    for name,reference in configured_service_refs().items():
        try:
            secret=secret_reader(reference)
            if not isinstance(secret,str) or len(secret)<32:
                continue
            expected=hashlib.sha256(secret.strip().encode('utf8')).digest()
            if hmac.compare_digest(received,expected):
                return {'subject':name,'label':'Tavi trusted service', 'kind':'service',
                        'scopes':SERVICE_SCOPES}
        except (ValueError,OSError,KeyError):
            continue
    return None


async def verify(ctx):
    if hmac.compare_digest(ctx.credential, GUEST_CREDENTIAL):
        return {'subject': 'guest', 'label': 'Tavi guest', 'kind': 'service', 'scopes': SOCIAL_SCOPES}
    service=service_identity(ctx.credential,ctx.secret)
    if service is not None:
        return service
    if ctx.session_factory is None:
        return None
    return await ctx.run(lookup_session, ctx.session_factory, ctx.credential)
