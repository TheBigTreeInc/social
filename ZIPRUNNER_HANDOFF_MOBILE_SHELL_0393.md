# Tavi 0.3.93 — Mobile navigation and Companion world focus

- **Scope**: client-host shell only. LoopRD Social release 0.3.83 / DB schema 11 unchanged.
- **Navigation**: one icon-based host toolbar and four bottom tabs (Home, Chats, Games, Apps) for focused compact app surfaces; old File/Contacts/Tools bar hidden in compact views, still accessible via Apps/Settings. Home remains messenger-first. Chat composer retains dedicated space.
- **App launcher**: Talk, Explore and Your apps are horizontally swipeable with native scroll snap, explicit category buttons and accessible labels. Overscroll gives bounded spring feedback on host-owned vertical scroll areas, respecting reduced motion and not entering iframes.
- **Companion**: Existing reviewed publisher assets untouched. Tavi opens `ui/index.html#viewport` within its already restricted iframe, so the existing painted world appears ahead of its long hero/settings page. The publisher still needs a future separately approved mobile redesign to remove prototype controls and stale development copy.
- **Security**: No CSP relaxation, host token exposure, publisher identity/digest changes, new permissions, state migration, Git push or deployment.
- **Operator tests**: import in ZipRunner, run npm run verify / Python tests / descriptor --check; on 320/355/390 tablet, real Android and Windows, test swipe, elastic, keyboard, Tauri system Back, dialogs and Companion world focus. Confirm GitHub exact push SHA and workflow runs separately. Native acceptance remains open.
