"""LoopRD 0.4 service façade for the first-party Tavi Wallet.

The child component owns service authentication and caller identity. Durable Gold
balances/history remain in the existing Social home-realm database during this
transition. Calls are forwarded only through the declared local service contract;
no Social bearer/session token or ledger credential is exposed to callers.
"""
import re

CALLER = re.compile(r'^[a-z][a-z0-9-]{0,47}$')
BROKER_COMPONENT = 'looprd-social'
BROKER_CONTRACT = 'tavi-wallet-ledger-broker'
BROKER_SCHEMA = 'tavi.wallet-broker/v1'


def _service_actor(ctx):
    principal = getattr(ctx, 'principal', None)
    if getattr(principal, 'kind', None) != 'service':
        return None
    actor = getattr(principal, 'subject', None)
    return actor if isinstance(actor, str) and CALLER.fullmatch(actor) else None


async def _forward(ctx, channel):
    actor = _service_actor(ctx)
    if actor is None:
        return {'accepted': False, 'reason': 'service_identity_required'}
    command = getattr(ctx, 'body', None)
    if not isinstance(command, dict):
        return {'accepted': False, 'reason': 'invalid_request'}
    try:
        return await ctx.call(BROKER_COMPONENT, BROKER_CONTRACT, {
            'schema': BROKER_SCHEMA,
            'channel': channel,
            'actor': actor,
            'command': command,
        })
    except Exception:
        # Service-call exceptions can contain runtime/deployment details. The
        # public contract deliberately collapses them to a stable safe result.
        return {'accepted': False, 'reason': 'ledger_unavailable'}


async def handle_merchant(ctx):
    return await _forward(ctx, 'merchant')


async def handle_reward(ctx):
    return await _forward(ctx, 'reward')
