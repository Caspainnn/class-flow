'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inclass-multiple-'));
const port = 31836;
const child = spawn(process.execPath, [path.resolve('server/server.js')], {env:{...process.env,DATA_DIR:dir,HOST:'127.0.0.1',PORT:String(port)},windowsHide:true,stdio:'ignore'});
async function request(url, body) {
  const r = await fetch(`http://127.0.0.1:${port}${url}`, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:r.status, body:await r.json()};
}
(async () => {
  try {
    let ready = false;
    for(let i=0;i<60;i++) {try {await request('/api/ping');ready=true;break;}catch {await new Promise(r=>setTimeout(r,100));}}
    assert(ready, 'test server ready');
    const all = (await request('/api/all')).body;
    const courseId = all.courses[0].id;
    const students = all.students.filter(s=>s.courseId===courseId);
    const question = {text:'多选测试',options:['甲','乙','丙','丁'],type:'multiple',correct:[0,2]};
    assert.equal((await request('/api/session/start',{courseId,question:{...question,correct:[0]}})).status,400);
    assert.equal((await request('/api/session/start',{courseId,question})).status,200);
    let state = (await request('/api/session/state')).body;
    assert.deepEqual(state.question.correct,[0,2]);
    for (const [i,answer] of [[0,[2,0]],[1,[0]],[2,[0,1,2]]]) {
      const claim = (await request('/api/claim',{code:state.code})).body;
      assert.equal(claim.question.type,'multiple');
      assert.equal(claim.question.correct,undefined);
      if(i===0) assert.equal((await request('/api/submit',{ticket:claim.ticket,studentId:students[i].id,studentName:students[i].name,answer:[5]})).status,400);
      assert.equal((await request('/api/submit',{ticket:claim.ticket,studentId:students[i].id,studentName:students[i].name,answer})).status,200);
    }
    state = (await request('/api/session/state')).body;
    assert.equal(state.answered,3);assert.equal(state.correct,1);assert.deepEqual(state.dist,[3,1,2,0]);
    const ended = (await request('/api/session/end',{})).body;
    assert.equal(ended.session.id,state.id);
    assert.equal(ended.session.answered,3);
    assert.deepEqual(ended.session.question.correct,[0,2]);
    assert.equal((await request('/api/session/state')).body.active,false);
    assert.equal((await request('/api/session/start',{courseId,question:{...question,type:'single',correct:1}})).status,200);
    assert.equal((await request('/api/session/state')).body.question.correct,1);
    console.log('PASS: multi-choice create, student question secrecy, invalid answer retry, exact grading, distribution and legacy single-choice');
  } finally {
    child.kill();
    await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));
    if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe cleanup');
    fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
