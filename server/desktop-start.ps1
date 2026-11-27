param([string]$NodePath,[string]$ServerPath,[string]$DataPath,[int]$ServerPort,[string]$LogDir)
$ErrorActionPreference='Stop'
$env:PORT=[string]$ServerPort
$env:DATA_DIR=$DataPath
foreach($entry in [System.Environment]::GetEnvironmentVariables().GetEnumerator()){if($entry.Key.StartsWith('CODEBUDDY_') -or $entry.Key -eq 'NODE_OPTIONS'){Remove-Item -LiteralPath ('Env:'+ $entry.Key) -ErrorAction SilentlyContinue}}
# 环境块中可能存在仅大小写不同的重复变量（如 http_proxy / HTTP_PROXY），
# Start-Process 构建环境字典时会因重复键直接失败，这里只保留每组的第一个。
$seen=@{}
foreach($entry in [System.Environment]::GetEnvironmentVariables().GetEnumerator()){
 $name=[string]$entry.Key;$lower=$name.ToLowerInvariant()
 if($seen.ContainsKey($lower)){[System.Environment]::SetEnvironmentVariable($name,$null)}else{$seen[$lower]=$true}
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$nodeProcess=Start-Process -FilePath $NodePath -ArgumentList ('"'+$ServerPath+'"') -WorkingDirectory (Split-Path $ServerPath -Parent) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir 'server.out.log') -RedirectStandardError (Join-Path $LogDir 'server.err.log') -PassThru
[Console]::WriteLine($nodeProcess.Id)
