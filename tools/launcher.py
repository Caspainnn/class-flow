# Legacy source entry; use the native Windows launcher.
import os
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
exe = root / "一堂课.exe"
if not exe.exists():
    subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(root / "tools" / "build-launcher.ps1")], check=True)
subprocess.Popen([str(exe)], cwd=root)
