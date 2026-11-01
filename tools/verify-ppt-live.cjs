'use strict';
// User-authorized single synthetic workflow; no real teaching data is written.
const fs=require('node:fs'),path=require('node:path');
const {createService}=require('../server/ppt/service');
if(!process.argv.includes('--run-live')){console.error('Use --run-live only with explicit authorization for model usage.');process.exit(1);}
const project=path.resolve(__dirname,'..'),root=path.join(project,'.tmp-ppt-live-check');
const ppt={name:'PPT Master',revision:'5832c3a8ca77e22284198407f0a7e4485ada9688',skillPath:path.join(project,'.local-ppt-skills/ppt-master'),pythonPath:path.join(project,'.local-ppt-python/Scripts/python.exe'),timeoutMs:900000,allowShell:process.argv.includes('--allow-shell-once')};
fs.writeFileSync(path.join(project,'.local-ppt-skills/config.json'),JSON.stringify({...ppt,allowShell:false},null,2));
const settings=JSON.parse(fs.readFileSync(path.join(project,'data/settings.json'),'utf8'));
const service=createService({root,getSettings:()=>({...settings,ppt}),getCourses:()=>[]});
const wait=()=>new Promise(resolve=>setTimeout(resolve,2000));
async function settle(task){let t=task;while(t.status==='running'){await wait();t=service.get(t.id);}return t;}
(async()=>{
 const existing=service.list().find(t=>t.title==='识别三角形（虚构联调）');
 const task=existing||service.create({title:'识别三角形（虚构联调）',audience:'小学三年级，认识线段',minutes:5,content:'严格只制作5页：封面与目标、三角形定义、生活中的三角形、一道辨认练习、总结。三角形由三条首尾相接的线段围成；练习：三条首尾相接线段是三角形，两条线段不是。只用这些给定内容，不联网研究，不生图。图形使用原生可编辑元素，中文适合投影，含教师备注。',extra:'本次是已授权的虚构集成验证。大纲确认后直接进入SVG制作和导出，使用Quick路线，不需要额外的策略选择或确认，不生成音频/视频，不启动预览服务器。'});
 console.log('Synthetic task:',task.id);
 let t=task.outline?task:await settle(service.start(task.id,'outline'));
 console.log('Outline status:',t.status);if(!t.outline){console.log(t.error);process.exitCode=2;return;}
 console.log('Validated outline sections:',t.outline.sections.length);
 t=await settle(service.start(task.id,'deck'));
 console.log('Delivery status:',t.status);if(t.status!=='complete'){console.log(t.error);process.exitCode=3;return;}
 console.log('Actual PPTX:',service.file(t.id,t.versions.at(-1).file));console.log('Slides:',t.versions.at(-1).slides.length,'Sources:',t.versions.at(-1).sources.length);
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({taskId:t.id,status:t.status,version:t.versions.at(-1)},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
