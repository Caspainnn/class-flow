# PPT制作：GitHub skill调研与方案修订

日期：2026-10-27（Asia/Shanghai）。最新状态：用户已验收HTML原型并授权真实功能实现，另授权固定版本PPT Master安装和一次虚构出片联调。实施与证据见[真实功能验收](真实功能验收.md)。下文“尚未安装/未获批”描述调研当时的历史边界，不再代表当前授权状态。

## 1. 用户已明确的产品方向

同一份最少必要信息模板、同一套固定提示词，提供两条路径：

1. **手动调用（保底）**：老师填写模板，复制提示词及填写内容，附上参考资料，单独交给WorkBuddy制作、查看反馈并修改。
2. **平台调用**：老师在平台填写同样的信息，平台整理并交接给WorkBuddy，接收反馈和生成结果，支持继续修改。

**PPT制作与美化由WorkBuddy执行；平台负责填写、交接、反馈、产物与版本管理。**“模板”首先指需求填写模板，不是要求平台自建一套PPT排版生成器。原方案中“CodeBuddy只生成JSON、平台固定模板渲染PPTX”的主路线撤下，不作为第一版要求；平台自由画布编辑器、固定六类版式、自建PPTX引擎也不再是必交范围。

用户另要求扩大到GitHub高星项目选型，不以本机已有技能限制候选。该要求已纳入本轮调研。之后用户明确允许开始构造原型；原型仍须审查，阶段边界继续生效。

## 2. 搜索方法与证据边界

检索GitHub中的ppt、pptx、presentation、skill关键词，并使用stars排序查找候选；再核对原作者仓库、README、SKILL.md、依赖与许可证。以下是相关高星代表，不是全球完整排名。排除只转发上游的同名仓库作为首选来源。

星数来自本轮GitHub仓库页面显示的近似数，记录日期为2026-10-27；会随时间变化。综合仓库的星数不等于其中PPT skill的独立星数，也不能证明制作质量或WorkBuddy兼容性。本次“已验证”仅指已查到源文件和项目声明；本机运行、视觉、性能、费用与Office可编辑性均未实测。

