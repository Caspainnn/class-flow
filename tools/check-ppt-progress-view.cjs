'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('server/ppt/public/ppt-progress-view.js','utf8'),ctx);
function container(){let writes=0,nodes;return {get writes(){return writes;},set innerHTML(value){writes++;nodes=new Map();},querySelector(key){if(!nodes.has(key))nodes.set(key,{textContent:'',innerHTML:'',hidden:false,open:false,listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});return nodes.get(key);},querySelectorAll(){return Array.from({length:4},()=>({classList:{toggle(){}}}));}};}
const target=container(),run={id:'one',phase:'deck',startedAt:1000,timeoutMs:7200000,progress:{stage:'reading',lastActivityAt:1000,serverAt:1000,processAlive:true,history:[{time:1000,message:'Started'}]}};
ctx.window.PptExecutionView.update(target,run,1000);const details=target.querySelector('details');details.open=true;details.listeners.toggle();
for(let i=1;i<=5;i++)ctx.window.PptExecutionView.update(target,run,1000+i*1000);
assert.equal(target.writes,1);assert.equal(details.open,true);assert.equal(target.querySelector('details'),details);
run.progress.history.push({time:6000,message:'Writing'});ctx.window.PptExecutionView.update(target,run,7000);assert.equal(details.open,true);assert.equal(target.writes,1);
const reentered=container();ctx.window.PptExecutionView.update(reentered,run,8000);assert.equal(reentered.querySelector('details').open,true);
console.log('PASS: timer/polling keeps animated DOM alive, history stays open, new events and re-entry preserve expansion');
