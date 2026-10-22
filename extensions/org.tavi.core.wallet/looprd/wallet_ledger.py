"""First-party virtual wallet inside the Social home-realm database.

Separately owned ledger tables and narrow commands permit later extraction into a
standalone LoopRD Ledger component without changing currency or receipt IDs.
No fiat, cash-out, paid tokens, credit, gambling stakes or client-side minting.
"""
import hashlib
import json
import os
import re
import time
import sqlalchemy as sa
from starlette.concurrency import run_in_threadpool

WALLET_SCHEMA = 'tavi.wallet/v1'
GOLD = 'gold'
TREASURY = 'system:treasury'
ACCOUNT = re.compile(r'^acct_[1-9][0-9]{0,18}$')
CURRENCY = re.compile(r'^[a-z][a-z0-9._:-]{0,47}$')
SKU = re.compile(r'^[a-z][a-z0-9._:-]{1,95}$')
REQUEST = re.compile(r'^[A-Za-z0-9_-]{8,96}$')
CALLER = re.compile(r'^[a-z][a-z0-9-]{1,47}$')
MAX_AMOUNT = 10**12
BALANCE = sa.table('WalletBalance',sa.column('id',sa.Integer),sa.column('subjectId',sa.String),
    sa.column('currencyId',sa.String),sa.column('amount',sa.BigInteger))
TX = sa.table('WalletTransaction',sa.column('id',sa.Integer),sa.column('actor',sa.String),
    sa.column('requestId',sa.String),sa.column('digest',sa.String),sa.column('kind',sa.String),
    sa.column('data',sa.JSON),sa.column('created',sa.Integer))
ENTRY = sa.table('WalletEntry',sa.column('id',sa.Integer),sa.column('transactionId',sa.Integer),
    sa.column('accountId',sa.String),sa.column('currencyId',sa.String),sa.column('delta',sa.BigInteger))
RESERVE = sa.table('WalletRestrictedBalance',sa.column('id',sa.Integer),sa.column('subjectId',sa.String),
    sa.column('currencyId',sa.String),sa.column('amount',sa.BigInteger))
REWARD = sa.table('WalletRewardIssue',sa.column('id',sa.Integer),sa.column('merchant',sa.String),
    sa.column('eventId',sa.String),sa.column('recipient',sa.String),sa.column('currencyId',sa.String),
    sa.column('amount',sa.BigInteger),sa.column('transactionId',sa.Integer),sa.column('created',sa.Integer))
ORDER = sa.table('WalletOrder',sa.column('id',sa.Integer),sa.column('subjectId',sa.String),
    sa.column('sku',sa.String),sa.column('currencyId',sa.String),sa.column('price',sa.BigInteger),
    sa.column('merchant',sa.String),sa.column('state',sa.String),sa.column('transactionId',sa.Integer),
    sa.column('created',sa.Integer))


def failure(code):
    return {'ok':False,'code':code,'error':code.replace('_',' ')}


def amount(value, *, positive=True):
    if not isinstance(value,str) or not re.fullmatch(r'(?:0|[1-9][0-9]{0,12})',value):
        raise ValueError('invalid_amount')
    n=int(value)
    if n>MAX_AMOUNT or (positive and n<=0):raise ValueError('invalid_amount')
    return n


def valid_request(value):
    if not isinstance(value,str) or not REQUEST.fullmatch(value):raise ValueError('invalid_request_id')
    return value


