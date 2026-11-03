# ClassFlow · 一堂课

面向教师的本机教学工作台，串联课前备课、课堂签到与答题、课后作业批改、问卷反馈和教学数据分析。一个 Node.js 服务提供教师网页与学生填写入口，教学数据和文件默认保存在老师电脑上。

基础管理功能不依赖模型。PPT、教案、问卷初版和自动批改通过本机已登录的 CodeBuddy CLI / WorkBuddy 工具链完成。**模型调用和在线配图需要网络，相关资料可能交给模型服务处理，并产生账号费用。**

## 功能与入口

| 模块 | 当前能力 | 教师入口 |
| --- | --- | --- |
| 工作台 | 课程概览、待办、最近课堂与常用功能 | `/` |
| 数据看板 | 课程/学期/日期筛选，课堂、作业、问卷和备课统计，跳转待办 | `/dashboard` |
| 课程管理 | 创建与维护课程，粘贴或上传名单，课程概要与删除保护 | `/courses` |
| PPT管理 | 课件卡片、逐页大纲、HTML课件预览和修改、逐页讲稿、历史版本、可编辑PPTX导出；模板库与代表布局确认 | `/preparation?type=ppt` |
| 教案制作 | 基本要求、内置/上传DOCX模板、参考资料、AI生成、逐节编辑、课时校验与Word版本导出 | `/preparation?type=plan` |
| 签到管理 | 动态二维码/课堂码、答题即签到、迟到补签、实时名单、签到记录与出勤导出 | `/session` |
| 学情分析 | 规则预警、个体画像、课堂练习与作业分析 | `/xueqing?tab=warn` |
| 问卷管理 | 匿名/实名，手工或AI初版，教师审阅后发布，扫码回收，柱状图/环形图、答卷表格与CSV导出 | `/questionnaires` |
| 作业管理 | 创建作业、成绩维护、未交/补交、文件批改启用与分析关联 | `/homework` |
| 自动批改 | 先选课程再选作业，评分标准、文件匹配、自动调用或手工交接、原文复核与成绩归档 | `/grading` |
| 工具与设置 | CLI连接、模型/超时配置、签到与预警规则 | `/workbuddy`、`/admin?pane=set` |
| 数据与备份 | 容量概况、完整备份、下载、上传检查与安全恢复 | `/backup` |

以上是正式服务入口。`prototype/`为独立交互原型，不是教师日常入口。旧`/xueqing?tab=dash`兼容跳转至全平台数据看板。

## 快速启动

### 交给Agent自动安装与配置

将下面整段复制给能在本机读写文件、执行命令的Agent（如WorkBuddy或编码助手）。无需先填写路径；Agent会优先使用当前项目，自动完成可执行步骤，账号登录、Office安装等需要本人参与的事项会单独提示。

