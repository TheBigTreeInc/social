# Generic game activity contract — optional adapter v1

LoopRD does not know games, turns or invitations. Each game component **may** implement this application-level API, on the SAME LoopRD server as Social:

`GET /looprd/<game-component>/v1/activity`

Use game-specific authentication where required (`Authorization: Bearer <game credential>`). The Social credential MUST NOT be forwarded to arbitrary games. A future trusted shared-principal solution may let game components validate application-owned credentials without reusing the legacy developer token.

Example response:

```json
{
  "schema": "looprd.game.activity/v1",
  "turns": [
    {"id": "match-42-turn-9", "title": "Jones: your move", "status": "your-turn", "match": "Game #42", "path": "/looprd/the-life-loop/v1/games/42"},
    {"id": "match-51-turn-2", "title": "Waiting for another player", "status": "waiting", "match": "Game #51"}
  ]
}
```

Rules:
- `id` is a stable activity identity that CHANGES each time it becomes a new actionable turn (not only a match ID). This prevents duplicate notifications and permits the next turn to alert again.
- `status`: `your-turn`, `waiting`, or `complete`.
- `path` is optional and must be on the exact same game component on the same LoopRD origin, never an external URL.
- The game backend determines the authenticated player and ownership; callers cannot specify a player ID to see another player's turns.
- The app checks every 25 seconds while running and on window focus, retaining seen active turn IDs per server/component/account in local storage.
- This is an **application convention**, not a built-in LoopRD route and not yet implemented by The Life Loop in the inspected sources.
- Notifications while Android kills the app require game-specific server push and device registration; this first pass cannot guarantee delivery after termination.
- Server-provided invitations and friends/groups are intentionally not faked: their future Social/game contracts need implementation and testing.
