'use strict';
const assert=require('node:assert/strict'),doc=require('../server/lesson-plan/document');
const schema=doc.builtin(),p=structuredClone(schema);
for(const s of p.sections)for(const b of s.blocks)if(b.type==='text')b.text='教学内容';else b.rows=b.headers.join('/')==='项目/内容'?b.rows.map(r=>[r[0],'待教师填写']):[b.headers.map(h=>h==='时间'?'10':h==='实际记录'?'':'具体活动')];
p.sections[8].blocks[0].rows[0].pop();
const fixed=doc.normalizeGenerated(p,schema);assert.equal(fixed.plan.sections[8].blocks[0].rows[0].length,3);assert.ok(fixed.changes.length);doc.validate(fixed.plan,schema,10,{generated:true});
const bad=structuredClone(p);bad.sections[5].blocks[0].rows[0].pop();assert.throws(()=>doc.validate(doc.normalizeGenerated(bad,schema).plan,schema,10,{generated:true}),/列|表格/);
const overflow=structuredClone(fixed.plan);overflow.sections[8].blocks[0].rows[0].push('不可丢弃的内容');assert.throws(()=>doc.validate(doc.normalizeGenerated(overflow,schema).plan,schema,10,{generated:true}),/列|表格/);
const numeric=structuredClone(fixed.plan);numeric.sections[5].blocks[0].rows[0][1]=10;doc.validate(doc.normalizeGenerated(numeric,schema).plan,schema,10,{generated:true});
for(const mutate of [v=>v.sections[0]=null,v=>v.sections[0].blocks[0]=null,v=>v.sections[0].blocks[0].rows[0]=null]){const v=structuredClone(fixed.plan);mutate(v);assert.throws(()=>doc.validate(doc.normalizeGenerated(v,schema).plan,schema,10,{generated:true}),e=>e.status===400,'malformed JSON nodes must become repairable format errors');}
console.log('lesson format: missing blank reflection cell, numeric minutes, meaningful column loss rejection PASS');
