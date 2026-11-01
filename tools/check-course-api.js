'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-course-')),port=31831;
fs.writeFileSync(path.join(dir,'courses.json'),JSON.stringify([{id:'demo',name:'示例课程',term:'2026 秋',createdAt:1}]));
fs.writeFileSync(path.join(dir,'students.json'),'[]');fs.writeFileSync(path.join(dir,'sessions.json'),'[]');fs.writeFileSync(path.join(dir,'settings.json'),'{"activeCourseId":"demo"}');
const child=spawn(process.execPath,[path.resolve('server/server.js')],{cwd:path.resolve('.'),env:{...process.env,DATA_DIR:dir,HOST:'127.0.0.1',PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
async function request(url,body,method='POST'){const r=await fetch('http://127.0.0.1:'+port+url,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
(async()=>{try{
  for(let i=0;i<80&&!logs.includes('已启动');i++)await new Promise(r=>setTimeout(r,100));assert(logs.includes('已启动'),logs);
  let r=await request('/api/courses');assert.equal(r.status,200);assert.equal(r.body.items.length,1);
  r=await request('/api/courses',{name:'接口示例课程',term:'2026 秋',note:'课程备注'});const id=r.body.id;assert(id);
  r=await request('/api/students/upload',{courseId:id,fileName:'roster.csv',fileBase64:Buffer.from('学号,姓名\n90001,示例甲\n90002,示例乙\n90001,重复\nbad,错误').toString('base64')});assert.equal(r.body.ok,2);assert(r.body.skipped>=1);
  r=await request('/api/courses/'+id,{note:'已修改'},'PUT');assert.equal(r.body.note,'已修改');
  r=await request('/api/courses');assert.equal(r.body.items.find(c=>c.id===id).count,2);
  const ExcelJS=require('../server/node_modules/exceljs');const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('名单');ws.addRow(['学号','姓名']);ws.addRow(['90003','示例丙']);const bytes=await wb.xlsx.writeBuffer();
  r=await request('/api/students/upload',{courseId:id,fileName:'roster.xlsx',fileBase64:Buffer.from(bytes).toString('base64')});assert.equal(r.body.ok,1);
  r=await request('/api/students/upload',{courseId:id,fileName:'errors.csv',fileBase64:Buffer.from(Array.from({length:20},(_,i)=>'bad'+i+',错误').join('\n')).toString('base64')});assert.equal(r.body.bad.length,20);
  r=await request('/api/courses/'+id,{},'DELETE');assert.equal(r.status,400);
  r=await request('/api/courses/'+id,{confirm:true},'DELETE');assert.equal(r.status,200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'students.json'))).length,3);
  r=await request('/api/all');assert(!r.body.courses.some(c=>c.id===id));assert(!r.body.students.some(s=>s.courseId===id));
  r=await request('/api/students/upload',{courseId:id,fileName:'roster.csv',fileBase64:'YQ=='});assert.equal(r.status,400);
  const old=await fetch('http://127.0.0.1:'+port+'/admin?pane=course&courseId=demo',{redirect:'manual'});assert.equal(old.status,302);assert.equal(old.headers.get('location'),'/courses#edit/demo');
  for(const url of ['/courses','/preparation?type=ppt','/preparation?type=plan'])assert.equal((await fetch('http://127.0.0.1:'+port+url)).status,200);
  console.log('PASS course API: create/edit, CSV/XLSX partial import, summaries, confirmed soft deletion, hidden records, old links and pages');
}finally{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));const root=path.resolve(os.tmpdir())+path.sep;if(!path.resolve(dir).startsWith(root))throw new Error('Unsafe cleanup path');fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
