# TaviX UI contract demo (Tavi 0.3.162)

This is **sample source**, not a distributable/signed `.tavix` package. It is intentionally not registered or installed into Tavi automatically.

Build the JS and CSS with a bundler that resolves `@tavi/tavix-sdk` from `client/extension-sdk`; bundle resulting assets into a reviewed TaviX app according to the existing packager/manifest policy. The sample illustrates app-owned tabs, a resource/detail browser, read-only host discovery, theme event handling and a host-mediated `navigation.close()` action. It deliberately omits a duplicate host Back bar, OS window APIs, server credentials and arbitrary filesystem access.

Read `docs/TAVI_UI_UX_DEVELOPER_CONTRACT_0162.adoc` for available components, the legacy `detached` compatibility alias and the Android/tablet orientation policy. This example does not exercise native Android locking or tablet floating panels; those remain future implementation work.
