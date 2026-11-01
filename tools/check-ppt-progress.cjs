'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createProgress}=require('../server/ppt/progress');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-ppt-progress-'));let clock=1000;
try{
 const p=createProgress({runDir:dir,phase:'deck',startedAt:clock,now:()=>clock});
 fs.writeFileSync(path.join(dir,'previous.pptx'),'input');fs.writeFileSync(path.join(dir,'a'.repeat(24)+'-reference.pptx'),'input');
 assert.equal(p.snapshot(true).exportFiles,0);
 const event=JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',name:'Read',input:{file_path:'private-file'}}]}})+'\n';p.consume(event.slice(0,15));p.consume(event.slice(15));assert.equal(p.snapshot(true).stage,'reading');assert.ok(!JSON.stringify(p.snapshot(true)).includes('private-file'));
 clock+=5000;fs.mkdirSync(path.join(dir,'project/svg_output'),{recursive:true});fs.writeFileSync(path.join(dir,'project/svg_output/01.svg'),'<svg/>');let snapshot=p.snapshot(true);assert.equal(snapshot.sourceFiles,1);assert.equal(snapshot.stage,'authoring');const activity=snapshot.lastActivityAt;
 clock+=100000;snapshot=p.snapshot(true);assert.equal(snapshot.lastActivityAt,activity);assert.equal(snapshot.serverAt,clock);assert.equal(snapshot.processAlive,true);assert.equal(snapshot.percent,undefined);
 p.consume(JSON.stringify({type:'ping'})+'\n');assert.equal(p.snapshot(true).lastActivityAt,activity);
 fs.writeFileSync(path.join(dir,'delivery.json'),'{}');assert.equal(p.snapshot(true).stage,'delivery');
 p.consume(JSON.stringify({type:'result',result:'structured final text'})+'\n');assert.equal(p.finalText,'structured final text');
 const htmlDir=path.join(dir,'html-run');fs.mkdirSync(path.join(htmlDir,'input-html'),{recursive:true});fs.writeFileSync(path.join(htmlDir,'input-html/001.html'),'input');fs.writeFileSync(path.join(htmlDir,'a'.repeat(24)+'-reference.html'),'input');
 const hp=createProgress({runDir:htmlDir,phase:'html',startedAt:clock,now:()=>clock});assert.equal(hp.snapshot(true).sourceFiles,0);fs.writeFileSync(path.join(htmlDir,'01.html'),'<html/>');assert.equal(hp.snapshot(true).sourceFiles,1);fs.writeFileSync(path.join(htmlDir,'html-delivery.json'),'{}');assert.equal(hp.snapshot(true).stage,'delivery');
 console.log('PASS: chunked tool events, no raw input leak, real artifacts, reference exclusion, heartbeat is not activity, no fake percent, final-text fallback');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
