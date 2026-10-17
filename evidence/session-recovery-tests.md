# v0.3.35 session recovery acceptance evidence

Automated source tests: `node --test client/tests/session-recovery.test.mjs client/tests/secure-session-contract.test.mjs`. The policy test classifies 401, 403, and transient failures. Scheduler tests check bounded delay, coalescing, disabling on account switch and guards after rejection.

Manual checks outstanding: Windows native NSIS build, DPAPI save/restore on the same Windows user, offline startup automatic retry, HTTP 401/403 on deployed LoopRD, and separate chat/game windows. Automated JavaScript tests are not substitutes for these checks.
