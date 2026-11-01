'use strict';
// Deferred fake FileReaders and API responses only; never uses a real server.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../server/grade/public/grading.html'),'utf8');
const script=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[1];
const code=script.slice(0,script.indexOf('(async function init()'));
function setup(){
  const elements={},handlers={},readers=[],requests=[];
  const node=id=>elements[id]||(elements[id]={disabled:false,value:'',innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener:(name,fn)=>handlers[id+':'+name]=fn,querySelectorAll:()=>[],replaceChildren(){}});
  const ctx=vm.createContext({console,document:{getElementById:node,querySelectorAll:()=>[]},history:{replaceState(){}},location:{search:''},toast(){},setTimeout(){},clearTimeout(){},setInterval(fn){ctx.interval=fn;return 1;},clearInterval(){},FileReader:class{constructor(){readers.push(this);}readAsDataURL(){}},fetch:async(url,opt)=>{requests.push({url,opt});return {ok:true,json:async()=>({})};}});
  vm.runInContext(code,ctx);
  const select=id=>vm.runInContext(`CUR=${JSON.stringify(id)}; if(typeof contextVersion!=='undefined')contextVersion++;`,ctx);
  return {ctx,node,handlers,readers,requests,select};
}
async function pendingFile(which,endpoint){
  const t=setup();t.select('A');vm.runInContext('loadState=async()=>null;go=()=>{};',t.ctx);
  const target={files:[{name:'fake.txt'}],value:'selected'};
  const pending=t.handlers[which+':change']({target});
  assert.equal(t.node('currentBatch').disabled,true,'Do not allow switching while FileReader is pending');
  assert.equal(t.node('currentCourse').disabled,true,'Course selection must also lock during file operations');
  t.select('B');t.readers[0].result='data:text/plain;base64,eA==';t.readers[0].onload();await pending;
  const post=t.requests.find(r=>r.opt&&r.opt.method==='POST');
  assert.equal(post.url,'/api/gb/batches/A/'+endpoint,'File/results must remain attached to original selection');
}
async function lateResponse(name,target){
  const t=setup();let release;
  t.ctx.fetch=async url=>url.includes('/students')?{ok:true,json:async()=>[]}:{ok:true,json:()=>new Promise(r=>release=r)};
  t.select('A');t.node(target).innerHTML='B-current';t.node(target).textContent='B-current';
  const pending=t.ctx[name]();t.select('B');vm.runInContext("state={id:'B'}",t.ctx);
  // api() first awaits fetch before it awaits json().
  for(let i=0;i<10&&!release;i++)await Promise.resolve();
  assert.equal(typeof release,'function','Fake response should be awaiting release');
  release({id:'A',courseId:'c',status:'done',results:{},questions:[{points:100}],files:[]});await pending;
  assert.equal(t.node(target).innerHTML,'B-current',name+' must discard old response');
  assert.equal(vm.runInContext('state.id',t.ctx),'B',name+' must not replace current state');
}
(async()=>{
 const picker=setup();
 vm.runInContext("batchChoices=[{batchId:'a1',courseId:'c1',name:'Assignment A'},{batchId:'b1',courseId:'c2',name:'Assignment B'}];renderBatchChoices();",picker.ctx);
 assert.equal(picker.node('currentBatch').disabled,true);
 vm.runInContext("selectedCourse='c1';renderBatchChoices();",picker.ctx);
 assert.match(picker.node('currentBatch').innerHTML,/Assignment A/);
 assert.ok(!picker.node('currentBatch').innerHTML.includes('Assignment B'));
 assert.equal(picker.node('currentBatch').disabled,false);
 vm.runInContext("CUR='a1';standardsDirty=true;",picker.ctx);
 await picker.handlers['currentCourse:change']({target:{value:'c2'}});
 assert.equal(picker.node('currentCourse').value,'c1');
 assert.equal(vm.runInContext('CUR',picker.ctx),'a1');
 vm.runInContext("standardsDirty=false;",picker.ctx);
 await picker.handlers['currentCourse:change']({target:{value:'c2'}});
 assert.equal(vm.runInContext('CUR',picker.ctx),null);
 assert.match(picker.node('currentBatch').innerHTML,/Assignment B/);
 assert.ok(!picker.node('currentBatch').innerHTML.includes('Assignment A'));
 await pendingFile('fpick','files');await pendingFile('xlpick','import');
 const roster=setup();roster.ctx.fetch=async()=>({ok:true,json:async()=>({students:[{id:'fake',name:'示例'}]})});
 await roster.ctx.loadRoster('c');assert.equal(vm.runInContext('ROSTER.length',roster.ctx),1,'Roster API wraps its array in students');
 await lateResponse('loadGrades','grades');await lateResponse('loadState','files');
 console.log('PASS grading context: uploads/imports pinned, selection locked, stale state/grades ignored');
})().catch(e=>{console.error(e);process.exitCode=1;});
