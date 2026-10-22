# -*- coding: utf-8 -*-
"""
生成桌面快捷方式（纯 ctypes 调 ShellLink COM，不依赖 pywin32）。
用法：python tools/make-shortcut.py
"""
import ctypes
import os
import sys
import winreg
from ctypes import POINTER, byref, c_int, c_ubyte, c_ulong, c_ushort, c_void_p, c_wchar_p

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(PROJECT, "课中签到.exe")
ICON = os.path.join(PROJECT, "icon.ico")
LNK_NAME = "课中签到.lnk"


def desktop_dir():
    """桌面可能被 OneDrive / 自定义路径重定向，优先读注册表"""
    key = r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key) as k:
            v, _ = winreg.QueryValueEx(k, "Desktop")
            return os.path.expandvars(v)
    except OSError:
        return os.path.join(os.path.expanduser("~"), "Desktop")


DESK = desktop_dir()


class GUID(ctypes.Structure):
    _fields_ = [("d1", c_ulong), ("d2", c_ushort), ("d3", c_ushort), ("d4", c_ubyte * 8)]


def guid(s):
    p = s.strip("{}").split("-")
    g = GUID()
    g.d1, g.d2, g.d3 = int(p[0], 16), int(p[1], 16), int(p[2], 16)
    tail = (p[3] + p[4]).rjust(16, "0")
    for i in range(8):
        g.d4[i] = int(tail[2 * i:2 * i + 2], 16)
    return g


CLSID_ShellLink = guid("00021401-0000-0000-C000-000000000046")
IID_IShellLinkW = guid("000214F9-0000-0000-C000-000000000046")
IID_IPersistFile = guid("0000010B-0000-0000-C000-000000000046")
CLSCTX_INPROC_SERVER = 1

ole32 = ctypes.WinDLL("ole32")
ole32.CoInitializeEx(None, 2)

psl = c_void_p()
hr = ole32.CoCreateInstance(byref(CLSID_ShellLink), None, CLSCTX_INPROC_SERVER,
                            byref(IID_IShellLinkW), byref(psl))
if hr != 0:
    sys.exit("CoCreateInstance failed 0x%08X" % (hr & 0xFFFFFFFF))


def method(obj, index, restype, *argtypes):
    vtbl = ctypes.cast(obj, POINTER(c_void_p)).contents.value
    addr = ctypes.cast(c_void_p(vtbl + index * ctypes.sizeof(c_void_p)),
                       POINTER(c_void_p)).contents.value
    return ctypes.WINFUNCTYPE(restype, c_void_p, *argtypes)(addr)


def chk(hr, what):
    if hr != 0:
        sys.exit("%s failed 0x%08X" % (what, hr & 0xFFFFFFFF))


# IShellLinkW 槽位：3 GetPath … 7 SetDescription … 9 SetWorkingDirectory …
# 15 SetShowCmd … 17 SetIconLocation … 20 SetPath
chk(method(psl, 20, ctypes.HRESULT, c_wchar_p)(psl, TARGET), "SetPath")
chk(method(psl, 9, ctypes.HRESULT, c_wchar_p)(psl, PROJECT), "SetWorkingDirectory")
chk(method(psl, 17, ctypes.HRESULT, c_wchar_p, c_int)(psl, ICON, 0), "SetIconLocation")
chk(method(psl, 7, ctypes.HRESULT, c_wchar_p)(psl, "课中签到 · 双击进入，投影点名"), "SetDescription")
chk(method(psl, 15, ctypes.HRESULT, c_int)(psl, 1), "SetShowCmd")

ppf = c_void_p()
chk(method(psl, 0, ctypes.HRESULT, POINTER(GUID), POINTER(c_void_p))(
    psl, byref(IID_IPersistFile), byref(ppf)), "QueryInterface")
chk(method(ppf, 6, ctypes.HRESULT, c_wchar_p, c_int)(
    ppf, os.path.join(DESK, LNK_NAME), 1), "Save")
print("OK:", os.path.join(DESK, LNK_NAME))
