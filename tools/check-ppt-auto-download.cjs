'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const id='a'.repeat(24),run='b'.repeat(24),downloads=[];let items=[],detail;
const region={setAttribute(){},addEventListener(){},innerHTML:''};
const context={window:{addEventListener(){}},document:{createElement(tag){return tag==='a'?{click(){downloads.push(this.href);},remove(){}}:region;},body:{append(){}},querySelector:()=>null,getElementById:()=>null},localStorage:{getItem:()=>null,setItem(){}},fetch:async url=>({ok:true,json:async()=>url==='/api/ppt/tasks'?{items}:detail}),setInterval(){},location:{href:'http://127.0.0.1:3000/'},URL};
vm.createContext(context);vm.runInContext(fs.readFileSync('server/public/ppt-notifications.js','utf8'),context);
const manager=context.window.PptNotifications,running={id,title:'Synthetic lesson',status:'running',run:{id:run,phase:'export',htmlVersion:2,htmlHash:'hash'}};
const complete={...running,status:'complete',versions:[{number:1,file:'versions/1/lesson.pptx',htmlVersion:2,htmlHash:'hash'}]};
(async()=>{
 assert.equal(typeof manager.downloadWhenReady,'function');
 manager.downloadReady(complete);assert.equal(downloads.length,0,'opening old result must not download');
 manager.downloadWhenReady(running);manager.downloadReady(running);assert.equal(downloads.length,0);
 manager.downloadReady(complete);manager.downloadReady(complete);assert.equal(downloads.length,1,'one download per requested run');assert.ok(downloads[0].includes(encodeURIComponent('versions/1/lesson.pptx')));
 manager.downloadWhenReady(running);manager.downloadReady({...running,status:'failed'});manager.downloadReady(complete);assert.equal(downloads.length,1,'failure clears intent');
 manager.downloadWhenReady(running);manager.downloadReady({...complete,run:{...complete.run,id:'c'.repeat(24)}});manager.downloadReady(complete);assert.equal(downloads.length,1,'different run cannot download');
 // Existing parent polling must finish a requested download even after leaving the PPT iframe.
 manager.downloadWhenReady(running);items=[{id,status:'complete',runId:run}];detail=complete;
 await new Promise(r=>setImmediate(r));await manager.refresh();await manager.refresh();assert.equal(downloads.length,2);
 console.log('PASS: first export auto-downloads once, old results stay quiet, failed/stale jobs do not download, parent polling works after switching modules.');
})().catch(e=>{console.error(e);process.exitCode=1;});
