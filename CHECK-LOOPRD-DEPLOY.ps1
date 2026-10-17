# Checks checked-in LoopRD descriptor against local source; never pushes.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git is required for comparison against the checked-in descriptor.' }
& git rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No Git checkout found: cannot determine whether looprd.yaml changed. No push decision made.' }
& git ls-files --error-unmatch -- looprd.yaml 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'SERVER UPDATE REVIEW REQUIRED: looprd.yaml is not tracked by Git.' -ForegroundColor Yellow
    exit 2
}
& git diff --quiet HEAD -- looprd.yaml
$state=$LASTEXITCODE
if ($state -eq 0) {
    Write-Host 'CLIENT-ONLY: looprd.yaml matches HEAD. GitHub push not needed for local Windows/Web builds.' -ForegroundColor Green
    exit 0
}
if ($state -eq 1) {
    Write-Host 'SERVER CHANGE: looprd.yaml differs from HEAD. Review and push this descriptor when deploying a new LoopRD revision.' -ForegroundColor Yellow
    Write-Host 'Inspect changes: git diff HEAD -- looprd.yaml'
    exit 1
}
throw "git diff failed ($state); no push decision made"
