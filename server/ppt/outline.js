'use strict';
const bad=(message,code)=>{const e=new Error(message);e.status=400;if(code)e.code=code;throw e;};
function validate(value,task){
 const pageBased=Array.isArray(value?.pages)||value?.pageBased===true,items=pageBased?(value.pages||value.sections):value?.sections;
 if(!Array.isArray(items)||!items.length||items.length>(pageBased?150:30))bad(pageBased?'逐页大纲须包含1至150页。':'大纲需包含1至30个教学环节。');
 if(items.some(s=>!s||typeof s!=='object'||Array.isArray(s)))bad('大纲页面格式无效。');
 const sections=items.map(s=>({title:String(s.title??'').trim().slice(0,200),minutes:Number(s.minutes),description:String(s.description??s.content??'').trim().slice(0,6000),...(task.creationMode==='update'?{sourcePages:s.sourcePages||[]}:{}),...(s.layoutId?{layoutId:String(s.layoutId).slice(0,80)}:{}),...(s.image?{image:require('./images').intent(s.image)}:{})}));
 if(task.creationMode==='update'){
  const count=task.sourcePageCount;
  if(!pageBased||!Number.isInteger(count)||count<1)bad('请先读取有效原稿，再生成逐页大纲。');
  if(!task.pageCount&&sections.length!==count)bad('更新模式默认保留原稿页数，请核对逐页大纲。');
  if(sections.some(s=>!Array.isArray(s.sourcePages)||!s.sourcePages.length||s.sourcePages.some(n=>!Number.isInteger(n)||n<1||n>count)))bad('原稿来源页码无效。');
  const covered=new Set(sections.flatMap(s=>s.sourcePages));if(covered.size!==count)bad('更新大纲遗漏原稿页面，请保留全部来源页。');
  if(sections.some(s=>s.image?.kind==='web'))bad('更新模式保留原稿教学图片，不新增网上配图。');
 }
 if(sections.filter(s=>s.image?.kind==='web').length>1)bad('整套PPT最多一张外部配图，请仅保留一页网上找图。');
 if(sections.some(s=>!s.title||!Number.isFinite(s.minutes)||s.minutes<=0)||Math.abs(sections.reduce((a,s)=>a+s.minutes,0)-task.minutes)>.01)bad('大纲各页或环节的时间之和应等于课时。');
 if(pageBased&&sections.some(s=>!s.description))bad('请填写每一页展示的内容。');
 if(pageBased&&task.pageCount&&sections.length!==task.pageCount)bad(task.creationMode==='update'?`本次目标为${task.pageCount}页，制作工具却返回${sections.length}页，尚未形成符合要求的拆合页方案。请重新生成；若要保留原稿页数，请在填写要求中清空PPT页数。`:`逐页大纲须恰好${task.pageCount}页，当前为${sections.length}页。`,'outline_page_count');
 if(pageBased&&sections.some(s=>s.layoutId&&!task.template?.profile?.layoutGroups?.some(g=>g.id===s.layoutId)))bad('大纲所选布局不属于当前已确认模板，请重新选择。');
 for(const s of sections)if(s.image?.kind==='web')s.imageRegion=require('./images').layout(s,task.template?.profile?.layoutGroups);
 return {objective:String(value.objective??'').trim().slice(0,2000),sections,...(pageBased?{pageBased:true}:{})};
}
module.exports={validate};
