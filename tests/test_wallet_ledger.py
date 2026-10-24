"""Wallet pilot integration with exactly the generated LoopRD database model."""
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
import sqlalchemy as sa
import yaml
from sqlalchemy.orm import sessionmaker
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'extensions/org.tavi.core.wallet/looprd'))
from wallet_ledger import execute_wallet,execute_merchant,execute_reward,snapshot,amount,wallet_amount,restricted_amount,shopping_amount

OFFERS=[
 {'sku':'test.game.entry','title':'Play test game','merchant':'test-game','type':'entry','currencyId':'gold','price':'80'},
 {'sku':'test.game.free','title':'Free entry','merchant':'test-game','type':'entry','currencyId':'gold','price':'0'},
 {'sku':'test.game.item','title':'A small sword','merchant':'test-game','type':'item','currencyId':'gold','price':'25'},
]
CURRENCIES=[{'id':'test:points','name':'Test Points','symbol':'P','decimals':0,'scope':'game'}]
RATES=[{'from':'gold','to':'test:points','numerator':'1','denominator':'10'},
       {'from':'test:points','to':'gold','numerator':'10','denominator':'1'}]

class LedgerTest(unittest.TestCase):
 def setUp(self):
  self.settings=patch.dict(os.environ,{
   'LOOPRD_TAVI_WALLET_OFFERS_JSON':json.dumps(OFFERS),
   'LOOPRD_TAVI_WALLET_CURRENCIES_JSON':json.dumps(CURRENCIES),
   'LOOPRD_TAVI_WALLET_RATES_JSON':json.dumps(RATES),
   'LOOPRD_TAVI_WALLET_MERCHANTS_JSON':json.dumps({'test-game':[x['sku'] for x in OFFERS]}),
   'LOOPRD_TAVI_WALLET_REWARDS_JSON':json.dumps({'test-game':{'currencyId':'gold','maxPerEvent':'120','dailyPerPlayer':'500'}})})
  self.settings.start()
  spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
  self.assertEqual(spec['database']['schemaVersion'],12)
  self.engine=sa.create_engine('sqlite+pysqlite:///:memory:')
  meta=sa.MetaData()
  for name,model in spec['models'].items():
   cols=[]
   for key,field in model['fields'].items():
    kind={'integer':sa.BigInteger,'string':sa.String(field.get('maxLength',128)),
      'json':sa.JSON,'boolean':sa.Boolean}[field['type']]
    cols.append(sa.Column(key,kind,primary_key=field.get('primaryKey',False),
      autoincrement=field.get('generated',False),nullable=not field.get('required',False),
      unique=field.get('unique',False)))
   # SQLite autoincrement needs Integer exact type rather than BigInteger.
   for col in cols:
    if col.primary_key:col.type=sa.Integer()
   table=sa.Table(name,meta,*cols)
   for ix in model.get('indexes',[]):
    sa.Index(ix['name'],*(table.c[key] for key in ix['fields']),unique=ix.get('unique',False))
  meta.create_all(self.engine)
  self.sessions=sessionmaker(self.engine)
 def tearDown(self):self.engine.dispose();self.settings.stop()
 def call(self,subject='acct_1',**params):
  if params.get('op')=='purchase' and 'expectedPrice' not in params:
   offer=next((x for x in OFFERS if x['sku']==params.get('sku')),None)
   if offer:params.update(expectedPrice=offer['price'],expectedCurrency=offer['currencyId'],expectedMerchant=offer['merchant'])
  if params.get('op')=='convert' and 'expectedNumerator' not in params:
   rate=next((x for x in RATES if x['from']==params.get('from') and x['to']==params.get('to')),None)
   if rate:params.update(expectedNumerator=rate['numerator'],expectedDenominator=rate['denominator'])
  with self.sessions.begin() as db:return execute_wallet(db,subject,params,now=123456)
 def reward(self,recipient='acct_1',actor='test-game',eventId='earned-reward-001',amount='100',currencyId='gold',now=123456):
  with self.sessions.begin() as db:return execute_reward(db,actor,{'schema':'tavi.wallet-reward/v1',
   'op':'reward','recipient':recipient,'eventId':eventId,'currencyId':currencyId,'amount':amount},now)
 def merchant(self,kind='fulfill',actor='test-game',**params):
  with self.sessions.begin() as db:return execute_merchant(db,actor,kind,{'schema':'tavi.wallet-fulfillment/v1',**params},now=123457)
 def test_clean_wallet_schema_and_service_routes_separated(self):
  spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
  engine=sa.create_engine('sqlite+pysqlite:///:memory:')
  try:
   with engine.begin() as db:
    for migration in spec['database']['migrations']:
     if migration['version']>10:break
     for sql in migration['statements']:db.exec_driver_sql(sql)
    db.exec_driver_sql('''INSERT INTO "SocialContact" (leftId,rightId,requestedBy,status,created)
       VALUES ('acct_1','acct_2','acct_1','accepted',100)''')
    for migration in spec['database']['migrations']:
     if migration['version']==11:
      for sql in migration['statements']:db.exec_driver_sql(sql)
    self.assertEqual(db.exec_driver_sql('SELECT status FROM "SocialContact"').scalar_one(),'accepted')
    self.assertEqual(db.exec_driver_sql('SELECT count(*) FROM "WalletTransaction"').scalar_one(),0)
   routes={h['path']:h for h in spec['handlers']}
   self.assertEqual(routes['/wallet']['scopes'],['social:api'])
   self.assertEqual(routes['/ecosystem/wallet-merchant']['scopes'],['social:service'])
   self.assertEqual(routes['/ecosystem/wallet-reward']['scopes'],['social:service'])
   self.assertIn('return await handle_reward(ctx)',routes['/ecosystem/wallet-reward']['source'])
   self.assertIn('return await handle_merchant(ctx)',routes['/ecosystem/wallet-merchant']['source'])
  finally:engine.dispose()
 def test_welcome_grant_once_no_client_mint(self):
  first=self.call(op='balance')
  self.assertTrue(first['ok']);self.assertEqual(first['balances'][0],{'currencyId':'gold','amount':'100','playOnly':'100','availableForShopping':'0'})
  self.assertEqual(self.call(op='balance')['balances'][0]['amount'],'100')
  self.assertFalse(self.call(op='mint',amount='999999')['ok'])
  self.assertEqual(self.call(subject='acct_2',op='balance')['balances'][0]['amount'],'100')
  with self.sessions.begin() as db:
   self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "WalletTransaction" WHERE kind="welcome"')).scalar_one(),2)
 def test_shop_cannot_spend_free_gold_even_after_refill(self):
  balance=self.call(op='balance')['balances'][0]
  self.assertEqual(balance['amount'],'100')
  self.assertEqual(balance['playOnly'],'100')
  self.assertEqual(balance['availableForShopping'],'0')
  self.assertEqual(self.call(op='purchase',sku='test.game.item',requestId='shop-not-earned1')['code'],'shop_requires_earned_currency')
  game=self.call(op='purchase',sku='test.game.entry',requestId='entry-only-0001')
  self.assertTrue(game['ok']);self.assertEqual(game['restrictedSpent'],'80')
  ref=self.call(op='claim',requestId='refill-entry-001')
  self.assertTrue(ref['ok']);self.assertEqual(ref['amount'],'80')
  self.assertEqual(self.call(op='balance')['balances'][0]['availableForShopping'],'0')
  self.assertEqual(self.call(op='purchase',sku='test.game.item',requestId='shop-not-earned2')['code'],'shop_requires_earned_currency')
 def test_reward_and_shop_purchase_replay_only_spend_earned(self):
  earned=self.reward()
  self.assertTrue(earned['accepted']);self.assertEqual(earned['delivery'],'created')
  self.assertEqual(self.reward()['delivery'],'duplicate')
  self.assertEqual(self.reward(amount='80')['reason'],'reward_event_conflict')
  balances=self.call(op='balance')['balances'][0]
  self.assertEqual((balances['amount'],balances['playOnly'],balances['availableForShopping']),('200','100','100'))
  a=self.call(op='purchase',sku='test.game.item',requestId='order-shop-0001')
  self.assertTrue(a['ok']);self.assertEqual(a['restrictedSpent'],'0')
  self.assertEqual(self.call(op='purchase',sku='test.game.item',requestId='order-shop-0001'),a)
  self.assertFalse(self.call(op='purchase',sku='test.game.entry',requestId='order-shop-0001')['ok'])
  self.assertEqual(self.call(op='balance')['balances'][0]['availableForShopping'],'75')
  self.assertEqual(self.call(subject='acct_2',op='balance')['balances'][0]['availableForShopping'],'0')
  self.assertFalse(self.call(subject='acct_2',op='order_status',orderId=a['orderId'])['ok'])
 def test_refill_tracks_only_play_gold_and_does_not_mint_shopping_gold(self):
  self.reward(amount='120')
  first=self.call(op='balance')['balances'][0]
  self.assertEqual(first['availableForShopping'],'120')
  self.assertFalse(self.call(op='claim',requestId='refill-not-needed1')['ok'])
  self.call(op='purchase',sku='test.game.entry',requestId='spend-play-001')
  ref=self.call(op='claim',requestId='refill-play-001')
  self.assertTrue(ref['ok']);self.assertEqual(ref['amount'],'80')
  self.assertEqual(self.call(op='claim',requestId='refill-play-001'),ref)
  after=self.call(op='balance')['balances'][0]
  self.assertEqual(after['playOnly'],'100')
  self.assertEqual(after['availableForShopping'],'120')
  self.assertFalse(self.call(op='claim',requestId='refill-not-needed2')['ok'])
 def test_free_game_and_expensive_game(self):
  free=self.call(op='purchase',sku='test.game.free',requestId='free-0000001')
  self.assertTrue(free['ok']);self.assertEqual(free['amount'],'0')
  self.assertEqual(self.call(op='balance')['balances'][0]['amount'],'100')
  self.call(op='purchase',sku='test.game.entry',requestId='paid-0000001')
  self.assertFalse(self.call(op='purchase',sku='test.game.entry',requestId='paid-0000002')['ok'])
  self.assertEqual(self.call(op='balance')['balances'][0]['amount'],'20')
 def test_conversion_is_rational_exact_and_only_from_earned(self):
  self.assertEqual(self.call(op='convert',requestId='convert-blocked',amount='30',**{'from':'gold','to':'test:points'})['code'],'conversion_requires_earned_currency')
  self.reward()
  convert=self.call(op='convert',requestId='convert-00001',amount='30',**{'from':'gold','to':'test:points'})
  self.assertTrue(convert['ok']);self.assertEqual(convert['credited'],'3')
  self.assertEqual(self.call(op='balance')['balances'][0]['availableForShopping'],'70')
  reverse=self.call(op='convert',requestId='convert-00002',amount='3',**{'from':'test:points','to':'gold'})
  self.assertTrue(reverse['ok']);self.assertEqual(self.call(op='balance')['balances'][0]['availableForShopping'],'100')
  self.assertFalse(self.call(op='convert',requestId='convert-00003',amount='1',**{'from':'gold','to':'test:points'})['ok'])
  self.assertFalse(self.call(op='convert',requestId='convert-00004',amount='10',**{'from':'test:unknown','to':'gold'})['ok'])
 def test_balanced_journal_all_events(self):
  self.reward()
  self.call(op='purchase',sku='test.game.item',requestId='item-000001')
  self.call(op='purchase',sku='test.game.entry',requestId='entry-000001')
  self.call(op='claim',requestId='refill-000001')
  self.call(op='convert',requestId='change-00001',amount='10',**{'from':'gold','to':'test:points'})
  with self.sessions.begin() as db:
   rows=db.execute(sa.text('SELECT transactionId,currencyId,sum(delta) amount FROM "WalletEntry" GROUP BY transactionId,currencyId')).all()
   self.assertTrue(rows);self.assertTrue(all(r.amount==0 for r in rows))
 def test_only_approved_merchant_can_fulfill_or_refund(self):
  self.reward(amount='100')
  item=self.call(op='purchase',sku='test.game.item',requestId='purchase0001')
  order=item['orderId']
  self.assertFalse(self.merchant(actor='other-game',sku='test.game.item',orderId=order)['accepted'])
  self.assertFalse(self.merchant(sku='other.item',orderId=order)['accepted'])
  ok=self.merchant(sku='test.game.item',orderId=order)
  self.assertTrue(ok['accepted'])
  self.assertEqual(self.merchant(sku='test.game.item',orderId=order)['delivery'],'duplicate')
  self.assertFalse(self.merchant(kind='refund',sku='test.game.item',orderId=order)['accepted'])
  item2=self.call(op='purchase',sku='test.game.item',requestId='purchase0002')
  ok2=self.merchant(kind='refund',sku='test.game.item',orderId=item2['orderId'])
  self.assertTrue(ok2['accepted'])
  self.assertEqual(self.merchant(kind='refund',sku='test.game.item',orderId=item2['orderId'])['delivery'],'duplicate')
  self.assertEqual(self.call(op='balance')['balances'][0]['availableForShopping'],'75')
 def test_game_refund_preserves_play_only_provenance(self):
  game=self.call(op='purchase',sku='test.game.entry',requestId='entry-refund-0001')
  self.assertEqual(game['restrictedSpent'],'80')
  refunded=self.merchant(kind='refund',sku='test.game.entry',orderId=game['orderId'])
  self.assertTrue(refunded['accepted'])
  self.assertEqual(self.merchant(kind='refund',sku='test.game.entry',orderId=game['orderId'])['delivery'],'duplicate')
  balance=self.call(op='balance')['balances'][0]
  self.assertEqual(balance['playOnly'],'100');self.assertEqual(balance['availableForShopping'],'0')
  self.assertEqual(self.call(op='purchase',sku='test.game.item',requestId='refund-launder-01')['code'],'shop_requires_earned_currency')
 def test_mixed_game_entry_and_refund_returns_original_sources(self):
  self.call(op='purchase',sku='test.game.entry',requestId='entry-first-0001')
  self.reward()
  again=self.call(op='purchase',sku='test.game.entry',requestId='entry-second-001')
  self.assertEqual(again['restrictedSpent'],'20')
  mid=self.call(op='balance')['balances'][0]
  self.assertEqual(mid['playOnly'],'0');self.assertEqual(mid['availableForShopping'],'40')
  self.assertTrue(self.merchant(kind='refund',sku='test.game.entry',orderId=again['orderId'])['accepted'])
  after=self.call(op='balance')['balances'][0]
  self.assertEqual(after['playOnly'],'20');self.assertEqual(after['availableForShopping'],'100')
 def test_rewards_default_denied_limits_and_daily_cap(self):
  with patch.dict(os.environ,{'LOOPRD_TAVI_WALLET_REWARDS_JSON':'{}'}):
   self.assertEqual(self.reward()['reason'],'reward_not_authorized')
  self.assertEqual(self.reward(actor='unapproved')['reason'],'reward_not_authorized')
  self.assertEqual(self.reward(amount='121')['reason'],'reward_limit_exceeded')
  self.assertEqual(self.reward(currencyId='test:points')['reason'],'invalid_recipient_or_currency')
  for i in range(4):self.assertTrue(self.reward(eventId=f'earned-limit-{i:06}',amount='120')['accepted'])
  self.assertEqual(self.reward(eventId='earned-limit-005',amount='30')['reason'],'daily_reward_limit_exceeded')
  self.assertEqual(self.call(op='balance')['balances'][0]['availableForShopping'],'480')
 def test_fresh_wallet_schema_has_protected_gold_and_no_legacy_backfill(self):
  spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
  self.assertEqual(spec['database']['schemaVersion'],12)
  self.assertEqual([m['version'] for m in spec['database']['migrations']],list(range(2,13)))
  last=next(m for m in spec['database']['migrations'] if m['version']==11)['statements']
  self.assertTrue(any('CREATE TABLE "WalletRestrictedBalance"' in v for v in last))
  self.assertTrue(any('CREATE TABLE "WalletRewardIssue"' in v for v in last))
  self.assertFalse(any('INSERT INTO "WalletRestrictedBalance"' in v for v in last),
   'Fresh prelaunch schema must not treat old balances as migrated data')
  with self.sessions.begin() as db:
   self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "WalletRestrictedBalance"')).scalar_one(),0)
   self.assertEqual(db.execute(sa.text('SELECT count(*) FROM "WalletRewardIssue"')).scalar_one(),0)
  initial=self.call(op='balance')['balances'][0]
  self.assertEqual(initial,{'currencyId':'gold','amount':'100','playOnly':'100','availableForShopping':'0'})
  self.assertEqual(self.call(op='purchase',sku='test.game.item',requestId='fresh-shop-0001')['code'],'shop_requires_earned_currency')
 def test_validation_and_privacy(self):
  for bad in [0,10,-2,1.0,'1.2','01','-1','1e3','10000000000000']:
   with self.assertRaises(ValueError):amount(bad)
  self.assertFalse(self.call(subject='guest',op='balance')['ok'])
  self.assertFalse(self.call(op='purchase',sku='unknown',requestId='request00001')['ok'])
  self.assertNotIn('token',json.dumps(self.call(op='balance')))

if __name__=='__main__':unittest.main()
