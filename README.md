# ClassFlow · 一堂课

面向教师的本机教学工作台，串联课前备课、课堂签到与答题、课后作业批改、问卷反馈和教学数据分析。一个 Node.js 服务提供教师网页与学生填写入口，教学数据和文件默认保存在老师电脑上。

基础管理功能不依赖模型。PPT、教案、问卷初版和自动批改通过本机已登录的 CodeBuddy CLI / WorkBuddy 工具链完成。**模型调用和在线配图需要网络，相关资料可能交给模型服务处理，并产生账号费用。**

## 功能与入口

| 模块 | 当前能力 | 教师入口 |
| --- | --- | --- |
| 工作台 | 课程概览、待办、最近课堂与常用功能 | `/` |
| 数据看板 | 课程/学期/日期筛选，课堂、作业、问卷和备课统计，跳转待办 | `/dashboard` |
| 课程管理 | 创建与维护课程，粘贴或上传名单，课程概要与删除保护 | `/courses` |
| PPT管理 | 课件卡片、大纲布局查看与更换、HTML课件预览和修改、逐页讲稿Word下载、检查标记、历史版本、本机可编辑PPTX导出；模板库及可选WorkBuddy布局说明书 | `/preparation?type=ppt` |
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

将下面整段复制给老师电脑上能读写文件、执行命令的Agent（如WorkBuddy或编码助手）。这是“一次粘贴，Agent实际部署”的入口；老师只需完成本人账号登录、安装器授权及手机同网测试。电脑需联网且允许下载依赖。Agent必须以实际检查结果交付，不能把安装完成或保存路径当作AI已连通。适用环境为Windows 10/11；Mac/Linux可运行基础平台，但本文的PowerPoint COM模板截图和Windows导出环境不适用。

