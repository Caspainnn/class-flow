# 本机上传组件资源

PPT参考资料使用真正的 Element Plus Upload（drag、多选、中文文件列表、点击和拖入共用处理），以局部Vue组件挂载。页面不从CDN请求脚本、样式或教学资料。

- Element Plus 2.14.0，Vue 3.5.44，MIT许可随资源保留。
- 源码：`tools/ui/element-upload-entry.js`；固定依赖及锁文件：`tools/ui/package*.json`。
- 构建：在 `tools/ui` 执行 `npm ci --ignore-scripts --no-audit --no-fund`，然后在项目根执行 `node tools/ui/build.cjs`。
- esbuild 0.25.11只用于构建；部署已生成的JS/CSS无需安装上述构建依赖。
- 官方用法：https://element-plus.org/en-US/component/upload.html

可复用接口：`InclassUpload.mount(container, {files, getFiles, onSelect, onRemove, onPreview, onError})`，返回卸载函数。宿主负责本机接口上传及业务验证，组件负责点击/拖入、多文件批处理与列表；移除必须等业务接口成功，不能只在界面上删掉条目。
# 模板上传扩展

`InclassUpload.mount` 支持可选 `accept`、`multiple`、`limit`、`label`、`types`、`exceedText`；默认仍为12份通用参考资料。PPT模板使用 `.pptx`、单选、单次一份；宿主服务验证真实PPTX包及20MB限制。
