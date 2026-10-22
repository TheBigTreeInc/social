"""Legacy import adapter for ZipRunner overlays; source of truth is Wallet extension.

Do not implement Wallet operations here: the LoopRD generator embeds only
extensions/org.tavi.core.wallet/looprd/wallet_ledger.py. The adapter prevents an
older server/wallet_ledger.py from lingering under ZipRunner's delete_missing=false
policy and diverging from the canonical Wallet implementation. This file can be
retired after explicit operator-approved overlay cleanup.
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

canonical = Path(__file__).resolve().parents[1] / 'extensions/org.tavi.core.wallet/looprd/wallet_ledger.py'
spec = spec_from_file_location('_tavi_wallet_extension_backend', canonical)
if spec is None or spec.loader is None:
    raise ImportError('Wallet extension backend source is missing')
module = module_from_spec(spec)
spec.loader.exec_module(module)
for name, value in vars(module).items():
    if not name.startswith('_'):
        globals()[name] = value
