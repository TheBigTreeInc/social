# Tavi 0.3.68 — Help diagnostics handoff

Base: 0.3.67. Client-only change. No LoopRD API/schema modification.

Help → Copy diagnostics… opens a locally generated JSON report with version, platform, viewport, navigation, connection stage, safe counts, installed extension metadata, and notification state. The user reviews and copies it manually; nothing is uploaded. The report deliberately omits messages, passwords, bearer tokens, usernames, server addresses and local-storage contents.

New workboard candidate: TAVI-DEBUG-068 (Review). Keep previous ticket statuses unchanged. Validate Help menu on Windows, Android and web, including offline and signed-out behavior; verify clipboard fallback and inspect output for private data.

Import source ZIP via ZipRunner; do not treat source tests as physical device acceptance.
