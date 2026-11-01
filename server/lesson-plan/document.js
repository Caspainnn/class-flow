'use strict';
const ZIP=require('jszip');
const {SaxesParser}=require('saxes');
const MAX=20*1024*1024;
const WORD_LAYOUT_REVISION=5;
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function str(v,max=12000){if(typeof v!=='string'||v.length>max)fail('教案文字格式不正确或过长。');return v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim();}
const text=(label='')=>({type:'text',label,text:''});
const table=(headers,rows=[])=>({type:'table',headers,rows});
function builtin(){return {sections:[
 {title:'一、课程基本信息',blocks:[table(['项目','内容'],['课程名称','章节与主题','授课对象','课时安排','教材与范围','授课教师／地点'].map(x=>[x,'']))]},
 {title:'二、教学目标',blocks:[text('1. 知识与理解'),text('2. 方法与能力'),text('3. 意识与素养')]},
 {title:'三、教学重点与难点',blocks:[text('重点'),table(['难点','学生卡在哪','突破手段','评价证据'])]},
 {title:'四、学情分析',blocks:[text('已有基础'),text('困难'),text('诊断'),text('支持')]},{title:'五、教学准备',blocks:[text()]},
 {title:'六、教学过程',blocks:[table(['环节','时间','主要内容','教师活动','学生活动','设计意图'])]},
 {title:'七、板书设计',blocks:[table(['区域','板书内容'])]},
 {title:'八、作业与思考题',blocks:[text('课堂讨论与检测'),text('课后实践与评价')]},
 {title:'九、教学反思（课后填写）',blocks:[table(['观察点','预设风险与改进线索','实际记录'])]}
 ]};}
