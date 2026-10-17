# Local Tavi build: never pushes, commits or deploys anything.
[CmdletBinding()]
param(
    [ValidateSet('All','Windows','Web','Android','Verify')][string]$Target='All',
    [switch]$SkipTests,
    [switch]$SkipPortraitSync
)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
function Run([string]$file, [string[]]$arguments) {
    Write-Host ('> ' + $file + ' ' + ($arguments -join ' ')) -ForegroundColor Cyan
    & $file @arguments
    if ($LASTEXITCODE -ne 0) { throw "$file failed ($LASTEXITCODE)" }
}
function Need([string]$name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "Missing $name in PATH. See docs/LOCAL_BUILD.adoc." }
}
Need 'node'; Need 'npm'; Need 'python'
# Keep Python test dependencies isolated and reproducible on a clean Windows host.
$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host 'TAVI_PYTHON_SETUP: creating isolated .venv' -ForegroundColor Cyan
    Run 'python' @('-m','venv','.venv')
}
Write-Host 'TAVI_PYTHON_SETUP: verifying development dependencies' -ForegroundColor Cyan
Run $venvPython @('-m','pip','install','-r','requirements-dev.txt','--disable-pip-version-check')

$npmCommand = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
if (-not $SkipTests) {
    Run $npmCommand @('run','verify')
    Run $venvPython @('tools/generate-looprd.py','--check')
    Run $venvPython @('-m','unittest','discover','-s','tests','-p','test_*.py','-q')
}
if ($Target -ne 'Verify') {
    Push-Location (Join-Path $PSScriptRoot 'client')
    try {
        Run $npmCommand @('install','--no-audit','--no-fund')
        if (-not $SkipPortraitSync) { Run $npmCommand @('run','portrait:sync') }
        Run $npmCommand @('run','check')
        if ($Target -in @('All','Web')) {
            Run $npmCommand @('run','web:build')
            Run $npmCommand @('run','web:verify')
            Write-Host ('Web: ' + (Join-Path $PWD 'dist')) -ForegroundColor Green
        }
        if ($Target -eq 'Android') {
            Need 'cargo'; Need 'rustc'; Need 'java'
            if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) { throw 'Android SDK missing: set ANDROID_HOME or ANDROID_SDK_ROOT.' }
            Run $npmCommand @('run','tauri','--','android','build','--apk')
            Write-Host 'Android APK build complete; check client/src-tauri/gen/android/app/build/outputs/apk.' -ForegroundColor Green
        }
        if ($Target -in @('All','Windows')) {
            if ($env:OS -ne 'Windows_NT') { throw 'Windows NSIS build requires Windows. Use -Target Web on other platforms.' }
            Need 'cargo'; Need 'rustc'
            # Cargo cannot replace a running Windows .exe (os error 5). Stop only
            # the exact executable in this project's generated release folder.
            # The helper first requests a graceful close, then forces that PID
            # only if needed. Installed copies elsewhere are left untouched.
            & (Join-Path $PSScriptRoot 'tools/stop-running-tavi.ps1') -ExecutablePath (Join-Path $PSScriptRoot 'client/src-tauri/target/release/looprd-social-client.exe')
            Run $npmCommand @('run','tauri','--','build','--bundles','nsis')
            Write-Host ('Windows installers: ' + (Join-Path $PWD 'src-tauri/target/release/bundle/nsis')) -ForegroundColor Green
        }
    } finally { Pop-Location }
}
Write-Host 'Local build completed. No Git operations were performed.' -ForegroundColor Green
Write-Host 'Check server deployment separately: powershell -File .\CHECK-LOOPRD-DEPLOY.ps1'
