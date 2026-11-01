# PPT 真实功能 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将已验收原型接为真实持久化、手动任务包与可追踪的 CLI 分阶段制作流程。
**Architecture:** Node 独立 PPT 模块，任务文件按目录隔离；复用现有服务、本地访问限制和 shell。两条路径共用固定提示词。每次 CLI 调用使用独立运行目录与完整输入快照，大纲/制作分阶段，不要求复用不可靠的会话。
**Tech Stack:** 原生 Node HTTP/fs/child_process、现有 JSZip、HTML/CSS/JS，无新增前端框架。
**Spec:** docs/ppt-preparation/2026-10-27-GitHub-skill调研与方案修订.md、已验收 prototype/ppt-preparation.*、docs/ui-feedback-standard.md。

## Global Constraints

- 原型在本轮已由用户确认通过，授权正式实现；另已授权安装固定 PPT Master 和一次虚构样例真实模型验证。
- 不修改 WorkBuddy 安装目录、登录凭据或批改模块，不用真实教学数据测试，不自动重试付费调用。
- CLI 不可用则明确失败并保留手动复制入口。只有真实合法 PPTX 入库后才显示完成；文本预览不得冒充实际排版。
- 文件按任务/运行/版本隔离，旧版本不可覆盖；取消、超时、进程重启不得收录迟到输出。

## Review Focus

上传及产物路径穿越/符号链接；畸形或过大 ZIP；运行中重复请求；取消后迟到结果；上游修改导致大纲和检查状态失效。

## Tasks

- [x] 持久化服务与真实文件导入/下载：server/ppt/service.js、server/ppt/routes.js；隔离服务测试覆盖重启、越界、无效包、版本。
- [x] CLI 桥接：固定 skill 配置、完整输入快照、outline.json 与 delivery.json 交接；反馈、失败、取消、超时、重启恢复；假 CLI 测试状态机，真 CLI 一次出片检查。
- [x] 正式页面：server/ppt/public/*，保留原型布局，空列表起步、真实资料、手动复制包、大纲确认、真实产物内容与备注、常驻修改、版本与检查卡。
- [x] 隔离浏览器验证，更新原型验收、正式功能验收和 README。经验证才激活正式服务，不提交/合并/推送用户其他未提交改动。

## Ledger

2026-10-27：分支 codex/ppt-preparation，保留既有未提交工作。用户原型验收覆盖全部当前原型项目；真实出片只用虚构主题。平台页面继续 /preparation?type=ppt，教案占位不变。独立 CLI 是现有自动化桥接工具，不能把其连通等同桌面 WorkBuddy 或最终出片验收。

实施结果：4份PPT专项测试通过，既有导航/批改工作区/原型回归通过。独立审查发现的迟到响应、修改重试、包结构与页面类型、未保存输入、未改页共享资源和日志写入错误处理已修复。真实虚构课件有5页原生PPTX、5页备注与8份源文件；自动交接超时，使用显式恢复完成。没有将该案例记为全程无人干预通过。用户批准的Bash仅本次进程使用，持久设置false。正式服务已启用，既有教学文件哈希变化0份。