def currency_catalog():
    # Operator-approved metadata only. No exchange routes or prices from the UI.
    result={'gold':{'id':'gold','name':'Gold','decimals':0,'symbol':'✦','scope':'realm'}}
    try: data=json.loads(os.environ.get('LOOPRD_TAVI_WALLET_CURRENCIES_JSON','[]'))
    except (ValueError,TypeError):return result
    if not isinstance(data,list) or len(data)>24:return result
    for item in data:
        if not isinstance(item,dict) or set(item)!={'id','name','symbol','decimals','scope'}:continue
        id_=item['id']
        if id_=='gold' or not isinstance(id_,str) or not CURRENCY.fullmatch(id_):continue
        if (not isinstance(item['name'],str) or not 1<=len(item['name'])<=50 or
            not isinstance(item['symbol'],str) or not 1<=len(item['symbol'])<=4 or
            type(item['decimals']) is not int or not 0<=item['decimals']<=6 or
            item['scope'] not in ('realm','game')):continue
        result[id_]=item
    return result


def offers():
    """Static operator-approved SKUs; offer state never comes from publisher iframe."""
    try: data=json.loads(os.environ.get('LOOPRD_TAVI_WALLET_OFFERS_JSON','[]'))
    except (ValueError,TypeError):return {}
    if not isinstance(data,list) or len(data)>150:return {}
    currency_ids=currency_catalog()
    result={}
    for x in data:
        if not isinstance(x,dict) or set(x)!={'sku','title','merchant','type','currencyId','price'}:continue
        try:
            if (not isinstance(x['sku'],str) or not SKU.fullmatch(x['sku']) or
                not isinstance(x['merchant'],str) or not CALLER.fullmatch(x['merchant']) or
                not isinstance(x['title'],str) or not 1<=len(x['title'])<=90 or
                any(ord(c)<32 for c in x['title']) or x['type'] not in ('entry','item') or
                x['currencyId'] not in currency_ids):continue
            amount(x['price'],positive=False)
        except (ValueError,TypeError,KeyError):continue
        result[x['sku']]=x
    return result


def conversion_rates():
    """Exact rational quotes, operator supplied; reverse requires another explicit rule."""
    try: data=json.loads(os.environ.get('LOOPRD_TAVI_WALLET_RATES_JSON','[]'))
    except (ValueError,TypeError):return []
    if not isinstance(data,list) or len(data)>40:return []
    known=currency_catalog(); result=[];seen=set()
    for item in data:
        if not isinstance(item,dict) or set(item)!={'from','to','numerator','denominator'}:continue
        try:
            a,b=item['from'],item['to']
            if a not in known or b not in known or a==b or (a,b) in seen:continue
            n=amount(item['numerator']);d=amount(item['denominator'])
            if n>1000000 or d>1000000:continue
        except (KeyError,TypeError,ValueError):continue
        seen.add((a,b));result.append({'from':a,'to':b,'numerator':str(n),'denominator':str(d)})
    return result


def merchants():
    try: data=json.loads(os.environ.get('LOOPRD_TAVI_WALLET_MERCHANTS_JSON','{}'))
    except (ValueError,TypeError):return {}
    if not isinstance(data,dict) or len(data)>32:return {}
    return {key:set(values) for key,values in data.items()
        if isinstance(key,str) and CALLER.fullmatch(key) and isinstance(values,list)
        and len(values)<=100 and all(isinstance(v,str) and SKU.fullmatch(v) for v in values)}


def reward_policy():
    """Explicit trusted merchant limits. Absent config means no reward minting."""
    try: raw=json.loads(os.environ.get('LOOPRD_TAVI_WALLET_REWARDS_JSON','{}'))
    except (ValueError,TypeError):return {}
    if not isinstance(raw,dict) or len(raw)>32:return {}
    catalog=currency_catalog();result={}
    for merchant,limits in raw.items():
        if (not isinstance(merchant,str) or not CALLER.fullmatch(merchant)
            or not isinstance(limits,dict) or set(limits)!={'currencyId','maxPerEvent','dailyPerPlayer'}):continue
        try:
            if limits['currencyId'] not in catalog:continue
            maximum=amount(limits['maxPerEvent']);daily=amount(limits['dailyPerPlayer'])
            if maximum>10000 or daily>100000 or daily<maximum:continue
        except (TypeError,ValueError,KeyError):continue
        result[merchant]={'currencyId':limits['currencyId'], 'maxPerEvent':maximum,
            'dailyPerPlayer':daily}
    return result


