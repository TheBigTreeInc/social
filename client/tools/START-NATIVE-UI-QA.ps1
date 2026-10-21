# Launch ONLY a disposable Windows Tavi QA client. Do not reuse the production
# account, data directory, or server: UI screenshots can contain private data.
param(
  [Parameter(Mandatory=$true)][string]$TaviExe,
  [int]$CdpPort = 9238
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $TaviExe -PathType Leaf)) { throw 'Tavi QA executable does not exist.' }
if ($CdpPort -lt 1024 -or $CdpPort -gt 65535) { throw 'CDP port must be 1024..65535.' }
Write-Host 'This starts a separate Tavi process with WebView2 debugging enabled.'
Write-Host 'Use a disposable QA account and server only. Close existing Tavi windows first.'
$confirmation = Read-Host 'Type QA to confirm you will NOT sign into your production account'
if ($confirmation -cne 'QA') { throw 'QA launch cancelled.' }
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$CdpPort"
$env:TAVI_NATIVE_QA_CDP_PORT = [string]$CdpPort
$env:TAVI_NATIVE_QA_DISPOSABLE = '1'
Start-Process -FilePath (Resolve-Path -LiteralPath $TaviExe).Path
Write-Host "After signing into a disposable QA account, run in another terminal:"
Write-Host "  `$env:TAVI_NATIVE_QA_DISPOSABLE='1'; `$env:TAVI_NATIVE_QA_CDP_PORT='$CdpPort'; npm --prefix client run ui:native"
Write-Host 'Screenshots are disabled unless TAVI_NATIVE_QA_CAPTURE=1.'
