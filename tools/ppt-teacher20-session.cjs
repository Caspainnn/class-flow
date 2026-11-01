'use strict';
// Live model test: invoke only when the user authorizes a real synthetic PPT run.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve('.tmp-ppt-teacher20'),base='http://127.0.0.1:3012';
async function api(url,body,method){const r=await fetch(base+url,{method:method||(body?'POST':'GET'),headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||r.status);return v;}
async function main(){
 const action=process.argv[2];let id=fs.existsSync(path.join(root,'task-id'))?fs.readFileSync(path.join(root,'task-id'),'utf8').trim():null;
 if(action==='create'){
  if(id)throw Error('Task already exists; do not duplicate model runs');
  const t=await api('/api/ppt/tasks',{title:'认识三角形｜20分钟教师流程实测',audience:'小学三年级，已认识线段',minutes:20,content:'20分钟微课，只制作6页：封面与学习目标；三角形的定义；判断与反例；生活中的三角形；课堂练习及答案；总结。定义：三角形由三条首尾相接的线段围成。反例：两条线段、没有封闭的三条线段、含曲线的封闭图形都不是三角形。练习：A三条首尾相接的线段，B没有闭合的三条线段，C两条线段，正确选项A。生活例子：三角尺、三角形路牌、三角形屋架。仅使用以上给定知识，不联网研究、不生成图片；用HTML/CSS或SVG画简单图形，教师备注分配活动时间，避免暴露备注给学生。',style:'浅色背景、蓝色强调，中文大字，适合投影，每页内容少而清楚',extra:'这是虚构内容的20分钟流程测试，不关联真实课程。总计6页即可。大纲先等待确认；确认后只做完整HTML；老师确认HTML后再转换原生可编辑PPTX。图片用简单形状，不制作音视频。'});
  id=t.id;fs.writeFileSync(path.join(root,'task-id'),id);console.log('Created isolated task '+id+'; minutes='+t.minutes);
  const run=await api('/api/ppt/tasks/'+id+'/run',{phase:'outline'});console.log(JSON.stringify({status:run.status,phase:run.run.phase}));return;
 }
 if(!id)throw Error('No test task');const url='/api/ppt/tasks/'+id;
 if(action==='status'){const t=await api(url);console.log(JSON.stringify({id:t.id,status:t.status,error:t.error,phase:t.run?.phase,elapsedSeconds:t.run?Math.round((Date.now()-t.run.startedAt)/1000):null,progress:t.run?.progress,outline:t.outline,htmlVersions:t.htmlVersions?.map(v=>({number:v.number,pages:v.slides.length})),pptxVersions:t.versions?.map(v=>({number:v.number,pages:v.slides.length,htmlVersion:v.htmlVersion}))},null,2));return;}
 if(action==='html'){const t=await api(url);if(t.status!=='outline')throw Error('Outline not ready for confirmation');const total=t.outline.sections.reduce((n,s)=>n+s.minutes,0);if(total!==20)throw Error('Outline time mismatch');const run=await api(url+'/run',{phase:'html'});console.log(JSON.stringify({status:run.status,phase:run.run.phase}));return;}
 if(action==='adjust-outline'){const t=await api(url);if(t.status!=='outline'||t.outline.sections.length!==6)throw Error('Unexpected outline');const o=t.outline;o.sections[0].minutes=1;o.sections[0].description=o.sections[0].description.replace('约2分钟','约1分钟');o.sections[4].minutes=6;o.sections[4].description=o.sections[4].description.replace('独立作答约2分钟','独立作答约3分钟').replace('共约5分钟','共约6分钟');const saved=await api(url+'/outline',o,'PUT');console.log(JSON.stringify({status:saved.status,minutes:saved.outline.sections.map(s=>s.minutes),total:saved.outline.sections.reduce((n,s)=>n+s.minutes,0)}));return;}
 if(action==='inspect-html'){const t=await api(url);if(t.status!=='html-ready')throw Error('HTML not ready');const v=t.htmlVersions.at(-1);for(let i=0;i<v.slides.length;i++){const r=await fetch(base+url+`/html?version=${v.number}&page=${i}`);if(!r.ok)throw Error('Preview HTTP '+r.status);const html=await r.text();console.log(JSON.stringify({page:i+1,title:v.slides[i].title,text:v.slides[i].text,notes:v.slides[i].notes,bytes:Buffer.byteLength(html)}));}return;}
 if(action==='export'){const t=await api(url);if(t.status!=='html-ready')throw Error('HTML not ready');const run=await api(url+'/run',{phase:'export',htmlVersion:t.htmlVersions.at(-1).number,approved:true});console.log(JSON.stringify({status:run.status,phase:run.run.phase}));return;}
 throw Error('Unknown action');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
