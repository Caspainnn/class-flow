'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {validate}=require('../server/ppt/outline');
const source=fs.readFileSync('server/ppt/public/ppt.js','utf8'),field={textContent:'',focus(){focusCount++;},scrollIntoView(){},classList:{toggle(){}}};
let received,focusCount=0;
const ctx=vm.createContext({render(){},document:{getElementById:id=>id==='outlineObjective'?null:field},api:async(url,value)=>{received=validate(value,ctx.task);return {...ctx.task,outline:received};}});
vm.runInContext(source.slice(0,source.indexOf('const deletedTaskIds'))+source.slice(source.indexOf('function outlineEditing()'),source.indexOf('function durationLabel('))+source.slice(source.indexOf('function outlinePage()'),source.indexOf('\n',source.indexOf('function outlinePage()')))+"\nconst endpoint=()=>'/isolated-outline';",ctx);
const brief='保留所有原稿内容，只调整模板布局与字号。',goal='能够识别输入风险，并解释人工复核的方法。';
function seed(mode,objective,teachingObjective){
 const task={id:'synthetic',minutes:5,creationMode:mode,sourcePageCount:1,outline:{pageBased:true,objective,sections:[{title:'示例页面',minutes:5,description:'真实的逐页内容',...(mode==='update'?{sourcePages:[1]}:{})}]}};
 if(teachingObjective!==undefined)task.outline.teachingObjective=teachingObjective;
 ctx.task=task;vm.runInContext('current='+JSON.stringify(task)+';outlineDraft=null;',ctx);
 return task;
}
function view(){return vm.runInContext('outlinePage()',ctx);}
function editor(){vm.runInContext('outlineDraft={taskId:current.id,value:JSON.parse(JSON.stringify(current.outline))};',ctx);return view();}
(async()=>{
 seed('update',brief);assert.doesNotMatch(view(),/教学目标|class="objective"/);assert.doesNotMatch(view(),/只调整模板布局与字号/);assert.match(view(),/真实的逐页内容/);assert.doesNotMatch(editor(),/outlineObjective|只调整模板布局与字号/);
 const editStart=source.indexOf('outlineViewing=true;outlineDraft=',source.indexOf("if(a==='edit-outline'){"));vm.runInContext('(function(){'+source.slice(editStart,source.indexOf('\n',editStart))+')()',ctx);assert.equal(focusCount,1,'editor focuses the first page when no objective field exists');
 vm.runInContext("outlineDraft.value.sections[0].title='修改后的标题'",ctx);assert.equal(await vm.runInContext('saveOutlineDraft()',ctx),true);assert.equal(received.objective,brief);assert.deepEqual(Array.from(received.sections[0].sourcePages),[1]);
 seed('update',brief,goal);assert.match(view(),/教学目标/);assert.match(view(),new RegExp(goal));assert.doesNotMatch(view(),new RegExp(brief));assert.match(editor(),/data-outline-field="teachingObjective"/);
 vm.runInContext("outlineDraft.value.teachingObjective='修改后的学习目标'",ctx);await vm.runInContext('saveOutlineDraft()',ctx);assert.equal(received.teachingObjective,'修改后的学习目标');assert.equal(received.objective,brief);
 seed('create',goal);assert.match(view(),new RegExp(goal));assert.match(editor(),/data-outline-field="objective"/);
 for(const mode of ['create','update'])for(const empty of [undefined,'','  ']){seed(mode,'',empty);assert.doesNotMatch(view(),/教学目标|class="objective"/);assert.doesNotMatch(editor(),/outlineObjective/);}
 seed('create','legacy text','  ');assert.doesNotMatch(view(),/教学目标|legacy text/,'explicit empty goal overrides legacy fallback');
 seed('create','',goal+' <script>alert(1)</script>');assert.match(view(),/&lt;script&gt;/);assert.doesNotMatch(view(),/<script>/);
 const saved=validate({teachingObjective:'  '+goal+'  ',pages:[{title:'示例',minutes:5,description:'示例内容'}]},{minutes:5});assert.equal(saved.teachingObjective,goal);assert.equal(validate(saved,{minutes:5}).teachingObjective,goal);
 const updatePrompt=require('../server/ppt/update-prompt').build({sourceName:'synthetic.pptx',platform:true});assert.match(updatePrompt,/原稿没有明确目标则留空/);assert.match(updatePrompt,/"teachingObjective":""/);assert.match(require('../server/ppt/outline-prompt').handoff,/"teachingObjective"/);
 console.log('PASS: legacy update instructions hidden in both views; genuine and legacy create goals shown; empty goals omitted; escaping and edit/save roundtrip preserve internal instructions and source mappings; no real task writes or model calls');
})().catch(error=>{console.error(error);process.exitCode=1;});
