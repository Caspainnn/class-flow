param([int]$Port=3000,[string]$DataDirectory,[string]$HostAddress='0.0.0.0',[string]$PublicOrigin='')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
if($Port -lt 1 -or $Port -gt 65535){throw 'Invalid port'}
if(!$DataDirectory){$DataDirectory=Join-Path $projectRoot 'data'}
$env:PORT=[string]$Port
$env:DATA_DIR=[IO.Path]::GetFullPath($DataDirectory)
$env:HOST=$HostAddress
if($PublicOrigin){$env:PUBLIC_ORIGIN=$PublicOrigin}else{Remove-Item Env:PUBLIC_ORIGIN -ErrorAction SilentlyContinue}
$start=New-Object System.Diagnostics.ProcessStartInfo
$start.FileName=Join-Path $projectRoot '一堂课.exe'
$start.WorkingDirectory=$projectRoot
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
[System.Diagnostics.Process]::Start($start) | Out-Null
