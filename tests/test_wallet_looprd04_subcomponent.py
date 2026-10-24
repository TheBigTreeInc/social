"""LoopRD 0.4 Wallet subcomponent/service-boundary regressions."""
from pathlib import Path
from types import SimpleNamespace
import asyncio
import importlib.util
import json
import unittest
import yaml

ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/'extensions/org.tavi.core.wallet/looprd'

# LoopRD 0.4 docs/shapes.py intentionally supports a bounded structural subset.
SHAPE_KEYS={'type','properties','required','additionalProperties','items','maxItems','minItems',
            'maxLength','minLength','minimum','maximum','enum','title','description'}


def _walk_shape(shape):
    if not isinstance(shape,dict):
        return
    unknown=set(shape)-SHAPE_KEYS
    if unknown:
        raise AssertionError(f'unsupported LoopRD 0.4 service-contract keys: {sorted(unknown)}')
    for child in shape.get('properties',{}).values():
        _walk_shape(child)
    if 'items' in shape:
        _walk_shape(shape['items'])


def _load_facade():
    spec=importlib.util.spec_from_file_location('tavi_wallet_service_facade',EXT/'service_facade.py')
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class WalletLoopRD04Test(unittest.TestCase):
    def setUp(self):
        self.parent=yaml.safe_load((ROOT/'looprd.yaml').read_text(encoding='utf8'))
        self.child=yaml.safe_load((EXT/'looprd.yaml').read_text(encoding='utf8'))

    def test_parent_declares_one_independent_wallet_subcomponent(self):
        self.assertIn('spec.subcomponents',self.parent['requires'])
        self.assertEqual(self.parent['subcomponents'],[
            {'source':'extensions/org.tavi.core.wallet/looprd/looprd.yaml'}])
        self.assertEqual(self.parent['component'],'looprd-social')
        self.assertEqual(self.parent['database']['schemaVersion'],12)
        self.assertEqual(self.child['apiVersion'],'looprd/v1')
        self.assertEqual(self.child['component'],'tavi-wallet')
        self.assertEqual(self.child['auth'],{
            'mode':'database','scopes':['wallet:merchant','wallet:reward']})
        self.assertEqual(self.child['database'],{'backend':'sqlite'})
        self.assertNotIn('models',self.child,
            '0.3.107 must not silently copy/migrate the authoritative ledger into child storage')

    def test_service_contracts_use_caller_bound_child_and_social_only_broker(self):
        parent_handlers={h['path']:h for h in self.parent['handlers']}
        broker=parent_handlers['/ecosystem/wallet-ledger-broker']
        self.assertEqual(broker['contract']['name'],'tavi-wallet-ledger-broker')
        self.assertTrue(broker['contract']['serviceOnly'])
        self.assertEqual(broker['contract']['allowedCallers'],['tavi-wallet'])
        self.assertEqual(broker['scopes'],['social:service'])
        # Existing user and service routes remain during the transition so the
        # released Tavi client and current games are not broken by the 0.4 host upgrade.
        for path in ('/wallet','/ecosystem/wallet-merchant','/ecosystem/wallet-reward'):
            self.assertIn(path,parent_handlers)

        self.assertEqual(self.child['dependencies'],[{
            'component':'looprd-social','contract':'tavi-wallet-ledger-broker','version':1,
            'credentialSecret':'tavi-wallet-social-service-key','optional':True}])
        child_handlers={h['path']:h for h in self.child['handlers']}
        self.assertEqual(child_handlers['/merchant']['contract']['name'],'tavi-wallet-merchant')
        self.assertEqual(child_handlers['/reward']['contract']['name'],'tavi-wallet-reward')
        self.assertTrue(child_handlers['/merchant']['contract']['serviceOnly'])
        self.assertTrue(child_handlers['/reward']['contract']['serviceOnly'])
        self.assertEqual(child_handlers['/merchant']['scopes'],['wallet:merchant'])
        self.assertEqual(child_handlers['/reward']['scopes'],['wallet:reward'])

    def test_contract_shapes_match_looprd04_structural_subset(self):
        for spec in (self.parent,self.child):
            for handler in spec.get('handlers',[]):
                contract=handler.get('contract')
                if not contract:
                    continue
                _walk_shape(contract.get('request',{}))
                _walk_shape(contract.get('response',{}))

    def test_backend_metadata_keeps_ui_storage_authority_explicit(self):
        backend=json.loads((EXT/'backend.json').read_text(encoding='utf8'))
        self.assertEqual(backend['schema'],'tavi.looprd-wallet-backend/v2')
        self.assertEqual(backend['deployment'],'looprd-0.4-subcomponent-service-facade')
        self.assertEqual(backend['uiBroker']['component'],'looprd-social')
        self.assertEqual(backend['serviceComponent']['component'],'tavi-wallet')
        self.assertEqual(backend['ledger'],{
            'component':'looprd-social','databaseSchemaVersion':12,
            'storageOwnership':'looprd-social','migration':'planned-explicit-storage-split'})
        registry=json.loads((ROOT/'extensions/registry.json').read_text(encoding='utf8'))
        wallet=next(x for x in registry['extensions'] if x['id']=='org.tavi.core.wallet')
        self.assertEqual(wallet['backend'],{'kind':'looprd-component','component':'looprd-social'},
            'Tavi UI must keep using its verified Social-session broker until identity/storage migration')

    def test_facade_forwards_verified_component_identity_without_credentials(self):
        facade=_load_facade()
        calls=[]
        class Ctx:
            principal=SimpleNamespace(kind='service',subject='test-game')
            body={'schema':'tavi.wallet-reward/v1','op':'reward','eventId':'evt-00001',
                  'recipient':'acct_1','currencyId':'gold','amount':'10'}
            async def call(self,component,contract,payload):
                calls.append((component,contract,payload))
                return {'accepted':True,'delivery':'created','transactionId':7}
        result=asyncio.run(facade.handle_reward(Ctx()))
        self.assertEqual(result['transactionId'],7)
        self.assertEqual(calls[0][0:2],('looprd-social','tavi-wallet-ledger-broker'))
        forwarded=calls[0][2]
        self.assertEqual(forwarded['actor'],'test-game')
        self.assertEqual(forwarded['channel'],'reward')
        self.assertEqual(forwarded['command'],Ctx.body)
        self.assertNotIn('token',json.dumps(forwarded).lower())
        self.assertNotIn('credential',json.dumps(forwarded).lower())

        denied=SimpleNamespace(principal=SimpleNamespace(kind='api-key',subject=None),body=Ctx.body)
        self.assertEqual(asyncio.run(facade.handle_reward(denied)),
                         {'accepted':False,'reason':'service_identity_required'})


if __name__=='__main__':
    unittest.main()
