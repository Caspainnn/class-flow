'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{validateHtml}=require('./html-deck'),images=require('./images');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function inspect({task,taskDir}){
 const total=task.outline?.sections?.length||0,empty=reason=>({available:false,completed:0,total,reason});
 if(!['failed','cancelled'].includes(task.status)||task.run?.phase!=='html')return empty('仅中断的逐页课件制作支持续做。');
 if(!/^[a-f0-9]{24}$/.test(task.run.id)||(task.run.requirementsRevision||0)!==(task.requirementsRevision||0))return empty('教学要求已变化，请全部重新生成。');
 let root,input,plan;try{
  const base=fs.realpathSync(taskDir);root=fs.realpathSync(path.join(base,'runs',task.run.id));if(!root.startsWith(base+path.sep))return empty('续做目录无效。');
  const read=(relative,max)=>{const file=fs.realpathSync(path.join(root,relative));if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile()||fs.statSync(file).size>max)throw Error('checkpoint path');return fs.readFileSync(file);};
  input=JSON.parse(read('input.json',4*1024*1024));
  if(JSON.stringify(input.outline)!==JSON.stringify(task.outline)||(input.template?.sha256||null)!==(task.template?.sha256||null))return empty('大纲或模板已变化，请全部重新生成。');
  for(const key of Object.keys(input.requirements))if(key!=='sourcePageCount'&&String(input.requirements[key]??'')!==String(task[key]??(key==='pageCountPolicy'?'preserve':key==='creationMode'?'create':'')))return empty('教学要求已变化，请全部重新生成。');
  plan=JSON.parse(read('image-plan.json',256*1024));if(!Array.isArray(plan)||plan.filter(i=>i?.status==='ready').length>1)return empty('配图记录不完整，无法安全续做。');
  const source=task.creationMode==='update'?JSON.parse(read('source-content.json',4*1024*1024)):null,slides=[];let bytes=0;
  for(let i=0;i<total;i++){
   try{
    const sub='pages/'+String(i+1).padStart(3,'0'),original=read(sub+'/slide.html',require('./html-deck').pageLimit(task));let html=original.toString('utf8');const raw=JSON.parse(read(sub+'/slide.json',256*1024));
    let ready=null;try{ready=JSON.parse(read(sub+'/ready.json',256*1024));}catch(e){if(e.code!=='ENOENT')throw e;}
    if(ready&&ready.sha256!==hash(original))break;
    const meta=ready?.meta||raw;
    if(meta.title!==task.outline.sections[i].title||typeof meta.speech!=='string'||meta.speech.trim().length<40||meta.speech.length>40000||typeof meta.notes!=='string'||meta.notes.length>20000)break;
    const image=plan[i]||null;
    if(source){html=require('./source-images').inline(html,{runDir:root,htmlFile:path.join(root,sub,'slide.html'),pages:source.pages.filter(p=>task.outline.sections[i].sourcePages.includes(p.number))});}
    else{images.noUnplannedImages(html);if(html.includes('<!--PPT_IMAGE_START-->')!==(image?.status==='ready'))break;if(image?.status==='ready'&&!/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(image.source||''))break;}
    validateHtml(Buffer.from(html),task);bytes+=Buffer.byteLength(html);if(bytes>(source?80:20)*1024*1024)break;
    const credit=images.credit(image),notes=credit&&!meta.notes.includes(credit)?meta.notes.slice(0,17000)+'\n'+credit:meta.notes;
    slides.push({number:i+1,title:meta.title,notes,speech:meta.speech.trim(),html,image});
   }catch{break;}
  }
  return {available:slides.length>0,completed:slides.length,total,runId:task.run.id,slides,reason:slides.length?'':'没有已完成且通过校验的页面，请全部重新生成。'};
 }catch{return empty('本轮文件记录不完整，无法安全续做。');}
}
function stage(resume,runDir){
 for(const slide of resume.slides){const sub='pages/'+String(slide.number).padStart(3,'0');fs.mkdirSync(path.join(runDir,sub),{recursive:true});const meta={title:slide.title,notes:slide.notes,speech:slide.speech};fs.writeFileSync(path.join(runDir,sub,'slide.html'),slide.html);fs.writeFileSync(path.join(runDir,sub,'slide.json'),JSON.stringify(meta));fs.writeFileSync(path.join(runDir,sub,'ready.json'),JSON.stringify({sha256:hash(Buffer.from(slide.html)),meta}));}
 return {runId:resume.runId,completed:resume.completed,imagePlan:resume.slides.map(s=>s.image)};
}
module.exports={inspect,stage};
