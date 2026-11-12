workspace "Tavi Workspace UI" "Source-derived C4 L3 view for Tavi 0.3.171 desktop presentation preferences, reviewed local app window, UI kit and startup diagnostics" {
  model {
    personUser = person "Tavi user" "Uses chat first and launches optional applications"
    looprd = softwareSystem "LoopRD Social" "Authenticates accounts and authorizes server data" {
      tags "External"
    }
    tavixApps = softwareSystem "TaviX apps" "Reviewed isolated extensions and games" {
      tags "External"
    }
    tavi = softwareSystem "Tavi" "Messenger-first Windows/Android client" {
      client = container "Tavi client" "Authenticated main UI and native workspace surfaces" "JavaScript/Tauri" {
        productDetail = component "Store product detail" "Displays escaped app/asset product metadata, verified price status and existing install actions; never authorizes Wallet transfers" "client/src/ui/store-detail.js"
        taviStore = component "Tavi Store composition" "Projects verified TaviX catalog and Tavi Assets metadata into one public/private discovery UI, without new install authority" "client/src/ui/storefront.js"
        taviAssets = component "Tavi Assets catalog projection" "Projects approved local and remote asset metadata, preserving the existing permissioned install flow" "client/src/ui/asset-market.js"
        marketplace = component "TaviX catalog projection" "Preserves installed/source status and app-update projection" "client/src/extensions/marketplace.js"
        messenger = component "Messenger UI" "Renders home, chat, app launcher, Back navigation and theme" "client/src/main.js"
        workspace = component "Desktop workspace manager" "Creates reviewed separate native windows, tracks authenticated sessions and drops them only after native destruction" "client/src/extensions/workspace-native-host.js"
        host = component "TaviX sandbox host" "Checks iframe SDK requests, grants and supplies read-only UI discovery" "client/src/extensions/host.js"
        uiKit = component "TaviX UI kit" "Source-distributed offline action icons, OS typography and responsive lifecycle controller; no privilege grants" "client/extension-sdk/ui.js, ui.css, icons.js"
        uiInfo = component "UI context" "Computes non-sensitive theme, device and presentation metadata" "client/src/extensions/ui-context.js"
        presentation = component "Presentation declaration" "Validates manifest modes and per-account device-local remembered preferences" "client/src/extensions/workspace-presentation.js"
        localWindowPackage = component "Local TaviX window archive loader" "Rechecks account-scoped IndexedDB archive revision and projects only verified manifest/assets into sandboxed native-window iframe" "client/src/extensions/workspace-local-package.js"
        nativeLifecycle = component "Native Windows destruction monitor" "Emits a label-only post-destroyed event from Tauri to the trusted main window" "client/src-tauri/src/lib.rs"
        boot = component "Startup guard" "Distinguishes startup load, exception, promise and timeout failures without exposing private state" "client/public/boot-guard.js"
        relay = component "Native workspace relay" "Nonced Tauri events across sandboxed app windows" "client/src/extensions/workspace-relay.js"
      }
    }
    personUser -> messenger "Uses authenticated client"
    messenger -> looprd "Requests authenticated chat and account data"
    messenger -> taviStore "Displays unified discovery when Store is opened"
    taviStore -> productDetail "Shows product details before an install action"
    productDetail -> taviAssets "Reads safe pack metadata and illustrative catalog cover"
    taviStore -> taviAssets "Renders metadata-only asset pack entries"
    taviStore -> marketplace "Projects app and game entries; hides internal tools in public discovery"
    messenger -> host "Mounts verified application iframe"
    messenger -> workspace "Opens detachable app on explicit user request"
    messenger -> boot "Completes startup signal after first render"
    host -> uiInfo "Returns read-only ui.info context"
    uiKit -> uiInfo "Consumes UI context through optional authenticated SDK call"
    workspace -> host "Creates scoped per-window SDK host"
    workspace -> relay "Routes authenticated requests without credentials"
    workspace -> presentation "Uses per-device game/app launch defaults and preserves explicit per-app choice"
    workspace -> localWindowPackage "Resolves verified local TaviX package by account and revision"
    workspace -> nativeLifecycle "Observes native Destroyed event, validates missing native label, releases relay"
    host -> tavixApps "Sandboxed TaviX SDK messages"
  }
  views {
    systemContext tavi "TaviWorkspaceContext" { include *; autoLayout lr }
    container tavi "TaviWorkspaceContainers" { include *; autoLayout lr }
    component client "TaviWorkspaceComponents" { include *; autoLayout lr }
    styles { element "External" { background #777777; color #ffffff } }
  }
}
