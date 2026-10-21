# Tavi 0.3.75 — UI foundation and optional native WebView2 QA

This source-only pass follows the 0.3.74 video audit. It introduces semantic forest-green light/dark design tokens, shared host navigation rendering, repairs outdated synthetic browser QA selectors and adds an opt-in native Windows WebView2 CDP QA attachment path. No new client/server capabilities or LoopRD schema changes.

**Authoritative latest operator board:** 116 tickets (60 review, 38 planned, 16 deferred, 2 suggested, 0 done). All existing IDs, original statuses/priorities/criteria retained in `.ziprunner-workboard-update.json`. Two new Review tickets describe source-candidate code; NOT accepted or Done.

**Native test:** See `docs/TAVI_UNIFIED_UI_FOUNDATION_AND_NATIVE_QA_0375.adoc`. Do not silently attach to the user's signed-in client. `npm --prefix client run ui:native` requires an explicit disposable QA session and WebView2 CDP port; blocked is not passed. Existing browser UI fixtures are useful but separate.

**Operator:** Verify exact 0.3.75 ZIP SHA and new push SHA/CI evidence. Do not push, tag, release or deploy automatically. `TAVI-QA-047` and real Windows/Android acceptance remain open. Avoid reviving duplicate Home games/search/toolbar despite historical criteria conflicts.
