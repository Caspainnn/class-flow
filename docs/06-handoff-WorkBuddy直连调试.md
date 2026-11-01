# Handoff：WorkBuddy 平台直连（headless CLI）调试

> **后续状态已更新**：独立 CLI 登录、平台命令连通与本地网页访问已经解决。请优先阅读 [最新交接与可复用方案](08-handoff-CLI登录与本地访问已解决.md)，不要按本文旧状态重新排查。本文保留为历史证据；完整作业端到端验收仍待完成。

> 交接对象：Codex 或任何接手调试的智能体。
> 目标：让「一堂课」平台（本项目）能通过本机 WorkBuddy 的命令行接口完成「平台调用批改」。
> 当前状态：**功能代码全部完成且测试通过，卡在最后一步——WorkBuddy 的 CLI 在这台机器上 `-p` 模式挂死**。
> 日期：2026-10-23 · 机器：Windows 11，WorkBuddy 安装在 `E:\software\WorkBuddy`，CLI 版本 2.161.0

---

## 1. 背景与产品目标

「一堂课」是给高校教师用的课堂工具（签到/学情分析/作业批改）。作业批改支持两种方式：

- **平台调用 WorkBuddy（推荐）**：服务端直接 spawn 本机 WorkBuddy 的 headless CLI（`codebuddy -p`），把整批作业目录交给它批，WorkBuddy 写回 `批改结果.json`，平台解析入库。用老师自己 WorkBuddy 账号的免费额度，作业原文不出本机。
- **手动调用 WorkBuddy（保底）**：平台准备好批改目录和提示词，老师复制提示词到 WorkBuddy 手动批，批完把三列 Excel 拖回平台导入。**此路径已完整可用**。

要修的就是「平台调用」这条路：**让 `codebuddy -p "..."` 在这台机器上能正常返回**。

## 2. 项目结构与关键文件

```
E:\MyProjects\Inclass\
├── server\
│   ├── server.js                    # 主服务（端口 3000，挂载各模块）
│   └── grade\
│       ├── grade.js                 # 作业批改模块：/grading 页 + /api/gb/*
│       └── public\
│           ├── grading.html         # 批改页（四步流程）
│           └── wbset.html           # WorkBuddy 设置页（连接/批改参数）
├── tools\connect-workbuddy.js       # 命令行探测连接工具（node 直跑，--help 可看用法）
├── data\
│   ├── settings.json                # workbuddy 连接配置存这里（enabled/path/version/...）
│   └── 批改\<批次id>\               # 批次工作目录（final\ 下是规范重命名后的作业）
└── docs\05-部署与连接WorkBuddy.md    # 部署文档（含排查表）

WorkBuddy 安装（只读参考，不要修改其文件）：
E:\software\WorkBuddy\resources\app.asar.unpacked\cli\
├── bin\codebuddy                    # 入口脚本（已损坏，见 §4）
├── bin\codebuddy-lowmem
├── dist\codebuddy-lite-wb.mjs       # 9.4MB 打包产物，唯一可跑的 bundle
└── dist\lazy-lite-wb\               # 懒加载分片（5284.295fdf0d.mjs 里有 Config.startPull）
```

### 2.1 平台如何调用 CLI（grade.js）

探测（`POST /api/gb/probe`，写 settings.json 的 `workbuddy` 段）：
```js
// spawn 方式：bin/codebuddy 是带 #! 的文本脚本，必须用 node 跑
const isScript = /\.(mjs|cjs|js)$/i.test(file) || looksLikeScript(file); // 读前两字节判 #!
const cmd = isScript ? process.execPath : file;
args.push('-p', '只回复两个字母：OK', '--output-format', 'text',
          '--tools', '', '--permission-mode', 'dontAsk', '--no-session-persistence');
// 判据：code===0 && /OK/.test(stdout)；默认 30s 超时
```

正式批改（`POST /api/gb/batches/:id/run`）：
```js
spawn(node, [cli, '-p', prompt, '--output-format', 'text',
  '--add-dir', finalDir, '--permission-mode', 'dontAsk',
  ...(background ? ['--tools','Read,Write,Glob,Grep,Bash'] : []),
  ...(noHistory ? ['--no-session-persistence'] : [])], { timeout: (份数+4)*单份超时 })
// 成功判据：finalDir 里出现合法的 批改结果.json
```

