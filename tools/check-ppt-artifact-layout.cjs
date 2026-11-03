'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('server/ppt/public/ppt-html-view.js','utf8'),ctx);
const version={number:1,hash:'test',speechFile:'html/test/逐页演讲稿.md',slides:[{title:'Test',speech:'Keep independent speech'}]},pptx={number:1,htmlHash:'test',file:'versions/1/lesson.pptx',notesPolicy:'empty'};
const html=ctx.window.PptHtmlView.render({task:{id:'test',title:'Lesson',status:'complete',versions:[pptx],htmlVersions:[version]},version,page:0,draft:'',connected:true});
const main=html.slice(0,html.indexOf('<aside class="result-sidebar">')),sidebar=html.slice(html.indexOf('<aside class="result-sidebar">'));
assert.equal((main.match(/class="artifact-strip/g)||[]).length,2);
assert.ok(main.indexOf('lesson.pptx')<main.indexOf('逐页讲稿.docx'));
assert.equal((main.match(/>下载<\/a>/g)||[]).length,2);
assert.match(main, /class="file-icon word-icon">Word<\/span>/);
assert.match(main, /&format=docx/);
assert.ok(!main.includes('逐页讲稿.md'));
assert.ok(!sidebar.includes('format=docx'));
assert.ok(!html.includes('本机直接转换，不调用模型'));
assert.ok(!html.includes('对照当前页面描述修改'));
assert.ok(main.includes('Keep independent speech'));
for(const notesPolicy of [null,undefined,'empty']){
 const task={id:'test',title:'Lesson',status:'complete',versions:[{...pptx,notesPolicy}],htmlVersions:[version]};
 const render=()=>ctx.window.PptHtmlView.render({task,version,page:0,draft:'',connected:false,exportConnected:false});
 const unchecked=render();assert.match(unchecked,/id="reviewed" type="checkbox"/);assert.match(unchecked,/data-action="ready" disabled>标记可上课/);assert.ok(!unchecked.includes('data-action="confirm-html"'));assert.ok(!unchecked.includes('需要在PowerPoint中编辑或带走使用时'));
 task.reviewedVersion=1;task.status='ready';const checked=render();assert.match(checked,/id="reviewed" type="checkbox" checked/);assert.match(checked,/data-action="ready" >已标记可上课/);
}
const pending=ctx.window.PptHtmlView.render({task:{id:'test',title:'Lesson',status:'html-ready',versions:[],htmlVersions:[version]},version,page:0,draft:'',connected:true});assert.match(pending,/data-action="confirm-html"/);assert.ok(!pending.includes('id="reviewed"'));
const next={...version,number:2,hash:'next'},changed=ctx.window.PptHtmlView.render({task:{id:'test',title:'Lesson',status:'html-ready',reviewedVersion:null,versions:[pptx],htmlVersions:[version,next]},version:next,page:0,draft:'',connected:true});assert.match(changed,/data-action="confirm-html"/);assert.ok(!changed.includes('id="reviewed"'));
console.log('PASS: PPT and manuscript are separate full-width rows, manuscript follows PPT, no sidebar download or redundant copy.');