```text
请帮我在这台电脑上安装、配置并启动 ClassFlow · 一堂课，实际执行操作，
不要只给安装教程。项目仓库：https://github.com/Caspainnn/class-flow.git

目标：基础平台启动、桌面双击入口及托盘可用、独立CLI实际回复OK、PPT本机转换通过隔离单页验证。
遇到本人登录、安装授权等必须由我处理的步骤时，给出明确入口并等我操作；
其余可独立执行的工作继续完成。缺少账号或Office不能阻止基础平台安装，
但未完成的AI连接/模板截图必须如实标为待办，不能笼统报告“全部部署成功”。

1. 定位项目，保留已有工作
   - 检查当前目录和已有项目；若已是ClassFlow，直接复用，先阅读AGENTS.md和README。
     获取origin/main并记录实际提交号；工作区干净且能快进时才更新，
     有本地改动或分叉时保留并说明差异，不覆盖老师已有版本。
   - 若尚未下载，在非C盘、当前用户可写的位置克隆仓库，例如D:\ClassFlow；
     使用这台电脑实际可用的盘符。没有合适位置时再让我选择，不擅自放到C盘。
   - 已有目录非空时不得覆盖。已有data、备份、配置和未提交代码必须保留；
     不运行reset --hard、clean或强制拉取，不用演示数据覆盖真实数据。

2. 检查和安装基础环境
   - 检查Node.js、npm和Git；Node至少20，新部署优先选择官方仍支持的LTS。
     缺少时从官方渠道安装兼容版本，
     在安装前核对来源；需要管理员授权或安装器交互时清楚提示我。
   - 在项目server目录运行npm ci，使用锁文件，不随意升级依赖或更改全局npm镜像。
   - 不要求我手工安装数据库，也不要求重新构建已附带的前端资源。

3. 启动并验证基础平台
   - 先检查3000端口及其所属进程。如果已经是这个项目的服务，验证并复用；
     不结束不明进程，不在正在签到、回收问卷、批改或生成课件/说明书时重启服务。
   - 端口可用时启动server/server.js。确需其他端口时，统一调整启动方式、
     学生链接与快捷入口，不能仍用固定3000的旧启动脚本。
   - Windows后台启动使用隐藏窗口，并把日志留在本机logs目录。
     启动前仅在子进程环境移除CODEBUDDY_*和NODE_OPTIONS，防止继承Agent运行环境；
     不改系统环境变量、代理、注册表或WorkBuddy程序文件。
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
   - 先运行node tools/connect-workbuddy.js --list（不调用模型），检查候选是否存在。
     优先复用已有已验证的独立CLI；桌面WorkBuddy已登录不代表独立CLI已登录。
   - 没有可用入口时，按README“独立CLI安装与登录”在项目.local-codebuddy-cli
     安装官方包@tencent-ai/codebuddy-code@2.173.0；不安装来源不明的同名包。
     该版本是项目已联调版本，不声称它是最新版；若官方源不可用，报告实际错误，
     不擅自换包、换镜像或改WorkBuddy内置程序。
   - 运行该CLI的交互入口，由我本人选择对应站点并在浏览器授权。
     不读取或复制其他账号令牌，不把开发者电脑的登录目录拷过来，不伪造登录。
     登录完成后继续执行下一项，而不是停在“请自行配置”。
   - 与服务使用同一个绝对DATA_DIR，在项目根目录执行：
     node tools/connect-workbuddy.js --path "本机实际CLI入口" --timeout 45000
     显式指定一个入口，只检测一次；脚本保留其他设置并使用--port 0避开端口冲突。
   - 允许一次只要求回复“OK”的最小模型连通验证，可能消耗少量账号额度；
     未经我进一步要求，不批量调用模型、不自动生成真实课件、不购买套餐。
     必须同时确认退出码0、脚本报告连通、GET /api/gb/settings中enabled=true、
     verifiedAt已更新、lastError为空，并刷新/workbuddy核对实际入口。
     不再额外点击一次“重新检测”消耗第二次额度；失败时先查原因，等我同意后再重试。
   - 无法连接时保留已启动的平台，说明原因及待完成配置，不伪装连接成功。

6. 配置PPT附加工具
   - 按README列出的固定提交安装PPT Master，保留许可证。
     若下载完整仓库，正确定位skills/ppt-master，确保配置指向含SKILL.md的目录。
   - 在项目.local-ppt-python建立独立Python虚拟环境，依照该提交的实际依赖说明安装；
     不修改系统Python环境，不复制开发者电脑上的虚拟环境或绝对路径。
     本机固定导出必须安装python-pptx和Pillow；不能只创建空虚拟环境就算完成。
   - 检查本机Chrome或Edge，若不是默认安装位置则显式写入ppt.browserPath。
   - 写入或合并本机PPT配置，使用实际skillPath、pythonPath及固定revision，
     timeoutMs=7200000、allowShell=false；不得为绕过错误打开全权限模式。
   - 检查Microsoft PowerPoint是否可用。未安装时列为待办，不安装破解软件，
     不把布局示意当作原PPT截图；有授权安装或人工操作需求时再提示我。
   - 用配置中的Python实际执行import pptx和import PIL，检查浏览器文件与SKILL.md存在，
     GET /api/ppt/connection核对ready和exportReady，然后运行README的隔离单页转换。
     必须得到真实PPTX并验证原生文字，不能只凭exportReady=true宣称可导出。
     不调用真实模型生成长课件，不读取真实教学任务作为测试样例。

7. 交付结果
   - 完成必要静态检查与隔离验证；只使用临时虚构数据，不向真实教学库灌测试记录。
   - Windows必须实际配置桌面双击入口，不得只建议我自行创建快捷方式。
     在项目根目录运行（使用本机实际端口、绝对数据目录）：
     powershell -NoProfile -ExecutionPolicy Bypass -File tools/setup-desktop.ps1 -Port 3000 -DataDirectory "D:\ClassFlow\data" -Open
     上面的D:\ClassFlow只是示例，必须替换为实际项目位置，不可照抄开发者电脑路径。
     脚本自动使用Windows自带.NET Framework编译器构建“一堂课.exe”、
     创建当前用户桌面“一堂课”快捷方式，持久保留该快捷入口的PORT、DATA_DIR、HOST；
     自定义局域网地址时追加-HostAddress和-PublicOrigin，与服务及学生地址保持一致。
     不要求老师安装Python/PyInstaller来启动基础平台，不依赖Agent会话继续存活。
   - 旧启动器正在运行且需要编译更新时，先核对所有后台任务均已结束，
     再从托盘安全退出并重新运行脚本；禁止直接杀死不明PID或中断教学任务。
     当前旧服务无桌面接口时，不把/api/ping正常当成完成双击配置。
   - 实际验证/api/desktop/status返回app=inclass且对应本项目；
     打开桌面快捷方式，确认日志logs/launcher.log出现ready和browser opened；
     再次打开快捷方式，确认仍是同一服务PID并再次请求打开浏览器。
     仅exe文件存在、端口占用、HTTP正常或进程启动，均不能代替双击验收。
     如无法观察浏览器或托盘，明确记为界面待本人确认，不伪报已验证。
   - 告诉我关闭网页不停止后台任务；退出使用托盘“退出一堂课”，
     由服务端校验本机身份与密钥，存在教学、模板分析或备份任务时拒绝退出。
     不要声称旧版发行包已包含当前完整平台。
   - 最后告诉我：项目位置、启动/停止方法、教师地址、学生地址、日志位置、
     当前main提交号、桌面快捷方式位置与双击复用验证、基础页面HTTP结果、CLI最小请求结果、单页PPTX转换结果、
     模板截图能力、仍需本人登录或安装的事项。分别列通过/失败/未验证及原因。
   - 不上传教学数据、备份、登录凭据或截图，不把本机路径与密钥写入公开Git仓库。
```