## 3. 现象

- `codebuddy-lite-wb.mjs --version` → 正常输出 `2.161.0`，秒回。
- `codebuddy-lite-wb.mjs --help` → 先打印 `fetch config failed TypeError: Right-hand side of 'instanceof' is not callable at setProxy (...)`，然后正常输出帮助并 exit 0。
- `codebuddy-lite-wb.mjs -p "只回复两个字母：OK" --output-format text` → **无限挂死，零输出**。实测最长跑了 7 分 52 秒被手动杀掉。
- `bin\codebuddy -p ...`（完整版入口）→ 秒退：`Error: Cannot find module '../dist/codebuddy'`（dist 里根本没有这个文件，安装不完整）。
- 平台探测（真跑一次 CLI）因此全部 30 秒超时 → 状态保持「未连接」。

## 4. 已完成的诊断（按时间顺序，都是有效证据）

| # | 实验 | 环境 | 结果 |
|---|------|------|------|
| 1 | 平台探测全部候选路径 | agent 沙箱内 | 全部超时 |
| 2 | 独立跑 `bin\codebuddy -p` | 沙箱外 | 120 秒无输出被杀 |
| 3 | 独立跑 lite `-p`，清空全部 `CODEBUDDY_*` 和 `NODE_OPTIONS` | 沙箱外 | 150 秒无输出被杀 |
| 4 | lite `-p` 后台长跑（原环境） | 沙箱外 | 7 分 52 秒零输出，杀 |
| 5 | 用干净环境重启平台服务，从服务端探测 | 沙箱外 | 30 秒超时（**环境变量污染假设被排除**） |
| 6 | `CODEBUDDY_SERVICE_PROXY_URL=http://127.0.0.1:1` 逼配置拉取快速失败 + `-p` | 沙箱外 | 2 分 26 秒零输出，杀 |
| 7 | `--help`（原环境） | 沙箱外 | **报 setProxy 崩溃后正常工作**（§3） |
| 8 | 用户在「自己认为干净」的服务上点重新检测 | - | 仍超时（注：经查当时 3000 端口仍是我方进程，此条证据无效） |

### 4.1 源码级发现（lite 包反混淆摘录）

`setProxy(t,i,n,s,c,p)` 中：
```js
let h=i, S=getProxyEnvAgent(t,p,c);
if(!h && h!==false && !isNodeEnvProxyEnabled(S)){
  let t=getProxyForUrl(n);  // 从环境变量读代理
  t&&!shouldBypassProxy(n)&&(h=new URL(t))
}
...
let i=h instanceof URL;   // ← 崩这里：URL 不是构造函数（被遮蔽/未定义）
```
- 崩溃信息出现在 `Config.fetchConfig → SetupGalileo → Config.startPull`（`dist/lazy-lite-wb/5284.295fdf0d.mjs`）的调用链上，即 **CLI 启动时会同步拉取远端配置**。
- 注册表有残留代理值：`HKCU\...\Internet Settings` → `ProxyEnable=0` 但 `ProxyServer=127.0.0.1:7897`（Clash 残留）。当前用户环境变量里没有 `http_proxy` 等标准代理变量。

### 4.2 当前机器的宿主环境

