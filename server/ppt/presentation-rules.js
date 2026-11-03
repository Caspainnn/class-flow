'use strict';
const coverRules=`首页固定规范：第1页是简洁封面，展示课程标题、可选的一句短副标题、授课信息、日期，以及可选的简短课程亮点。课程亮点最多2–4条，每条不超过16字，只概括本课核心主题或特色；没有合适内容可以省略，不凑数量，不写详细知识点、教学目标或长段落。
封面信息必须去重：授课人姓名、职称、学院/单位、联系方式、日期等同类信息各只展示一次，集中在一个合适区域；不能在原稿介绍区、侧栏与模板底栏重复放置相同信息。同义表达也算重复。模板空余区域可放简短课程亮点或适当留白，不能用重复的教师介绍填空。
不展示“适用对象”“授课对象”“适用人群”等标签及其对应的受众说明；受众/年级/基础仅为模型组织内容与讲稿的背景信息，不印在封面。也不展示目录、学习目标、课时时长或制作状态。课程名称中本来包含的年级等专有名称可保留，不额外添加受众栏。
已填写的授课人和日期用于本课封面，不从视觉模板复制他人的身份、日期或课程文字，也不能编造。更新旧课件时可保留原稿中未被明确覆盖的有效身份信息，但重复项合并为一次，受众元信息不搬到封面；这属于首页整理，不得据此删减原稿实质教学内容。
任何投影片都不得印“本页N分钟”、建议用时、总课时、制作状态或教师提示；时长只用于大纲和讲稿。页脚保持简洁，不重复封面中已有的身份与日期。写完首页自检：没有重复身份信息、没有受众栏、亮点简短且来自本课内容。`;

const endingRules=`结尾页专属规范：总页数大于1时，最后一页作为课程回顾与结束页，优先使用已记录的结尾页模板，不额外增加总页数。主标题用“课程小结”“本课回顾”或一句简短核心结论；可选一句课程收束语，回顾本课最重要的2–3个结论，每条简短、来自已讲内容，不新增知识或展开长篇推导。可选一句“谢谢聆听”或“欢迎提问”，不要重复堆叠致谢。
结尾页不得出现30分钟/三十分钟/课时时长、授课对象或适用对象；这些仅为讲稿和模型背景。默认不重复教师介绍、姓名、学院、联系方式。只有教师明确提供下节课内容或联系信息并要求展示时才使用，不沿用模板旧预告、旧英文标语、旧课程结论或来源名单。
不将长串来源堆到结束页；实际引用保留到已安排的参考资料页或对应讲稿，不编造来源，不为此突破已确认页数。全套页脚保持统一标题年月和当前页/总页数。只有1页的课件以首页为主，不另造结尾页。
更新原稿时，若原稿末页含实质教学内容，大纲阶段须明确安排其在正文中的保留位置并待教师确认，不能为了做结束页漏掉步骤、例题或数据。已确认旧大纲尚未安排转移时，不得在制作阶段擅自删掉这些内容，应保留并说明待调整事项。`;
const studentSurfaceRules=`学生可见画面规范：顶部额外页眉、章节导航、眉题区域留空，不展示“第2章 · 原理与结构”“第2章 · 应用实例”等章节/分类标签，也不换成别的导航文字。保留本页正常的正文主标题，留空页眉不等于删除页面标题；模板顶部色条、装饰线等可保留。
不要将原稿溯源信息写入HTML：不出现“来源：原第10页『3.生成对抗网络的应用』”“原第N页”“由原第X–Y页合并”等原页码、原文件名、原标题或制作说明。sourcePages等对应关系只保留在平台大纲和内部输入记录中，不抄到页面正文、图注、页眉或页脚，也不作为口述讲稿。
隐藏这些溯源/导航信息属于画面整理，不得删减正文知识、例题、公式或数据；真实文献引用、作者和配图授权署名不属于原稿页码溯源，按原有引用规则保留。旧大纲即使带有来源页码，也只用于定位原稿，不能作为投影片文案。`;
function footerData(task){
 let title=String(task.title||'课件').trim(),before;do{before=title;title=title.replace(/^第[零〇一二两三四五六七八九十百千\d]+(?:章|节|篇|讲|课|单元)[\s:：、·.．-]*/u,'').replace(/^\d{1,3}(?:[.．]\d{1,3})+[\s:：、·-]*/u,'').replace(/^[一二三四五六七八九十\d]+[、.．][\s]+/u,'').trim();}while(title!==before);
 let yearMonth;const date=String(task.lessonDate||'');if(/^\d{4}-\d{2}-\d{2}$/.test(date))yearMonth=Number(date.slice(0,4))+'.'+Number(date.slice(5,7));else{const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric',month:'numeric'}).formatToParts(new Date(task.createdAt||Date.now()));yearMonth=parts.find(p=>p.type==='year').value+'.'+Number(parts.find(p=>p.type==='month').value);}
 return {title:title||'课件',yearMonth};
}
function footerRules(task,page,total){const f=task.footer||footerData(task),left=f.title+' · '+f.yearMonth,right=page&&total?`<strong>${String(page).padStart(2,'0')}</strong>/${String(total).padStart(2,'0')}`:'<strong>两位当前页码</strong>/两位总页数';return `全套固定页脚规范（包括封面）：左侧文案统一为“${left}”，不换成本页标题、章节编号、学院或授课对象；右侧统一为${right}，仅当前页码加粗，斜杠两侧不留空格，不把Markdown星号打印到画面。页码按全套实际顺序连续编号。所有页在1280×720画布使用相同定位：距左48px、距右48px、距底20px，12px字体、16px行高，左右端点与基线一致；根据底色保证对比度，不随模板改变位置。删除旧模板自带的其他页脚/页码，只保留这一组；正文为底部页脚留出安全空间，不能重叠。年月已在统一页脚展示，不在封面侧栏、底栏重复印日期；教师讲稿仍可保留完整授课日期。`;
}
function filename(title){let name=String(title||'课件').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').slice(0,100)||'课件';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='课件-'+name;return name+'.pptx';}
function identity(task){return `授课人：${task.presenter||'未填写，封面省略'}\n授课日期：${task.lessonDate||'未填写，封面省略'}`;}
module.exports={coverRules,endingRules,studentSurfaceRules,footerData,footerRules,filename,identity};
