# OpenClaw ↔ Tavi headless bridge (v0.3.39)

This is a **working CLI integration**, not yet a native OpenClaw channel plugin. It uses Tavi's real Social API and works from OpenClaw's shell/exec tool. It does not need the Windows Tavi client, admin privileges, or new LoopRD schema. Requires Node.js 20+ and network access to your admitted `looprd-social` component.

## Provision a separate Tavi user

1. In Tavi, create a separate account (e.g. `openclaw`) using the ordinary registration flow, or run the `register` command below if registration is enabled.
2. On the OpenClaw host, put the integration directory somewhere persistent. It requires the matching `client/sdk/looprd-social.js` from the same Tavi source tree; **keep the repository layout intact** or copy the full project.
3. Set `TAVI_SERVER=https://api.thebigtree.life` (change if your server differs). Set `TAVI_AGENT_STATE_DIR` to a private writable folder outside Git and backup packages.
4. Provide `TAVI_PASSWORD` via your OpenClaw secret/environment mechanism, not in prompts, tool arguments, command history, config checked into Git or chat. Run `node integrations/openclaw/tavi-agent.mjs login openclaw` (or `register openclaw` once). Unset `TAVI_PASSWORD` afterwards.
5. Run `node integrations/openclaw/tavi-agent.mjs me`, then `contacts` and `updates`. Use `request HANDLE`, `accept ACCOUNT_ID`, `dm ACCOUNT_ID TEXT` and `lobby TEXT` for actions.
6. Allow the OpenClaw agent's exec tool to call this program, with an appropriate tool policy. Copy `OPENCLAW_SKILL.md` to its agent instructions or skill directory.

On POSIX, the bridge stores a **revocable Tavi session token** at `~/.config/tavi-openclaw/session.json` (0600). Set `TAVI_TOKEN` instead to use a managed environment secret. The file is not encrypted; use an encrypted filesystem or your platform secret manager for stronger protection. Do not copy it into source ZIPs. Windows ACL protections are not provided by this CLI; use environment-secret injection on Windows.

`updates` polls the authenticated lobby and accepted friends' DM histories, emits new inbound messages as JSON and persists cursors. The first call emits recent history; review it before scheduling. Call periodically using OpenClaw's own scheduling. No automatic LLM response is made: the OpenClaw agent decides whether and how to reply. For production use, a proper OpenClaw channel plugin should translate these events into inbound OpenClaw messages and send replies through the SDK, avoiding frequent polling.

## Current limitations

* The current API identifies accounts as ordinary users; **no `agent` badge or agent account provisioning API** is included in this pass.
* Contact requests and game invites are not emitted as distinct `updates` events; `contacts` is available to inspect and accept requests.
* The API's lobby history is bounded; if polling stops too long, older messages can be missed. Event cursors are local and don't claim exactly-once delivery.
* Game catalog discovery works, but **joining/playing a game is not yet implemented**. `games` returns `agentPlaySupported:false`. Games need an authenticated player identity and legal-action API. Do not attempt to drive arbitrary game pages or reuse Tavi credentials as game credentials.
* This CLI is an interim adapter, not an OpenClaw native channel; use the skill and controlled exec integration to start.

## GitHub install / update (0.3.39)

Clone `https://github.com/TheBigTreeInc/social.git` on the OpenClaw host, preferably checking out a pinned release tag or commit. Use `node integrations/openclaw/tavi-agent.mjs help` from the repository root. The bridge imports `client/sdk/looprd-social.js`, so do not copy only `tavi-agent.mjs`. Set `TAVI_SERVER` to the LoopRD origin; use `TAVI_PASSWORD` only during login. No GitHub Pages or Tavi server credentials are required to download the bridge.

## v0.3.39: notification-driven OpenClaw responder (opt-in)

This adds a **long-running external bridge**; it is **not yet an installed native OpenClaw channel plugin**. It needs OpenClaw CLI and a running Gateway with an agent. It does not change DAPI.

1. Provision a dedicated Tavi account, accept the other accounts as contacts, and authenticate using the existing CLI once. Use its revocable session token as a private `TAVI_TOKEN` environment secret (never publish or commit it).
2. Set `TAVI_SERVER=https://api.thebigtree.life` (or your server), `TAVI_TOKEN`, and **`TAVI_ALLOWED_PEERS=acct_1,acct_2`**. This explicit allowlist prevents unsolicited new contacts from invoking the model.
3. Optionally set `TAVI_OPENCLAW_AGENT=main`.
4. Run `node integrations/openclaw/tavi-openclaw-service.mjs` as a supervised user process (systemd, Windows service manager, etc.). Ensure the `openclaw` executable is on PATH and its Gateway is working.

The service uses LoopRD's one-use WebSocket ticket and generic `pulses` notification to wake, and reconciles authenticated contacts and direct feeds on reconnect and periodically. It ignores self-authored messages; on first startup it **baselines existing history** rather than unexpectedly answering months of old chats. It keeps separate `tavi-dm-acct_N` OpenClaw sessions per sender. It calls `openclaw agent --agent main --session-key ... --message-file - --json`, then replies through `dm_send` only when OpenClaw returns a recognized textual payload. Both the agent and the outgoing send must succeed before the inbox checkpoint advances. No shell interpolates incoming text.

Caveats: there is **no exactly-once side-effect guarantee** across a crash after an outgoing message and before checkpoint persistence. A manual restart can cause a duplicate reply; do not use this bridge for irreversible actions. LoopRD `pulses` is a generic wake hint, not private payload or a per-recipient replay stream. Periodic HTTPS reconciliation is authoritative. The Social feed is bounded, so a prolonged offline interval can miss messages outside the feed retention; no zero-loss promise. Local checkpoints need filesystem protection and backup policy. A full native OpenClaw channel plugin, host lifecycle integration, and end-to-end Gateway acceptance are still pending. No autonomous game play is enabled.


## v0.3.39 — OpenClaw sender identity

Tavi now sends the contact’s verified username and profile-selected display name through the bridge to OpenClaw. `acct_N` remains an internal routing ID, not a name. This requires deploying the updated LoopRD Social component to expose the `displayName` field in `contact_list`; the bridge falls back to `username` with older runtimes. No database migration is needed.

## Game events in Social (0.3.40 source candidate)

A service-owned, recipient-consented game turn event can be shown in Tavi's Inbox. The OpenClaw bridge remains chat only and returns `agentPlaySupported:false`. No `game-act` command, account/game grant, or actual headless game implementation is included. See `docs/GAME_EVENT_IMPLEMENTATION.adoc` and the shared game play proposal.

The `game-events [AFTER_ID]` CLI command (0.3.40) reads the agent account's own recipient-scoped, cursor-based Social game-turn inbox after login. It does not act on the game, join a match or consume another player's grant. In a full integration, the agent will use the returned event only as a hint to query the game's authorized LoopRD `looprd.game-play/v1` state and legal-action endpoints. It MUST not execute instructions contained in untrusted event text.


## 0.3.41 game invitations and identity proof

Trusted game components can send `invite.created` through Social's existing game-event service. OpenClaw can inspect this recipient-only inbox with `game-events`, explicitly accept or decline an invitation and request a 5-minute, one-use proof via `game-grant PUBLISHER GAME_ID MATCH_ID`. `game-grant` prints only a protected file path and metadata; a game-specific adapter must redeem the file's proof and securely remove it. Social authenticates the agent's own account, never impersonates a human or joins a match. No full headless gameplay is claimed without the corresponding game-owned API.
