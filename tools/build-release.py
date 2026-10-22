# -*- coding: utf-8 -*-
"""
打一个「解压就能双击」的 Windows 发行包。

产出：dist/class-flow-win64-v<版本>.zip
里面：课中签到.exe + runtime\\node.exe + server\\（含生产依赖）+ 停止脚本 + 使用说明.txt

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
EXE = os.path.join(ROOT, "课中签到.exe")
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
    print("[1/5] 打包 exe …")
    pyinstaller = shutil.which("pyinstaller") or os.path.join(
        os.path.dirname(sys.executable), "pyinstaller.exe")
    if not os.path.isfile(pyinstaller):
        sys.exit("找不到 pyinstaller，先 pip install pyinstaller")
    subprocess.check_call([
        pyinstaller, "--onefile", "--noconsole",
        "--icon", os.path.join(ROOT, "icon.ico"),
        "--name", "课中签到",
        "--distpath", ROOT,
        "--workpath", os.path.join(ROOT, "build"),
        "--specpath", os.path.join(ROOT, "build"),
        "--clean", "--noconfirm",
        os.path.join(ROOT, "tools", "launcher.py"),
    ], stdout=subprocess.DEVNULL)


def ignore(dirname, names):
    return [n for n in names if n in SKIP_NAMES or n in SKIP_FILES]


def readme_text(ver):
    return """课中签到 · 使用说明
=====================

一、第一次启动
1. 把整个文件夹解压到你能记住的位置，例如 D:\\课中签到
   （别放在 C:\\Program Files 下，那里要管理员权限，数据写不进去）
2. 双击「课中签到.exe」
   - 第一次会慢 3~5 秒（杀毒软件在扫描新文件），之后大约 1 秒
   - 会自动弹出浏览器，打开选课页面；没弹出就手动打开 http://127.0.0.1:3000/
   - 这个文件夹已经带了 Node 运行时，不用另外安装任何东西
3. 想要桌面图标：右键「课中签到.exe」→ 发送到 → 桌面快捷方式

二、把演示数据换成你自己的（只需要做一次）
第一次启动会自动生成一门演示课（高等数学（上），47 个假学生）。
1. 浏览器打开 http://127.0.0.1:3000/admin
2. 「课程管理」里改课程名，或新建一门课
3. 录名单，两种方式都行：
   · 粘贴：每行一个人，「学号 姓名」，逗号、分号、空格、Tab 都能识别
   · 上传：xlsx 或 csv，第一列学号、第二列姓名，有表头也能识别
4. 名单录好后回首页，按数字键 1 选这门课

三、上课时怎么用
1. 课前：双击 → 按 1 选课，自动进入出题页
2. 出题：题干打完回车换行，选项打完回车跳下一格，点左边的字母定正确答案，
   Ctrl+Enter 开始点名（Esc 返回选课）
3. 投影：把浏览器窗口拖到投影屏，按 F11 全屏。学生扫二维码答题即签到，
   右栏未签到名单会一个个消失
4. 结束：点「结束本次点名」，投影立刻变成选项分布图，正好拿来讲评
5. 课后：「后台 → 看板」看趋势，点「导出 xlsx」交给教务处

四、常见问题
· 学生扫码打不开
  手机和电脑要连同一个 Wi-Fi；Windows 防火墙第一次会问「是否允许 Node.js
  访问网络」，点允许。投影页二维码下面那行地址就是学生该访问的地址。
· 退出
  双击「停止课中签到.bat」，或点页面里的「退出程序」。关浏览器不等于关服务。
· 数据在哪
  这个文件夹里的 data 目录。整个文件夹拷走就是搬家，名单和历史都在。
· 端口被占用
  说明有另一个程序占了 3000。先把那个程序关掉。

五、包里有什么
课中签到.exe        启动器，双击它就对了
runtime\\node.exe   自带的 Node 运行时，不需要另外安装
server\\            服务端和五张页面（选课 / 出题 / 投影 / 学生 / 后台）
停止课中签到.bat    关闭后台服务
LICENSE             开源协议（MIT）

版本 v%s
源码与问题反馈：https://github.com/Caspainnn/class-flow
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
    if os.path.isdir(stage):
        shutil.rmtree(stage)
    os.makedirs(os.path.join(stage, "runtime"), exist_ok=True)

    print("[3/5] 复制文件 …")
    shutil.copy2(EXE, os.path.join(stage, "课中签到.exe"))
    shutil.copy2(os.path.join(ROOT, "icon.ico"), stage)
    shutil.copy2(os.path.join(ROOT, "LICENSE"), stage)
    shutil.copy2(os.path.join(ROOT, "停止课中签到.bat"), stage)
    shutil.copy2(node, os.path.join(stage, "runtime", "node.exe"))
    shutil.copytree(SERVER, os.path.join(stage, "server"), ignore=ignore)

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