def wallet_amount(db,subject,currency):
    row=db.execute(sa.select(BALANCE.c.amount).where(BALANCE.c.subjectId==subject,
        BALANCE.c.currencyId==currency)).scalar_one_or_none()
    return int(row or 0)


def restricted_amount(db,subject,currency):
    value=db.execute(sa.select(RESERVE.c.amount).where(RESERVE.c.subjectId==subject,
        RESERVE.c.currencyId==currency)).scalar_one_or_none()
    return int(value or 0)


def shopping_amount(db,subject,currency):
    total=wallet_amount(db,subject,currency)
    protected=restricted_amount(db,subject,currency)
    if protected<0 or protected>total:raise ValueError('wallet_restricted_balance_corrupt')
    return total-protected


def _apply_restriction(db,subject,currency,delta):
    if not ACCOUNT.fullmatch(str(subject)):raise ValueError('invalid_restriction_subject')
    db.execute(sa.text('''INSERT INTO "WalletRestrictedBalance" (subjectId,currencyId,amount)
        VALUES (:subject,:currency,0) ON CONFLICT(subjectId,currencyId) DO NOTHING'''),
        {'subject':subject,'currency':currency})
    result=db.execute(sa.text('''UPDATE "WalletRestrictedBalance"
        SET amount=amount+:delta WHERE subjectId=:subject AND currencyId=:currency
        AND amount+:delta>=0 AND amount+:delta <=
            (SELECT amount FROM "WalletBalance" WHERE subjectId=:subject AND currencyId=:currency)'''),
        {'subject':subject,'currency':currency,'delta':delta})
    if result.rowcount!=1:raise ValueError('restricted_balance_violation')


def _apply_entry(db,account,currency,delta):
    db.execute(sa.text('''INSERT INTO "WalletBalance" (subjectId,currencyId,amount)
        VALUES (:subject,:currency,0) ON CONFLICT(subjectId,currencyId) DO NOTHING'''),
        {'subject':account,'currency':currency})
    stmt='''UPDATE "WalletBalance" SET amount=amount+:delta
        WHERE subjectId=:subject AND currencyId=:currency'''
    if account!=TREASURY:stmt+=' AND amount+:delta>=0'
    updated=db.execute(sa.text(stmt),{'subject':account,'currency':currency,'delta':delta})
    if updated.rowcount!=1:raise ValueError('insufficient_funds')


def _receipt(db,actor,request_id,digest):
    row=db.execute(sa.select(TX).where(TX.c.actor==actor,TX.c.requestId==request_id)).mappings().first()
    if not row:return None
    if row['digest']!=digest:raise ValueError('request_conflict')
    return row['data']


def _post(db,actor,request_id,kind,payload,changes,now,restricted_changes=()):
    valid_request(request_id)
    if not isinstance(changes,list) or len(changes)>8:raise ValueError('invalid_entries')
    by_currency={}
    for account,currency,delta in changes:
        if not isinstance(account,str) or not CURRENCY.fullmatch(currency) or type(delta) is not int:
            raise ValueError('invalid_entries')
        by_currency[currency]=by_currency.get(currency,0)+delta
    if any(v!=0 for v in by_currency.values()):raise ValueError('unbalanced_journal')
    if not isinstance(restricted_changes,(list,tuple)) or len(restricted_changes)>4:
        raise ValueError('invalid_restrictions')
    for account,currency,delta in restricted_changes:
        if not ACCOUNT.fullmatch(str(account)) or not CURRENCY.fullmatch(currency) or type(delta) is not int:
            raise ValueError('invalid_restrictions')
    digest=hashlib.sha256(json.dumps({'kind':kind,'payload':payload,'entries':changes,'restrictions':restricted_changes},
        sort_keys=True,separators=(',',':')).encode()).hexdigest()
    prior=_receipt(db,actor,request_id,digest)
    if prior is not None:return prior,False
    for account,currency,delta in changes:_apply_entry(db,account,currency,delta)
    for account,currency,delta in restricted_changes:_apply_restriction(db,account,currency,delta)
    tx_id=db.execute(sa.insert(TX).values(actor=actor,requestId=request_id,digest=digest,
        kind=kind,data={},created=now).returning(TX.c.id)).scalar_one()
    for account,currency,delta in changes:
        db.execute(sa.insert(ENTRY).values(transactionId=tx_id,accountId=account,
            currencyId=currency,delta=delta))
    result={'ok':True,'schema':'tavi.wallet-receipt/v1','transactionId':tx_id,
        'kind':kind,'created':now,**payload}
    db.execute(sa.update(TX).where(TX.c.id==tx_id).values(data=result))
    return result,True


