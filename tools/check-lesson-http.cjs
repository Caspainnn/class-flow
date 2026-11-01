'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),doc=require('../server/lesson-plan/document');
const base=process.env.LESSON_URL||'http://127.0.0.1:3016';
async function api(p,method='GET',data){const r=await fetch(base+'/api/lesson-plan'+p,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const b=await r.json();return {status:r.status,body:b};}
(async()=>{
 for(const asset of ['/lesson-plan.js','/lesson-plan.css','/preparation?type=plan'])assert.equal((await fetch(base+asset)).status,200);
 const page=await fetch(base+'/preparation?type=plan',{headers:{'sec-fetch-dest':'iframe'}});assert.match(await page.text(),/src="\/lesson-plan\.js"/);
 let r=await api('/tasks','POST',{title:'接口隔离虚构教案',audience:'虚构学生',minutes:10,content:'整数加法'});assert.equal(r.status,201);let t=r.body;
 r=await api('/tasks/'+t.id,'PUT',{...t,title:'更新接口虚构教案'});assert.equal(r.status,200);const stale=t;t=r.body;
 assert.equal((await api('/tasks/'+t.id,'PUT',stale)).status,409);
 const schema=doc.builtin(),plan=structuredClone(schema);for(const s of plan.sections)for(const b of s.blocks)if(b.type==='text')b.text='可操作的虚构教学说明';else b.rows=b.headers.join('/')==='项目/内容'?b.rows.map(r=>[r[0],'待教师填写']):[b.headers.map(h=>h==='时间'?'10':'虚构内容')];
 r=await api('/tasks/'+t.id+'/plan','PUT',{revision:t.revision,plan});assert.equal(r.status,200);t=r.body;
 const d=await fetch(base+`/api/lesson-plan/tasks/${t.id}/file?path=`+encodeURIComponent(t.versions[0].file));assert.equal(d.status,200);assert.match(d.headers.get('content-disposition'),/attachment/);assert.ok((await d.arrayBuffer()).byteLength>500);
 assert.equal((await api('/tasks/'+t.id+'/file?path=task.json')).status,404);
 const section=structuredClone(t.plan.sections[1]);section.blocks[0].text='接口章节草稿目标';const oldWord=await (await fetch(base+`/api/lesson-plan/tasks/${t.id}/file?path=`+encodeURIComponent(t.versions[0].file))).arrayBuffer();
 r=await api('/tasks/'+t.id+'/sections','PUT',{revision:t.revision,index:1,section});assert.equal(r.status,200);t=r.body;assert.equal(t.versions.length,1);assert.equal((await api('/tasks/'+t.id)).body.plan.sections[1].blocks[0].text,'接口章节草稿目标');
 r=await api('/tasks/'+t.id+'/versions','POST',{revision:t.revision,name:'\u8bd5\u8bb2\u7248'});assert.equal(r.status,200);t=r.body;assert.equal(t.versions.length,2);assert.equal(t.versions[1].name,'\u8bd5\u8bb2\u7248');const namedDownload=await fetch(base+`/api/lesson-plan/tasks/${t.id}/file?path=`+encodeURIComponent(t.versions[1].file));assert.match(decodeURIComponent(namedDownload.headers.get('content-disposition')),/\u8bd5\u8bb2\u7248-v2\.docx/);assert.equal(t.versions[1].plan.sections[1].blocks[0].text,'接口章节草稿目标');assert.deepEqual(await (await fetch(base+`/api/lesson-plan/tasks/${t.id}/file?path=`+encodeURIComponent(t.versions[0].file))).arrayBuffer(),oldWord);
 r=await api('/tasks/'+t.id+'/files','POST',{revision:t.revision,name:'虚构讲稿.md',base64:Buffer.from('只供隔离测试的讲稿').toString('base64')});assert.equal(r.status,200);t=r.body;
 assert.equal(t.files.length,1);
 r=await api('/tasks/'+t.id+'/files','DELETE',{revision:t.revision,fileId:t.files[0].id});assert.equal(r.status,200);t=r.body;assert.equal(t.files.length,0);
 r=await api('/tasks/'+t.id+'/restore','POST',{revision:t.revision,version:1});assert.equal(r.status,400,'old requirement versions must stay read-only');
 r=await api('/tasks/'+t.id+'/files','POST',{revision:t.revision,name:'bad.jpg',base64:Buffer.from('x').toString('base64')});assert.equal(r.status,400);
 assert.equal((await fetch(base+'/api/lesson-plan/tasks',{headers:{Origin:'https://untrusted.example'}})).status,403);
 const templatePath=process.env.LESSON_TEMPLATE_DOCX;
 if(templatePath&&fs.existsSync(templatePath)){r=await api('/templates','POST',{name:'教师提供的九章教学设计.docx',base64:fs.readFileSync(templatePath).toString('base64')});assert.equal(r.status,201);assert.equal(r.body.schema.sections.length,9);assert.equal(doc.timeTables(r.body.schema).length,1);console.log('actual teacher DOCX template upload: 9 sections and teaching-time table PASS');}
 console.log('lesson HTTP: assets, draft, conflict, version, download, attachment upload/removal, stale restore, invalid JPEG, unpublished file protection, cross-origin rejection PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
