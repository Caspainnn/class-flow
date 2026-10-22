@echo off
chcp 65001 >nul
cd /d "%~dp0.."

rem 重新打包 课中签到.exe
rem 依赖：C:\Users\29263\.workbuddy\binaries\python\envs\default 里已装 pyinstaller

set "PY=C:\Users\29263\.workbuddy\binaries\python\envs\default\Scripts\pyinstaller.exe"
if not exist "%PY%" (
  echo 找不到 pyinstaller，请先安装：
  echo   python -m venv C:\Users\29263\.workbuddy\binaries\python\envs\default
  echo   ...\Scripts\pip install pyinstaller
  pause
  exit /b 1
)

"%PY%" --onefile --noconsole --icon "icon.ico" --name "课中签到" ^
  --distpath "." --workpath "build" --specpath "build" --clean --noconfirm ^
  "tools\launcher.py"

if errorlevel 1 ( echo 打包失败 & pause & exit /b 1 )
echo.
echo 完成：%~dp0..\课中签到.exe
pause