def ensure_welcome(db,actor,now):
    # The initial 100 Gold grant is intrinsically restricted; no legacy funds.
    previous=db.execute(sa.select(TX.c.id).where(TX.c.actor==actor,
        TX.c.requestId=='wallet-welcome-v1')).scalar_one_or_none()
    if previous is not None:return
    _post(db,actor,'wallet-welcome-v1','welcome',
        {'currencyId':GOLD,'amount':'100','restricted':'100'},
        [(TREASURY,GOLD,-100),(actor,GOLD,100)],now,
        [(actor,GOLD,100)])


def snapshot(db,actor):
    def view(cid):
        total=wallet_amount(db,actor,cid)
        protected=restricted_amount(db,actor,cid)
        if protected>total:raise ValueError('wallet_restricted_balance_corrupt')
        return {'currencyId':cid,'amount':str(total),'playOnly':str(protected),
                'availableForShopping':str(total-protected)}
    return {'ok':True,'schema':WALLET_SCHEMA,'balances':[
        view(cid) for cid in currency_catalog()], 'currencies':list(currency_catalog().values()),
        'rates':conversion_rates(),'offers':list(offers().values()),'faucet':{'currencyId':GOLD,
        'target':'100','claimable':restricted_amount(db,actor,GOLD)<100,
        'purpose':'game_entries_only'}}


