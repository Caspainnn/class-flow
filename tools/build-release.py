# -*- coding: utf-8 -*-
"""
打一个「解压就能双击」的 Windows 发行包。

产出：dist/class-flow-win64-v<版本>.zip
里面：一堂课.exe + runtime\\node.exe + server\\（含生产依赖）+ 停止脚本 + 使用说明.txt

用法（在项目根目录）：
    python tools\\build-release.py            # 重新打包 exe 再组装
    python tools\\build-release.py --skip-exe # 直接用已有的 exe 组装
    python tools\\build-release.py --node "C:\\path\\node.exe"
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "server")
EXE = os.path.join(ROOT, "一堂课.exe")
STAGE_NAME = "class-flow"
DIST = os.path.join(ROOT, "dist")

# 这些目录/文件不进发行包
SKIP_NAMES = {"data", "logs", "certs", "public_backup", ".git", "__pycache__", ".secret"}
SKIP_FILES = {"legacy-server.js"}


def version():
    with open(os.path.join(SERVER, "package.json"), encoding="utf-8") as f:
        return json.load(f)["version"]


def find_node():
    for d in os.environ.get("PATH", "").split(os.pathsep):
        p = os.path.join(d.strip('"'), "node.exe")
        if os.path.isfile(p):
            return p
    for p in (r"D:\Node\node.exe",
              os.path.expandvars(r"%ProgramFiles%\nodejs\node.exe")):
        if os.path.isfile(p):
            return p
    return None


def build_exe():
    print("[1/5] 编译 Windows 托盘启动器 …")
    subprocess.check_call(["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", os.path.join(ROOT, "tools", "build-launcher.ps1")])


def ignore(dirname, names):
    return [n for n in names if n in SKIP_NAMES or n in SKIP_FILES]


def readme_text(ver):
    return """一堂课 · 使用说明

1. 将整个目录解压到当前用户可写的位置，如 D:\\ClassFlow。双击“一堂课.exe”。
2. 程序在后台启动服务，准备好后自动打开浏览器；右下角托盘有“一堂课”图标。
3. 重复双击复用同一服务。关闭网页不停止签到或制作任务。
4. 右键托盘可打开平台、日志目录或退出。退出需要确认；有教学任务时禁止退出，先在平台结束任务。
5. 基础平台已带 Node，无需安装 Node 或 Python。完整 AI/PPT 能力另需账号、CLI、PPT技能、Python及PowerPoint；未配置时可先使用基础管理功能。
6. 教学数据位于 data 目录，日志在 logs 目录。不要把 exe 单独移出目录，不要在多个软件副本中同时修改同一数据。
7. 学生设备与老师电脑连接同一局域网；学生使用平台生成的二维码/地址。
8. 默认端口3000；可在启动环境设置 PORT、DATA_DIR。端口被其他程序或其他目录的服务占用时，程序会报错并保留它。
9. 软件不自动包含或公开原电脑的教学数据、密钥及账号配置。

版本 %s
""" % ver


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-exe", action="store_true")
    ap.add_argument("--node", default=None)
    args = ap.parse_args()

    ver = version()
    if not args.skip_exe:
        build_exe()
    if not os.path.isfile(EXE):
        sys.exit("没有 exe，先打包：tools\\build.bat")

    node = args.node or find_node()
    if not node or not os.path.isfile(node):
        sys.exit("找不到 node.exe，用 --node 指定路径")
    print("[2/5] 自带运行时:", node)

    stage = os.path.join(DIST, STAGE_NAME)
    if os.path.commonpath([os.path.realpath(stage), os.path.realpath(DIST)]) != os.path.realpath(DIST) or os.path.realpath(stage) == os.path.realpath(DIST):
        sys.exit("发行暂存目录越界，未删除")
    if os.path.isdir(stage):
        shutil.rmtree(stage)
    os.makedirs(os.path.join(stage, "runtime"), exist_ok=True)

    print("[3/5] 复制文件 …")
    shutil.copy2(EXE, os.path.join(stage, "一堂课.exe"))
    shutil.copy2(os.path.join(ROOT, "icon.ico"), stage)
    shutil.copy2(os.path.join(ROOT, "LICENSE"), stage)
    shutil.copy2(os.path.join(ROOT, "退出一堂课.bat"), stage)
    shutil.copy2(node, os.path.join(stage, "runtime", "node.exe"))
    shutil.copytree(SERVER, os.path.join(stage, "server"), ignore=ignore)
    shutil.copytree(os.path.join(ROOT, "xueqing"), os.path.join(stage, "xueqing"), ignore=ignore)

    # 只要生产依赖，清掉 npm 缓存性文件
    nm = os.path.join(stage, "server", "node_modules")
    if not os.path.isdir(nm):
        sys.exit("server\\node_modules 不存在，先在 server 里 npm install --omit=dev")
    for junk in (".package-lock.json", ".cache"):
        p = os.path.join(nm, junk)
        if os.path.isdir(p):
            shutil.rmtree(p, ignore_errors=True)

    with open(os.path.join(stage, "使用说明.txt"), "w",
              encoding="utf-8-sig", newline="\r\n") as f:
        f.write(readme_text(ver))

    print("[4/5] 压缩 …")
    os.makedirs(DIST, exist_ok=True)
    name = "class-flow-win64-v%s.zip" % ver
    out = os.path.join(DIST, name)
    if os.path.isfile(out):
        os.remove(out)
    n = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, dirs, files in os.walk(stage):
            for fn in files:
                full = os.path.join(base, fn)
                rel = os.path.join(STAGE_NAME, os.path.relpath(full, stage))
                z.write(full, rel)
                n += 1

    size = os.path.getsize(out) / 1048576.0
    print("[5/5] 完成")
    print("  文件数 %d，%s，%.1f MB" % (n, name, size))
    print("  路径 %s" % out)
    print()
    print("  上传方式：GitHub 仓库页 → Releases → Draft a new release →")
    print("  标签填 v%s → 把这个 zip 拖进附件区 → Publish release" % ver)


if __name__ == "__main__":
    main()
