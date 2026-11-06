param([string]$NodePath,[string]$ServerPath,[string]$DataPath,[int]$ServerPort,[string]$LogDir)
$ErrorActionPreference='Stop'
$env:PORT=[string]$ServerPort
$env:DATA_DIR=$DataPath
foreach($item in Get-ChildItem Env:){if($item.Name.StartsWith('CODEBUDDY_') -or $item.Name -eq 'NODE_OPTIONS'){Remove-Item -LiteralPath ('Env:'+ $item.Name)}}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$nodeProcess=Start-Process -FilePath $NodePath -ArgumentList ('"'+$ServerPath+'"') -WorkingDirectory (Split-Path $ServerPath -Parent) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir 'server.out.log') -RedirectStandardError (Join-Path $LogDir 'server.err.log') -PassThru
[Console]::WriteLine($nodeProcess.Id)