def execute_wallet(db,actor,body,now=None):
    now=int(time.time()) if now is None else int(now)
    if not ACCOUNT.fullmatch(str(actor)):return failure('auth_required')
    if not isinstance(body,dict):return failure('invalid_request')
    op=body.get('op')
    if op not in ('balance','transactions','claim','convert','purchase','order_status'):
        return failure('unsupported_wallet_operation')
    try:
        ensure_welcome(db,actor,now)
        if op=='balance':return snapshot(db,actor)
        if op=='transactions':
            limit=body.get('limit',40)
            if type(limit) is not int or not 1<=limit<=100:raise ValueError('invalid_limit')
            records=db.execute(sa.select(TX).where(TX.c.actor==actor)
                .order_by(TX.c.id.desc()).limit(limit)).mappings().all()
            receipts=[]
            for r in records:
                item=dict(r['data'])
                if r['kind']=='purchase':
                    order=db.execute(sa.select(ORDER.c.state,ORDER.c.id).where(
                        ORDER.c.transactionId==r['id'],ORDER.c.subjectId==actor)).first()
                    if order:item.update(fulfillment=order.state,orderId=order.id)
                receipts.append(item)
            return {'ok':True,'schema':'tavi.wallet-history/v1','transactions':receipts}
        if op=='order_status':
            order_id=body.get('orderId')
            if type(order_id) is not int or order_id<1:raise ValueError('invalid_order')
            row=db.execute(sa.select(ORDER).where(ORDER.c.id==order_id,
                ORDER.c.subjectId==actor)).mappings().first()
            if not row:return failure('order_not_found')
            return {'ok':True,'schema':'tavi.wallet-order/v1','orderId':row['id'],
                'sku':row['sku'],'state':row['state'],'transactionId':row['transactionId']}
        request_id=valid_request(body.get('requestId'))
        prior=db.execute(sa.select(TX.c.kind,TX.c.data).where(
            TX.c.actor==actor,TX.c.requestId==request_id)).mappings().first()
        if prior:
            receipt=prior['data']
            valid=(op=='claim' and prior['kind']=='refill' or
                op=='convert' and prior['kind']=='conversion' and
                receipt.get('from')==body.get('from') and receipt.get('to')==body.get('to') and
                receipt.get('debited')==body.get('amount') and
                receipt.get('numerator')==body.get('expectedNumerator') and
                receipt.get('denominator')==body.get('expectedDenominator') or
                op=='purchase' and prior['kind']=='purchase' and receipt.get('sku')==body.get('sku'))
            return receipt if valid else failure('request_conflict')
        if op=='claim':
            protected=restricted_amount(db,actor,GOLD)
            if protected>=100:return failure('refill_not_needed')
            difference=100-protected
            result,_=_post(db,actor,request_id,'refill',
                {'currencyId':GOLD,'amount':str(difference),'restricted':str(difference),
                 'purpose':'game_entries_only'},
                [(TREASURY,GOLD,-difference),(actor,GOLD,difference)],now,
                [(actor,GOLD,difference)])
            return result
        if op=='convert':
            src=body.get('from');dst=body.get('to');units=amount(body.get('amount'))
            rule=next((r for r in conversion_rates() if r['from']==src and r['to']==dst),None)
            if rule is None:raise ValueError('conversion_unavailable')
            numerator,denominator=int(rule['numerator']),int(rule['denominator'])
            if body.get('expectedNumerator')!=rule['numerator'] or body.get('expectedDenominator')!=rule['denominator']:
                raise ValueError('conversion_rate_changed')
            if (units*numerator)%denominator:raise ValueError('fractional_conversion')
            obtained=units*numerator//denominator
            if not 0<obtained<=MAX_AMOUNT:raise ValueError('invalid_conversion_amount')
            if shopping_amount(db,actor,src)<units:
                raise ValueError('conversion_requires_earned_currency')
            result,_=_post(db,actor,request_id,'conversion',
                {'from':src,'to':dst,'debited':str(units),'credited':str(obtained),
                 'numerator':str(numerator),'denominator':str(denominator)},
                [(actor,src,-units),(TREASURY,src,units),
                 (TREASURY,dst,-obtained),(actor,dst,obtained)],now)
            return result
        if op=='purchase':
            sku=body.get('sku');offer=offers().get(sku)
            if offer is None:raise ValueError('offer_unavailable')
            cost=amount(offer['price'],positive=False);currency=offer['currencyId']
            if (body.get('expectedPrice')!=offer['price'] or body.get('expectedCurrency')!=currency
                    or body.get('expectedMerchant')!=offer['merchant']):
                raise ValueError('offer_changed_review_again')
            protected=restricted_amount(db,actor,currency)
            available=shopping_amount(db,actor,currency)
            if offer['type']=='item' and cost>available:
                raise ValueError('shop_requires_earned_currency')
            if cost>wallet_amount(db,actor,currency):raise ValueError('insufficient_funds')
            restricted_spend=min(cost,protected) if offer['type']=='entry' else 0
            result,created=_post(db,actor,request_id,'purchase',
                {'sku':sku,'title':offer['title'],'offerType':offer['type'],
                 'currencyId':currency,'amount':str(cost),'merchant':offer['merchant'],
                 'restrictedSpent':str(restricted_spend),'fulfillment':'pending'},
                ([(actor,currency,-cost),(TREASURY,currency,cost)] if cost else []),now,
                ([(actor,currency,-restricted_spend)] if restricted_spend else []))
            if created:
                order_id=db.execute(sa.insert(ORDER).values(subjectId=actor,sku=sku,
                    currencyId=currency,price=cost,merchant=offer['merchant'],
                    state='pending',transactionId=result['transactionId'],created=now)
                    .returning(ORDER.c.id)).scalar_one()
                result={**result,'orderId':order_id}
                db.execute(sa.update(TX).where(TX.c.id==result['transactionId']).values(data=result))
            return result
    except (ValueError,KeyError,TypeError) as ex:
        return failure(str(ex)[:70])
    return failure('unsupported_wallet_operation')