- WorkBuddy 桌面版**正在运行且已登录**（调试者就跑在它里面）。它的 agent 会话会注入大量 `CODEBUDDY_*` 环境变量和 `NODE_OPTIONS=--require=...node-language-shim.cjs`——做实验时务必清掉，否则结果被污染。
- 疑点（未验证）：桌面版与 CLI 可能争用 `C:\Users\29263\.workbuddy\` 下的配置目录/会话锁；退出桌面版再测会中断调试会话，所以这条**始终没能排除**。

## 5. 待验证假设（按性价比排序）

1. **桌面版会话锁冲突**（最可能）：完全退出 WorkBuddy 桌面版 → 起服务 → 跑 `codebuddy-lite-wb.mjs -p "hi"`。若通了，结论 = CLI 与桌面版不能同时用，产品上把「批改前退出桌面版」写进文档即可。
2. **配置拉取目标不可达/被挂起**：抓包或加 `--debug api`（CLI 支持 `-d, --debug [filter]`）看启动时 POST 到哪个域名、卡在 DNS/TLS/等待响应哪一步。若目标域名在本机网络不通，考虑 hosts/代理方案。
3. **代理处理 bug 触发路径**：注册表残留 `ProxyServer=127.0.0.1:7897` 清空后重试；或给 CLI 显式注入合法的空代理环境变量组合对比实验。
4. **调用参数问题**：去掉 `--tools ''`、`--no-session-persistence`、`--permission-mode dontAsk` 等逐个排除（`--help` 输出里确认有效 flag）；也试试交互式 `codebuddy`（不带 -p）是否同样挂。
5. **login/凭据缺失**：CLI 是否需要单独 login？查 `--help` 里有没有 `login/logout/auth` 子命令；或查 `C:\Users\29263\.workbuddy\` 下凭据文件是否被桌面版独占。
6. **换入口**：`bin\codebuddy-lowmem`、`bin\cbc-prewarm` 是否是更合适的入口；`dist/lazy-lite-wb/` 分片加载失败是否是挂死根因（试用 `--verbose`）。
7. **版本差异**：GitHub 上 CodeBuddy Code 开源版 CLI（`npm i @tencent/codebuddy` 之类）是否能独立跑通；若能，平台探测候选里加一个「使用独立安装的 codebuddy CLI」路径，绕开 WorkBuddy 内置 CLI。

## 6. 验收标准

1. `node tools\connect-workbuddy.js`（或 `--path` 指定）→ 输出「✓ 连通」，退出码 0，`data/settings.json` 的 `workbuddy.enabled=true` 且写入 path/version；
2. 平台 `/workbuddy` 页点「重新检测」→ 状态灯变绿；
3. 端到端：建批次 → 上传作业 → 准备目录 → 「平台调用」跑完 → `final\批改结果.json` 被解析进 results → 归档成功；
4. 以上在**退出 WorkBuddy 桌面版**和**桌面版运行中**两种状态下都测一遍，记录哪种可用，并把结论补进 `docs/05` 排查表。

## 7. 约束与注意事项

- **不要修改** `E:\software\WorkBuddy\` 下的任何文件（那是正在运行的软件）；
- `data\` 目录含用户真实数据（名单、成绩、`.secret` 密钥），**不要删除或提交到 git**；测试用批次跑完记得删；
- 平台代码的硬约束：页面里**禁止 `alert()`/`confirm()`/`prompt()`**（独立窗口会静默拦截），危险操作用「按钮变色二次确认 + toast」模式；
- grade.js 是挂载式模块（导出 `async (req,res,ctx)=>boolean`，返回 falsy 穿透主路由）；`json()` 无返回值，路由里必须 `J()` 包装返回 true；
- 服务启动：`cd server && node server.js`（端口默认 3000，环境变量 PORT 可改）；数据全在 `data\`，无外部依赖（依赖已装在 `server\node_modules`）；
- WorkBuddy CLI 免费额度有限，`-p` 试跑请用最短 prompt，别循环压测。

## 8. 快速上手命令

```bash
cd /e/MyProjects/Inclass
# 看当前连接状态
node -e "console.log(require('./data/settings.json').workbuddy)"
# 探测（真跑 CLI）
node tools/connect-workbuddy.js --timeout 60000
# 最小复现（关键实验，建议每次实验都从这条开始）
env -u NODE_OPTIONS $(env | grep -oE "^CODEBUDDY_[A-Z_]+" | sed 's/^/-u /' | tr '\n' ' ') \
  node E:/software/WorkBuddy/resources/app.asar.unpacked/cli/dist/codebuddy-lite-wb.mjs \
  -p "只回复两个字母：OK" --output-format text
# 带调试输出
... codebuddy-lite-wb.mjs -d api -p "hi" ...
# 起服务看页面
cd server && node server.js   # http://127.0.0.1:3000/workbuddy
```

## 9. 一句话总结

平台侧（探测、spawn、解析、降级）已完成并测试通过；唯一的拦路虎是 WorkBuddy 2.161.0 内置 CLI 在这台机器上 `-p` 模式挂死——先验证「退出桌面版」这条假设，再沿 §5 清单往下排查。就算最终修不通，产品也有完整的手动调用兜底，不阻塞交付。
