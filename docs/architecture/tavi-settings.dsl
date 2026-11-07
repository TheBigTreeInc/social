workspace "Tavi Settings" "Source-derived C4 model for Settings and TaviX contributions, 0.3.135" {
  model {
    user = person "Tavi user" "Uses messenger, installed apps and Settings on desktop or mobile"
    looprd = softwareSystem "LoopRD Social" "Owns accounts, messages and server-side authorization" {
      tags "External"
    }
    tavixSources = softwareSystem "TaviX repository" "Public static extension metadata served via HTTPS" {
      tags "External"
    }
    tavi = softwareSystem "Tavi" "Messenger-first client and optional social-game launcher" {
      client = container "Tavi client" "Windows, Android or browser UI" "JavaScript/Tauri" {
        settingsView = component "Settings view" "Host-owned Material settings pages, source editor and links" "client/src/ui/settings-view.js"
        settingsDirectory = component "Settings contribution registry" "Filters installed approved manifest settings.app entries" "client/src/ui/settings-registry.js"
        marketplace = component "Extension marketplace" "Discovers apps and offers install/update review" "client/src/main.js"
        repositories = component "Repository subscriptions" "Validates HTTPS sources and stores server-origin-scoped device choices" "client/src/extensions/repositories.js"
        extensionStore = component "Extension install store" "Per-account pinned installed metadata and permission state" "client/src/extensions/store.js"
        extensionHost = component "Extension sandbox host" "Serves isolated iframe SDK requests; reports settings launch context" "client/src/extensions/host.js"
        manifestValidator = component "Manifest validator" "Validates v1 contribution slots, identity and permissions" "client/src/extensions/contract.js"
      }
    }
    user -> client "Uses Settings, Apps and messages"
    client -> looprd "Authenticated Social API"
    repositories -> tavixSources "Fetches validated indexes over HTTPS"
    settingsView -> settingsDirectory "Reads eligible app settings links"
    settingsView -> repositories "Lists and edits subscriptions"
    marketplace -> repositories "Discovers catalogs"
    settingsDirectory -> extensionStore "Checks approved installed metadata"
    settingsDirectory -> manifestValidator "Validates declarations"
    settingsView -> extensionHost "Opens extension in isolated app panel via client routing"
  }
  views {
    systemContext tavi "SystemContext" { include *; autoLayout lr }
    container tavi "Containers" { include *; autoLayout lr }
    component client "SettingsComponents" { include *; autoLayout lr }
    styles { element "External" { background #777777; color #ffffff } }
  }
}
