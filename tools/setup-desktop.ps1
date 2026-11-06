param([int]$Port=3000,[string]$DataDirectory,[string]$HostAddress='0.0.0.0',[string]$PublicOrigin='',[string]$ShortcutDirectory,[switch]$Open)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
if($Port -lt 1 -or $Port -gt 65535){throw '端口须为1至65535。'}
if(!$DataDirectory){$DataDirectory=Join-Path $projectRoot 'data'}
$DataDirectory=[IO.Path]::GetFullPath($DataDirectory)
if(!$ShortcutDirectory){$ShortcutDirectory=[Environment]::GetFolderPath('Desktop')}
if($PublicOrigin){$origin=[Uri]$PublicOrigin;if(!$origin.IsAbsoluteUri -or $origin.Scheme -notin @('http','https')){throw 'PUBLIC_ORIGIN须为有效HTTP地址。'}}
$exe=Join-Path $projectRoot '一堂课.exe'
$source=Join-Path $PSScriptRoot 'launcher.cs'
if(!(Test-Path -LiteralPath $exe) -or (Get-Item -LiteralPath $source).LastWriteTimeUtc -gt (Get-Item -LiteralPath $exe).LastWriteTimeUtc){
 $running=Get-Process -Name '一堂课' -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $exe}
 if($running){throw '当前启动器需要更新；请先从托盘安全退出一堂课，再运行配置脚本。未停止任何服务。'}
 & (Join-Path $PSScriptRoot 'build-launcher.ps1')
}
New-Item -ItemType Directory -Force -Path $ShortcutDirectory | Out-Null
$shell=New-Object -ComObject WScript.Shell
$shortcut=Join-Path $ShortcutDirectory '一堂课.lnk'
$wrapper=Join-Path $PSScriptRoot 'open-desktop.ps1'
$powershell=Join-Path $PSHOME 'powershell.exe'
if(Test-Path -LiteralPath $shortcut){$old=$shell.CreateShortcut($shortcut);if($old.TargetPath -ne $exe -and !($old.TargetPath -eq $powershell -and $old.Arguments.Contains($wrapper))){throw '桌面已有其他项目的一堂课快捷方式，未覆盖。请用-ShortcutDirectory指定其他位置。'}}
$link=$shell.CreateShortcut($shortcut)
$link.TargetPath=$powershell
$link.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$wrapper+'" -Port '+$Port+' -DataDirectory "'+$DataDirectory+'" -HostAddress "'+$HostAddress+'"'
if($PublicOrigin){$link.Arguments+=' -PublicOrigin "'+$PublicOrigin+'"'}
$link.WorkingDirectory=$projectRoot
$link.IconLocation=Join-Path $projectRoot 'icon.ico'
$link.Description='一堂课教学工作台'
$link.WindowStyle=7
$link.Save()
Write-Output ('已配置桌面入口：'+$shortcut)
if($Open){& $wrapper -Port $Port -DataDirectory $DataDirectory -HostAddress $HostAddress -PublicOrigin $PublicOrigin}
