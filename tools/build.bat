@echo off
chcp 65001 >nul
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0build-launcher.ps1"
if errorlevel 1 pause
