'use strict';
const fs=require('node:fs'),path=require('node:path');
function busy(root,now=Date.now()){
 const read=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('本地任务状态无法读取，请检查后再退出。');}};
 const data=(name,fallback=[])=>read(path.join(root,name+'.json'),fallback),s=data('settings',{}),rows=[];
 if(data('sessions').some(v=>!v.closed&&now<(Number(v.endsAt)||0)+(Number(s.lateGraceMs)||600000)))rows.push('签到尚未结束');
 if(data('gradebatches').some(v=>!v.deletedAt&&v.status==='running'))rows.push('作业正在批改');
 if((data('questionnaires',{surveys:[]}).surveys||[]).some(v=>v.status==='collecting'&&(!v.deadline||Date.parse(v.deadline)>now)))rows.push('问卷正在回收');
 for(const folder of ['ppt','lesson-plan','questionnaire-ai']){const base=path.join(root,folder);if(!fs.existsSync(base))continue;for(const name of fs.readdirSync(base).filter(x=>/^[a-f0-9]{24}$/.test(x))){const task=read(path.join(base,name,'task.json'),null);if(task&&!task.deletedAt&&task.status==='running'){rows.push('课件、教案或问卷正在生成');break;}}}
 const templates=path.join(root,'ppt','_templates');if(fs.existsSync(templates))for(const name of fs.readdirSync(templates).filter(x=>/^[a-f0-9]{24}$/.test(x))){const t=read(path.join(templates,name,'template.json'),null);if(t&&!t.deletedAt&&t.layoutGuide?.status==='running'){rows.push('课件模板正在分析');break;}}
 return [...new Set(rows)];
}
module.exports={busy};
