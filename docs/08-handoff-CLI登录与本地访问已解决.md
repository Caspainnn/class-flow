# Handoff：CLI 登录、平台连通与本地访问已解决

日期：2026-10-23，Asia/Shanghai。接手者：WorkBuddy。

## 当前结论（优先于 docs/06 和 docs/07 的历史状态）

**已解决独立 CLI 登录、平台命令探测和本地网页访问问题。不要再从“CLI 无限挂死”开始重复排查。**

采用的方案是：**使用官方独立 CodeBuddy CLI 2.173.0，用户完成国内站登录后，平台以明确路径调用它；平台服务以独立 Windows 进程运行，并用 HTTP 响应确认可用。**

这不是修复 WorkBuddy 内置 CLI 2.161.0；内置包仍不可用。独立 CodeBuddy 与 WorkBuddy 的额度是否共享未确认。完整作业批改尚未验收，不能宣布所有业务闭环完成。

## 已落地的状态和证据

| 项目 | 已验证结果 |
| --- | --- |
| 官方 CLI 安装 | 包 `@tencent-ai/codebuddy-code`，实际版本 2.173.0 |
| 用户登录 | 独立 CLI → Chinese Site → 用户浏览器授权完成 |
| 最短无工具请求 | stdout `OK`、stderr 空、exit 0 |
| 平台连接工具 | 输出 `✓ 连通（8803ms）`，exit 0 |
| settings.json | `workbuddy.enabled=true`，version `2.173.0`，lastError `null`，路径存在 |
| 首页 | 本次交接前复查 `http://127.0.0.1:3000/`，HTTP 200 |
| 设置页 | 本次交接前复查 `/workbuddy`，HTTP 200；不等于已经点击“重新检测”验收绿灯 |

当前 CLI 入口：

```text
E:\MyProjects\Inclass\.tmp-codebuddy-cli\node_modules\@tencent-ai\codebuddy-code\bin\codebuddy
```

该目录虽叫 `.tmp-codebuddy-cli`，目前是**在用依赖，禁止当临时垃圾清理**。它被 `.gitignore` 的 `.tmp*` 规则忽略，不会随 Git 分发。新机器需独立安装并由用户登录，不复制当前用户凭据。以后迁移目录时，先保留原目录，再安装到正式位置、更新连接路径并验证。

## 可复用的操作方案

所有命令使用 Windows PowerShell `-NoProfile` 执行，避免本机 profile 中 conda 启动错误。若在智能体沙箱里执行，本地监听和网络探测可能受限，应按宿主权限机制运行，不通过修改防火墙或网络安全配置绕过。

### 1. 清洁子进程环境

在启动服务、登录或探测 CLI 的同一 PowerShell 进程内先执行：

```powershell
Get-ChildItem Env: |
  Where-Object { $_.Name -like 'CODEBUDDY_*' -or $_.Name -eq 'NODE_OPTIONS' } |
  ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
```

只清当前进程环境，不改系统或用户的持久环境变量。无需为此改注册表代理。

### 2. 登录失效时恢复

当前登录已经成功，**不要重复登录或退出账号**。若未来提示认证缺失，在清洁环境中执行：

```powershell
Set-Location 'E:\MyProjects\Inclass\.tmp-codebuddy-cli'
& 'D:\Node\node.exe' '.\node_modules\@tencent-ai\codebuddy-code\bin\codebuddy'
```

