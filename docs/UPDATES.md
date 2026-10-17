# Tavi update notifications (v0.3.39)

The client checks `https://api.github.com/repos/TheBigTreeInc/social/releases/latest` when started and every six hours while running. It compares strict three-part numeric versions to the built-in client version, ignoring prereleases and drafts. An available stable update appears in the roster and in Help > Download Tavi, with a manual Help > Check for updates action.

The download action opens `https://github.com/TheBigTreeInc/social/releases/latest` through the OS/browser; no remote URL is accepted from the API response. The user must choose the appropriate platform asset and install it manually. Checks fail safely offline or if GitHub rate limits the request. No credentials are sent to GitHub.

This is **not an automatic installer**. For native auto-update, add the Tauri updater plugin and a signed update manifest. Provision the signing private key exclusively as a GitHub Actions secret, publish the signature for each compatible binary, pin the public key in the application, verify signatures before applying updates, and require explicit user consent and a safe restart. Android additionally needs its own APK distribution/signing strategy. Do not enable unsigned binary execution.