def execute_merchant(db,actor,kind,body,now=None):
    # Actor is the independently authenticated service principal, never a body field.
    if not CALLER.fullmatch(str(actor)) or actor not in merchants():
        return {'accepted':False,'reason':'merchant_not_authorized'}
    if not isinstance(body,dict) or body.get('schema')!='tavi.wallet-fulfillment/v1':
        return {'accepted':False,'reason':'invalid_request'}
    order_id=body.get('orderId');sku=body.get('sku')
    if type(order_id) is not int or order_id<1 or not isinstance(sku,str):
        return {'accepted':False,'reason':'invalid_order'}
    if sku not in merchants()[actor]:return {'accepted':False,'reason':'merchant_not_authorized'}
    row=db.execute(sa.select(ORDER).where(ORDER.c.id==order_id,
        ORDER.c.sku==sku,ORDER.c.merchant==actor)).mappings().first()
    if not row:return {'accepted':False,'reason':'order_not_found'}
    if kind=='fulfill':
        if row['state']=='fulfilled':return {'accepted':True,'delivery':'duplicate'}
        if row['state']!='pending':return {'accepted':False,'reason':'order_not_pending'}
        updated=db.execute(sa.update(ORDER).where(ORDER.c.id==order_id,ORDER.c.state=='pending')
            .values(state='fulfilled'))
        return {'accepted':updated.rowcount==1,'delivery':'fulfilled' if updated.rowcount==1 else 'duplicate'}
    if kind=='refund':
        if row['state']=='refunded':return {'accepted':True,'delivery':'duplicate'}
        if row['state']!='pending':return {'accepted':False,'reason':'order_not_pending'}
        cost=int(row['price']);currency=row['currencyId'];recipient=row['subjectId']
        if cost:
            original=db.execute(sa.select(TX.c.data).where(TX.c.id==row['transactionId'])).scalar_one()
            # Every purchase in the clean ledger records its source. A missing
            # provenance record is corruption, never an excuse to mint credit.
            raw=original.get('restrictedSpent') if isinstance(original,dict) else None
            if not isinstance(raw,str) or not raw.isdecimal():
                raise ValueError('missing_refund_provenance')
            protected=int(raw)
            if not 0<=protected<=cost:raise ValueError('invalid_refund_provenance')
            _post(db,recipient,f'wallet-refund-{order_id}','refund',
                {'sku':sku,'orderId':order_id,'currencyId':currency,
                 'amount':str(cost),'restrictedRefund':str(protected)},
                [(TREASURY,currency,-cost),(recipient,currency,cost)],
                int(time.time()) if now is None else int(now),
                ([(recipient,currency,protected)] if protected else []))
        db.execute(sa.update(ORDER).where(ORDER.c.id==order_id,ORDER.c.state=='pending')
            .values(state='refunded'))
        return {'accepted':True,'delivery':'refunded'}
    return {'accepted':False,'reason':'unsupported_operation'}


