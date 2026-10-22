@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $c) { '  课中签到没有在运行。' } else { $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq 'node') { $p | Stop-Process -Force; '  已停止课中签到服务。' } else { '  端口 3000 被 ' + $p.ProcessName + ' 占用，没有动它。' } }"
ping -n 5 127.0.0.1 >nul
