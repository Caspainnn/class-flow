'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const els=new Map(),events={},requests=[];
function el(s){if(!els.has(s))els.set(s,{value:({'#course':'all','#term':'all','#period':'30'}[s]||''),innerHTML:'',textContent:'',hidden:false,disabled:false,setAttribute(){},addEventListener(n,f){events[s+n]=f;},scrollIntoView(){}});return els.get(s);}
const sample=name=>({generatedAt:Date.now(),range:{from:'2026-10-01',to:'2026-11-01'},options:{courses:[{id:'real',name}],terms:['学期']},courses:[{id:'real',name,students:3,warn:0}],sessions:[{courseId:'real',date:'2026-10-28',total:3,present:1,answered:0,correct:0,late:0}],trend:[{date:'2026-10-28',total:3,present:1,answered:0,correct:0,late:0}],homework:[{name:'<img src=x onerror=alert(1)>',courseId:'real',total:3,scored:0,missing:0,pending:0,abnormal:0,mean:null,href:'/homework'}],surveys:[],resources:[],tasks:[],templateCounts:{ppt:0,plan:1}});
const ctx=vm.createContext({document:{querySelector:el,addEventListener:(n,f)=>events[n]=f,hidden:false},location:{search:''},URLSearchParams,AbortController,Date,setInterval(){},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),console});
vm.runInContext(fs.readFileSync('server/dashboard/public/view.js','utf8'),ctx);vm.runInContext(fs.readFileSync('server/dashboard/public/app.js','utf8'),ctx);
const finish=async(i,data,status=200)=>{requests[i].resolve({ok:status===200,json:async()=>data});await new Promise(r=>setImmediate(r));};
(async()=>{
 assert.equal(requests.length,1);await finish(0,sample('真实数据课程'));assert.match(el('#content').innerHTML,/真实数据课程/);assert.ok(!el('#content').innerHTML.includes('<img'));assert.match(el('#content').innerHTML,/&lt;img/);assert.ok(!el('#content').innerHTML.includes('NaN'));assert.ok(!el('#content').innerHTML.includes('Infinity'));assert.ok(!el('#content').innerHTML.includes('模板 4'));
 el('#period').value='7';events['#periodchange']();el('#period').value='all';events['#periodchange']();await finish(2,sample('最新范围'));await finish(1,sample('过期范围'));assert.match(el('#content').innerHTML,/最新范围/);assert.ok(!el('#content').innerHTML.includes('过期范围'));
 el('#refresh').onclick();await finish(3,{error:'暂时不可用'},503);assert.equal(el('#loadError').hidden,false);assert.match(el('#content').innerHTML,/最新范围/);assert.ok(!el('#refresh').disabled);
 el('#period').value='custom';el('#from').value='2026-11-02';el('#to').value='2026-11-01';events['#periodchange']();assert.equal(el('#dateError').hidden,false);assert.equal(requests.length,4);
 console.log('PASS formal UI: actual payload render, escaping, zero-answer chart gaps, no prototype counts, filter race guard, error retains previous data and invalid range');
})().catch(e=>{console.error(e);process.exitCode=1;});
