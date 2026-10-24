"""Wallet ownership regression across Tavi UI, Social storage and LoopRD 0.4 child service."""
from pathlib import Path
import json
import unittest
import yaml

ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/'extensions/org.tavi.core.wallet/looprd'


class WalletEmbeddingTest(unittest.TestCase):
    def test_canonical_ledger_stays_private_and_tavi_ui_keeps_social_broker(self):
        source=(EXT/'wallet_ledger.py').read_text(encoding='utf8')
        self.assertTrue(source.startswith('"""First-party virtual wallet'))
        adapter=(ROOT/'server/wallet_ledger.py').read_text(encoding='utf8')
        self.assertIn('extensions/org.tavi.core.wallet/looprd/wallet_ledger.py',adapter)
        self.assertNotIn('CREATE TABLE',adapter)
        self.assertNotIn('def execute_wallet(',adapter)
        self.assertFalse((ROOT/'client/public/tavi-extensions/org.tavi.core.wallet/looprd').exists())
        catalog=json.loads((ROOT/'extensions/registry.json').read_text())
        wallet=next(x for x in catalog['extensions'] if x['id']=='org.tavi.core.wallet')
        # Current Tavi user sessions are Social-realm credentials. They continue
        # through /wallet until the explicit identity/storage migration pass.
        self.assertEqual(wallet['backend'],{'kind':'looprd-component','component':'looprd-social'})

        parent=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        routes={x['path']:x for x in parent['handlers']}
        self.assertEqual(parent['component'],'looprd-social')
        self.assertEqual(parent['auth']['realm'],'tavi-social')
        self.assertEqual(parent['database']['schemaVersion'],12)
        self.assertEqual(routes['/wallet']['source'],source)
        self.assertEqual(routes['/ecosystem/wallet-merchant']['source'],source+'\n\nasync def handle(ctx):\n    return await handle_merchant(ctx)\n')
        self.assertEqual(routes['/ecosystem/wallet-reward']['source'],source+'\n\nasync def handle(ctx):\n    return await handle_reward(ctx)\n')
        self.assertEqual(routes['/wallet']['scopes'],['social:api'])
        self.assertEqual(routes['/ecosystem/wallet-merchant']['scopes'],['social:service'])
        self.assertEqual(routes['/ecosystem/wallet-reward']['scopes'],['social:service'])

    def test_schema_11_remains_authoritative_while_looprd04_child_is_service_facade(self):
        parent=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        migrations=parent['database']['migrations']
        expected={'WalletBalance','WalletTransaction','WalletEntry','WalletOrder','WalletRestrictedBalance','WalletRewardIssue'}
        statements='\n'.join(next(x for x in migrations if x['version']==11)['statements'])
        for name in expected:self.assertIn(f'CREATE TABLE "{name}"',statements)
        for unsafe in ('DROP TABLE','DELETE FROM','ALTER TABLE "SocialAccount"'):
            self.assertNotIn(unsafe,statements)

        child=yaml.safe_load((EXT/'looprd.yaml').read_text())
        self.assertEqual(child['component'],'tavi-wallet')
        self.assertEqual(child['database'],{'backend':'sqlite'})
        self.assertNotIn('models',child)
        backend=json.loads((EXT/'backend.json').read_text())
        self.assertEqual(backend['deployment'],'looprd-0.4-subcomponent-service-facade')
        self.assertEqual(backend['ledger']['storageOwnership'],'looprd-social')
        self.assertEqual(backend['ledger']['migration'],'planned-explicit-storage-split')


if __name__=='__main__':unittest.main()
