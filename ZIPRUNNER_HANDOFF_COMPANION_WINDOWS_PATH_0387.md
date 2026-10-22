# Tavi 0.3.87 — Windows reviewed Companion source URL path repair

## Source-only fix

ZipRunner 1.2.304.159 rejected 0.3.86 after its Node client suite ran 219/220 tests. The failing test was `client/tests/companion-preview-086.test.mjs`, which fed `new URL('../../extensions/org.tavi.community.companion/', import.meta.url).pathname` into `inspectReviewedBundle()`. On Windows, a `file:` URL's `.pathname` begins with `/C:/`; using `path.resolve()` yielded `C:\\C:\\...` and `ENOENT`. Neither the extension assets nor the Companion manifest were corrupt.

The importer now accepts a `file:` URL object and converts it using Node `fileURLToPath()` before `resolve()`, including for optional `root` paths. The regression test passes the URL directly, and checks the equivalent native filesystem path yields the same SHA-256 digest. Existing filesystem-string callers remain supported.

## Unchanged scope

- Reviewed Companion 0.6.11 snapshot, publisher, content digest and palette/assets remain unchanged.
- First-party Wallet stays core; Notepad stays optional.
- Companion preview host policy and account isolation remain as in 0.3.86.
- Social Ledger schema 11, LoopRD descriptor and server release stay unchanged.
- No user data, active settings, secrets, or database migration in this ZIP.

## Run on Windows / ZipRunner

1. Import `looprd-social-0.3.87-companion-windows-path-repair-ziprunner.zip` after the failed 0.3.86 build. Do not delete the old installation, `.git`, settings, or private state.
2. Confirm ZipRunner's build passes `npm run verify`, which includes `node --test client/tests/companion-preview-086.test.mjs`.
3. Verify `npm run extensions:check` and the normal Windows native build.
4. Inspect the real client: open App Store, install Companion, open My pet, inspect the painted preview, return Home. Verify Wallet and Notepad unaffected.
5. Only after reviewing the source, perform Git push and inspect exact-commit required CI. Native Windows/Android and real iframe acceptance remain operator-gated.

## Verification boundaries

Linux Node tests and archive preflight cannot substitute for executing ZipRunner on Windows. No Git push, release or deployment was done by the author.