### 交给Agent自动检查与更新

已经安装过的电脑使用这一段，首次部署使用上面的“安装与配置”。以后可直接告诉Agent：**“读取本项目README的‘交给Agent自动检查与更新’，按其中的提示词执行。”** 这段提示词授权Agent完成正常的检查、隔离验证、安全更新和桌面入口维护；遇到教学任务进行中、代码冲突或会覆盖数据的回退，仍须保留当前工作并说明阻塞原因。

```text
请按本项目README执行一次ClassFlow · 一堂课的安全更新，实际完成操作，
不要只给更新教程。官方仓库：https://github.com/Caspainnn/class-flow.git
默认更新到检查时获取的origin/main提交；若我指定版本，使用我指定的版本。
不要重新安装整个项目，不把首次部署流程全部重跑一遍。

1. 盘点当前安装与运行状态
   - 阅读当前AGENTS.md、README及与本轮变更相关的文档；定位实际项目根目录，
     核对origin地址、当前分支/提交、git status，记录更新前提交号。
   - 查明当前PORT、HOST、绝对DATA_DIR、PUBLIC_ORIGIN、桌面快捷方式目标及参数、
     托盘程序和服务PID、日志位置。使用实际运行配置，不假设一定是3000或项目data目录。
     程序不自动加载.env；快捷方式可能通过tools/open-desktop.ps1持久传入环境。
   - 仅记录必要配置及文件位置，不展示、上传或写入Git账号令牌、密钥、学生数据。
     保留现有data、备份、settings.json、CLI登录、模型/PPT路径和老师已修改的文件。

2. 获取目标版本，先判断能否更新
   - 核对远端后fetch main，固定并记录本次目标SHA，比较当前版本与目标版本的变更。
     若已是目标版本，只补必要健康与桌面入口检查，说明无需更新。
   - 本地部署分支可快进时才使用git merge --ff-only等安全方式推进。
     无关本地改动也要保留并先在本机留存补丁及必要文件副本；不要自动提交或上传它们。
     修改与远端冲突、历史分叉或分支用途不明时，不能自行reset、clean、强推、
     覆盖或丢弃改动；保留运行版本，完成可独立进行的目标检查后说明待解决问题。
     不把仅fetch成功说成项目已更新。

3. 在隔离目录检查目标，安排与改动匹配的验证
   - 优先在独立临时目录检出/展开目标代码，使用临时端口和虚构DATA_DIR验证，
     不在正式服务运行时执行npm ci、替换依赖、覆盖代码或重新编译在用EXE。
   - 阅读目标提交的README、依赖锁文件与迁移说明，确定本次涉及的模块和人工依赖。
     依赖变化时在隔离目录按锁文件安装；不要自行升级库、全局环境或更换npm镜像。
   - 执行与改动相关的静态检查和已有隔离测试。测试脚本可能创建文件、启动服务或
     调用真实模型，先读说明和入口，再决定运行；不盲跑所有脚本、不做真实教学写操作。
     不为普通更新重新探测所有模型，不消耗账号额度、不生成真实课件；确需真实模型
     或Office交互验证时先说明并获得相应授权。未验证的能力明确列出。
   - 目标验证失败时先修复可安全解决的环境问题；仍失败则保留当前可用版本，
     给出错误、日志位置和下一步，不继续替换正式环境。

4. 确认空闲，备份后再切换
   - 通过实际端口的/api/desktop/status、/api/backup/status及必要业务状态，
     检查签到、作业批改、问卷回收、PPT/模板说明书/教案/问卷生成、备份及恢复。
     有任务时继续做只读与隔离检查；不要自动取消、结束或强制中断任务。
     只有全部空闲后才能切换；等待过长时告诉我哪些任务需先在平台结束。
   - 依照本项目备份功能创建本机完整备份并等待完成，核对成功状态与备份记录。
     服务原本未运行时先按现有备份规范保留数据和配置，不得启动演示环境覆盖原数据。
     同时保留更新前代码提交、必要本地补丁、启动器及启动参数，便于回退。
   - 优先从托盘安全退出。使用/api/desktop/stop时按现有接口在本机读取退出密钥，
     不输出密钥，尊重服务端拒绝退出；不得用强杀绕过任务保护。
     确认服务已退出后，如旧托盘仍持有EXE，只能处理已核实路径及PID的本项目托盘。
     旧版本没有桌面接口时，先核对数据目录、进程命令及全部后台状态，再安排安全停止，
     不仅凭“端口上有node”判断归属；无法确认则保留服务并说明原因。

5. 应用更新，保留配置，维护双击入口
   - 将正式代码安全推进到已验证的目标SHA；依赖锁文件变化时，在服务停止后运行
     server目录的npm ci。没有变化且依赖完整时不重复安装。
   - 不覆盖本机配置、登录、数据及备份；配置结构有变化时按目标迁移说明处理，
     只合并必需项，不照抄开发者路径或把已配置模型/解释器重置成默认值。
   - 使用更新前记录的实际参数，运行tools/setup-desktop.ps1并带-Open，
     自动构建需要更新的EXE、创建/更新桌面“一堂课”入口并打开平台。例如：
     powershell -NoProfile -ExecutionPolicy Bypass -File tools/setup-desktop.ps1 -Port 3000 -DataDirectory "D:\ClassFlow\data" -Open
     路径、端口必须替换为这台电脑的值；原来指定HOST/PUBLIC_ORIGIN时也传入
     -HostAddress/-PublicOrigin。不能丢失已有自定义参数或覆盖其他项目的快捷方式。
     EXE仍被占用时先排查已确认的旧托盘，不反复编译或删除程序文件。

6. 验证实际运行，再交付
   - 核对正式代码HEAD等于目标SHA，服务身份/数据目录/端口正确，/api/ping正常；
     检查本轮涉及的实际模块页面、脚本资源与只读接口，不仅检查外层工作区返回200。
     确认原有课程和记录仍能读取，不输出学生明细，不把测试数据写入正式库。
   - 查看本次启动之后的logs/launcher.log，确认新出现ready与browser opened；
     再次打开桌面快捷方式，确认同一服务PID被复用且再次请求打开浏览器。
     检查日志无本轮新错误。无法实际观察浏览器、托盘或手机访问时注明未验证，
     不把历史日志、文件存在或进程启动当作这次双击验收。
   - 更新后出现故障，先保留错误证据、失败版本和当前数据，暂停新的教学写入。
     仅在数据格式兼容且确认切换后没有新写入时，才安全回退代码/依赖/启动器；
     涉及数据迁移、恢复备份或覆盖更新后数据时，说明影响并等待我明确确认。
     不自动恢复旧备份抹掉新数据，不宣称已有备份就一定能无损降级。
   - 最后给出更新前/目标/实际运行提交号、变更摘要、备份位置、保留的本地改动、
     验证结果、桌面入口、教师/学生地址，以及失败或待我操作的事项。
     若未切换或已回退，清楚说明当前实际运行版本。除非我明确要求，不自动提交、
     推送本地修补到GitHub，也不上传任何教学数据、日志、密钥或账号配置。
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

Windows 推荐双击根目录的 `一堂课.exe`（本机已创建桌面快捷方式）。启动器隐藏启动后台服务，就绪后打开浏览器；重复双击复用服务。关闭网页不停止后台任务。右键系统托盘的“一堂课”可打开平台、日志目录或安全退出；有签到、批改、问卷回收、课件/模板分析、教案或备份恢复任务时禁止退出。原 `课中签到.bat`、`停止课中签到.bat` 保留为兼容入口，均转交新启动器。源码用户首次运行 `tools/build.bat` 生成 EXE；发行包自带 Node，基础功能无需另装 Node/Python。详见[桌面启动器](docs/desktop-launcher.md)。

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

程序不自动加载`.env`。启动器默认使用3000端口，可通过启动环境的 `PORT` 和 `DATA_DIR` 指定端口及数据目录。请放在非C盘、当前用户可写的目录，例如`D:\ClassFlow`；不要放在系统目录或多人同时同步修改的网盘中。

## AI制作与批改

### 连接本机工具

1. 安装可用的CodeBuddy CLI，由本人完成账号登录。现有联调使用独立CLI `2.173.0`，不要假定每台机器的WorkBuddy内置CLI都可用。
2. 在“WorkBuddy”设置页配置实际入口路径、模型和超时，检测连接。检测与真实任务可能消耗额度；桌面WorkBuddy和独立CLI是否共享额度，需向服务方确认。
3. 在具体模块发起任务并审阅结果。问卷初版不会自动发布给学生。

#### 独立CLI安装与登录（Agent可执行）

从[CodeBuddy官方安装文档](https://www.codebuddy.cn/docs/cli/installation)核对包来源，按[官方快速开始](https://www.codebuddy.cn/docs/cli/quickstart)由本人授权。以下在项目根目录的PowerShell中执行，安装到Git忽略的本机目录，不改全局安装或WorkBuddy应用：

```powershell
npm.cmd install --prefix .local-codebuddy-cli --no-audit --no-fund --ignore-scripts @tencent-ai/codebuddy-code@2.173.0
node .local-codebuddy-cli/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy --version
node .local-codebuddy-cli/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy --port 0
```

第三条是交互登录入口，需老师本人完成对应站点的浏览器授权，随后退出交互CLI回到终端。版本号仅为本项目联调依据；安装或登录失败时保留基础平台，不自动升级或循环请求。若Agent正在WorkBuddy中运行，CLI进程需要干净的子进程环境：移除其继承的`CODEBUDDY_*`和`NODE_OPTIONS`，不要改系统持久设置。连接脚本和平台检测已自动清理这些子进程变量，并使用随机端口`--port 0`。

登录后做一次最小连接验证：

```bash
node tools/connect-workbuddy.js --list
node tools/connect-workbuddy.js --path ".local-codebuddy-cli/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy" --timeout 45000
```

`--list`只列候选，不调用模型、不改配置。显式`--path`只检测该入口；不指定时可能逐个检测多个候选。检测会发送一次只需回复`OK`的模型请求并消耗额度；成功要求CLI正常退出且实际输出为`OK`，不以路径存在或提示词回显判定。成功后合并保存`workbuddy`配置，保留模型、超时、PPT及其他设置；失败时不报告连通。无需为连接配置重启服务。

脚本与服务都读取`DATA_DIR`，默认是项目`data/`。自定义时必须在两者的启动环境中设为同一个绝对路径。配置保存在这个目录的`settings.json`；不要同时运行多个配置写入操作。可用`GET /api/gb/settings`核对`enabled`、`path`、`verifiedAt`和`lastError`，无需重复发送模型请求。`/workbuddy`中的绿色连接状态是最近一次探测结果，账号过期、额度或网络变化仍可能使后续任务失败。

### PPT附加依赖与流程

- **PPT Master skill**：已验证来源为[hugohe3/ppt-master](https://github.com/hugohe3/ppt-master/tree/5832c3a8ca77e22284198407f0a7e4485ada9688/skills/ppt-master)，固定提交`5832c3a8ca77e22284198407f0a7e4485ada9688`。需另行安装技能目录、保留许可，并按该版本说明准备Python依赖；本仓库不包含skill副本、Python环境或账号凭据。首次安装可将完整仓库克隆到`.local-ppt-skills/ppt-master-repo`并检出该提交，此时真正的`skillPath`是该目录下的`skills/ppt-master`，不是仓库根目录。已有目录不得覆盖或重置。
- 配置读取实际`DATA_DIR/settings.json`中的`ppt`，未设置时兼容读取项目下`.local-ppt-skills/config.json`。路径应使用本机绝对路径；不要覆盖文件中其他设置。
- 原生模板页面截图依赖**Windows、Microsoft PowerPoint与PowerShell COM**。缺少组件时不能获得该路径的真实模板视觉参考，结构示意不能替代原页截图。
- 平台“导出可编辑PPT”使用本机固定程序，读取已确认HTML，不调用模型。需要本机 Chrome 或 Edge、Python 的 `python-pptx` 与 `Pillow`；读取 `ppt.pythonPath`，浏览器自动查找，亦可配置 `ppt.browserPath`。普通文字和常规图形可编辑，复杂SVG图示暂作为图片保留。手动交接流程仍可在外部制作和导回文件。
- PPT任务默认最长两小时，可配置缩短，不能超过两小时。默认不启用更宽的Shell权限，任务目录不是操作系统沙箱。

首次配置的命令示例（项目根目录PowerShell；Git目标目录必须尚不存在；`py -3.12`需替换为本机已安装、可安装这些依赖的真实Python入口，本机已验证Python 3.12）：

```powershell
git clone --no-checkout https://github.com/hugohe3/ppt-master.git .local-ppt-skills/ppt-master-repo
git -C .local-ppt-skills/ppt-master-repo checkout --detach 5832c3a8ca77e22284198407f0a7e4485ada9688
py -3.12 -m venv .local-ppt-python
& .local-ppt-python/Scripts/python.exe -m pip install -r .local-ppt-skills/ppt-master-repo/skills/ppt-master/requirements.txt
& .local-ppt-python/Scripts/python.exe -m pip install python-pptx Pillow
```

Python未安装时由Agent核对官方来源并安装，安装器授权交给老师；不得使用指向Microsoft Store的空命令当作已安装解释器。技能配置完成后检查`SKILL.md`与`LICENSE`确实存在，按该版本技能要求检查环境，不能为通过校验修改其归属或完整性文件。

PPT专用配置示例（合并到`settings.json`的`ppt`字段，或作为兼容文件`.local-ppt-skills/config.json`的完整内容；替换为本机实际路径，不包含账号信息）：

```json
{
  "name": "PPT Master",
  "skillPath": "D:/ClassFlow/.local-ppt-skills/ppt-master-repo/skills/ppt-master",
  "pythonPath": "D:/ClassFlow/.local-ppt-python/Scripts/python.exe",
  "revision": "5832c3a8ca77e22284198407f0a7e4485ada9688",
  "timeoutMs": 7200000,
  "allowShell": false
}
```

PPT按“填写要求 → 选择方式 → 生成大纲 → 生成PPT”操作。大纲按页组织，右侧展示当前模板的布局缩略图，支持查看、更换布局和定位编辑；编辑中的布局选择随大纲一起保存，教师确认后逐页制作HTML课件。检查和修改后通过按钮导出可编辑PPTX。封面使用填写的授课人、时间，逐页讲稿供教师查看。HTML与PPTX是不同产物，导出后需核对字体、布局与可编辑性。PPT备注默认留空，逐页讲稿独立下载，入口位于PPT下载行下方。

上传模板先拆解、推荐代表布局，由教师确认保留，也可从原PPT补选。“模板文件与信息”默认勾选使用WorkBuddy编写布局说明书，结合原页预览分析用途、估计容量和限制，供新课件大纲参考，会调用模型；取消勾选则仅程序识别。分析失败保留模板，并可在详情中重试。模板真实截图仍需PowerPoint。

在线配图按大纲意图检索Commons素材，整套最多一张外部照片或插画，需联网并核对素材及来源。取消、失败或服务重启会保留要求与已有版本，但不保证模型任务可从中断处自动续跑。

#### 部署完成的最小验证

浏览器应为本机实际的Chrome或Edge。在项目根目录设置真实工具路径，先检查同一个Python环境能导入所需模块，再运行不调用模型的单页检查：

```powershell
$env:PPT_PYTHON = (Resolve-Path '.local-ppt-python/Scripts/python.exe').Path
& $env:PPT_PYTHON -c "import pptx; import PIL; print('PPT dependencies OK')"
# 非默认浏览器位置才需设置：$env:PPT_BROWSER = '本机实际chrome.exe或msedge.exe路径'
node tools/check-ppt-native-export.cjs --geometry
```

成功时输出包含`pages: 1`和实际`pptx`路径的JSON；脚本已校验真实PPTX页数、原生文字、图片比例与图层。产物留在项目`.tmp-native-service-*`隔离目录，不写正式教学库。基础服务另需验证`/api/ping`、`/api/dashboard`、`/api/gb/settings`、`/api/ppt/connection`及正式页面。`ready`只检查CLI/skill配置，`exportReady`只检查浏览器/Python路径；它们不能代替模型回复、Python导入和实际转换。

部署结果应分别记录“基础平台HTTP通过、CLI实际回复通过、PPT本机转换通过、模板截图通过/待验证”。未启动真实PowerPoint渲染时，模板截图只能记为待验证；手机同网和真实教学内容生成仍由老师验收。详细检查与本次发布范围见[部署与发布记录](docs/部署与发布-2026-11-03.md)。

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
- [首尾页布局校验与已有大纲恢复](docs/ppt-preparation/2026-11-03-首尾页布局校验修复.md)
- [大纲布局选择正式集成（真实模板布局、草稿保存与首尾页约束）](docs/ppt-preparation/2026-11-03-大纲布局正式集成.md)
- [模板布局说明书上传选项（默认勾选、程序识别回退与大纲参考）](docs/ppt-preparation/2026-11-03-模板布局说明书选项.md)
- [已验收的大纲布局独立网页原型（保留3000端口下独立路由）](docs/ppt-preparation/2026-11-03-大纲布局独立原型.md)
- [大纲教学目标与内部制作说明分离](docs/ppt-preparation/2026-11-03-大纲教学目标展示修正.md)
- [本机固定程序导出接入](docs/ppt-preparation/2026-11-03-本机导出接入.md)
- [教案使用与验证](docs/lesson-plan/使用与验证.md)
- [问卷正式交付与验收](docs/questionnaire/正式交付与验收.md)
- [数据看板口径与验收](docs/dashboard/正式交付与验收.md)
- [数据备份与恢复验收](docs/data-backup/正式交付与验收.md)
- [品牌与名称约定](docs/project-brand.md)

本机验收截图和外部教学样例未全部随源码公开，历史文档的对应附件可能不可用。手机局域网连通、Office最终排版、模型生成质量与账号费用，需要在实际部署环境核对。

代码采用[MIT许可证](LICENSE)；组件和外部技能遵循各自许可证。上传的教材、课件、图片与学生材料不因使用本项目而改变版权或隐私归属。
