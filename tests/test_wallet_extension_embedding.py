"""Contract regression: source belongs to Wallet extension, deployment stays inside Social."""
from pathlib import Path
import json
import unittest
import yaml

ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/'extensions/org.tavi.core.wallet/looprd'

class EmbeddedWalletTest(unittest.TestCase):
    def test_single_canonical_backend_source_and_private_delivery(self):
        source=(EXT/'wallet_ledger.py').read_text(encoding='utf8')
        self.assertTrue(source.startswith('"""First-party virtual wallet'))
        adapter=(ROOT/'server/wallet_ledger.py').read_text(encoding='utf8')
        self.assertIn('extensions/org.tavi.core.wallet/looprd/wallet_ledger.py',adapter)
        self.assertNotIn('CREATE TABLE',adapter)
        self.assertNotIn('def execute_wallet(',adapter)
        self.assertFalse((ROOT/'client/public/tavi-extensions/org.tavi.core.wallet/looprd').exists())
        catalog=json.loads((ROOT/'extensions/registry.json').read_text())
        wallet=next(x for x in catalog['extensions'] if x['id']=='org.tavi.core.wallet')
        self.assertEqual(wallet['backend'],{'kind':'looprd-component','component':'looprd-social'})
        spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        routes={x['path']:x for x in spec['handlers']}
        self.assertEqual(spec['component'],'looprd-social')
        self.assertEqual(spec['auth']['realm'],'tavi-social')
        self.assertEqual(spec['database']['schemaVersion'],12)
        self.assertEqual(routes['/wallet']['source'],source)
        self.assertEqual(routes['/ecosystem/wallet-merchant']['source'],source+'\n\nasync def handle(ctx):\n    return await handle_merchant(ctx)\n')
        self.assertEqual(routes['/ecosystem/wallet-reward']['source'],source+'\n\nasync def handle(ctx):\n    return await handle_reward(ctx)\n')
        self.assertEqual(routes['/wallet']['scopes'],['social:api'])
        self.assertEqual(routes['/ecosystem/wallet-merchant']['scopes'],['social:service'])
        self.assertEqual(routes['/ecosystem/wallet-reward']['scopes'],['social:service'])
    def test_schema_11_is_additive_wallet_tables_not_duplicate_component(self):
        spec=yaml.safe_load((ROOT/'looprd.yaml').read_text())
        migrations=spec['database']['migrations']
        expected={'WalletBalance','WalletTransaction','WalletEntry','WalletOrder','WalletRestrictedBalance','WalletRewardIssue'}
        statements='\n'.join(next(x for x in migrations if x['version']==11)['statements'])
        for name in expected:self.assertIn(f'CREATE TABLE "{name}"',statements)
        for unsafe in ('DROP TABLE','DELETE FROM','ALTER TABLE "SocialAccount"'):
            self.assertNotIn(unsafe,statements)
        self.assertEqual([x['component'] for x in [spec]],['looprd-social'])
        backend=json.loads((EXT/'backend.json').read_text())
        self.assertEqual(backend['deployment'],'embed-in-existing-component')
        self.assertEqual(backend['migration'],'none-no-secondary-database')

if __name__=='__main__':unittest.main()
