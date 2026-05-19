# One-time setup: registers a Windows scheduled task that runs the
# competitor-watch script every Monday at 9 AM Central. Requires admin
# (the task is registered at the user level; UAC prompt appears the
# first time you run this).
#
# To install:
#   powershell -ExecutionPolicy Bypass -File scripts\install-competitor-watch-task.ps1
#
# To uninstall:
#   Unregister-ScheduledTask -TaskName "TCC Competitor Watch" -Confirm:$false
#
# The script is wrapped in a VBS launcher (no console window flash) using
# the same pattern we use for PowerhousePoll and OpenClaw Gateway. See
# project_openclaw_hidden_launchers memory for context.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyScript = Join-Path $scriptDir "competitor-watch.py"
$vbsLauncher = Join-Path $scriptDir "competitor-watch-hidden.vbs"

if (-not (Test-Path $pyScript)) {
    Write-Error "competitor-watch.py not found at $pyScript"
    exit 1
}

# Write the VBS launcher so the weekly run doesn't flash a console
$vbsContent = @"
' Competitor-watch hidden launcher (SW_HIDE = 0, bWaitOnReturn = False).
' Runs python competitor-watch.py with no visible console window.
CreateObject("WScript.Shell").Run "python.exe ""$($pyScript -replace '\\', '\\\\')""", 0, False
"@
Set-Content -Path $vbsLauncher -Value $vbsContent -Encoding ASCII
Write-Host "Wrote launcher: $vbsLauncher"

# Build the scheduled task
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsLauncher`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

Register-ScheduledTask `
    -TaskName "TCC Competitor Watch" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Weekly scrape of Atlas + IWM prices, diff against TCC live prices, post summary to Mission Control. Set up by scripts/install-competitor-watch-task.ps1." `
    -Force | Out-Null

Write-Host "Installed scheduled task 'TCC Competitor Watch' — runs every Monday at 9 AM"
Write-Host "Next run: $((Get-ScheduledTaskInfo -TaskName 'TCC Competitor Watch').NextRunTime)"
Write-Host ""
Write-Host "Fire a test run manually:"
Write-Host "  Start-ScheduledTask -TaskName 'TCC Competitor Watch'"
Write-Host "  # OR direct:"
Write-Host "  python $pyScript --dry-run"