function timeTables(plan){return plan.sections.flatMap(s=>s.blocks.filter(b=>b.type==='table'&&b.headers.some(h=>/^(时间|时长)([（(].*[）)])?$/.test(h))));}
function duration(value){const m=String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(?:分钟|min)?$/i);return m?Number(m[1]):NaN;}
function normalizeGenerated(value,schema){
 const plan=structuredClone(value),changes=[];
 if(!Array.isArray(plan?.sections))return {plan,changes};
 for(const [i,s] of plan.sections.entries())for(const [j,b] of (Array.isArray(s?.blocks)?s.blocks:[]).entries()){
  const ref=schema.sections[i]?.blocks[j];if(ref?.type!=='table'||b?.type!=='table'||JSON.stringify(b.headers)!==JSON.stringify(ref.headers)||!Array.isArray(b.rows))continue;
  b.rows=b.rows.map((row,k)=>{if(!Array.isArray(row))return row;const width=ref.headers.length;let r=row;
   if(r.length>width&&r.slice(width).every(v=>typeof v==='string'&&!v.trim())){r=r.slice(0,width);changes.push(`${s.title}第${k+1}行：移除多余空单元格`);}
   if(r.length<width&&ref.headers.slice(r.length).every(h=>/实际记录/.test(h))){r=[...r,...ref.headers.slice(r.length).map(()=> '')];changes.push(`${s.title}第${k+1}行：补回空白实际记录区`);}
   return r.map(v=>{if(typeof v==='number'&&Number.isFinite(v)){changes.push(`${s.title}第${k+1}行：将数字转换为单元格文字`);return String(v);}return v;});
  });
 }
 return {plan,changes};
}
function validate(value,schema,minutes,{generated=false,draft=false}={}){
 if(!value||!Array.isArray(value.sections)||value.sections.length!==schema.sections.length)fail('教案章节不完整，请保留所选模板的全部章节。');
 const plan={sections:value.sections.map((s,i)=>{
  const ref=schema.sections[i];if(s?.title!==ref.title||!Array.isArray(s.blocks)||s.blocks.length!==ref.blocks.length)fail('教案章节或表格结构与模板不一致。');
  return {title:ref.title,blocks:s.blocks.map((b,j)=>{
   const r=ref.blocks[j];if(b?.type!==r.type)fail('请保留模板原有段落和表格。');
   if(r.type==='text'){const value=str(b.text);if(generated&&!value)fail('模型交付的教案仍有空白或未完成内容，请重新生成。');return {type:'text',label:r.label||'',text:value};}
   const editableBoard=!generated&&/板书设计/.test(ref.title);
   if(!Array.isArray(b.headers)||!b.headers.length||b.headers.length>10||(!editableBoard&&JSON.stringify(b.headers)!==JSON.stringify(r.headers))||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>60)fail('请保留模板表头；板书设计可调整为1至10列，每张表需有1至60行内容。');
   const headers=editableBoard?b.headers.map(h=>{const name=str(h,80);if(!name)fail('板书表头不能为空，请填写列名称。');return name;}):r.headers;
   if(r.headers.join('/')==='项目/内容'&&r.rows.length&&(b.rows.length!==r.rows.length||b.rows.some((row,k)=>!Array.isArray(row)||row[0]!==r.rows[k][0])))fail('请保留模板的全部基本信息字段及教师填写区。');
   return {type:'table',headers,rows:b.rows.map(row=>{
    // Model JSON may include empty trailing cells. Keep authored values strict;
    // only discard redundant blank overflow from a generated, unpublished draft.
    if(generated&&Array.isArray(row)&&row.length>r.headers.length&&row.slice(r.headers.length).every(v=>typeof v==='string'&&!v.trim()))row=row.slice(0,r.headers.length);
    if(!Array.isArray(row)||row.length!==headers.length)fail(`“${ref.title}”表格列数与模板不一致：表头需${headers.length}列，当前行有${Array.isArray(row)?row.length:'无效'}列。`);
    return row.map((v,k)=>{if(generated&&/实际记录/.test(r.headers[k]))return '';const value=str(v,6000);if(generated&&!value)fail('模型交付的表格仍有空白或未完成内容，请重新生成。');return value;});
   })};
  })};
 })};
 if(generated)for(const section of plan.sections)if(/作业|思考题/.test(section.title))for(const block of section.blocks){const values=block.type==='text'?[block.label,block.text]:block.rows.flat();if(values.some(v=>/(?:^|[\n。；])\s*(?:[•●·-]\s*)?(?:\*\*)?(?:参考答案|标准答案|答案要点|参考解答|解答|答案)\s*[：:]/.test(v)))fail('作业与思考题只保留题目、提交要求和评价标准，请移除答案或解答。');}
 const tables=timeTables(plan);if(tables.length!==1)fail('模板需有一张带“时间”或“时长”列的教学过程表。');
 const t=tables[0],col=t.headers.findIndex(h=>/^(时间|时长)([（(].*[）)])?$/.test(h));
 const times=t.rows.map(r=>duration(r[col]));
 if(!draft&&(times.some(n=>!Number.isFinite(n)||n<=0)||Math.abs(times.reduce((s,n)=>s+n,0)-minutes)>.01))fail(`教学过程各环节时间须为正数，合计必须等于${minutes}分钟。`);
 if(JSON.stringify(plan).length>500000)fail('教案内容过长，请精简后保存。');
 if(value.summary!==undefined){if(!value.summary||typeof value.summary!=='object'||Array.isArray(value.summary))fail('课程摘要格式不正确。');plan.summary={lessonType:str(value.summary.lessonType||'',100),previousTopic:str(value.summary.previousTopic||'',100)};}
 return plan;
}
async function openPackage(buffer,kind='docx'){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>MAX)fail('文件为空或超过20MB。');
 let zip;try{zip=await ZIP.loadAsync(buffer);}catch{fail(`无法读取${kind.toUpperCase()}文件，请选择有效的Office文件。`);}
 const entries=Object.values(zip.files);
 if(entries.length>2500||entries.reduce((s,e)=>s+(e._data?.uncompressedSize||0),0)>60*1024*1024||entries.some(e=>(e._data?.uncompressedSize||0)>12*1024*1024))fail('DOCX/Office文件解压后过大，请精简后上传。');
 const entry=kind==='docx'?'word/document.xml':'ppt/presentation.xml';
 if(!zip.file('[Content_Types].xml')||!zip.file(entry)||entries.some(e=>/vbaProject|embeddings\//i.test(e.name)))fail('请使用不含宏或嵌入对象的标准DOCX/PPTX文件。');
 return zip;
}
function readEntry(zip,name,budget={bytes:0}){
 const entry=zip.file(name);if(!entry)fail('Office文件缺少正文，请重新保存后上传。');
 return new Promise((resolve,reject)=>{const chunks=[];let total=0,settled=false;const stream=entry.internalStream('nodebuffer');
  stream.on('data',chunk=>{if(settled)return;total+=chunk.length;budget.bytes+=chunk.length;
   if(total>12*1024*1024||budget.bytes>60*1024*1024){settled=true;stream.pause();reject(Object.assign(new Error('Office文件实际解压内容过大，请精简后上传。'),{status:400}));return;}chunks.push(chunk);
  });
  stream.on('error',()=>{if(!settled){settled=true;reject(Object.assign(new Error('Office文件解压数据与声明不符，请重新保存后上传。'),{status:400}));}});
  stream.on('end',()=>{if(!settled){settled=true;resolve(Buffer.concat(chunks).toString('utf8'));}});stream.resume();
 });
}
function parse(xml){
 const root={name:'root',children:[]},stack=[root];let count=0;
 const parser=new SaxesParser();
 parser.on('doctype',()=>fail('不支持含外部声明的Word文档。'));
 parser.on('opentag',n=>{if(++count>180000||stack.length>100)fail('Word文档结构过于复杂。');const node={name:n.name,attrs:n.attributes,children:[]};stack.at(-1).children.push(node);stack.push(node);});
 parser.on('text',t=>{stack.at(-1).value=(stack.at(-1).value||'')+t;});parser.on('closetag',()=>stack.pop());
 try{parser.write(xml).close();}catch(e){if(e.status)throw e;fail('Word文档XML损坏，请重新保存后上传。');}return root;
}
const local=n=>n.name.split(':').at(-1);
function descendants(n,name){return n.children.flatMap(c=>[...(local(c)===name?[c]:[]),...descendants(c,name)]);}
function content(n){return descendants(n,'t').map(t=>t.value||'').join('').trim();}
function extractText(xml){return descendants(parse(xml),'p').map(content).filter(Boolean).join('\n');}
async function inspectTemplate(buffer){
 const zip=await openPackage(buffer),tree=parse(await readEntry(zip,'word/document.xml'));
 const body=descendants(tree,'body')[0];if(!body)fail('Word文档没有正文。');
 const schema={sections:[]};let section;
 // Numbered chapters are authoritative; some teachers also style the document title as Heading1.
 const numbered=body.children.some(n=>local(n)==='p'&&/^[一二三四五六七八九十百]+[、.．]/.test(content(n)));
 for(const node of body.children){
  if(local(node)==='p'){
   const line=content(node);if(!line)continue;
   if(/^[一二三四五六七八九十百]+[、.．]/.test(line)||(!numbered&&descendants(node,'pStyle').some(s=>/^(Heading1|1|标题1)$/i.test(s.attrs['w:val']||'')))){section={title:line.slice(0,150),blocks:[]};schema.sections.push(section);}
   else if(section){const last=section.blocks.at(-1);if(last?.type==='text')last.text+='\n'+line;else section.blocks.push({type:'text',label:'',text:line});}
  }else if(local(node)==='tbl'&&section){
   if(descendants(node,'gridSpan').length||descendants(node,'vMerge').length||descendants(node,'tbl').length)fail('当前支持普通行列表格；此模板含合并单元格或嵌套表格，请先在Word中拆分后上传。');
   const rows=node.children.filter(n=>local(n)==='tr').map(r=>r.children.filter(n=>local(n)==='tc').map(content));
   const headers=rows.shift();if(!headers?.length||headers.length>10||rows.length>60||rows.some(r=>r.length!==headers.length))fail('模板表格列数不齐或过大，请精简后上传。');
   section.blocks.push(table(headers,rows));
  }
 }
 if(!schema.sections.length||schema.sections.length>20||schema.sections.some(s=>!s.blocks.length||s.blocks.length>20))fail('未识别到完整章节。请使用“一、章节名”或Word一级标题，并在每章添加正文或表格。');
 if(timeTables(schema).length!==1)fail('模板需有一张带“时间”或“时长”列的教学过程表。');
 // Keep structure and field labels, never reuse sample teaching/reflection text as a new lesson.
 for(const s of schema.sections)for(const b of s.blocks)if(b.type==='text')b.text='';else b.rows=b.headers.join('/')==='项目/内容'?b.rows.map(r=>[r[0],'']):[];
 return schema;
}
const esc=v=>String(v).replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function exportDocx(plan,title,options){return require('./word').exportDocx(plan,title,options,{ZIP,openPackage,readEntry,parse,descendants,content,local,esc});}

module.exports={builtin,timeTables,duration,normalizeGenerated,validate,inspectTemplate,exportDocx,openPackage,readEntry,extractText,fail,MAX,WORD_LAYOUT_REVISION};