```text
请帮我在这台电脑上安装、配置并启动 ClassFlow · 一堂课，实际执行操作，
不要只给安装教程。项目仓库：https://github.com/Caspainnn/class-flow.git

目标：先让基础平台可用，再尽可能配置本机AI工具链。完成可独立执行的工作后，
一次性告诉我仍需本人处理的事项；不要因缺少AI账号或Office就停止基础平台安装。

1. 定位项目，保留已有工作
   - 检查当前目录和已有项目；若已是ClassFlow，直接复用，先阅读AGENTS.md和README。
   - 若尚未下载，在非C盘、当前用户可写的位置克隆仓库，例如D:\ClassFlow；
     使用这台电脑实际可用的盘符。没有合适位置时再让我选择，不擅自放到C盘。
   - 已有目录非空时不得覆盖。已有data、备份、配置和未提交代码必须保留；
     不运行reset --hard、clean或强制拉取，不用演示数据覆盖真实数据。

2. 检查和安装基础环境
   - 检查Node.js、npm和Git；Node至少20。缺少时从官方渠道安装兼容版本，
     在安装前核对来源；需要管理员授权或安装器交互时清楚提示我。
   - 在项目server目录运行npm ci，使用锁文件，不随意升级依赖或更改全局npm镜像。
   - 不要求我手工安装数据库，也不要求重新构建已附带的前端资源。

3. 启动并验证基础平台
   - 先检查3000端口及其所属进程。如果已经是这个项目的服务，验证并复用；
     不结束不明进程，不在正在签到、回收问卷或生成课件时重启服务。
   - 端口可用时启动server/server.js。确需其他端口时，统一调整启动方式、
     学生链接与快捷入口，不能仍用固定3000的旧启动脚本。
   - Windows后台启动使用隐藏窗口，并把日志留在本机被忽略的目录。
   - 验证/api/ping和工作台、课程、签到、PPT、教案、作业、批改、问卷、
     数据看板、备份页面的HTTP响应；打开教师本机地址供我使用。
   - 新安装有默认演示名单，明确告诉我在哪里替换，不把它当作我的真实学生。

4. 配置学生访问地址
   - 检查实际局域网IP与多网卡情况，按README配置HOST、PORT和必要的PUBLIC_ORIGIN；
     注意程序不自动加载.env。教师端仍使用127.0.0.1或localhost。
   - 不开放公网端口、不关闭防火墙；如需放行，只说明实际端口与课堂专用网络范围。
   - 本机检查通过后，给我学生访问地址和手机同网测试方法。
     没有实际手机访问证据时，不宣称局域网验收通过。

5. 配置CodeBuddy / WorkBuddy
   - 优先查找现有CLI及登录状态，可用tools/connect-workbuddy.js --list列出候选。
   - 没有可用CLI时，核对官方来源并安装README中有联调记录的独立CodeBuddy CLI；
     不修改WorkBuddy应用文件，不读取或复制其他账号的令牌，不伪造登录。
   - 账号登录由我本人完成。连接配置保留其他已有设置，使用本机实际路径，
     自定义DATA_DIR时不能把配置写错到默认data目录。
   - 允许一次只要求回复“OK”的最小模型连通验证，可能消耗少量账号额度；
     未经我进一步要求，不批量调用模型、不自动生成真实课件、不购买套餐。
   - 无法连接时保留已启动的平台，说明原因及待完成配置，不伪装连接成功。

6. 配置PPT附加工具
   - 按README列出的固定提交安装PPT Master，保留许可证。
     若下载完整仓库，正确定位skills/ppt-master，确保配置指向含SKILL.md的目录。
   - 在项目非C盘目录建立独立Python环境，依照该提交的实际依赖说明安装；
     不修改系统Python环境，不复制开发者电脑上的虚拟环境或绝对路径。
   - 写入或合并本机PPT配置，使用实际skillPath、pythonPath及固定revision，
     timeoutMs=7200000、allowShell=false；不得为绕过错误打开全权限模式。
   - 检查Microsoft PowerPoint是否可用。未安装时列为待办，不安装破解软件，
     不把布局示意当作原PPT截图；有授权安装或人工操作需求时再提示我。
   - 本步骤只核对环境与配置，不以长时间真实出片作为安装成功的前提。

7. 交付结果
   - 完成必要静态检查与隔离验证；只使用临时虚构数据，不向真实教学库灌测试记录。
   - 在Windows上准备可重复启动的入口或快捷方式，确保项目路径、端口正确，
     不依赖Agent会话存活；不要声称旧版发行包已包含当前完整平台。
   - 最后告诉我：项目位置、启动/停止方法、教师地址、学生地址、日志位置、
     基础平台验证结果、AI/PPT工具配置结果，以及仍需本人登录或安装的事项。
   - 不上传教学数据、备份、登录凭据或截图，不把本机路径与密钥写入公开Git仓库。
```

### 手动启动

建议使用 **Node.js 20或更高版本**、npm与现代浏览器；当前开发验证使用Node.js 20。完整的PPT模板原页渲染依赖Windows和Microsoft PowerPoint，见下文。没有模型账号也能先启动基础管理功能。

