'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const extract=require('./native-scene'),{validateHtml}=require('./html-deck');
const run=path.resolve(process.argv[2]),output=path.join(run,'native-export'),input=JSON.parse(fs.readFileSync(path.join(run,'input.json'),'utf8'));
const slides=input.htmlVersion?.slides;if(!Array.isArray(slides)||!slides.length||slides.length>150)throw Error('当前课件页数无效。');
const started=Date.now();fs.mkdirSync(output,{recursive:true});
function progress(stage,completed,message){const value={type:'local_export_progress',stage,completed,total:slides.length,message};fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(value));console.log(JSON.stringify(value));}
const html=slides.map((slide,i)=>{const file=path.join(run,'input-html',String(i+1).padStart(3,'0')+'.html');const buffer=fs.readFileSync(file);validateHtml(buffer,input.requirements);return buffer.toString('utf8');});
const profile=fs.mkdtempSync(path.join(output,'browser-'));
const child=spawn(process.env.PPT_BROWSER,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
let browserError;child.on('error',e=>browserError=e);const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,seq=0;const pending=new Map();
function call(method,params={},sessionId){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('页面转换等待超时：'+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
async function convert(){
 const python=spawn(process.env.PPT_PYTHON,[path.join(__dirname,'native-ppt.py'),output],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8'}});let error='',buffer='';
 python.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const line of lines){try{const p=JSON.parse(line);if(p.type==='local_export_progress')progress(p.stage,p.completed,p.message);}catch{}}});
 python.stderr.on('data',b=>error=(error+b).slice(-8000));
 await new Promise((resolve,reject)=>{python.once('error',reject);python.once('close',code=>code===0?resolve():reject(Error(/No module named/.test(error)?'本机 Python 缺少 python-pptx 或 Pillow，请安装导出依赖后重试。':'本机转换失败，已有课件保留。'+error.slice(-400))));});
}
(async()=>{try{
 progress('reading',0,'正在读取已确认课件，准备本机导出');
 const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;!fs.existsSync(portFile);i++){if(browserError||i>150||child.exitCode!==null)throw Error('无法启动本机导出浏览器，请检查 Chrome 或 Edge。');await sleep(100);}
 const [port,url]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);ws=new WebSocket(`ws://127.0.0.1:${port}${url}`);await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('连接本机导出浏览器超时。')),10000);ws.onopen=()=>{clearTimeout(timer);res();};ws.onerror=()=>{clearTimeout(timer);rej(Error('连接本机导出浏览器失败。'));};});
 ws.onmessage=e=>{const msg=JSON.parse(e.data),p=pending.get(msg.id);if(p){clearTimeout(p.timer);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}};
 ws.onclose=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('本机导出浏览器已断开。'));}pending.clear();};
 const {targetId}=await call('Target.createTarget',{url:'about:blank'}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
 await call('Page.enable',{},sessionId);await call('Network.enable',{},sessionId);await call('Network.setBlockedURLs',{urls:['http://*','https://*','file://*','ftp://*','ws://*','wss://*']},sessionId);
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
 const {frameTree}=await call('Page.getFrameTree',{},sessionId),pages=[];
 for(let i=0;i<html.length;i++){
  await call('Page.setDocumentContent',{frameId:frameTree.frame.id,html:html[i]},sessionId);
  await call('Runtime.evaluate',{expression:'Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode().catch(()=>{}))])',awaitPromise:true},sessionId);
  const result=await call('Runtime.evaluate',{expression:`(${extract.toString()})()`,returnByValue:true},sessionId);if(result.exceptionDetails)throw Error(`第${i+1}页排版读取失败：`+String(result.exceptionDetails.exception?.description||'页面过于复杂').split('\n')[0].replace(/^Error:\s*/,''));const scene=result.result.value;
  if(!scene?.objects?.length||scene.objects.length>25000)throw Error(`第${i+1}页内容为空或过于复杂，尚未导出。`);
  for(let k=0;k<scene.objects.length;k++){const o=scene.objects[k];if(o.kind!=='raster')continue;const x=Math.max(0,o.x),y=Math.max(0,o.y),w=Math.min(1280,o.x+o.w)-x,h=Math.min(720,o.y+o.h)-y;
   const snap=await call('Page.captureScreenshot',{format:'png',clip:{x,y,width:w,height:h,scale:1}},sessionId);o.x=x;o.y=y;o.w=w;o.h=h;o.file=`${i+1}-${k}.png`;fs.writeFileSync(path.join(output,o.file),Buffer.from(snap.data,'base64'));
  }
  const shot=await call('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(output,`${i+1}-html.png`),Buffer.from(shot.data,'base64'));
  scene.speech=slides[i].speech||'';scene.notes=slides[i].notes||'';scene.imageCredit=slides[i].image?.status==='ready'?slides[i].image:null;pages.push(scene);fs.writeFileSync(path.join(output,`page-${i+1}.json`),JSON.stringify(scene));progress('reading',i+1,`已读取 ${i+1} / ${slides.length} 页排版`);
 }
 fs.writeFileSync(path.join(output,'scene.json'),JSON.stringify({title:input.requirements.title,pages}));
 progress('exporting',0,'正在写入可编辑文字和图形');await convert();
 const report=JSON.parse(fs.readFileSync(path.join(output,'report.json'),'utf8')),fragments=report.counts.reduce((n,c)=>n+c.svgFragments,0);
 const summary=`已在本机完成 ${pages.length} 页转换；备注留空，逐页讲稿单独保留。${fragments?`${fragments}处复杂图示按图片保留，图示内部暂不可编辑。`:''}请下载检查实际排版。`;
 fs.writeFileSync(path.join(output,'timing.json'),JSON.stringify({pages:pages.length,elapsedMs:Date.now()-started}));
 fs.writeFileSync(path.join(run,'delivery.json'),JSON.stringify({pptx:'native-export/lesson.pptx',sources:['native-export/report.json'],previews:pages.map((_,i)=>`native-export/${i+1}-html.png`),summary}));
 progress('delivery',pages.length,'所有页面已导出，正在校验文件');
}finally{
 if(ws?.readyState===1){try{await call('Browser.close');}catch{}ws.close();}else child.kill();
 if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('close',resolve)),sleep(2000)]);
 if(child.exitCode===null&&child.pid){if(process.platform==='win32')await new Promise(resolve=>{const killer=spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.once('error',resolve);killer.once('close',resolve);});else child.kill();}
 if(profile.startsWith(output+path.sep)&&path.basename(profile).startsWith('browser-')){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100});}catch{}}
}})().catch(e=>{console.error(e.message);process.exitCode=1;});
