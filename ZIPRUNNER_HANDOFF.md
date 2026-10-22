# Tavi 0.3.90 — ZipRunner workboard preflight repair

The 0.3.89 source package failed mandatory workboard validation before installation. Both new Review tickets lacked required `operator_checks`; 0.3.90 supplies these lists without changing their acceptance criteria, prior workboard decisions, Ledger source or Companion bytes.

See `ZIPRUNNER_HANDOFF_WORKBOARD_PREFLIGHT_0390.md` for operator checks and `ZIPRUNNER_HANDOFF_WALLET_EMBED_CI_0389.md` for the unchanged functional implementation. The LoopRD server release remains 0.3.83/schema 11, and the failed v0.3.89 never installed. Do not auto-push, deploy, release or mark Review tickets Done.
