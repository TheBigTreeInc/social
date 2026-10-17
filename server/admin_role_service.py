"""Trusted service contract for checking the current Tavi administrator role."""
import re
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool


def current_role(sessions, subject):
    if not isinstance(subject,str) or not re.fullmatch(r'acct_[1-9][0-9]{0,18}',subject):
        return False
    with sessions() as db:
        return db.execute(sa.text('SELECT "ecosystemAdmin" FROM "SocialAccount" WHERE id=:id'),
            {'id':int(subject[5:])}).scalar() == 1


async def handle(ctx):
    if getattr(ctx.principal,'kind',None)!='service':
        return {'admin':False}
    return {'admin':await run_in_threadpool(current_role,ctx.session_factory,(ctx.body or {}).get('subject'))}
