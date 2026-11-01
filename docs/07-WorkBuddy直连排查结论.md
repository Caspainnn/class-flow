# WorkBuddy 直连排查结论

> 当前可执行方案和接手事项见 [最新 handoff](08-handoff-CLI登录与本地访问已解决.md)。本文件保留排查过程。

日期：2026-10-23（Asia/Shanghai）。接续 `06-handoff-WorkBuddy直连调试.md`。

## 后续进展：独立 CLI 登录和平台命令探测已通过

用户随后要求继续解决 CLI 登录，并亲自完成国内站浏览器授权。安装官方 `@tencent-ai/codebuddy-code` 到项目忽略目录 `.tmp-codebuddy-cli`，实际安装版本为 2.173.0；未修改 WorkBuddy 安装文件或全局 PATH。

- 独立 CLI 交互入口能展示登录方式，选择 Chinese Site 后浏览器授权成功。
- 清除 `CODEBUDDY_*`、`NODE_OPTIONS` 后，独立 CLI 使用平台参数发送 `Reply OK`，stdout 为 `OK`，stderr 为空，exit 0。
- 同条件调用 WorkBuddy 内置 lite 2.161.0，仍报 `Authentication required`；标准 CLI 登录未使内置包可用。
- 执行 `node tools/connect-workbuddy.js --path E:/MyProjects/Inclass/.tmp-codebuddy-cli/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy --timeout 45000`，实测输出 `✓ 连通（8803ms）`，exit 0。该工具按原验收目标更新 `data/settings.json` 的 workbuddy 连接配置；未操作教学数据。
- 当前使用的是独立 CodeBuddy 账号认证，其与 WorkBuddy 免费额度是否共享尚未确认。页面重新检测及作业端到端验收尚未进行，不能据此宣称自动批改已经全部验收。
- 当前连接依赖 `.tmp-codebuddy-cli` 目录，**不要清理该目录**；若日后迁移到正式工具目录，须同步更新连接路径再验证。

以下为登录前历史排查记录，其中“未连接/未安装”的状态已由本节更新。

## 结论与边界

**直连尚未打通。当前可重复的直接阻塞是独立 CLI 未取得有效登录身份；普通入口还有分派目标缺失问题。历史“无限挂死”本轮未复现，不能宣布已经修复，也不能断言本机 CLI 永久不可修复。**

完全退出 WorkBuddy 后，lite CLI 在约 4.7 秒内退出，stderr 为：

```text
Authentication required. Please use /login command to sign in to your account
```

重新启动桌面版后，相同条件约 4.5 秒返回相同错误。两次 stdout 都为空，exit code 都为 0。**退出码 0 不等于连通；桌面版运行本身不是本轮阻塞的充分条件。** 显式指定现有 `.workbuddy` 配置目录也没有识别到登录身份。

未改平台代码，未操作平台 `data/` 中的数据或设置，未修改 WorkBuddy 安装目录，未改系统代理或注册表，未升级或安装软件。桌面版已重新启动。所有模型提示词均为 `hi`，没有批量压测；未获得模型回复，实际计费需以服务端账单为准。

## 实验条件

- CLI：`E:\software\WorkBuddy\resources\app.asar.unpacked\cli\dist\codebuddy-lite-wb.mjs`，实测 `--version` 为 `2.161.0`。
- 系统 Node：`D:\Node\node.exe`，v20.18.0。
- 对照 Node：`C:\Users\29263\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`。
- 所有 CLI 实验均在沙箱外执行；PowerShell 禁用 profile；首先清除子进程继承环境的全部 `CODEBUDDY_*` 和 `NODE_OPTIONS`。
- CLI 工作目录为系统临时目录，stdout/stderr 分开捕获，单次设置 15–45 秒上限。实际均提前退出。
- 当前环境存在 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY=http://127.0.0.1:7897`，这与旧交接记录不同；不能把前后差异全部归因于退出桌面版。
- 首先关闭已确认路径的 WorkBuddy 主窗口，随后结束残留 WorkBuddy.exe；实验后核查无 WorkBuddy 进程。恢复运行后核查有 7 个 WorkBuddy 进程。

## 按 §5 假设顺序记录

| 假设 | 本轮证据 | 判断 |
| --- | --- | --- |
| 1. 桌面版会话锁 | 完全退出后 `-p hi` 4670ms 返回未登录；重启后同命令 4545ms 返回未登录 | 本轮不支持锁冲突解释；没有复现历史挂死 |
| 2. 配置拉取卡住 | 自带 Node 加 `--debug api` 4345ms 返回；出现 `Config.fetchConfig → setProxy` 类型错误，之后仍返回未登录 | 不能把配置错误当作当前无限等待根因；未观察到 DNS/TLS 超时，也未做抓包，不能据此证明所有服务端点都可达 |
| 3. 代理触发路径 | 在子进程内移除所有大小写形式 HTTP/HTTPS/ALL/NO_PROXY，再设 `NO_PROXY=*`，使用平台参数组合，仍快速返回未登录，未出现 setProxy 错误 | 代理路径与错误有关；关闭代理没有解决认证，不改注册表 |
| 4. 参数 | 最小 `-p hi` 与含 `--output-format text --tools "" --permission-mode dontAsk --no-session-persistence` 都返回未登录；帮助列出这些选项 | 无证据表明平台附加参数是阻塞原因。裸 lite 在工具提供的 PTY 下约 5 秒退出，未展示可用登录界面；不能外推所有终端均如此 |
| 5. 登录 | 清洁环境无 ACC/AUTH/WORKBUDDY/CODEBUDDY 环境键；两份 settings 结构均未发现 apiKeyHelper 或 env 键；显式注入 `CODEBUDDY_CONFIG_DIR=C:\Users\29263\.workbuddy` 后 5686ms 仍未登录 | 独立 CLI 没有取得可用身份；不能声称桌面账号已失效，也未尝试提取、复制或解密桌面凭据 |
| 6. 换入口 | `bin/codebuddy -p hi` 140ms exit 1，`Cannot find module '../dist/codebuddy'`；`codebuddy-lowmem` 源码仅 require 普通入口；`cbc-prewarm` 是预热进程 IPC 管理器 | 普通入口按 headless/full 分派，所需产物缺失；lowmem 没有独立实现，prewarm 不是独立登录方案。`--version` 两入口均能成功，不能用它判断可调用 |
| 7. 独立发行版 | 核对官方安装及登录文档：包名为 `@tencent-ai/codebuddy-code`，首次使用需要登录 | 独立发行版是后续候选，未安装或验证；没有证据证明其共享 WorkBuddy 免费额度，不能视为已经达成原目标 |

