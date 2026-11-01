'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createService}=require('../server/dashboard/service');
const dir=fs.mkdtempSync(path.resolve('.tmp-dashboard-service-')),time=Date.parse('2026-11-01T12:00:00+08:00'),ts=s=>Date.parse(s+'T12:00:00+08:00');
const write=(name,value)=>{const f=path.join(dir,name+'.json');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(value));};
write('courses',[{id:'a',name:'A',term:'秋'},{id:'b',name:'B',term:'春'},{id:'deleted',deletedAt:1}]);
write('students',[{id:'1',courseId:'a'},{id:'2',courseId:'a'},{id:'3',courseId:'a'},{id:'1',courseId:'b'}]);
write('settings',{});
write('sessions',[
 {id:'s1',courseId:'a',startedAt:ts('2026-10-28'),closed:true,records:[{studentId:'1',answer:0,correct:true},{studentId:'1',answer:0,correct:true},{studentId:'2',answer:1,correct:false,status:'late'},{studentId:'outsider',answer:0,correct:true}]},
 {id:'s2',courseId:'b',startedAt:ts('2026-10-29'),closed:true,records:[{studentId:'1',answer:0,correct:true}]},
 {id:'no-answer',courseId:'a',startedAt:ts('2026-10-30'),closed:true,records:[{studentId:'1',answer:null}]},
 {id:'empty',courseId:'a',startedAt:ts('2026-10-30'),closed:true,records:[]},
 {id:'active',courseId:'a',startedAt:time,endsAt:time+50000,closed:false,records:[]},
 {id:'old',courseId:'a',startedAt:ts('2025-01-01'),closed:true,records:[{studentId:'1'}]},
 {id:'deleted',courseId:'deleted',startedAt:ts('2026-10-29'),closed:true,records:[{studentId:'1'}]}
]);
write('homework',[{id:'h',courseId:'a',name:'H',createdAt:ts('2026-10-28'),published:true,scores:{'1':{score:80,source:'manual'}},manualMissing:{'2':true}},{id:'d',courseId:'a',createdAt:time,deletedAt:1}]);
write('gradebatches',[{id:'batch',hwId:'h',courseId:'a',name:'H',createdAt:time,questions:[{points:100}],files:[{sid:'1',status:'matched'},{sid:'1',status:'matched'},{sid:null,status:'pending'},{sid:'2',status:'matched'}],results:{'1':{total:80}},status:'done'}]);
write('questionnaires',{surveys:[
 {id:'named',courseId:'a',title:'N',mode:'named',status:'collecting',publishedAt:ts('2026-01-01'),target:[{id:'1'},{id:'4'}],responses:[{studentId:'1',submittedAt:ts('2026-10-28'),answers:{secret:'PRIVATE'}},{studentId:'1',submittedAt:ts('2026-10-29')},{studentId:'x',submittedAt:time}]},
 {id:'anon',courseId:'b',title:'AN',mode:'anonymous',status:'archived',publishedAt:ts('2026-01-01'),responses:[{submittedAt:ts('2026-10-28')},{submittedAt:ts('2026-01-01')}]},
 {id:'draft',courseId:'a',mode:'named',status:'draft',responses:[]}
]});
const ppt='a'.repeat(24),plan='b'.repeat(24),tpl='c'.repeat(24);
write('ppt/'+ppt+'/task',{id:ppt,title:'PPT',courseId:'a',status:'failed',createdAt:ts('2026-01-01'),htmlVersions:[{createdAt:ts('2026-10-28')}],versions:[{createdAt:ts('2026-10-29')}],run:{startedAt:time}});
write('lesson-plan/'+plan+'/task',{id:plan,title:'Plan',courseId:'',status:'running',createdAt:time,versions:[]});
write('ppt/_templates/'+tpl+'/template',{id:tpl,profile:{confirmed:true,layoutGroups:[{},{}]}});
const service=createService({root:dir,now:()=>time}),q=o=>new URLSearchParams(o),d=service.snapshot(q({period:'7'}));
assert.equal(d.courses.length,2);assert.equal(d.courses.reduce((n,c)=>n+c.students,0),4);
assert.equal(d.sessions.length,3);assert.equal(d.emptySessions,1);assert.equal(d.activeSessions,1);
assert.equal(d.sessions.reduce((n,s)=>n+s.present,0),4);assert.equal(d.sessions.reduce((n,s)=>n+s.total,0),7);
assert.equal(d.sessions.reduce((n,s)=>n+s.correct,0),2);assert.equal(d.sessions.reduce((n,s)=>n+s.answered,0),3);
assert.equal(d.homework.length,1);assert.equal(d.homework[0].scored,1);assert.equal(d.homework[0].missing,1);assert.equal(d.homework[0].matched,2);assert.equal(d.homework[0].ungraded,1);
assert.equal(d.surveys.length,2);assert.equal(d.surveys[0].count,1);assert.equal(d.surveys[0].target,2);assert.equal(d.surveys[1].count,1);assert.equal(d.surveys[1].totalCount,2);
assert.ok(!JSON.stringify(d).includes('PRIVATE'));assert.ok(!JSON.stringify(d).includes('responses'));assert.ok(!JSON.stringify(d).includes('studentId'));
assert.equal(d.resources.length,1);assert.equal(d.resources[0].status,'本轮失败');assert.equal(d.resources[0].hasOutput,true);assert.ok(d.tasks.some(t=>t.title==='Plan'));
assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'lesson-plan',plan,'task.json'))).status,'running');
assert.deepEqual(d.templateCounts,{ppt:1,layouts:2,plan:1});
const one=service.snapshot(q({courseId:'a',period:'7'}));assert.equal(one.courses.length,1);assert.ok(one.sessions.every(s=>s.courseId==='a'));assert.ok(!one.tasks.some(t=>t.title==='Plan'));
assert.equal(service.snapshot(q({term:'春',period:'7'})).courses[0].id,'b');
assert.throws(()=>service.snapshot(q({period:'custom',from:'2026-02-30',to:'2026-03-01'})),/有效日期/);
assert.throws(()=>service.snapshot(q({courseId:'no'})),/课程不存在/);
assert.equal(service.snapshot(q({period:'custom',from:'2026-10-29',to:'2026-10-29'})).surveys[0].count,1);
write('settings',{});fs.writeFileSync(path.join(dir,'questionnaires.json'),'{broken');assert.throws(()=>service.snapshot(),/暂时无法读取/);
console.log('PASS dashboard: weighted counts, current roster dedup, active/empty isolation, scores vs missing, matched dedup, named snapshot/anonymous/date, deleted records, retained outputs, unassociated tasks, no writes and corruption failure');
module.exports={dir};
