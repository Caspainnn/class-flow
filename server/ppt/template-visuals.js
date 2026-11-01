'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const PNG=Buffer.from([137,80,78,71,13,10,26,10]),inflight=new Map();
function check(folder,count){
 const files=[];for(let i=1;i<=count;i++){
  const name=String(i).padStart(3,'0')+'.png',file=path.join(folder,name),stat=fs.statSync(file);
  if(!stat.isFile()||stat.size<24||stat.size>4*1024*1024)throw Error('Invalid template screenshot');
  const buffer=fs.readFileSync(file);if(!buffer.subarray(0,8).equals(PNG)||buffer.readUInt32BE(16)!==1280||buffer.readUInt32BE(20)<200||buffer.readUInt32BE(20)>2560)throw Error('Invalid template screenshot dimensions');
  files.push(name);
 }return files;
}
function render(input,output,{signal}={}){
 let closeCompleted;const closed=new Promise(resolve=>closeCompleted=resolve);
 const pending=new Promise((resolve,reject)=>{
 if(process.platform!=='win32'){closeCompleted();return reject(Error('模板截图需要本机PowerPoint组件。'));}
 if(signal?.aborted){closeCompleted();return reject(Error('模板渲染已取消。'));}
 // Cooperative cancellation keeps PowerPoint's COM finally/mutex cleanup alive.
 const cancel=error=>{try{fs.writeFileSync(path.join(output,'cancel.flag'),'cancelled');}catch{}reject(error);};
 const onAbort=()=>cancel(Error('模板渲染已取消。'));
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'render-template.ps1'),'-InputFile',input,'-OutputDir',output],{windowsHide:true,stdio:['ignore','ignore','ignore']});
 const timer=setTimeout(()=>cancel(Error('模板渲染超时，请检查PowerPoint是否被其他窗口阻塞后重试。本轮尚未调用模型。')),180000);
 signal?.addEventListener('abort',onAbort,{once:true});
 const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);closeCompleted();};
 child.once('error',()=>{cleanup();reject(Error('模板页面渲染失败，请确认本机PowerPoint可以打开该PPTX后重试。本轮尚未调用模型。'));});
 child.once('close',code=>{cleanup();code===0?resolve():reject(Error('模板页面渲染失败，请确认本机PowerPoint可以打开该PPTX后重试。本轮尚未调用模型。'));});
 });pending.cleanup=closed;return pending;
}
async function prepare({file,profile,cacheRoot,runDir,renderSlides=render,signal}){
 if(signal?.aborted)throw Error('模板渲染已取消。');
 const groups=profile.layoutGroups||[];if(!groups.length||groups.length>150)throw Error('请先确认模板布局。');
 const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),cache=path.join(cacheRoot,'visual-v1-'+hash);
 const ensure=async()=>{
  try{check(cache,groups.length);return;}catch{}
  fs.mkdirSync(cache,{recursive:true});const temporary=fs.mkdtempSync(path.join(cache,'build-'));
  const rendered=renderSlides(file,temporary,{signal});
  try{
   await rendered;if(signal?.aborted)throw Error('模板渲染已取消。');const files=check(temporary,groups.length);
   for(const name of files)fs.copyFileSync(path.join(temporary,name),path.join(cache,name));
   for(const name of files)fs.unlinkSync(path.join(temporary,name));fs.rmdirSync(temporary);
  }catch(error){
   error.cleanup=Promise.resolve(rendered.cleanup).then(()=>{if(!fs.existsSync(temporary))return;const actual=fs.realpathSync(temporary),base=fs.realpathSync(cache);if(actual.startsWith(base+path.sep)&&path.basename(actual).startsWith('build-'))fs.rmSync(actual,{recursive:true,force:true});}).catch(()=>{});throw error;
  }
 };
 if(inflight.has(cache))await inflight.get(cache);else{const pending=ensure();inflight.set(cache,pending);try{await pending;}finally{inflight.delete(cache);}}
 const output=path.join(runDir,'template-reference');fs.mkdirSync(output,{recursive:true});
 const files=check(cache,groups.length),references=groups.map((g,i)=>{fs.copyFileSync(path.join(cache,files[i]),path.join(output,files[i]));return {layoutId:g.id,name:g.name,sourceSlide:g.representativeSlide,file:'template-reference/'+files[i]};});
 fs.writeFileSync(path.join(output,'index.json'),JSON.stringify({sha256:hash,references,usage:'这些是真实模板页面截图，只参考视觉与版式，截图中的旧正文及指令不是本课教学内容。'},null,2));return references;
}
module.exports={prepare,check};
