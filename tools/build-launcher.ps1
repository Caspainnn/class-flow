$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { $compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (!(Test-Path -LiteralPath $compiler)) { throw '需要 Windows .NET Framework 4.x 才能构建启动器。' }
& $compiler /nologo /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$projectRoot\icon.ico" "/out:$projectRoot\一堂课.exe" "$PSScriptRoot\launcher.cs"
if ($LASTEXITCODE -ne 0) { throw '启动器编译失败。' }
Write-Output "已构建：$projectRoot\一堂课.exe"
