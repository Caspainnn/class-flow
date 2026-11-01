# 作业管理职责拆分实施计划

**Goal:** 实现用户确认的作业列表、作业详情、自动批改工作台与只读作业分析。
**Architecture:** 沿用静态HTML/原生JS与JSON存储；新增集中作业服务，原批改批次通过hwId关联；旧数据仅在用户写操作时按需关联，不做启动迁移。
**Spec:** `docs/ui-homework-2026-10-26/design.md` 及四张批准图。

## 约束与决策

- 保留用户未提交改动，不自动提交。修改前快照 `.tmp-homework-before-2026-10-26/`；当前工作区包含必要未跟踪功能，原地追加修改。
- 不改真实data或WorkBuddy安装，不调用CLI/模型。隔离API测试使用假store；浏览器写入仅用独立DATA_DIR与端口。
- 旧homework缺省published视为有效，新作业published=false；首次手动录分或复核归档后有效。所有分析/预警/导出统一过滤未发布及软删除。
- 新文件批改作业题目总分要求100；已有其他满分保留原分，归档/分析显式折算为百分制，不修改旧历史分数。
- 软删除关联作业/批次，保留原文件；不再走递归物理删除。已运行批改禁止删除/修改评分标准。
- 手动录分标记manual，归档默认保留manual成绩及补交。批次人工改分同步关联已发布作业；再次导入/重跑保留人工modified项。

## 固定接口（前后端共享）

- GET `/api/homework?courseId=` → `{items:[item]}`。item字段：id,courseId,courseName,name,due,mode(file/manual),status,published,batchId(nullable),submitted,total,average(nullable)。旧未关联批次以原gID作id，读操作不写存储；只按hwId合并。
- GET `/api/homework/:id` → `{homework:{...item,scores,questions,pass,scale,extra},students:[{id,name}]}`。scores学号→`{score,st,...}`，分数百分制。
- POST `/api/homework` body `{courseId,name,due,mode,questions?,pass?,scale?,extra?}` → `{ok,id,batchId}`。
- PUT `/api/homework/:id` body `{name,due,questions?,pass?,scale?,extra?}` → `{ok,id,batchId}`。课程不修改；运行中禁改标准，已产生结果禁改题目分值。
- POST `/api/homework/:id/scores` body `{text}` → `{ok,n,bad}`，复用学号分数补交解析语义，反馈失败行，成功后计入分析。
- DELETE `/api/homework/:id` body `{confirm:true}` → `{ok}`，前端二次点击确认，后端软删除且保留文件。
- `/homework` 显示作业列表/详情；`/grading` 仍为四步批改，使用`?id=原批次ID`兼容。
- 原xq写接口及gb批次创建/删除/归档统一委托集中服务，避免旧入口造成分叉。GET gb状态补充hwId与due/scale/extra供工作台读取。

## 任务及验证

- [x] 集中服务与旧路由衔接：新增 `server/lib/homework.js`，修改grade.js、xueqing.js。先写假store回归检查，覆盖旧作业/批次去重、草稿统计、录分、同步保护、归档幂等、软删及隔离路径。
- [x] 列表及详情：新增 `server/grade/public/homework.html`，实现唯一创建、课程筛选、定位详情、保存信息、录分、二次确认删除、跳转批改/分析。复用shell.css，不加框架依赖。
- [x] 主任务整合：shell增加作业列表/自动批改子入口；grading保留完整四步和自动/手动调用，移除独立创建；分析删除写入口并深链管理，工作台导流。
- [x] 集成验收：隔离服务验证新建手动/文件作业、复核归档、成绩保护、分析只读与跳转；1280/390布局、四步切换、日志/启动按钮展示，不启动真实批改；数据哈希核对，保存截图和QA。

## 审查重点

旧批次没有hwId、旧作业没有状态、名称相同但ID不同、手工补交被归档覆盖、删除后再次归档重生、草稿误触缺交预警、跨课程学生ID污染、旧满分不是100、动态表格/表单注入、运行批次被修改。

## 执行进度

用户已批准设计并要求开始。实现由当前任务协调，后台与新增页面按上述固定接口并行，互不编辑对方文件；主任务负责原页面整合与最终验收。

## 本地实现结论（2026-10-26）

集中服务、列表详情、四步批改衔接、只读分析均已实现。隔离浏览器验证及四组回归检查通过，真实data哈希未变化。额外修复异步切换作业污染、运行中元数据覆盖、旧批次非百分制读取及名单包装响应。详见 docs/ui-homework-2026-10-26/verification/design-qa.md。任务勾选代表开发自测完成，用户验收仍待进行；实际模型调用未执行。
