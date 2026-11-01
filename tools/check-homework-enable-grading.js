'use strict';
const assert=require('node:assert/strict'),make=require('../server/lib/homework');let serial=0;const data={};const store={uid:()=>String(++serial),read:(k,d)=>data[k]||d,write:(k,v)=>data[k]=v};const svc=make({store,findCourse:id=>id==='c1'?{id}:null,getStudents:()=>[{id:'s1'}]});
const hw=svc.create({courseId:'c1',name:'新建作业',due:'2026-11-01'});assert.equal(hw.batchId,null);assert.equal((data.gradebatches||[]).length,0);
svc.inputScores(hw.id,'s1 88 补');const before=JSON.stringify(data.homework[0].scores);
const first=svc.enableGrading(hw.id),second=svc.enableGrading(hw.id);assert.equal(first.batchId,second.batchId);assert.equal(data.gradebatches.length,1);assert.deepEqual(data.gradebatches[0].questions,[]);assert.equal(JSON.stringify(data.homework[0].scores),before);assert.equal(data.homework[0].published,true);assert.equal(svc.detail(hw.id).homework.batchId,first.batchId);
svc.inputScores(hw.id,'s1 91');assert.equal(Object.keys(data.gradebatches[0].results).length,0,'unconfigured batches must not synthesize grading results');assert.equal(data.homework[0].scores.s1.score,91);
svc.update(hw.id,{questions:[{text:'分析题',points:100,rubric:'观点清楚40分，论证60分'}]});assert.equal(svc.detail(hw.id).homework.questions[0].points,100);
svc.remove(hw.id,true);assert.throws(()=>svc.enableGrading(hw.id),/不存在|删除/);
console.log('PASS simple homework: metadata-only creation, lazy batch, idempotency, scores retained, configure later, deleted guard');