```bash
git clone https://github.com/Caspainnn/class-flow.git
cd class-flow/server
npm ci
npm start
```

老师在本机打开 **http://127.0.0.1:3000/**。安装依赖需要网络；运行时上传组件、图标和脚本由本机提供，无需CDN。

Windows安装好Node与依赖后，也可双击根目录的`课中签到.bat`，名称沿用早期版本。关闭浏览器不会停止后台服务。前台运行用`Ctrl+C`停止；双击启动可使用`停止课中签到.bat`。升级或停止前，先结束正在进行的签到、批改和制作任务。

首次启动会创建演示课程与示例名单，请在“课程管理”核对并替换，不能作为真实教学记录。问卷、PPT、教案的原型样例不会自动迁入正式教学库。

### 课堂网络

- 教师管理页面仅在老师电脑本机访问，使用`127.0.0.1`或`localhost`。
- 学生通过签到二维码、课堂码或已发布问卷链接填写，不使用教师管理地址。
- 学生与老师需要处于可互通的网络；校园访客Wi-Fi隔离、多网卡、VPN或防火墙都可能影响连接。保持电脑和服务运行，先用一台手机测试。
- 项目面向本机与课堂局域网，尚非带多租户登录的云平台，不要将默认服务直接暴露到公网。

### 可选环境配置

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | 服务端口 |
| `HOST` | `0.0.0.0` | 监听地址；设为`127.0.0.1`时手机无法访问 |
| `DATA_DIR` | 项目根目录下`data/` | 教学数据目录，建议使用可写的绝对路径 |
| `PUBLIC_ORIGIN` | 按监听配置及局域网IP推导 | 学生链接的完整地址，多网卡时可手动指定 |

例如在项目根目录用PowerShell运行：

```powershell
$env:PORT = '3000'
$env:HOST = '0.0.0.0'
$env:PUBLIC_ORIGIN = 'http://192.168.1.100:3000' # 替换为老师电脑实际IP
node server/server.js
```

程序不自动加载`.env`。双击启动脚本固定使用3000，自定义端口请用命令行。请放在非C盘、当前用户可写的目录，例如`D:\ClassFlow`；不要放在系统目录或多人同时同步修改的网盘中。

## AI制作与批改

### 连接本机工具

1. 安装可用的CodeBuddy CLI，由本人完成账号登录。现有联调曾使用独立CLI `2.173.0`，不要假定每台机器的WorkBuddy内置CLI都可用。
2. 在“WorkBuddy”设置页配置实际入口路径、模型和超时，检测连接。检测与真实任务可能消耗额度；桌面WorkBuddy和独立CLI是否共享额度，需向服务方确认。
3. 在具体模块发起任务并审阅结果。问卷初版不会自动发布给学生。

辅助探测脚本：

```bash
node tools/connect-workbuddy.js --list
node tools/connect-workbuddy.js --path "实际CLI入口路径"
```

`--list`只列候选，连接检测会发送模型请求。该辅助脚本使用项目默认`data/settings.json`，使用自定义`DATA_DIR`时请在平台设置页配置。

### PPT附加依赖与流程

