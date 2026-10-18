"""Private game-session room roster synchronization from an approved LoopRD game service.

Tavi never decides who has a game seat. The game service supplies an authoritative
full roster with monotonically increasing revision. Social only provides optional
private chat for those seats after separate per-account consent to that match.
"""
import hashlib
import json
import os
import re
import time
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

COMPONENT_ID = re.compile(r'^[a-z][a-z0-9-]{1,47}$')
GAME_ID = re.compile(r'^[a-z][a-z0-9.]{1,95}$')
MATCH_ID = re.compile(r'^[A-Za-z0-9_-]{12,128}$')
SUBJECT_ID = re.compile(r'^acct_[1-9][0-9]{0,18}$')


def configured_publishers():
    try: data = json.loads(os.environ.get('LOOPRD_TAVI_GAME_CALLERS_JSON','{}'))
    except (ValueError,TypeError): return {}
    if not isinstance(data,dict) or len(data)>32: return {}
    return {k:set(v) for k,v in data.items()
            if isinstance(k,str) and COMPONENT_ID.fullmatch(k) and isinstance(v,list) and 0<len(v)<=32
            and all(isinstance(g,str) and GAME_ID.fullmatch(g) for g in v)}


def room_key(publisher,game_id,match_id):
    return hashlib.sha256(json.dumps([publisher,game_id,match_id],separators=(',',':')).encode()).hexdigest()


def validate_snapshot(body,caller):
    if not isinstance(body,dict) or set(body) != {'schema','gameId','matchId','revision','status','members'}:
        return None
    game=body.get('gameId');match=body.get('matchId');members=body.get('members');rev=body.get('revision')
    issuer=os.environ.get('LOOPRD_TAVI_SOCIAL_ISSUER','')
    if (body.get('schema')!='tavi.game-room-roster/v1' or not isinstance(game,str) or not GAME_ID.fullmatch(game)
        or not isinstance(match,str) or not MATCH_ID.fullmatch(match) or game not in configured_publishers().get(caller,set())
        or type(rev) is not int or rev<1 or rev>1000000000 or body.get('status') not in ('active','closed')
        or not issuer or len(issuer)>128 or not isinstance(members,list) or len(members)>12):return None
    if body['status']=='active' and not 1<=len(members)<=12:return None
    subjects=[]
    for member in members:
        if (not isinstance(member,dict) or set(member) != {'issuer','subject'} or member.get('issuer')!=issuer
            or not isinstance(member.get('subject'),str) or not SUBJECT_ID.fullmatch(member['subject'])):return None
        subjects.append(member['subject'])
    if len(set(subjects))!=len(subjects):return None
    if body['status']=='closed' and subjects:return None
    return game,match,rev,body['status'],sorted(subjects)


def synchronize(ctx):
    caller=getattr(ctx.principal,'subject',None)
    if getattr(ctx.principal,'kind',None)!='service' or not isinstance(caller,str) or not COMPONENT_ID.fullmatch(caller):
        return {'accepted':False,'delivery':'rejected','reason':'service_identity_required'}
    snapshot=validate_snapshot(ctx.body,caller)
    if snapshot is None:return {'accepted':False,'delivery':'rejected','reason':'invalid_or_unapproved_roster'}
    game,match,revision,status,members=snapshot
    key=room_key(caller,game,match);now=int(time.time())
    with ctx.transaction() as db:
        old=db.execute(sa.text('''SELECT revision,status FROM "SocialGameRoom" WHERE roomKey=:key'''),{'key':key}).mappings().first()
        if old:
            if revision<old['revision']:return {'accepted':False,'delivery':'rejected','reason':'stale_revision'}
            if revision==old['revision']:
                current=db.execute(sa.text('SELECT subjectId FROM "SocialGameRoomMember" WHERE roomKey=:key ORDER BY subjectId'),{'key':key}).scalars().all()
                if old['status']==status and current==members:
                    return {'accepted':True,'delivery':'duplicate','roomId':key,'revision':revision}
                return {'accepted':False,'delivery':'rejected','reason':'revision_conflict'}
            if old['status']=='closed':return {'accepted':False,'delivery':'rejected','reason':'room_already_closed'}
            db.execute(sa.text('UPDATE "SocialGameRoom" SET revision=:revision,status=:status,updated=:now WHERE roomKey=:key'),
                       {'key':key,'revision':revision,'status':status,'now':now})
            db.execute(sa.text('DELETE FROM "SocialGameRoomMember" WHERE roomKey=:key'),{'key':key})
        else:
            db.execute(sa.text('''INSERT INTO "SocialGameRoom"
                (roomKey,publisher,gameId,matchId,revision,status,updated)
                VALUES (:key,:caller,:game,:match,:revision,:status,:now)'''),
                {'key':key,'caller':caller,'game':game,'match':match,'revision':revision,'status':status,'now':now})
        for subject in members:
            db.execute(sa.text('''INSERT INTO "SocialGameRoomMember" (roomKey,subjectId,updated)
                VALUES (:key,:subject,:now)'''),{'key':key,'subject':subject,'now':now})
        # Closed rooms are terminal. Existing chat is inaccessible, but retained for
        # normal operator data-retention policy rather than deleted on closure.
        row=db.execute(sa.text('SELECT signal FROM "SocialPulse" WHERE id=1')).first()
        if row:
            signal=row[0]+1
            db.execute(sa.text('UPDATE "SocialPulse" SET signal=:signal WHERE id=1'),{'signal':signal})
        else:
            signal=1
            db.execute(sa.text('INSERT INTO "SocialPulse" (id,signal) VALUES (1,1)'))
        # Replay and notifications belong to the same transaction as membership changes.
        ctx.emit(db, {'resource':'pulses','action':'updated','id':1,'data':{'id':1,'signal':signal}})
    return {'accepted':True,'delivery':'created','roomId':key,'revision':revision}


async def handle(ctx):
    return await run_in_threadpool(synchronize,ctx)
