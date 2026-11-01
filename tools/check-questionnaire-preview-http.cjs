'use strict';
const assert=require('node:assert/strict'),{createServer}=require('./preview-questionnaire.cjs');
let started=0;const job={id:'a'.repeat(24),status:'running'};
const server=createServer({ai:{connection:()=>({ready:true}),list:()=>[job],start:body=>{started++;assert.equal(body.count,6);return job;},get:id=>({...job,id}),cancel:id=>({...job,id,status:'cancelled'})}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
for(const resource of ['/prototype/questionnaire.html','/prototype/questionnaire.js','/prototype/questionnaire-model.js','/prototype/questionnaire.css','/server/public/shell.css']){const response=await fetch(origin+resource);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok((await response.text()).length>30);}
const qr=await fetch(origin+'/demo-qr.svg?id=feedback-anon');assert.equal(qr.status,200);assert.match(qr.headers.get('content-type'),/svg/);assert.match(await qr.text(),/<svg/);
assert.equal((await fetch(origin+'/demo-qr.svg?id=%3Cscript%3E')).status,400);assert.equal((await fetch(origin+'/api/courses')).status,404);assert.equal((await fetch(origin+'/data/students.json')).status,404);assert.equal((await fetch(origin+'/server/server.js')).status,404);assert.equal((await fetch(origin+'/api/submit',{method:'POST',body:'{}'})).status,405);assert.equal((await fetch(origin+'/prototype/questionnaire.html',{method:'HEAD'})).status,200);
console.log('PASS: isolated static asset allowlist, actual demo QR SVG, invalid IDs/private/formal paths denied, submissions rejected');
const payload={method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({count:6})};
assert.equal((await fetch(origin+'/api/questionnaire-ai',{...payload,headers:{'Content-Type':'application/json'}})).status,403);
assert.equal((await fetch(origin+'/api/questionnaire-ai',{...payload,headers:{'Content-Type':'application/json',Origin:'https://example.com'}})).status,403);assert.equal(started,0);
assert.equal((await fetch(origin+'/api/questionnaire-ai',payload)).status,202);assert.equal(started,1);
assert.equal((await (await fetch(origin+'/api/questionnaire-ai')).json()).jobs.length,1);
assert.equal((await (await fetch(origin+'/api/questionnaire-ai/'+job.id)).json()).status,'running');
assert.equal((await (await fetch(origin+'/api/questionnaire-ai/'+job.id+'/cancel',{...payload,body:'{}'})).json()).status,'cancelled');
assert.equal((await fetch(origin+'/api/questionnaire-ai',{...payload,body:'x'.repeat(17000)})).status,413);
console.log('PASS: local same-origin AI start/status/history/cancel, foreign-origin mutation and oversized input rejected');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