- **PPT Master skill**：已验证来源为[hugohe3/ppt-master](https://github.com/hugohe3/ppt-master/tree/5832c3a8ca77e22284198407f0a7e4485ada9688/skills/ppt-master)，固定提交`5832c3a8ca77e22284198407f0a7e4485ada9688`。需另行安装技能目录、保留许可，并按该版本说明准备Python依赖；本仓库不包含skill副本、Python环境或账号凭据。
- 配置读取`data/settings.json`中的`ppt`，未设置时兼容读取项目下`.local-ppt-skills/config.json`。路径应使用本机绝对路径。
- 原生模板页面截图依赖**Windows、Microsoft PowerPoint与PowerShell COM**。缺少组件时不能获得该路径的真实模板视觉参考，结构示意不能替代原页截图。
- 平台“导出可编辑PPT”使用本机固定程序，读取已确认HTML，不调用模型。需要本机 Chrome 或 Edge、Python 的 `python-pptx` 与 `Pillow`；读取 `ppt.pythonPath`，浏览器自动查找，亦可配置 `ppt.browserPath`。普通文字和常规图形可编辑，复杂SVG图示暂作为图片保留。手动交接流程仍可在外部制作和导回文件。
- PPT任务默认最长两小时，可配置缩短，不能超过两小时。默认不启用更宽的Shell权限，任务目录不是操作系统沙箱。

PPT专用配置示例（替换路径，不包含账号信息）：

```json
{
  "name": "PPT Master",
  "skillPath": "D:/ClassFlow/.local-ppt-skills/ppt-master",
  "pythonPath": "D:/ClassFlow/.local-ppt-python/Scripts/python.exe",
  "revision": "5832c3a8ca77e22284198407f0a7e4485ada9688",
  "timeoutMs": 7200000,
  "allowShell": false
}
```

PPT按“填写要求 → 选择方式 → 生成大纲 → 生成PPT”操作。大纲按页组织，教师确认后逐页制作HTML课件；检查和修改后通过按钮导出可编辑PPTX。封面使用填写的授课人、时间，逐页讲稿供教师查看。HTML与PPTX是不同产物，导出后需核对字体、布局与可编辑性。

上传模板先拆解、推荐代表布局，由教师确认保留，也可从原PPT补选。在线配图按大纲意图检索Commons素材，整套最多一张外部照片或插画，需联网并核对素材及来源。取消、失败或服务重启会保留要求与已有版本，但不保证模型任务可从中断处自动续跑。

### 教案与问卷

教案使用DOCX模板和结构化结果生成Word，最长生成两小时。章节草稿与Word版本分开保存；修改章节后需要保存版本，才产生整份新Word。课后实际记录由教师填写，不由模型编造。

问卷支持“填写基本信息 → 选择方式 → 填写需求与生成 → 审阅题目 → 预览发布”，也可手工编写。默认匿名；截止时间默认必填，勾选“不设置截止时间”后由教师手动停止。实名按发布时名单统计未提交；匿名只统计份数，不能识别未提交学生或严格保证一人一份。

## 数据、备份与隐私

```text
data/                         # 运行时生成，不提交到Git
├─ settings.json              # 教学设置与本机工具配置
├─ courses.json / students.json
├─ sessions.json              # 签到和课堂回答
├─ homework.json / gradebatches.json
├─ questionnaires.json        # 问卷与答卷
├─ ppt/                       # 任务、附件、模板、HTML、讲稿与PPTX
├─ lesson-plan/               # 教案、模板、资料与Word版本
├─ questionnaire-ai/          # 问卷生成任务
└─ .secret                    # 本机签名密钥
```

存储使用本机JSON与文件，没有外部数据库。**不要公开上传`data/`、备份、CLI登录凭据、真实名单、学生作业或课堂截图。**交给模型的参考资料应限于允许外发的教学内容。

“数据与备份”打包教学数据与附件，提供逐文件SHA-256校验。备份和恢复事务放在数据目录同级`.inclass-backups-<数据目录名>/`，不会反复打入自身。恢复会整体替换数据并重启，先核对检查结果与安全备份；账号、工具连接和本机密钥不能视为可直接跨机器迁移的配置。容量与边界见[备份交付文档](docs/data-backup/正式交付与验收.md)。

统计依赖实际记录与模块口径，不代表自动判断学习能力。历史签到缺少名单快照时按当前名单计算；匿名问卷、无成绩和明确未交应分别理解。详见[看板统计口径](docs/dashboard/正式交付与验收.md)。

## 项目结构与开发

```text
server/
├─ server.js                  # HTTP入口、课堂签到与公共路由
├─ lib/                       # 存储、课程、作业、成绩与文件工具
├─ public/                    # 工作台、课程、签到、统一外壳及本机组件
├─ grade/                     # 作业管理、自动批改与工具连接
├─ ppt/                       # 逐页制作、模板、配图、版本与交接
├─ lesson-plan/               # 教案生成、编辑与Word版式
├─ questionnaire/             # 问卷、学生填写与AI初版
├─ dashboard/                 # 全平台只读统计
└─ backup/                    # 备份校验、恢复与启动恢复检查
xueqing/                      # 预警、个体画像与练习分析
prototype/                    # 原型，部分示例素材仅本机保留
tools/                        # 隔离测试、构建、预览与历史打包工具
docs/                         # 设计、使用说明及阶段验收记录
```

后端使用Node原生HTTP；主要依赖为ExcelJS、JSZip、QRCode、parse5和saxes。页面以HTML/CSS/JS为主，上传局部挂载Vue和Element Plus。组件预构建资源、固定依赖与许可见[本机上传组件说明](server/public/vendor/README.md)，通常不需重建整个前端。

问卷、看板、备份的正式页面由原型构建脚本生成，修改时同步源文件，避免下次构建覆盖：

```bash
python tools/build-questionnaire-public.py
python tools/build-dashboard-public.py
python tools/build-backup-public.py
```

Python是这些开发构建脚本及部分PPT/打包工具的依赖；基础Node服务不要求先运行上述构建。`tools/`中仍有历史EXE/发行包脚本，完整平台尚未以便携包重新验收，**当前以源码启动说明为准**。

### 验证

常用检查在项目根目录执行，不调用真实模型：

```bash
node tools/check-course-management.js
node tools/check-session-flow.js
node tools/check-grading-context.js
node tools/check-grading-rubric.js
node tools/check-questionnaire-service.cjs
node tools/check-questionnaire-formal-ui.cjs
node tools/check-dashboard-service.cjs
node tools/check-dashboard-ui.cjs
node tools/check-backup-service.cjs
node tools/check-backup-ui.cjs
node tools/check-ppt-service.cjs
node tools/check-lesson-service.cjs
```

另有模块`*-http*`/`*-api*`脚本，使用隔离数据和临时端口，要求允许本机网络、文件写入/重命名与子进程。测试不能指向正式教学库。历史视觉/真实模型脚本可能依赖本机Office、路径和账号，不属于通用检查。`verify-ppt-live.cjs --run-live`与`verify-questionnaire-generation.cjs --real`会消耗真实额度，不纳入普通回归。

遵循[项目约定](AGENTS.md)和[交互反馈规范](docs/ui-feedback-standard.md)：行内校验、明确危险操作确认、保留用户工作，“上一步”统一放在底部左侧，资料上传复用本机Element Plus组件。

## 交付状态

当前源码已集成上述模块，仍持续迭代。原型通过、自测通过、真实模型联调与教师正式验收是不同状态，以各模块最新记录为准。历史文档中的故障、路径及旧参数不是当前部署配置。

- [PPT真实功能与联调记录](docs/ppt-preparation/真实功能验收.md)
- [更新旧课件：原稿保留与模板翻新](docs/ppt-preparation/2026-11-02-更新课件正式集成.md)
- [课件中断后继续制作](docs/ppt-preparation/2026-11-02-课件中断续做.md)
- [本机固定程序导出接入](docs/ppt-preparation/2026-11-03-本机导出接入.md)
- [教案使用与验证](docs/lesson-plan/使用与验证.md)
- [问卷正式交付与验收](docs/questionnaire/正式交付与验收.md)
- [数据看板口径与验收](docs/dashboard/正式交付与验收.md)
- [数据备份与恢复验收](docs/data-backup/正式交付与验收.md)
- [品牌与名称约定](docs/project-brand.md)

本机验收截图和外部教学样例未全部随源码公开，历史文档的对应附件可能不可用。手机局域网连通、Office最终排版、模型生成质量与账号费用，需要在实际部署环境核对。

代码采用[MIT许可证](LICENSE)；组件和外部技能遵循各自许可证。上传的教材、课件、图片与学生材料不因使用本项目而改变版权或隐私归属。
