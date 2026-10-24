# Tavi 0.3.103 direct-message reliability

## User-visible behavior

Tavi keeps the existing 1000-character private-message limit, but no longer relies on a browser/WebView `maxlength` attribute to communicate it.

- The composer displays the current character count and maximum.
- Over-limit text stays in the draft.
- Send is refused with an explicit message such as `Message is 1,001 characters; maximum is 1,000.`
- The draft is cleared only after Social confirms that the message was persisted.

## Receipt semantics

Receipt labels are deliberately monotonic and have distinct meanings:

- `Sent`: the Social service persisted the direct message and returned its message ID.
- `Delivered`: a Tavi client authenticated as the recipient fetched the direct-message feed containing that message. Server persistence alone is not delivery.
- `Seen`: the recipient advanced the existing conversation read cursor to or beyond that message.

The sender receives the peer delivery/read cursors through the normal conversation/feed responses. Older servers that do not expose these fields safely fall back to `Sent` only.

## Schema 12

Social schema 12 adds `deliveredId INTEGER NOT NULL DEFAULT 0` to the existing `SocialConversationRead` table. Existing message rows, read cursors, accounts, contacts, Wallet data, and sessions are not rewritten by the migration.

Back up the deployed Social database before applying the schema 11 -> 12 migration and perform operator acceptance against a staging/backup copy first.

## Android updater preservation

0.3.103 retains the 0.3.102 PackageInstaller implementation byte-for-byte:

- `tools/android-update/TaviUpdaterPlugin.kt`
- `tools/android-update/TaviInstallResultReceiver.kt`
- `tools/configure-android-updater.py`

The corrected `app.tauri.plugin.JSObject` import, APK package/version/signature verification, non-installing self-test, and ZipRunner non-destructive-overlay regressions remain mandatory checks.

The intended device acceptance is a signed installed 0.3.102 client updating itself to a signed 0.3.103 client without uninstalling and without losing remembered account/session data.
