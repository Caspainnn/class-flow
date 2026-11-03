# 固定程序导出试验（未接入正式平台）

用途：验证浏览器排版 → 原生 PPT 对象是否能取代 AI 从头编写 SVG 的常规导出工作。用户已授权先备份再试验；当前仅为独立 CLI，不修改正式任务和已确认的 HTML。

依赖：本机 Chrome、Node 20（`--experimental-websocket`）、已有 `.local-ppt-python` 的 python-pptx。可通过 `PPT_BROWSER`、`PPT_PYTHON` 指定本机路径，不增加生产依赖。

```powershell
node --experimental-websocket tools/experimental/export-html-ppt.cjs <已有导出轮次目录> <独立输出目录>
& .local-ppt-python/Scripts/python.exe tools/experimental/verify-html-ppt.py <独立输出目录>
```

输入目录必须包含 `input.json`、`input-html/001.html` 等。仅接受平台静态 HTML 校验通过的页面；专用无头浏览器配置，屏蔽 HTTP/HTTPS 请求。只读原稿，截图、场景、进度和成品均写入独立输出目录，请勿使用存有其他重要文件的输出目录。

试验转换范围：

- 浏览器测量后的文字片段 → 可编辑文本框，常见矩形、圆角块、边线 → 原生图形；保留内嵌原图。
- 内嵌 SVG 图示 → 局部截图图片，内部文字和图元暂不可编辑；不会整页截图冒充可编辑课件。
- 逐页讲稿原文写入对应页备注。每页保存一次包含已完成页的 PPTX，通过临时文件替换，`progress.json` 显示阶段和完成页数。
- 不调用 AI；先验证规则覆盖率，再考虑对少量不能处理的图形做 AI 补偿。

已知限制：DOM 顺序近似绘制顺序，尚未完整支持任意 CSS 堆叠、裁剪、旋转、背景图、复杂渐变及阴影。文字为浏览器行片段而非完整段落。阴影省略，简单渐变近似，不保证任意 HTML 保真。SVG 截图保留外观而非图元可编辑。

验证：本机已确认的 5 页课件作为只读样本；检查页数、原生文本、逐页讲稿，并用项目现有 PowerPoint 渲染脚本逐页对比。教学内容和产物仅在忽略目录，不上传 GitHub。正式接入还需超时/取消、运行沙箱、依赖部署、更多页面及视觉回归检查。
