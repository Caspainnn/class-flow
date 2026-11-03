'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createService}=require('../server/ppt/service'),ZIP=require('../server/node_modules/jszip');
const context={window:{}};require('node:vm').createContext(context);require('node:vm').runInContext(fs.readFileSync(path.join(__dirname,'../server/ppt/public/ppt-html-view.js'),'utf8'),context);
const viewVersion={number:1,hash:'test',slides:[{title:'Test',speech:'Speech'}]},view=context.window.PptHtmlView.render({task:{id:'test',status:'html-ready',versions:[],htmlVersions:[viewVersion]},version:viewVersion,page:0,draft:'',connected:false,exportConnected:true});
assert.match(view,/data-action="confirm-html" >/);assert.match(view,/data-action="html-change" disabled/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-local-export-'));let calls=[],mode='success';
const speech='Synthetic per-page teacher speech, retained exactly in editable PowerPoint notes.';
const tick=()=>new Promise(r=>setTimeout(r,10));async function settle(s,id){for(let i=0;i<200;i++){const t=s.get(id);if(t.status!=='running')return t;await tick();}throw Error('Export did not settle');}
const service=createService({root,getSettings:()=>({}),getCourses:()=>[],launch(){throw Error('WorkBuddy must not be called');},exportHtml(options){
 const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{child.killed=true;};calls.push({options,child});
 setImmediate(async()=>{try{
  const input=JSON.parse(fs.readFileSync(path.join(options.runDir,'input.json')));assert.equal(input.htmlVersion.slides[0].speech,speech);assert.equal(input.htmlVersion.slides[0].notes,'Original teacher notes and image credit https://example.test/license');
  assert.match(fs.readFileSync(path.join(options.runDir,'input-html/001.html'),'utf8'),/Synthetic original/);
  child.stdout.emit('data',Buffer.from(JSON.stringify({type:'local_export_progress',stage:'exporting',completed:1,total:1,message:'Exported 1/1'})+'\n'));
  if(mode==='failure'){child.stderr.emit('data',Buffer.from('Synthetic converter failure'));child.emit('close',1);return;}
  if(mode==='wait')return;
  await deliver(options.runDir);child.emit('close',0);
 }catch(e){child.emit('error',e);}});return child;
}});
async function deliver(run){const zip=await ZIP.loadAsync(fs.readFileSync(path.join(__dirname,'fixtures/ppt-service.pptx')));const n='ppt/notesSlides/notesSlide1.xml';zip.file(n,(await zip.file(n).async('string')).replace(/<a:t(?:\s[^>]*)?>[\s\S]*?<\/a:t>/,'<a:t>'+speech+'</a:t>'));fs.writeFileSync(path.join(run,'lesson.pptx'),await zip.generateAsync({type:'nodebuffer'}));fs.writeFileSync(path.join(run,'delivery.json'),JSON.stringify({pptx:'lesson.pptx',sources:[],summary:'Local export fixture'}));}
(async()=>{
 const t=service.create({title:'Synthetic',audience:'Test',minutes:20,content:'Test'}),run='a'.repeat(24),dir=path.join(root,t.id),runDir=path.join(dir,'runs',run);fs.mkdirSync(runDir,{recursive:true});fs.writeFileSync(path.join(runDir,'001.html'),'<html><body><h1>Synthetic original</h1></body></html>');fs.writeFileSync(path.join(runDir,'html-delivery.json'),JSON.stringify({slides:[{title:'Synthetic',file:'001.html',notes:'',speech}],sources:[]}));
 const version=require('../server/ppt/html-deck').collectHtml({task:t,runId:run,taskDir:dir,readFile:r=>path.join(dir,r),phase:'html'});version.slides[0].notes='Original teacher notes and image credit https://example.test/license';t.htmlVersions=[version];t.status='html-ready';fs.writeFileSync(path.join(dir,'task.json'),JSON.stringify(t));
 assert.equal(service.connection().ready,false);assert.equal(service.connection().exportReady,true);
 assert.throws(()=>service.start(t.id,'export',{htmlVersion:1}));
 service.start(t.id,'export',{htmlVersion:1,approved:true});let done=await settle(service,t.id);assert.equal(done.status,'complete');assert.equal(done.provider,'local');assert.equal(done.versions[0].htmlHash,version.hash);assert.equal(done.versions[0].htmlVersion,1);assert.match(done.versions[0].slides[0].notes,/Synthetic per-page/);
 const original=fs.readFileSync(service.file(t.id,done.versions[0].file));mode='failure';service.start(t.id,'export',{htmlVersion:1,approved:true});done=await settle(service,t.id);assert.equal(done.status,'failed');assert.equal(done.versions.length,1);assert.ok(fs.readFileSync(service.file(t.id,done.versions[0].file)).equals(original));
 mode='wait';service.start(t.id,'export',{htmlVersion:1,approved:true});await tick();assert.equal(service.get(t.id).run.progress.pageProgress.completed,1);const latest=calls.at(-1);service.cancel(t.id);await deliver(latest.options.runDir);latest.child.emit('close',0);await tick();done=service.get(t.id);assert.equal(done.status,'cancelled');assert.equal(done.versions.length,1);assert.equal(latest.child.killed,true);
 assert.throws(()=>service.start(t.id,'outline'),/配置/);
 console.log('PASS: local export without CLI, exact approved input, notes/version binding, real progress, failure retains old version, cancellation discards late delivery.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
