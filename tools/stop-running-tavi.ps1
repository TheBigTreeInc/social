# Stop only the development executable that Cargo needs to replace.
# Do not stop an installed Tavi copy at another path or remove any build output.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ExecutablePath,
    [ValidateRange(1,60)][int]$GraceSeconds = 5
)
$ErrorActionPreference = 'Stop'
$target = [System.IO.Path]::GetFullPath($ExecutablePath)
if ([System.IO.Path]::GetFileName($target) -ine 'looprd-social-client.exe') {
    throw 'TAVI_BUILD_STOP_REFUSED: target must be looprd-social-client.exe'
}
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    Write-Host 'TAVI_BUILD_STOP_NOT_NEEDED: compiled executable does not exist yet'
    return
}

# A process name alone is not safe: installed copies may have the same name.
$running = @(Get-CimInstance Win32_Process -Filter "Name = 'looprd-social-client.exe'" -ErrorAction Stop)
$matching = @($running | Where-Object {
    $_.ExecutablePath -and
    [string]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $target,
        [System.StringComparison]::OrdinalIgnoreCase)
})
foreach ($entry in $matching) {
    $processId = [int]$entry.ProcessId
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $process) { continue }
    Write-Host "TAVI_BUILD_STOP_REQUESTED: pid=$processId (matching build executable)"
    # Request a normal close first, preserving an opportunity for app shutdown.
    try {
        if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
            [void]$process.CloseMainWindow()
            [void]$process.WaitForExit($GraceSeconds * 1000)
        }
    } catch [System.InvalidOperationException] {
        # Process exited between enumeration and the close request.
    }
    $stillRunning = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -ne $stillRunning) {
        # Revalidate the path immediately before a forced stop. In particular,
        # a PID reused after the graceful exit must never be terminated.
        $current = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
        if ($null -eq $current -or -not $current.ExecutablePath -or
            -not [string]::Equals([System.IO.Path]::GetFullPath($current.ExecutablePath), $target,
                [System.StringComparison]::OrdinalIgnoreCase)) {
            Write-Host "TAVI_BUILD_STOP_SKIPPED: pid=$processId is no longer the target executable"
            continue
        }
        Stop-Process -Id $processId -Force -ErrorAction Stop
        try { [void]$stillRunning.WaitForExit(5000) } catch [System.InvalidOperationException] {}
        Write-Host "TAVI_BUILD_STOP_FORCED: pid=$processId"
    } else {
        Write-Host "TAVI_BUILD_STOP_CLOSED: pid=$processId"
    }
}
$remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'looprd-social-client.exe'" | Where-Object {
    $_.ExecutablePath -and
    [string]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $target,
        [System.StringComparison]::OrdinalIgnoreCase)
})
if ($remaining.Count -gt 0) {
    throw "TAVI_BUILD_STOP_BLOCKED: still running at $target; close Tavi and retry"
}
Write-Host "TAVI_BUILD_STOP_READY: executable can be rebuilt ($($matching.Count) matching process(es))"
