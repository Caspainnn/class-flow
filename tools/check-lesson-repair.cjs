'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {createService}=require('../server/lesson-plan/service');
const root=path.resolve('.tmp-lesson-repair-'+process.pid);let children=[];
const launch=()=>{const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.kill=()=>{};children.push(c);return c;};
const service=createService({root,getSettings:()=>({workbuddy:{enabled:true,path:process.execPath}}),launch});
function plan(t){const p=structuredClone(t.template.schema);for(const s of p.sections)for(const b of s.blocks)if(b.type==='text')b.text='可核对活动';else b.rows=b.headers.join('/')==='项目/内容'?b.rows.map(r=>[r[0],'待教师填写']):[b.headers.map(h=>h==='时间'?'10':h==='实际记录'?'':'具体活动')];return p;}
async function waitFor(test){for(let i=0;i<80;i++){if(test())return;await new Promise(r=>setTimeout(r,10));}assert.fail('timeout');}
function output(t,p){fs.writeFileSync(path.join(root,t.id,'runs',t.run.id,'plan.json'),JSON.stringify(p));children.at(-1).emit('close',0);}
function start(){const t=service.create({title:'隔离格式修正课',audience:'虚构学生',minutes:10,content:'加法'});return service.start(t.id,{revision:t.revision});}
(async()=>{
 let t=start();children.at(-1).stdout.write(JSON.stringify({type:'assistant',message:{content:[{type:'text',text:'正在安排课时。'},{type:'tool_use',name:'Read',input:{file_path:'input.json'}}]}})+'\n');
 assert.match(JSON.stringify(service.get(t.id).run.progress),/正在安排课时/);
 const bad=plan(t);bad.sections[5].blocks[0].rows[0].push('不可直接删除的非空列');const count=children.length;output(t,bad);
 await waitFor(()=>children.length===count+1);assert.equal(service.get(t.id).status,'running');assert.equal(service.get(t.id).run.repairAttempts,1);assert.ok(fs.existsSync(path.join(root,t.id,'runs',t.run.id,'plan-original.json')));
 output(t,plan(t));await waitFor(()=>service.get(t.id).status==='complete');assert.equal(service.get(t.id).versions.length,1);
 t=start();const bad2=plan(t);bad2.sections[5].blocks[0].rows[0].pop();const before=children.length;output(t,bad2);await waitFor(()=>children.length===before+1);output(t,bad2);await waitFor(()=>service.get(t.id).status==='failed');assert.equal(children.length,before+1);assert.equal(service.get(t.id).versions.length,0);
 t=start();const beforeCancel=children.length;output(t,bad2);await waitFor(()=>children.length===beforeCancel+1);service.cancel(t.id,{runId:t.run.id});output(t,plan(t));await waitFor(()=>service.get(t.id).status==='cancelled');assert.equal(service.get(t.id).versions.length,0);
 const originalSetTimeout=global.setTimeout;let expire;
 try{global.setTimeout=(fn,ms,...args)=>ms===7200000?(expire=fn,{testTimer:true}):originalSetTimeout(fn,ms,...args);t=start();}finally{global.setTimeout=originalSetTimeout;}
 expire();assert.equal(service.get(t.id).status,'failed');assert.equal(service.get(t.id).run.progress.stage,'failed','timeout must publish terminal progress');children.at(-1).emit('close',0);
 console.log('lesson repair: live progress, one bounded format repair, original retention, repeated failure, cancellation during repair PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(root.startsWith(path.resolve('.')+path.sep)&&path.basename(root).startsWith('.tmp-lesson-repair-'))fs.rmSync(root,{recursive:true,force:true});});