选择 Chinese Site，由用户在浏览器完成授权。不要提取 WorkBuddy 桌面凭据，不把 token 写进仓库或交接文档。官方流程参考：[安装](https://www.codebuddy.cn/docs/cli/installation)、[登录](https://www.codebuddy.cn/docs/cli/quickstart)。

原机器目录丢失时，可在项目根目录用以下命令重新安装相同版本；它不改 WorkBuddy 安装目录或全局 PATH：

```powershell
npm.cmd install --prefix .tmp-codebuddy-cli --no-audit --no-fund --ignore-scripts @tencent-ai/codebuddy-code@2.173.0
```

### 3. 有必要时才重新探测连接

```powershell
Set-Location 'E:\MyProjects\Inclass'
& 'D:\Node\node.exe' tools/connect-workbuddy.js --path 'E:\MyProjects\Inclass\.tmp-codebuddy-cli\node_modules\@tencent-ai\codebuddy-code\bin\codebuddy' --timeout 45000
```

这是真模型调用，会消耗额度，并更新 `data/settings.json` 的 workbuddy 连接配置。已通过，无需循环执行。不要再自动改回 WorkBuddy 安装目录内的 CLI。

### 4. 可靠启动本地服务

先检查 HTTP，不能只看 LISTENING 或进程名：

```powershell
curl.exe --noproxy '*' --max-time 5 -s -o NUL -w '%{http_code}' http://127.0.0.1:3000/
```

HTTP 200 时复用现有服务，不再启动第二个实例。确认端口空闲后，在清洁环境中执行以下独立进程启动命令：

```powershell
$projectRoot = 'E:\MyProjects\Inclass'
New-Item -ItemType Directory -Force -Path "$projectRoot\logs" | Out-Null
$serverProcess = Start-Process -FilePath 'D:\Node\node.exe' `
  -ArgumentList 'server.js' `
  -WorkingDirectory "$projectRoot\server" `
  -WindowStyle Hidden `
  -RedirectStandardOutput "$projectRoot\logs\codex-server.stdout.log" `
  -RedirectStandardError "$projectRoot\logs\codex-server.stderr.log" `
  -PassThru
$serverProcess.Id
Start-Sleep -Seconds 2
curl.exe --noproxy '*' --max-time 5 -s -o NUL -w '%{http_code}' http://127.0.0.1:3000/
```

这个启动方式已实测返回 HTTP 200，并在后续独立工具调用中再次验证。不是开机自启；电脑重启后仍需启动服务。

如果端口占用且 HTTP 不响应：

```powershell
netstat -ano -p tcp | Select-String ':3000'
# 将下方数字替换为本次查到的监听 PID；只读确认身份。
Get-CimInstance Win32_Process -Filter 'ProcessId=12345' |
  Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine
```

只有从启动记录/完整命令行等证据确认属于本项目后，才结束那个具体 PID 并重启。**仅“node.exe”或相对命令“server.js”不足以在未知情况下判定归属。不要杀所有 Node 进程。不要照抄历史 PID。**

本次发生过旧服务占用 3000 且 HTTP 请求超时，第二实例报 `EADDRINUSE`；结束已知项目旧进程并独立重启后恢复 HTTP 200。旧进程为何不响应没有取得堆栈证据，不应杜撰具体死锁原因。现有 `课中签到.bat` 只用监听端口判断成功，`停止课中签到.bat` 仅按 Node 进程名判断归属；本轮没有改这两个文件，接手时不要把它们当成 HTTP 健康验证。

浏览器若仍显示旧错误页，手动刷新。Codex 的自动刷新曾被浏览器安全策略拒绝，这是工具访问限制；本机 HTTP 验证已经成功，不要因此再改防火墙、hosts 或系统代理。

## WorkBuddy 下一步任务

1. 保留已成功的 CLI 路径与登录，先直接打开 `/workbuddy`。
2. 完成一次“重新检测”并观察绿灯；这是尚未完成的 UI 验收，会调用模型。
3. 使用虚拟名单和一份极小作业做端到端批改，验证 `批改结果.json` 被平台解析。优先隔离测试，不能覆盖、删除或修改真实名单和成绩。需要写入测试数据时先明确隔离范围。
4. 明确独立 CodeBuddy 账号的额度归属后再进行真实批量作业。
5. 如需长期分发，将独立 CLI 安装与用户登录写入正式部署流程，避免依赖当前被 Git 忽略的目录。

继续遵守：不改 `E:\software\WorkBuddy\`；不破坏真实 `data/`；页面禁用 `alert/confirm/prompt`；短提示词、单次验证，不循环压测。没有自动提交 Git，没有向其他聊天发送消息。

## 可直接粘贴给 WorkBuddy

> 请先阅读 `E:\MyProjects\Inclass\docs\08-handoff-CLI登录与本地访问已解决.md`。Codex 已解决独立 CLI 登录、平台连接探测和网页访问：采用官方 CodeBuddy CLI 2.173.0，用户已授权登录，connect-workbuddy.js 输出“✓ 连通”，settings.workbuddy.enabled=true，首页和 /workbuddy HTTP 200。请保留配置中的独立 CLI 路径，勿删除 .tmp-codebuddy-cli，勿继续折腾内置 2.161.0。接下来只需完成一次设置页重新检测及一份虚拟作业端到端验收；额度是否共享仍待确认。启动服务请使用文档中的独立进程方案并验证 HTTP，不要仅检查端口。不要改 WorkBuddy 安装文件或真实教学数据。

---

## 附录（WorkBuddy 2026-10-23 16:00 追加）：验收结果与剩余阻塞

### 已完成
1. **设置页重新检测绿灯**：`POST /api/gb/probe` 返回 `enabled=true, version=2.173.0, lastError=null`，路径保持独立 CLI。✅
2. **平台代码两处加固**（grade.js，已随服务重启生效）：
   - 平台调用提示词补了一句：写不出文件时必须把完整 JSON 数组打印在最终回复末尾；
   - `run` 的结果处理加了 stdout 兜底解析 `extractJsonArray()`：`批改结果.json` 不存在时，从 CLI 的 stdout 里提取 JSON 数组（先 ```json 代码块、再首尾方括号），解析成功同样置 done 并入库。第一次批改（CLI 打了分却不写文件）这种产出以后能被 salvage。
3. 测试脚本名单解析问题已定位（学号姓名需分隔符），端到端脚本已改用「990001 测试甲」格式，匹配全中。

### 验收二（端到端批改）被两个 CLI 侧硬约束阻塞，平台无法绕过
1. **端口 3577 单实例**：CLI 启动时固定监听 127.0.0.1:3577，被占则直接 `EADDRINUSE` 退出（码 1）。WorkBuddy 桌面版跑着对话时（当前 agent 宿主 PID 32672）就占着它 → 平台批改必然失败。唯一一次成功（15:49）是桌面版服务尚未开始监听的空窗期。
2. **登录态已失效且无本地凭据**：`C:/Users/29263/.codebuddy/` 里没有任何 token/凭据文件；`--port 0` 换端口启动直接报 `Authentication required`。15:32 Codex 验证成功时的登录态在 15:49 之后已不可复用。`--port 0` 与「退出桌面版」都无法绕过认证问题。

### 给用户的收尾操作（必须在关闭本 WorkBuddy 对话后做——对话进程占着 3577）
1. 关闭本对话；
2. 登录：`cd E:/MyProjects/Inclass/.tmp-codebuddy-cli` → `D:/Node/node.exe node_modules\@tencent-ai\codebuddy-code\bin\codebuddy` → Chinese Site → 浏览器授权；
3. 启动服务：双击 `课中签到.bat`（或按本档 §4 独立进程方案），浏览器开 `http://127.0.0.1:3000/workbuddy` 应为绿灯；
4. 端到端验收：`node .tmp_e2e_accept.js`（脚本已留在项目根，虚拟数据自动建、自动清，跑两次批改约几分钟）。预期输出 `ALL PASS`；若 CLI 仍不写文件，stdout 兜底会接住并把「从输出解析 N 份」写进运行日志；
5. 脚本若失败，把打印的 FAIL 行反馈回来即可。