def execute_reward(db,actor,body,now=None):
    """Award *earned* shopping-eligible currency from a tightly configured service.

    Operator admission is separate from ordinary merchant fulfillment. Replays
    are stable per publisher event ID and there is a hard daily player cap.
    """
    now=int(time.time()) if now is None else int(now)
    if not isinstance(body,dict) or body.get('schema')!='tavi.wallet-reward/v1' or body.get('op')!='reward':
        return {'accepted':False,'reason':'invalid_request'}
    policy=reward_policy().get(str(actor))
    if not policy or actor not in merchants():return {'accepted':False,'reason':'reward_not_authorized'}
    recipient=body.get('recipient');event_id=body.get('eventId');currency=body.get('currencyId')
    try:
        if not ACCOUNT.fullmatch(str(recipient)) or currency!=policy['currencyId']:
            raise ValueError('invalid_recipient_or_currency')
        event_id=valid_request(event_id);units=amount(body.get('amount'))
        if units>policy['maxPerEvent']:raise ValueError('reward_limit_exceeded')
        previous=db.execute(sa.select(REWARD).where(REWARD.c.merchant==actor,
            REWARD.c.eventId==event_id)).mappings().first()
        if previous:
            same=(previous['recipient']==recipient and previous['currencyId']==currency and
                int(previous['amount'])==units)
            return ({'accepted':True,'delivery':'duplicate','transactionId':previous['transactionId']}
                if same else {'accepted':False,'reason':'reward_event_conflict'})
        since=now-now%86400
        today=db.execute(sa.select(sa.func.coalesce(sa.func.sum(REWARD.c.amount),0)).where(
            REWARD.c.merchant==actor,REWARD.c.recipient==recipient,
            REWARD.c.currencyId==currency,REWARD.c.created>=since)).scalar_one()
        if int(today)+units>policy['dailyPerPlayer']:
            raise ValueError('daily_reward_limit_exceeded')
        ensure_welcome(db,recipient,now)
        request_id='wallet-reward-'+hashlib.sha256((actor+':'+event_id).encode()).hexdigest()[:48]
        receipt,_=_post(db,recipient,request_id,'reward',
            {'currencyId':currency,'amount':str(units),'merchant':actor,'eventId':event_id,
             'restricted':'0'},
            [(TREASURY,currency,-units),(recipient,currency,units)],now)
        db.execute(sa.insert(REWARD).values(merchant=actor,eventId=event_id,
            recipient=recipient,currencyId=currency,amount=units,
            transactionId=receipt['transactionId'],created=now))
        return {'accepted':True,'delivery':'created','transactionId':receipt['transactionId']}
    except (ValueError,KeyError,TypeError) as e:
        return {'accepted':False,'reason':str(e)[:80]}


def _valid_session(db,subject,token):
    if not isinstance(token,str) or not 32<=len(token)<=256:return False
    found=db.execute(sa.text('''SELECT subjectId FROM "SocialSession"
        WHERE tokenHash=:hash AND revoked=0 AND expires>:now'''),
        {'hash':hashlib.sha256(token.encode()).hexdigest(),'now':time.time()}).scalar_one_or_none()
    return found==subject


def _run_user(ctx):
    subject=getattr(ctx.principal,'subject',None)
    if getattr(ctx.principal,'kind',None)!='user' or not ACCOUNT.fullmatch(str(subject)):
        return failure('auth_required')
    with ctx.transaction() as db:
        if not _valid_session(db,subject,ctx.body.get('token') if isinstance(ctx.body,dict) else None):
            return failure('session_mismatch')
        return execute_wallet(db,subject,ctx.body)


async def handle(ctx):
    return await run_in_threadpool(_run_user,ctx)


def _run_service(ctx):
    if getattr(ctx.principal,'kind',None)!='service':return {'accepted':False,'reason':'service_identity_required'}
    with ctx.transaction() as db:
        return execute_merchant(db,getattr(ctx.principal,'subject',None),
            ctx.body.get('op') if isinstance(ctx.body,dict) else None,ctx.body)


async def handle_merchant(ctx):
    return await run_in_threadpool(_run_service,ctx)


def _run_reward(ctx):
    if getattr(ctx.principal,'kind',None)!='service':
        return {'accepted':False,'reason':'service_identity_required'}
    with ctx.transaction() as db:
        return execute_reward(db,getattr(ctx.principal,'subject',None),ctx.body)


async def handle_reward(ctx):
    return await run_in_threadpool(_run_reward,ctx)
