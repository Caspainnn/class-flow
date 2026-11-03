'use strict';
// Read code templates only: never read task folders, settings or student data.
const fs=require('node:fs');
const read=p=>fs.readFileSync('server/'+p,'utf8');
const outline=require('../server/ppt/outline-prompt');
const cover=require('../server/ppt/presentation-rules').coverRules;
const update=require('../server/ppt/update-prompt');
const items=[];
function add(id,group,title,source,text,fixed,variables){items.push({id,group,title,source,text,fixed,variables});}
add('cover','PPT · 新建','首页与公共内容规范','ppt/presentation-rules.js · coverRules',cover,'首页规范用于新建大纲和HTML制作；导出只保留已确认版本。受众仅为组织教学的背景，不印在封面。','课程主题、授课人、授课日期：来自每次课件需求，模板中不保存实际值。');
add('outline','PPT · 新建','逐页大纲','ppt/outline-prompt.js · rules / handoff',outline.rules.slice(cover.length).trim(),outline.handoff.slice(outline.rules.length).trim(),'主题、受众、课时、页数、参考资料、模板布局：每次任务自动提供。');
const page=read('ppt/page-runner.js');
const pageText=page.match(/const message=`([\s\S]*?)`;/)[1];
add('page','PPT · 新建','逐页HTML与讲稿','ppt/page-runner.js · message / fullMessage',pageText.split('\\n')[1], '每轮只做指定一页；1280×720独立静态HTML；slide.html + slide.json（title/notes/speech）；不执行命令、不加载PPTX技能。模板截图决定视觉，平台管理图片，整套最多一张外部图片。首页继续叠加公共规范。','当前页标题、已确认大纲、原始要求、参考资料、上一页HTML、模板与配图区域：自动提供。');
const handoff=read('ppt/handoff.js');
add('modify','PPT · 新建','指定页修改','ppt/handoff.js · html-modify','保留其余页面的文件内容和备注，只修改教师指定页。每页同时提供可直接讲授的完整口语演讲稿speech，含[提问]等教师提示，不是知识点摘要；修改指定页时同步改写本页讲稿，其他页的标题、备注和speech须与输入逐字保持一致。','输出html-delivery.json，仍列出所有页面。保留平台唯一图片插槽及配图区；不另找图片、不复制到其他页。完成后等待HTML确认，不导出PPTX。','指定页码、修改意见、当前HTML、大纲、讲稿、模板截图：来自当轮操作。');
for(const phase of ['outline','html','export']){
 const full=update.build({sourceName:'{{原稿文件名}}.pptx',platform:true,phase});
 const start=full.indexOf('内容保留约束：');const end=full.lastIndexOf('\n\n');
 add('update-'+phase,'PPT · 更新',({outline:'原稿更新大纲',html:'逐页更新HTML与讲稿',export:'已确认版本导出'})[phase],'ppt/update-prompt.js · '+phase,phase==='export'?'仅转换教师确认的HTML，内容、顺序、图片和讲稿不变。':full.slice(start,end),full.slice(end).trim()+'\n原稿页数、保留/适配策略和教师授权按任务提供；不把新建短要点与单张配图限制套到旧稿。','原稿、完整原页对象、来源页映射、视觉模板、目标页数、已确认变更：自动提供；这里不嵌入原稿内容。');
}
add('export','PPT · 新建','已确认HTML导出PPTX','ppt/handoff.js · export','以教师明确确认的HTML版本为准，保持文案、页数、顺序和主要排版，只做格式转换。保留外部配图比例、署名与许可信息；将逐页完整讲稿写入对应页备注。保留原生可编辑文本框、形状、表格或图表，不能用整页截图冒充可编辑课件。','平台固定PPTX skill与Python入口、Quick路线、SVG检查与转换脚本、delivery.json结构；必须真实写出产物，失败明确报告。此阶段不重新整理首页。','教师确认的HTML版本、逐页讲稿、输出文件名：自动提供。');
const lesson=read('lesson-plan/service.js');const message=lesson.match(/const message=`([\s\S]*?)`;/)[1];
add('lesson','教案','教案制作','lesson-plan/service.js · message / effectiveMessage',message.slice(message.indexOf('教学过程时间列'),message.indexOf('只交付本轮教案JSON')).replace('${t.minutes}','{{课时分钟}}')+'\n文字按目标、动作步骤和题目分项换行；长段拆短段，表格单元格内同样排版。保留必要公式、代码和题目原样，不在函数或表达式中插入换行；作业与思考题不要复制参考资料中的答案或解答。','完整保留模板章节、块数量、表头和顺序；输出plan.json；平台生成Word。只读写本轮目录，不调用Shell或子代理；仍需遵循input.json中的qualityRules。','{{课时分钟}}：教师填写的总课时，保存时必须保留。教学要求、模板、参考文件及qualityRules：任务自动提供。');
add('grade','作业','批改作业','grade/grade.js · buildPrompt','请按「标准答案和评分规则.txt」逐份批改学生作业。作业情况里写清每题得分和失分原因，最后给一句总评；正文署名与文件名不符（交了别人的）标注异常，不要给分。','平台调用写批改结果.json（姓名、得分、题目、总评）；手动调用写作业批改结果.xlsx。无法读取、署名不符得分null。目录、名单数量、已收份数、题目分值与从严/从宽尺度由任务注入，不能在模板改成绩或名单。','评分规则、名单、作业文件、每题分值、评分尺度：来自批次；原型不加载任何实际学生数据。');
const questionnaire=require('../server/questionnaire/generator').prompt('{{本轮目录}}').split('\n');
add('questionnaire','问卷','问卷初版生成','questionnaire/generator.js · prompt',questionnaire[1],questionnaire[0]+'\n'+questionnaire[2],'调查目的、调查对象、关注点、题量：每轮需求提供。{{本轮目录}}由平台填入，不可手动指定目录。');
items.sort((a,b)=>['PPT · 新建','PPT · 更新','教案','作业','问卷'].indexOf(a.group)-['PPT · 新建','PPT · 更新','教案','作业','问卷'].indexOf(b.group));
for(const item of items){
 item.raw=item.id==='cover'?cover:item.id==='outline'?outline.handoff:item.id==='page'?pageText:item.id==='lesson'?message:item.id==='questionnaire'?questionnaire.join('\n'):item.id.startsWith('update-')?update.build({sourceName:'{{原稿文件名}}.pptx',platform:true,phase:item.id.slice(7)}):item.id==='grade'?read('grade/grade.js').split('  function buildPrompt(batch, dirAbs, asJson) {')[1].split('  /* ============')[0]:handoff;
}
fs.writeFileSync('prototype/workbuddy-prompts-data.js','// Code-derived prototype snapshot; not used by production.\nwindow.PROMPT_CATALOG='+JSON.stringify(items,null,2)+';\n');
console.log('Built '+items.length+' isolated prompt stages');
