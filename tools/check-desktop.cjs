'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.resolve('.tmp-desktop-api-')),runtime={locked:false,isLocked(){return this.locked;},acquire(){if(this.locked)throw Error('locked');this.locked=true;}};let exits=0,backup=false;
const desktop=require('../server/desktop').createDesktop({projectRoot:root,dataRoot:root,runtime,backupActive:()=>backup,exit:()=>exits++});
const server=http.createServer((req,res)=>desktop.handle(req,res,{url:new URL(req.url,'http://localhost'),json(r,status,v){r.writeHead(status,{'Content-Type':'application/json'});r.end(JSON.stringify(v));}}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(action,headers={})=>{const r=await fetch(base+'/api/desktop/'+action,{method:action==='stop'?'POST':'GET',headers});return {status:r.status,body:await r.json()};};
 let result=await call('status');assert.equal(result.body.app,'inclass');assert.ok(result.body.identity);assert.ok(!JSON.stringify(result.body).includes('.desktop-key'));
 assert.equal((await call('stop')).status,403);assert.equal((await call('status',{Origin:'https://foreign.test'})).status,403);
 const headers={'X-Inclass-Desktop-Key':fs.readFileSync(path.join(root,'.desktop-key'),'utf8')};
 for(const [file,value] of [['sessions',[{endsAt:Date.now()+10000}]],['gradebatches',[{status:'running'}]],['questionnaires',{surveys:[{status:'collecting'}]}]]){fs.writeFileSync(path.join(root,file+'.json'),JSON.stringify(value));assert.equal((await call('stop',headers)).status,409);fs.unlinkSync(path.join(root,file+'.json'));}
 const task=path.join(root,'ppt','a'.repeat(24));fs.mkdirSync(task,{recursive:true});fs.writeFileSync(path.join(task,'task.json'),JSON.stringify({status:'running'}));assert.equal((await call('stop',headers)).status,409);fs.writeFileSync(path.join(task,'task.json'),JSON.stringify({status:'complete'}));
 backup=true;assert.equal((await call('stop',headers)).status,409);backup=false;assert.equal(exits,0);
 const template=path.join(root,'ppt','_templates','b'.repeat(24));fs.mkdirSync(template,{recursive:true});fs.writeFileSync(path.join(template,'template.json'),JSON.stringify({layoutGuide:{status:'running'}}));assert.equal((await call('stop',headers)).status,409);fs.writeFileSync(path.join(template,'template.json'),JSON.stringify({layoutGuide:{status:'ready'}}));
 assert.equal((await call('stop',headers)).status,200);assert.equal(desktop.closing,true);await new Promise(r=>setTimeout(r,250));assert.equal(exits,1);
 console.log('PASS: project identity, local-only/authenticated exit, sign-in/grading/survey/PPT/backup guards, idle exit.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
