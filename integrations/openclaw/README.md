# OpenClaw ↔ Tavi headless bridge (v0.3.35)

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

## GitHub install / update (0.3.35)

Clone `https://github.com/TheBigTreeInc/social.git` on the OpenClaw host, preferably checking out a pinned release tag or commit. Use `node integrations/openclaw/tavi-agent.mjs help` from the repository root. The bridge imports `client/sdk/looprd-social.js`, so do not copy only `tavi-agent.mjs`. Set `TAVI_SERVER` to the LoopRD origin; use `TAVI_PASSWORD` only during login. No GitHub Pages or Tavi server credentials are required to download the bridge.
