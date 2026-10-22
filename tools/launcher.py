# -*- coding: utf-8 -*-
"""
课中签到 · 启动器
双击即：起服务（后台无窗口）→ 打开浏览器。已在运行则直接开页面。
打包：见同目录 build.bat
"""
import ctypes
import os
import socket
import subprocess
import sys
import time
import urllib.request

PORT = 3000
URL = "http://127.0.0.1:%d/" % PORT
TITLE = "课中签到"

CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008


def base_dir():
    """程序所在目录：打包后是 exe 所在目录，源码运行时是项目根目录"""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def msg(text, error=True):
    flags = 0x10 if error else 0x40          # MB_ICONERROR / MB_ICONINFORMATION
    ctypes.windll.user32.MessageBoxW(None, text, TITLE, flags | 0x40000)


def port_open():
    with socket.socket() as s:
        s.settimeout(0.25)
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def is_ours():
    try:
        with urllib.request.urlopen(URL + "api/ping", timeout=1.2) as r:
            return b'"ok":true' in r.read(200)
    except Exception:
        return False


def find_node():
    """优先用发行包自带的运行时，其次系统 PATH，最后常见安装位置"""
    for p in (
        os.path.join(base_dir(), "runtime", "node.exe"),
        os.path.join(base_dir(), "node", "node.exe"),
    ):
        if os.path.isfile(p):
            return p
    for d in os.environ.get("PATH", "").split(os.pathsep):
        p = os.path.join(d.strip('"'), "node.exe")
        if os.path.isfile(p):
            return p
    for p in (
        r"D:\Node\node.exe",
        os.path.expandvars(r"%ProgramFiles%\nodejs\node.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\nodejs\node.exe"),
    ):
        if os.path.isfile(p):
            return p
    return None


def find_server():
    p = os.path.join(base_dir(), "server", "server.js")
    return p if os.path.isfile(p) else None


def open_page():
    try:
        os.startfile(URL)
    except Exception:
        import webbrowser
        webbrowser.open(URL)


def tail(path, n=15):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return "".join(f.readlines()[-n:])
    except Exception:
        return ""


def main():
    # 1. 已经在跑：直接开页面
    if port_open():
        if is_ours():
            open_page()
            return 0
        msg("端口 3000 被其他程序占用了，课中签到起不来。\n\n请先把占用端口的程序关掉。")
        return 1

    # 2. 找 node 和服务端
    node = find_node()
    if not node:
        msg("没找到 Node.js 运行时。\n\n"
            "· 从发行包安装的：解压时可能少了 runtime 文件夹，请重新解压完整的压缩包；\n"
            "· 从源码跑的：先装 https://nodejs.org 的 LTS 版本，装完再双击一次。")
        return 1
    js = find_server()
    if not js:
        msg("找不到 server\\server.js。\n\n"
            "课中签到.exe 必须和 server 文件夹待在一起，不能单独把 exe 拷出来。\n"
            "把整个文件夹一起移动即可。")
        return 1

    # 3. 启动（无窗口，日志写文件，父进程退出不影响）
    logdir = os.path.join(base_dir(), "logs")
    try:
        os.makedirs(logdir, exist_ok=True)
    except Exception:
        logdir = os.environ.get("TEMP", ".")
    log = os.path.join(logdir, "server.log")
    try:
        fh = open(log, "wb", buffering=0)
    except Exception:
        fh = subprocess.DEVNULL

    try:
        subprocess.Popen(
            [node, js],
            cwd=os.path.dirname(js),
            stdin=subprocess.DEVNULL,
            stdout=fh,
            stderr=fh,
            creationflags=DETACHED_PROCESS | CREATE_NO_WINDOW,
            close_fds=True,
        )
    except Exception as e:
        msg("启动失败：%s" % e)
        return 1

    # 4. 等端口
    for _ in range(60):
        if port_open():
            break
        time.sleep(0.25)

    if not port_open():
        msg("服务没能启动起来。\n\n日志：%s\n\n%s" % (log, tail(log)))
        return 1

    open_page()
    return 0


if __name__ == "__main__":
    sys.exit(main())
