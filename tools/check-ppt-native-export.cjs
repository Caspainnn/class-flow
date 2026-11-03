'use strict';
// Real converter/service integration with isolated data. No model calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createService}=require('../server/ppt/service'),{validateHtml,outlineHash}=require('../server/ppt/html-deck');
const root=fs.mkdtempSync(path.resolve('.tmp-native-service-')),geometry=process.argv.includes('--geometry'),sample=geometry?null:process.argv[2],count=geometry?1:Number(process.argv[3]||50);
const settings={ppt:{pythonPath:process.env.PPT_PYTHON||path.resolve('.local-ppt-python/Scripts/python.exe'),...(process.env.PPT_BROWSER?{browserPath:process.env.PPT_BROWSER}:{})}};
const service=createService({root,getSettings:()=>settings,getCourses:()=>[],launch(){throw Error('No model calls allowed');}});
(async()=>{
 let task;
 if(sample){
  const source=path.resolve(sample);task=JSON.parse(fs.readFileSync(path.join(source,'task.json'),'utf8'));const latest=task.htmlVersions.at(-1);task.courseId='';task.status='html-ready';task.run=null;task.versions=[];task.htmlVersions=[latest];task.approvedHtmlVersion=null;task.feedback=[];task.reviewedVersion=null;task.deletedAt=null;
  for(const slide of latest.slides){const target=path.join(root,task.id,slide.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,slide.file),target);}
 }else{
  task=service.create({title:'Synthetic long deck',audience:'Test',minutes:20,content:'Synthetic content'});const slides=[];
  for(let i=1;i<=count;i++){const html=Buffer.from(`<html><head><style>body{margin:0;width:1280px;height:720px;background:#fff;font-family:Arial}h1{position:absolute;left:48px;top:60px;color:#124886;font-size:40px}.card{position:absolute;left:48px;top:180px;background:#e8eff8;width:800px;height:180px;border-radius:12px;padding:24px}</style></head><body><h1>Synthetic page ${i}</h1><div class="card">Native editable content ${i}</div></body></html>`),validated=validateHtml(html,task),file=`html/synthetic/${String(i).padStart(3,'0')}.html`;fs.mkdirSync(path.dirname(path.join(root,task.id,file)),{recursive:true});fs.writeFileSync(path.join(root,task.id,file),html);slides.push({number:i,title:'Page '+i,file,sha256:validated.sha256,text:validated.text,notes:'',speech:'Synthetic teacher speech for page '+i+'. Retain all of this text.'});}
  if(geometry){const slide=slides[0],html=Buffer.from(`<html><body style="margin:0;width:1280px;height:720px;font:24px Arial"><div style="position:absolute;z-index:2;left:40px;top:40px">Foreground label</div><div style="position:absolute;z-index:1;left:20px;top:20px;width:400px;height:100px;background:rgb(0,0,255)"></div><div style="position:absolute;left:40px;top:140px">Auto foreground</div><div style="margin-top:130px;width:300px;height:100px;background:rgb(250,250,250)"></div><img style="position:absolute;left:100px;top:200px;width:400px;height:100px;object-fit:contain" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8eUAAAAASUVORK5CYII="></body></html>`);fs.writeFileSync(path.join(root,task.id,slide.file),html);Object.assign(slide,validateHtml(html,task),{notes:'Teacher notes and complete image credit https://example.test/credit'});}
  task.htmlVersions=[{number:1,requirementsRevision:0,outlineHash:outlineHash(task),hash:crypto.createHash('sha256').update(JSON.stringify(slides)).digest('hex'),slides,sources:[]}];task.status='html-ready';
 }
 fs.writeFileSync(path.join(root,task.id,'task.json'),JSON.stringify(task));const started=Date.now();service.start(task.id,'export',{htmlVersion:task.htmlVersions.at(-1).number,approved:true});
 let latest;
 for(let i=0;i<600;i++){latest=service.get(task.id);if(latest.status!=='running')break;await new Promise(r=>setTimeout(r,500));}
 if(latest.status==='running'){service.cancel(task.id);throw Error('Converter exceeded five-minute test budget');}
 assert.equal(latest.status,'complete',latest.error);assert.equal(latest.versions.length,1);assert.equal(latest.provider,'local');assert.equal(latest.versions[0].slides.length,task.htmlVersions[0].slides.length);
 const normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,'');for(let i=0;i<latest.versions[0].slides.length;i++){assert.ok(latest.versions[0].slides[i].text.trim());assert.equal(latest.versions[0].slides[i].notes.trim(),'');}
 if(geometry){const scene=JSON.parse(fs.readFileSync(path.join(root,task.id,'runs',latest.run.id,'native-export/scene.json'))),objects=scene.pages[0].objects,img=objects.find(o=>o.kind==='image');assert.equal(img.w,100);assert.equal(img.h,100);assert.equal(img.x,250);assert.ok(objects.findIndex(o=>o.text?.includes('Foreground'))>objects.findIndex(o=>o.kind==='rect'&&o.color==='rgb(0, 0, 255)'));assert.ok(objects.findIndex(o=>o.text?.includes('Auto foreground'))>objects.findIndex(o=>o.kind==='rect'&&o.color==='rgb(250, 250, 250)'));assert.equal(latest.versions[0].slides[0].notes.trim(),'');}
 const result={pages:latest.versions[0].slides.length,elapsedMs:Date.now()-started,root,pptx:service.file(task.id,latest.versions[0].file),taskId:task.id};fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