| 原作者仓库 | 约星数 | 核心输出与定位 | 本项目建议 |
| --- | ---: | --- | --- |
| [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) | 69.1k | 原生可编辑PPTX；含创建、美化、模板及原生文件编辑路线 | **优先验证**，最贴近老师需要修改课件的目标 |
| [op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) | 28.7k | 杂志/瑞士风格HTML演示；PPTX不是其当前主流程 | 可作网页课件方向候选，不作可编辑PPTX默认引擎 |
| [chuspeeism/dashi-ppt-skill](https://github.com/chuspeeism/dashi-ppt-skill) | 10.1k | 浏览器可编辑演示，支持PPTX/PDF导出；项目声明实测支持Workbuddy | **第二候选**，关注视觉和修改体验，但必须处理独立导出许可 |
| [ningzimu/codex-ppt-skill](https://github.com/ningzimu/codex-ppt-skill) | 7.3k | 整页生图，再组装PPTX；项目明确页面元素不能直接编辑 | 强视觉专项备选，不作普通教学课件默认 |
| [anthropics/skills](https://github.com/anthropics/skills)中的pptx | 184.1k（整个集合） | 创建、编辑、解析PPTX及检查流程 | 作为对照；其单独许可不适合直接移植到WorkBuddy/平台 |

## 3. 优先候选的实际适配条件

### 3.1 PPT Master：首选验证对象

[SKILL.md](https://github.com/hugohe3/ppt-master/blob/main/skills/ppt-master/SKILL.md)当前声明版本6.7.3，包含生成、美化、模板、原生编辑路由；[主仓库许可](https://github.com/hugohe3/ppt-master/blob/main/LICENSE)为MIT，需保留版权和许可。比“HTML截图塞进PPT”更符合后续改字、换例题、调整图表的教学需求。

依赖见[requirements.txt](https://github.com/hugohe3/ppt-master/blob/main/skills/ppt-master/requirements.txt)：Python、python-pptx、XlsxWriter等，部分路线还需要字体排版/路径运算、材料解析等依赖；PDF路线列有PyMuPDF（文件注明AGPL/商业许可）。因此**主项目MIT不代表所有依赖都可按MIT打包**。旁白、生图与额外服务属于可选能力，第一版无需启用。

作者说明支持具有读写文件、命令执行与多轮能力的智能体，但未在所查README中找到针对WorkBuddy的专门实测声明。本项目结论是“结构上有适配条件，优先验证”，不能说“已能直接在本机WorkBuddy可靠运行”。需要检查多角色工作流、Python命令、字体和产物检查工具在WorkBuddy中的行为。

后续部署提案：使用原作者发布的固定版本及完整`skills/ppt-master`资源，在WorkBuddy支持的技能导入机制中安装；配置独立Python环境并按选定路线安装依赖。固定提示词明确使用该skill，输出到独立任务目录。平台不把skill里的任意脚本当作自己可执行的业务代码；由获授权的WorkBuddy任务运行。当前不安装、不运行完整skill或其归属检查脚本。

### 3.2 Dashi PPT：视觉与交互编辑候选

[README](https://github.com/chuspeeism/dashi-ppt-skill/blob/main/README.md)说明基于预置主题/版式生成HTML并导出可编辑PPTX，列出Workbuddy支持。环境要求为Node.js 20+，PPTX/PDF导出需Chrome/Chromium/Edge；[skill入口](https://github.com/chuspeeism/dashi-ppt-skill/blob/main/skills/dashi-ppt/SKILL.md)提供Windows PowerShell流程。以上均为作者声明，尚未本机验证。

许可须分开看：[根许可](https://github.com/chuspeeism/dashi-ppt-skill/blob/main/LICENSE)为AGPL-3.0；[html-deck-to-pptx子包](https://github.com/chuspeeism/dashi-ppt-skill/blob/main/skills/dashi-ppt/project/packages/html-deck-to-pptx/LICENSE)为专有许可，仅限作为该skill组成部分使用，并禁止抽出用于其他软件/产品/服务。不能把它当普通开源导出库嵌入平台。手动在WorkBuddy中使用完整skill，与将代码打包进教学平台是不同部署方式；自动调用和再分发方式在选用前核实适用许可，必要时联系作者。

还应注意：其README说明预览服务默认可在局域网访问。本项目继续要求127.0.0.1；候选若不能配置仅本机监听，则不启动预览服务。生成需要经过WorkBuddy所用模型，不能把项目描述的“本地导出”推广成“所有材料永不外发”。后续调用使用固定版本，不照抄`@latest`自动更新；静默版本联网检查也应纳入部署说明。

### 3.3 其余候选为何不作默认

- **归藏**：[README](https://github.com/op7418/guizang-ppt-skill/blob/main/README.md)明确核心交付是HTML，PPTX转换不属主流程。视觉方向有价值，但单凭名称含PPT不能等同于PowerPoint制作能力；根许可AGPL-3.0。
- **Codex PPT**：[README](https://github.com/ningzimu/codex-ppt-skill/blob/main/README.md)明确为整页图片式PPT，原页面元素不可直接编辑；可另接图片转可编辑技能，但这是额外工具链、成本与准确性验收，不能默认为已解决。项目MIT也不包含生图服务的账号与费用授权。
- **Anthropic pptx**：[独立许可](https://github.com/anthropics/skills/blob/main/skills/pptx/LICENSE.txt)的限制没有因仓库高星而改变；不能按集合内其他技能许可复制。可在老师自行使用的授权服务中使用，但本方案不移植其内容。
- **本机WorkBuddy原生pptx**：继续作对照，不因扩大GitHub检索而排除；其安装/宿主依赖证据见原调研第2.1节。必须和外部候选用同一份虚构教学样例比较。

## 4. 选型结论与后续验证

建议候选顺序：**PPT Master → WorkBuddy原生PPT → Dashi**。这只是优先验证顺序，未决定最终默认skill；首选理由是可编辑文件目标与授权/部署条件的综合匹配，不是最高星即最佳。归藏和图片式方案保留作特殊风格选项，不增加第一版老师的必填选择。

两种调用方式共用后端skill配置，普通老师无需理解引擎或手填命令。配置记录原作者URL、固定版本/commit、skill入口、依赖清单、许可、输出能力、验证日期；升级先用虚构样例回归，不自动更换已开始任务的引擎版本。

正式实现获批后再安排小规模真机验证（届时确认模型调用和安装范围）：

1. 相同虚构要求生成5页中文教学课件：导入、知识讲解、例题、练习、总结，含教师备注。
2. 检查教学目标、内容正确性、视觉、中文字体、PPTX是否能在PowerPoint打开且无修复提示；文字/形状/表格/图表逐项区分原生可编辑与图片。
3. 只修改第3页例题并交付新版本，检查其他页未意外变化；不允许以“再生成整份图片PPT”冒充局部可编辑。
4. 记录耗时、模型/工具调用和可取得的费用信息、失败恢复、依赖和外发范围。不能用第三方宣传中的token估计作为平台承诺。
5. 先验收老师手动使用的路径，再验收平台启动WorkBuddy任务、收到中间反馈/最终产物、取消和失败提示；独立CLI文本连通不替代完整出片验收。

若平台直连无法访问所需skill/工具，显示“自动交接待配置/不可用”并提供相同任务的复制包，不伪造后台正在制作；不据此偷偷改回平台自建渲染器。

## 5. 最少填写项与固定提示词草案

必填建议仅4项：**本课主题、授课对象、课时、教学内容/参考资料（二选一即可）**。已选课程可带入已知背景；教学目标由WorkBuddy先拟并允许老师改。风格、页数、备注等放可选项，默认“清晰适合投影、按课时建议页数、带教师备注”。需求模板不是PPT视觉模板，老师无需先挑选skill。

```text
本课主题：
授课对象（学段/年级或学生基础）：
课时（分钟）：
教学内容或参考资料：

可选补充：本课目标/重点难点/希望的风格/已有学校模板。
```

共用固定提示词草案（平台按固定文本拼接信息；老师手动路径可整段复制）：

```text
请根据下面的教学要求和我提供的参考资料，为一节课制作PPT。
使用已配置的PPT制作skill；若不可用，请明确说明缺少什么，不要只输出讲稿却宣称已生成PPT。
先提出教学目标、内容顺序和预计时间的大纲，等我确认后再制作完整课件。
按实际教学需要安排讲解、例题或练习和总结；正文适合投影，教师备注与学生可见内容分开。
事实、数据和例题答案须核对，资料不足的内容明确标记，不编造资料来源。
交付可编辑PPTX，并说明哪些内容仍是图片；保留制作所需源文件，方便之后指定页面修改。
如失败，反馈已完成内容、失败阶段及可继续的方法。

【以下为我填写的教学要求】
<模板填写内容>
```

这是方案中的文本草案，不是已经部署的skill或可执行集成。平台调用时把大纲确认请求转成“待老师确认”的反馈，确认后继续同一任务；手动路径由老师在WorkBuddy确认。平台不能仅发一次提示词后等待最终文件，却声称已支持大纲互动；需验证会话续接或分阶段输入快照。反馈协议和PPTX验收可由平台统一要求，不强迫所有skill内部改用某种JSON内容模型。

## 6. 页面与数据框架修订

沿用稳定外壳和`/preparation?type=ppt`。主界面按“填写要求 → 选择调用方式 → 查看反馈/确认大纲 → 获取与修改课件”组织，不建设PowerPoint式自由编辑器。手动方式显示模板与“一键复制”；自动方式显示连接状态、开始、阶段反馈、确认/补充说明、取消、产物下载与指定页面修改入口。

最小持久化实体为Task（教学要求、courseId）、Run（调用方式、skill版本、会话/阶段、输入快照、状态、错误）、Feedback（大纲/问题/进度/完成）、Artifact（PPTX/源文件/预览、hash、版本）。保留旧方案中任务隔离、版本不可变、旧版恢复、幂等与禁止静默收费重试原则；撤下以平台Slide内容模型和render job为中心的硬性接口。正式接口随批准后的交接协议制定，不能把旧接口表当作已批准契约。

手动流程不要求WorkBuddy能自动回传：老师可在外部拿成品，平台提供可选导回以归档；自动流程则必须验收实际反馈与文件交接。下载文件不等于教学内容和实际排版已经由老师验收。

仍严格遵守：完整方案批准 → HTML交互原型 → 原型批准 → 正式功能实现。当前只是更新调研和方案，不安装候选，不修改WorkBuddy安装或真实课程数据。
