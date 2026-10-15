# Social client boundaries (v0.3.0)

- Server-first onboarding discovers the Social component and obtains account capabilities; no Social -> no social session and no chat/account persistence fallback.
- Social owns registration, username/password verification, per-device sessions, contact requests, direct messages, presence and user portraits. LoopRD stays generic.
- Contact requests require explicit acceptance; the server checks participant authorization before every private feed/send. The public pulse is an opaque update only.
- The client shows a buddy roster, group headings, private and lobby conversations, turn sidebar, settings and portrait workshop. It has no invented online friends or automatic game catalog.
- Developer tokens remain backward-compatible for existing local tests and bridges; normal UI never asks for one.
- Remote servers require HTTPS; origin, component and game routes are validated. Game endpoints never receive Social credentials. Account session tokens and passwords are not stored in localStorage.
- The same account can be used on two devices with two independently revocable sessions. Re-login is required after restarting a device in this release. A secure OS keychain-backed remembered-device feature is planned.
- Open registration should be limited or protected at public deployment level; no password reset/email verification/invites/moderation yet. No Android background push after termination and no trusted game invitation issuer yet.
