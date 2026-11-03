'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {validate}=require('../server/ppt/outline');
const template={roleFile:'templates/roles.pptx',profile:{layoutGroups:[{id:'body',name:'正文'}]},pageRoles:{cover:{layoutId:'role-page-1'},ending:{layoutId:'role-page-30'},layoutGroups:[{id:'role-page-1',name:'首页'},{id:'role-page-30',name:'尾页'}]}};
const outline={objective:'Synthetic fixture',pages:['role-page-1','body','role-page-30'].map((layoutId,i)=>({title:'Page '+(i+1),description:'Fixture content',minutes:5,sourcePages:[i+1],layoutId}))},task={minutes:15,template};
for(const creationMode of ['create','update']){
 const approved=validate(outline,{...task,creationMode,sourcePageCount:3});assert.deepEqual(approved.sections.map(s=>s.layoutId),outline.pages.map(s=>s.layoutId));
 assert.deepEqual(validate(approved,{...task,creationMode,sourcePageCount:3}),approved,'normalized outline can be saved and revalidated');
}
for(const [index,layoutId] of [[0,'unknown'],[0,'role-page-30'],[1,'role-page-1'],[1,'role-page-30'],[2,'role-page-1']]){
 const invalid=structuredClone(outline);invalid.pages[index].layoutId=layoutId;assert.throws(()=>validate(invalid,task),/大纲所选布局/);
}
for(const broken of [null,{profile:template.profile},{...template,roleFile:null},{...template,pageRoles:{...template.pageRoles,layoutGroups:[]}}])assert.throws(()=>validate(outline,{...task,template:broken}),/大纲所选布局/);
const ordinary=structuredClone(outline);ordinary.pages.forEach(s=>s.layoutId='body');assert.equal(validate(ordinary,{...task,template:{profile:template.profile}}).sections.length,3);
ordinary.pages.forEach(s=>delete s.layoutId);assert.equal(validate(ordinary,{...task,template:null}).sections.length,3);
const single={pages:[{title:'One page',minutes:15,description:'Fixture',layoutId:'role-page-1'}]};assert.equal(validate(single,task).sections.length,1);
single.pages[0].layoutId='role-page-30';assert.throws(()=>validate(single,task),/大纲所选布局/,'a single page uses the cover role, matching the page runner');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8'),ctx=vm.createContext({esc:String,layoutDiagram:g=>'<svg aria-label="'+g.name+'"></svg>'});
vm.runInContext('let current='+JSON.stringify(task)+',outlineDraft={value:{sections:'+JSON.stringify(outline.pages)+'}};'+source.slice(source.indexOf('function outlineRoleLayout('),source.indexOf('function outlineImageFields(')),ctx);
const render=i=>vm.runInContext(`outlineLayoutSelect(outlineDraft.value.sections[${i}],${i})`,ctx);
assert.match(render(0),/首页/);assert.match(render(2),/尾页/);assert.match(render(0),/专用布局/);assert.match(render(1),/更换布局/);assert.ok(!render(1).includes('专用布局'));
vm.runInContext('outlineDraft.value.sections=[outlineDraft.value.sections[0]]',ctx);assert.ok(!render(0).includes('role-page-30'));
console.log('PASS: confirmed cover/ending roles survive validation and editing; wrong positions, unknown templates and unbacked roles are rejected; ordinary and single-page templates remain compatible.');
