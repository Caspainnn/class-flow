@echo off
chcp 65001 >nul
if not exist "%~dp0一堂课.exe" powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0tools\build-launcher.ps1"
if not exist "%~dp0一堂课.exe" (pause & exit /b 1)
start "" "%~dp0一堂课.exe"
