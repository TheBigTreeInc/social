# Tavi 0.3.71 extension UX

Review candidate only. Adds host-controlled install approval, responsive full-height isolated extension stage, and preserves Home / App Store. No new LoopRD migration, endpoint, auth grant, or auto installation. Atrium upstream must also hide its own Return button when receiving a real host.info response; standalone remains unchanged.

Test: `npm run verify`, `node --test client/tests/extension-ux-071.test.mjs`, `python -m unittest discover -s tests -p test_*.py`, `python tools/generate-looprd.py --check`. Verify Windows NSIS, Android and Web UI with narrow and resized panel.
