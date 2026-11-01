$ErrorActionPreference = 'Stop'
$dashboardProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dashboardRoot = Join-Path $dashboardProject 'data'
$dashboardState = Invoke-RestMethod -TimeoutSec 8 http://127.0.0.1:3000/api/all
if ([IO.Path]::GetFullPath($dashboardState.dataPath) -ne $dashboardRoot) { throw 'The listener belongs to another project.' }
if ($dashboardState.active) { throw 'Attendance is active; server was not restarted.' }
foreach ($dashboardFolder in @('ppt','lesson-plan','questionnaire-ai')) {
    $dashboardFolderPath = Join-Path $dashboardRoot $dashboardFolder
    if (Test-Path -LiteralPath $dashboardFolderPath) {
        foreach ($dashboardDirectory in (Get-ChildItem -LiteralPath $dashboardFolderPath -Directory | Where-Object { $_.Name -match '^[a-f0-9]{24}$' })) {
            $dashboardFile = Join-Path $dashboardDirectory.FullName 'task.json'
            if ((Test-Path -LiteralPath $dashboardFile) -and ((Get-Content -LiteralPath $dashboardFile -Raw -Encoding UTF8 | ConvertFrom-Json).status -eq 'running')) { throw 'Generation is running; server was not restarted.' }
        }
    }
}
$dashboardBatchesFile = Join-Path $dashboardRoot 'gradebatches.json'
if (Test-Path -LiteralPath $dashboardBatchesFile) {
    if (@((Get-Content -LiteralPath $dashboardBatchesFile -Raw -Encoding UTF8 | ConvertFrom-Json) | Where-Object { $_.status -eq 'running' -and -not $_.deletedAt }).Count) { throw 'Grading is running; server was not restarted.' }
}
$dashboardSurveysFile = Join-Path $dashboardRoot 'questionnaires.json'
if (Test-Path -LiteralPath $dashboardSurveysFile) {
    $dashboardSurveys = (Get-Content -LiteralPath $dashboardSurveysFile -Raw -Encoding UTF8 | ConvertFrom-Json).surveys
    if (@($dashboardSurveys | Where-Object { $_.status -eq 'collecting' -and (-not $_.deadline -or [DateTimeOffset]::Parse($_.deadline) -gt [DateTimeOffset]::Now) }).Count) { throw 'A questionnaire is collecting; server was not restarted.' }
}
$dashboardListener = Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1
$dashboardProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = '+$dashboardListener.OwningProcess)
if ($dashboardProcess.Name -ne 'node.exe' -or $dashboardProcess.CommandLine -notmatch 'server[\\/]server\.js') { throw 'Unexpected server process; no process was stopped.' }
Stop-Process -Id $dashboardListener.OwningProcess
Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server/server.js' -WorkingDirectory $dashboardProject -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dashboardProject '.tmp-dashboard-formal-server.log') -RedirectStandardError (Join-Path $dashboardProject '.tmp-dashboard-formal-server-error.log')
for ($dashboardAttempt=0; $dashboardAttempt -lt 30; $dashboardAttempt++) {
    try { $dashboardResult = Invoke-RestMethod -TimeoutSec 2 http://127.0.0.1:3000/api/dashboard; Write-Output ('Dashboard online; courses='+$dashboardResult.courses.Count); exit 0 } catch { Start-Sleep -Milliseconds 250 }
}
throw 'Server launched but the dashboard did not become ready; inspect the local log.'
