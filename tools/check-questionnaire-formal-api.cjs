'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),Q=require('../prototype/questionnaire-model');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-survey-')),port=31843,origin='http://127.0.0.1:'+port;
for(const [name,value]of Object.entries({courses:[{id:'test',name:'隔离虚构课程'}],students:[{id:'90001',name:'虚构甲',courseId:'test'},{id:'90002',name:'虚构乙',courseId:'test'}],sessions:[],settings:{activeCourseId:'test'}}))fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value));
const child=spawn(process.execPath,[path.resolve('server/server.js')],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
async function api(p,body,options={}){const r=await fetch(origin+p,{...options,...(body?{method:'PUT',body:JSON.stringify(body),...options}:{}),headers:{'Content-Type':'application/json',Origin:origin,...options.headers}});return {r,data:await r.json()};}
const foreignHost=p=>new Promise((resolve,reject)=>{require('node:http').get(origin+p,{headers:{Host:'student.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});
(async()=>{try{
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/ping')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.equal(child.exitCode,null,logs);
 for(const p of ['/questionnaires','/questionnaire/student.html','/questionnaire/teacher.js','/questionnaire/model.js','/questionnaire/style.css'])assert.equal((await fetch(origin+p)).status,200,p);
 let state=(await api('/api/questionnaires')).data;assert.equal(state.surveys.length,0);assert.equal(state.courses[0].id,'test');const s=Q.blank('test');s.noDeadline=true;s.title='课堂反馈验证';s.questions[0].title='节奏如何？';state=(await api('/api/questionnaires',{revision:state.revision,surveys:[s]})).data;assert.equal(state.surveys[0].status,'draft');
 state.surveys[0].status='collecting';state=(await api('/api/questionnaires',state)).data;assert.equal(state.surveys[0].status,'collecting');const pub=await api('/api/questionnaire-public/'+s.id),cookie=pub.r.headers.get('set-cookie').split(';')[0];assert.ok(!('responses'in pub.data));assert.ok(!('target'in pub.data));
 const payload={requestId:Q.uid(),answers:{[s.questions[0].id]:s.questions[0].options[0].id}};let submitted=await api('/api/questionnaire-public/'+s.id+'/submit',payload,{method:'POST',headers:{Cookie:cookie}});assert.equal(submitted.r.status,200,JSON.stringify(submitted.data));assert.equal((await api('/api/questionnaire-public/'+s.id+'/submit',payload,{method:'POST',headers:{Cookie:cookie}})).r.status,200);
 assert.equal((await api('/api/questionnaire-public/'+s.id+'/submit',{...payload,requestId:Q.uid()},{method:'POST',headers:{Cookie:cookie}})).r.status,400);
 assert.equal((await api('/api/questionnaires',state)).r.status,409);state=(await api('/api/questionnaires')).data;assert.equal(state.surveys[0].responses.length,1);assert.ok(!JSON.stringify(state).includes('"client"'));assert.ok(!JSON.stringify(state).includes('"requestId"'));
 assert.equal((await fetch(origin+'/api/questionnaires/qr?id='+s.id)).status,200);assert.equal((await api('/api/questionnaires/overview?courseId=test')).data.responses,1);assert.equal((await api('/api/questionnaires/overview?courseId=other')).data.responses,0);
 state.surveys[0].status='ended';state=(await api('/api/questionnaires',state)).data;assert.equal((await api('/api/questionnaire-public/'+s.id+'/submit',{...payload,requestId:Q.uid()},{method:'POST'})).r.status,400);
 assert.equal((await api('/api/questionnaires',state,{headers:{Origin:'https://foreign.example'}})).r.status,403);
 assert.equal(await foreignHost('/api/questionnaires'),403);
 assert.equal(await foreignHost('/questionnaire/teacher.js'),403);assert.equal(await foreignHost('/questionnaire/student.js'),200);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'questionnaires.json'))).surveys[0].responses.length,1);
 console.log('PASS formal HTTP: isolated storage, teacher assets, publish/public redaction, real submit/cookies/idempotency, revision/closed/CSRF protections, QR and course overview');
 }finally{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
