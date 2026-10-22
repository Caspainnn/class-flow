@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PORT=3000"
set "URL=http://127.0.0.1:%PORT%/"

rem ============================================================
rem  1. 端口已被占用：若是我们自己的服务，直接开页面就走
rem ============================================================
set "PIDON="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do set "PIDON=%%p"

if defined PIDON (
  tasklist /fi "PID eq %PIDON%" /nh 2>nul | findstr /i "node.exe" >nul 2>nul
  if errorlevel 1 (
    echo.
    echo   端口 %PORT% 被其他程序占用，进程号 %PIDON%。
    echo   请先关掉那个程序，或者联系老师调整端口。
    echo.
    pause
    exit /b 1
  )
  start "" "%URL%"
  exit /b 0
)

rem ============================================================
rem  2. 找 node：先看 PATH，再看常见安装位置
rem ============================================================
set "NODE="
for /f "delims=" %%P in ('where node 2^>nul') do if not defined NODE set "NODE=%%P"
if not defined NODE if exist "D:\Node\node.exe" set "NODE=D:\Node\node.exe"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE (
  echo.
  echo   启动失败：这台电脑上没有找到 Node.js。
  echo   请到 https://nodejs.org 安装后，再双击本文件。
  echo.
  pause
  exit /b 1
)

rem ============================================================
rem  3. 后台启动服务（最小化窗口，关掉浏览器不影响）
rem ============================================================
echo   正在启动课中签到…
start "Inclass" /min "%NODE%" "%~dp0server\server.js"

rem ============================================================
rem  4. 等端口就绪（最多 15 秒）
rem ============================================================
set "UP="
for /L %%i in (1,1,15) do (
  if not defined UP (
    netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>nul
    if not errorlevel 1 set "UP=1"
  )
  if not defined UP ping -n 2 127.0.0.1 >nul
)

rem ============================================================
rem  5. 复查：起来了又立刻崩掉的，也按失败处理
rem ============================================================
if defined UP (
  ping -n 3 127.0.0.1 >nul
  netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>nul
  if errorlevel 1 set "UP="
)

if not defined UP (
  echo.
  echo   服务没能启动。下面直接前台跑一次，把真实报错显示出来：
  echo.
  "%NODE%" "%~dp0server\server.js"
  echo.
  echo   服务已停止。把上面的报错内容截图或复制下来。
  echo.
  pause
  exit /b 1
)

rem ============================================================
rem  6. 打开浏览器
rem ============================================================
start "" "%URL%"
exit /b 0
