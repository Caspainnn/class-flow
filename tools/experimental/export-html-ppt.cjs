'use strict';
// Experimental CLI only. Does not publish versions or change the running service.
const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),extract=require('./html-ppt-scene');
const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw Error('Usage: node --experimental-websocket tools/experimental/export-html-ppt.cjs INPUT_RUN OUTPUT_DIR');
const input=path.resolve(inputArg),output=path.resolve(outputArg);if(input===output||output.startsWith(input+path.sep))throw Error('Output must be outside the input run');
fs.mkdirSync(output,{recursive:true});const started=Date.now(),manifest=JSON.parse(fs.readFileSync(path.join(input,'input.json'),'utf8'));
const files=fs.readdirSync(path.join(input,'input-html')).filter(n=>/^\d+\.html$/.test(n)).sort();if(!files.length)throw Error('No HTML pages');
for(const name of files)require('../../server/ppt/html-deck').validateHtml(fs.readFileSync(path.join(input,'input-html',name)),manifest.requirements);
const browser=process.env.PPT_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile=fs.mkdtempSync(path.join(output,'browser-'));const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,seq=0;const pending=new Map();
function call(method,params={},sessionId){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
(async()=>{try{
 const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;!fs.existsSync(portFile);i++){if(i>100)throw Error('Headless browser did not start');await sleep(100);}
 const [port,url]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);ws=new WebSocket(`ws://127.0.0.1:${port}${url}`);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
 ws.onmessage=e=>{const msg=JSON.parse(e.data);const p=pending.get(msg.id);if(p){clearTimeout(p.timer);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}};
 const {targetId}=await call('Target.createTarget',{url:'about:blank'}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
 await call('Page.enable',{},sessionId);await call('Network.enable',{},sessionId);await call('Network.setBlockedURLs',{urls:['http://*','https://*']},sessionId);
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
 const pages=[];
 for(let i=0;i<files.length;i++){
  const pageStarted=Date.now();await call('Page.navigate',{url:pathToFileURL(path.join(input,'input-html',files[i])).href},sessionId);
  let ready=false;for(let n=0;n<100;n++){const r=await call('Runtime.evaluate',{expression:'document.readyState',returnByValue:true},sessionId);if(r.result.value==='complete'){ready=true;break;}await sleep(50);}if(!ready)throw Error('Page load timeout');
  await call('Runtime.evaluate',{expression:'Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode().catch(()=>{}))])',awaitPromise:true},sessionId);
  const result=await call('Runtime.evaluate',{expression:`(${extract.toString()})()`,returnByValue:true},sessionId);if(result.exceptionDetails)throw Error('Scene extraction failed');const scene=result.result.value;
  for(let k=0;k<scene.objects.length;k++){const o=scene.objects[k];if(o.kind!=='raster')continue;const snap=await call('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,o.x),y:Math.max(0,o.y),width:o.w,height:o.h,scale:1}},sessionId);const name=`${i+1}-${k}.png`;fs.writeFileSync(path.join(output,name),Buffer.from(snap.data,'base64'));o.file=name;}
  const shot=await call('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(output,`${i+1}-html.png`),Buffer.from(shot.data,'base64'));
  scene.speech=manifest.htmlVersion?.slides?.[i]?.speech||'';
  pages.push(scene);fs.writeFileSync(path.join(output,`page-${i+1}.json`),JSON.stringify(scene));
  fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify({completed:i+1,total:files.length,stage:'layout captured',elapsedMs:Date.now()-started}));
  console.log(`Captured ${i+1}/${files.length} (${Date.now()-pageStarted}ms): ${scene.objects.length} objects`);
 }
 fs.writeFileSync(path.join(output,'scene.json'),JSON.stringify({title:manifest.requirements.title,pages,elapsedMs:Date.now()-started}));
 const python=process.env.PPT_PYTHON||path.join(root,'.local-ppt-python/Scripts/python.exe');const conversion=spawnSync(python,[path.join(__dirname,'scene-to-ppt.py'),output],{encoding:'utf8',timeout:180000,windowsHide:true});if(conversion.status!==0)throw Error(conversion.stderr||conversion.stdout||'PPT conversion failed');console.log(conversion.stdout.trim());
 fs.writeFileSync(path.join(output,'timing.json'),JSON.stringify({pages:pages.length,elapsedMs:Date.now()-started}));
}finally{if(ws?.readyState===1){try{await call('Browser.close');}catch{}ws.close();}else child.kill();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
