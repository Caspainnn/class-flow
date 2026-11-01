'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('server/public/session.html','utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
new vm.Script(script);
const nodes = new Map();
const $ = id => { if(!nodes.has(id))nodes.set(id,{style:{},textContent:'',innerHTML:''});return nodes.get(id); };
const context = vm.createContext({$,document:{querySelectorAll:()=>[]},closeCancelSession(){},esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
for(const name of ['showStage','renderArchive']) {
  const start=script.indexOf('function '+name+'(');
  const end=script.indexOf('\n}',start)+2;
  vm.runInContext(script.slice(start,end),context);
}
context.st={course:'示例课程',question:{text:'哪些是正确的？',options:['<script>','乙','丙'],correct:[0,2]},dist:[2,1,2],present:3,total:4,answered:3,correct:2};
vm.runInContext('renderArchive(st)',context);
assert.equal($('#stage3').style.display,'');
assert.equal($('#stage2').style.display,'none');
assert.equal($('#archiveAnswer').textContent,'正确答案：A、C');
assert($('#archiveOptions').innerHTML.includes('&lt;script&gt;'));
assert($('#archiveStats').textContent.includes('67%'));
const live=script.slice(script.indexOf("$('#liveOpts').innerHTML"),script.indexOf("$('#nPresent').textContent"));
assert(!live.includes('question.correct'));
assert(!live.includes('（正确）'));
assert(!html.includes('开始签到 · 投到大屏'));
assert(!html.includes('只在老师屏幕显示'));
console.log('PASS: live answers hidden, archive stage with safe multi-answer rendering and statistics');