附加排除：单个 CLI 子进程保持 stdin pipe 打开，计划第 8 秒关闭；它在 5751ms 已自行返回未登录。因此本轮也不支持“stdin 未关闭导致挂死”的解释。

## 源码证据与根因分层

1. **已证实：入口分派缺失。** `cli/bin/codebuddy` 第 260–294 行：只有显式 `CODEBUDDY_FORCE_LITE_WB_BUNDLE` 才选择 lite；普通 headless 先加载 `codebuddy-headless`，缺失后回退 `codebuddy`。本机最小命令实测回退后报模块缺失。清洁环境去掉该变量后，不能直接使用这个普通入口。可以直接选 lite 路径，但认证问题仍存在。
2. **已证实：独立调用没有有效身份。** lite 在桌面版开/关两种状态及显式配置目录下都报认证缺失。源码的 `CustomTokenAuthenticationStorageImpl` / `getAuthenticationAttributesSync` 支持环境、产品配置、设置或 helper 等身份来源；桌面侧另有 `CODEBUDDY_SIDECAR_CREDENTIAL_BOOTSTRAP_SOCKET` 托管启动通道。这支持“桌面启动上下文与独立启动不同”的解释，但没有证明某个凭据文件损坏或被锁。
3. **已复现但不是已证实的挂死根因：代理类型错误。** `codebuddy-lite-wb.mjs:2669:91959` 的 `setProxy` 使用 `h instanceof URL`；配置拉取栈来自 `lazy-lite-wb/5284.295fdf0d.mjs`。其 `fetchConfig` 捕获并打印异常；本轮随后继续至认证错误并退出。移除子进程代理后错误消失。
4. **仍未知：旧会话为什么长时间零输出。** 旧记录与本轮存在宿主、环境和运行时差异；没有对旧进程做堆栈采样，不能补写一个未经证明的单一根因。

遥测初始化分片 `lazy-lite-wb/376.ffc2c77a.mjs` 包含 `galileotelemetry.tencent.com/ocp/api/v1/get_config` 等配置地址；这是静态候选，不是抓包确认的实际请求目标。无需在未观察到网络阻塞时修改 hosts。

## WorkBuddy 升级后期待验证点

1. 官方明确 Windows 内置 CLI 的稳定入口；默认 `bin/codebuddy -p` 应能加载随安装包提供的产物。
2. 提供可用的独立登录或受支持的桌面授权桥接流程，明确刷新、退出桌面后的有效性，以及是否共享 WorkBuddy 的额度。不要依赖复制桌面 token。
3. 修复 lite ESM 包代理路径中的 URL 类型错误；配置拉取应有明确超时，且不妨碍打印认证诊断。
4. 未登录时应返回非零退出码和明确可执行的登录步骤；不要仅输出 `/login`，却没有可用交互入口。
5. 在桌面版退出/运行两种状态下，以相同 Node、cwd、stdin、代理和参数做一次短提示词对照，再进行一份虚拟作业的端到端验证。

官方已经提供独立 CLI 的 [v2.162.0 发布页](https://www.codebuddy.cn/docs/cli/release-notes/v2.162.0)，但不代表 WorkBuddy 安装包已集成该版本，也不代表上述问题已被修复。

## 验收现状

| 项目 | 状态 |
| --- | --- |
| connect-workbuddy.js 输出“✓ 连通” | 未达成；未运行会改写真实 settings 的探测脚本，采用等效 CLI 参数验证 |
| settings.workbuddy.enabled=true | 未达成；只读核查仍为 false，path 为 null |
| /workbuddy 点击重新检测变绿 | 未执行；此操作会写真实 settings，且认证前置条件失败 |
| 生成并解析批改结果.json | 未执行；未创建测试批次或触碰真实数据 |

后续最小推进条件：先获得受支持的独立 CLI 登录方式并由用户完成身份认证，再验证 `OK`。若采用独立 CodeBuddy Code，则还需确认账号及额度符合原 WorkBuddy 目标。目前保留现有手动调用兜底，不以修改平台掩盖上游认证问题。

官方参考：[安装指南](https://www.codebuddy.cn/docs/cli/installation)、[首次登录](https://www.codebuddy.cn/docs/cli/quickstart)。
