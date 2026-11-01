'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-rubric-')),port=31832;
fs.writeFileSync(path.join(dir,'courses.json'),JSON.stringify([{id:'demo',name:'示例课程',term:'2026 秋',createdAt:1}]));
fs.writeFileSync(path.join(dir,'students.json'),'[]');fs.writeFileSync(path.join(dir,'sessions.json'),'[]');fs.writeFileSync(path.join(dir,'settings.json'),'{"activeCourseId":"demo"}');
const child=spawn(process.execPath,[path.resolve('server/server.js')],{cwd:path.resolve('.'),env:{...process.env,DATA_DIR:dir,HOST:'127.0.0.1',PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
async function request(url,body,method='POST'){const r=await fetch('http://127.0.0.1:'+port+url,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
(async()=>{try{
  for(let i=0;i<80&&!logs.includes('已启动');i++)await new Promise(r=>setTimeout(r,100));assert(logs.includes('已启动'),logs);
  const ExcelJS=require('../server/node_modules/exceljs');
  let r=await request('/api/homework',{courseId:'demo',name:'评分标准测试'});const id=r.body.id;assert.equal(r.body.batchId,null);r=await request('/api/homework/'+id+'/grading',{});const bid=r.body.batchId;assert(bid);const again=await request('/api/homework/'+id+'/grading',{});assert.equal(again.body.batchId,bid);
  r=await request('/api/gb/batches/'+bid+'/prepare',{});assert.equal(r.status,400);assert.match(r.body.error,/标准/);
  const download=await fetch('http://127.0.0.1:'+port+'/api/gb/'+bid+'/rubric-template.xlsx');assert.equal(download.status,200);
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(await download.arrayBuffer()));assert.equal(wb.worksheets[0].getCell('D1').value,'评分标准');wb.worksheets[0].getCell('B2').value='分析题';wb.worksheets[0].getCell('C2').value=100;wb.worksheets[0].getCell('D2').value='论点准确40分；论据充分60分';const bytes=await wb.xlsx.writeBuffer();
  r=await request('/api/gb/'+bid+'/rubric-import',{fileName:'rubric.xlsx',fileBase64:Buffer.from(bytes).toString('base64')});assert.equal(r.status,200);const questions=r.body.questions;assert.match(questions[0].rubric,/论点准确/);
  let state=await request('/api/gb/batches/'+bid+'/state');assert.equal(state.body.questions.length,0,'import is preview only');
  r=await request('/api/homework/'+id,{questions},'PUT');assert.equal(r.status,200);
  state=await request('/api/gb/batches/'+bid+'/state');assert.equal(state.body.questions[0].rubric,questions[0].rubric);
  r=await request('/api/gb/batches/'+bid+'/prepare',{});assert.equal(r.status,200);
  const rules=fs.readFileSync(path.join(dir,'批改',bid,'final','标准答案和评分规则.txt'),'utf8');assert.match(rules,/论点准确40分/);
  const revised=questions.map(q=>({...q,rubric:q.rubric+'；逻辑错误酌情扣分'}));r=await request('/api/homework/'+id,{questions:revised},'PUT');assert.equal(r.status,200);state=await request('/api/gb/batches/'+bid+'/state');assert.equal(state.body.status,'collect');assert.equal(state.body.dir,null);assert.equal(state.body.prompt,null);r=await request('/api/gb/batches/'+bid+'/run',{});assert.equal(r.status,400);assert.match(r.body.error,/重新准备/);questions[0].rubric=revised[0].rubric;
  wb.worksheets[0].getCell('D2').value='';const invalid=await wb.xlsx.writeBuffer();r=await request('/api/gb/'+bid+'/rubric-import',{fileName:'bad.xlsx',fileBase64:Buffer.from(invalid).toString('base64')});assert.equal(r.status,400);
  state=await request('/api/gb/batches/'+bid+'/state');assert.equal(state.body.questions[0].rubric,questions[0].rubric);
  console.log('PASS rubric API: template download, preview import, save/reload, missing standards guard, prepared rule text, invalid file preserves data; no model called');
}finally{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));const root=path.resolve(os.tmpdir())+path.sep;if(!path.resolve(dir).startsWith(root))throw new Error('Unsafe cleanup path');fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
