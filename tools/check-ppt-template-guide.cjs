'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {createService}=require('../server/ppt/service'),guide=require('../server/ppt/template-guide');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-template-guide-'));
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw Error('Fixture did not settle');}
async function uiCheck(checked){
 const fields=new Map(),el=id=>{if(!fields.has(id))fields.set(id,{value:'',checked:false,innerHTML:'',textContent:'',isConnected:true,classList:{add(){},remove(){}},focus(){},scrollIntoView(){},addEventListener(){}});return fields.get(id);};
 let options,guideCalls=0,uploadBody,hash='#upload';
 const record={id:'a'.repeat(24),name:'Synthetic.pptx',createdAt:1,guideEnabled:checked,layoutGuide:{status:'pending'},profile:{confirmed:false},analysis:{slideCount:1,smart:{selectedIds:['g']},layoutGroups:[{id:'g',sourceSlides:[1],representativeSlide:1}]}};
 const fetch=async(url,opts={})=>{let data;if(url==='/api/ppt/templates'&&(!opts.method||opts.method==='GET'))data={items:[]};else if(url==='/api/ppt/templates'){uploadBody=JSON.parse(opts.body);data=record;}else if(url.endsWith('/guide')){guideCalls++;data={...record,layoutGuide:{status:'ready',layouts:[]}};}else data=record;return {ok:true,json:async()=>data};};
 class Reader{readAsDataURL(){this.result='data:application/zip;base64,YQ==';this.onload();}}
 const context=vm.createContext({document:{getElementById:el,querySelector:()=>el('main'),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},InclassUpload:{mount:(host,o)=>{options=o;return ()=>{};}}},location:{get hash(){return hash;},set hash(v){hash='#'+v.replace(/^#/,'');}},fetch,FileReader:Reader,structuredClone,AbortController,setTimeout:()=>0,clearTimeout(){}});
 vm.runInContext(fs.readFileSync('server/ppt/public/ppt-templates.js','utf8'),context);await tick();
 assert.match(el('view').innerHTML,/<input type="checkbox" id="useWorkBuddyGuide" checked/,el('pageError').textContent);
 options.onSelect([{name:'Synthetic.pptx',size:100}]);el('useWorkBuddyGuide').checked=checked;
 await el('uploadForm').onsubmit({preventDefault(){}});
 assert.equal(uploadBody.useWorkBuddyGuide,checked);assert.equal(guideCalls,checked?1:0);assert.match(hash,/#template\//);
}
(async()=>{
 const skill=path.join(root,'skill');fs.mkdirSync(skill);fs.writeFileSync(path.join(skill,'SKILL.md'),'synthetic');
 const settings={workbuddy:{enabled:true,path:__filename},ppt:{skillPath:skill}};
 let mode='valid',guideLaunches=0,held,taskLaunch;
 const launch=(command,args,options)=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};
  const input=JSON.parse(fs.readFileSync(path.join(options.cwd,'input.json'),'utf8'));
  if(input.layouts){guideLaunches++;assert.equal(args[args.indexOf('--tools')+1],'Read,Write,ViewImage');assert.equal(options.windowsHide,true);for(const g of input.layouts)assert.ok(fs.existsSync(path.join(options.cwd,g.preview)));assert.match(fs.readFileSync(path.join(options.cwd,'prompt.txt'),'utf8'),/逐个用ViewImage|逐个用ViewImage/);
   const finish=()=>{fs.writeFileSync(path.join(options.cwd,'layout-guide.json'),mode==='invalid'?'{}':JSON.stringify({layouts:input.layouts.map(g=>({id:g.id,usage:'适用于概念讲解',capacity:'估计2至3个要点',limitations:'避免过密长文'}))}));child.emit('close',mode==='exit'?1:0);};
   if(mode==='hold')held=finish;else setImmediate(finish);
  }else taskLaunch={args,options,child};return child;
 };
 const prepareVisuals=async({runDir,profile})=>{fs.mkdirSync(path.join(runDir,'template-reference'),{recursive:true});return profile.layoutGroups.map((g,i)=>{const file='template-reference/'+String(i+1).padStart(3,'0')+'.png';fs.writeFileSync(path.join(runDir,file),'synthetic preview');return {layoutId:g.id,file};});};
 const service=createService({root:path.join(root,'tasks'),getSettings:()=>settings,getCourses:()=>[],launch,prepareVisuals});
 const base64=fs.readFileSync(path.join(__dirname,'fixtures/ppt-service.pptx')).toString('base64'),body={name:'Synthetic.pptx',base64};
 let item=await service.templates.add(body);assert.equal(item.guideEnabled,undefined);assert.equal(guideLaunches,0);
 await assert.rejects(()=>service.templates.guide(item.id),/未启用/);
 await assert.rejects(()=>service.templates.add({...body,useWorkBuddyGuide:'true'}),/选项/);
 item=await service.templates.add({...body,useWorkBuddyGuide:true});assert.equal(item.layoutGuide.status,'pending');
 settings.workbuddy.enabled=false;item=await service.templates.guide(item.id);assert.equal(item.layoutGuide.status,'failed');assert.match(item.layoutGuide.error,/尚未连接/);assert.ok(service.templates.file(item.id));
 settings.workbuddy.enabled=true;mode='invalid';item=await service.templates.guide(item.id);assert.equal(item.layoutGuide.status,'failed');assert.match(item.layoutGuide.error,/缺少布局/);
 mode='hold';const first=service.templates.guide(item.id);await until(()=>!!held);assert.equal(service.templates.get(item.id).layoutGuide.status,'running');assert.throws(()=>service.templates.remove(item.id),/正在分析/);const second=service.templates.guide(item.id);await tick();assert.equal(guideLaunches,2);mode='valid';held();const results=await Promise.all([first,second]);assert.equal(results[0].layoutGuide.status,'ready');assert.equal(results[1].layoutGuide.status,'ready');
 const count=guideLaunches;item=await service.templates.guide(item.id);assert.equal(guideLaunches,count);assert.ok(item.profile.layoutGroups.every(g=>g.guide));assert.ok(item.pageRoles.layoutGroups.every(g=>g.guide));
 item=await service.templates.confirm(item.id,{layouts:[{sourceSlide:1,name:'确认布局'}]});assert.equal(item.profile.layoutGroups[0].guide.usage,'适用于概念讲解');
 const task=service.create({title:'Synthetic',audience:'Test',minutes:20,content:'Test'});const selected=service.selectTemplate(task.id,item.id,item.confirmedRevision);assert.ok(selected.template.profile.layoutGroups[0].guide);
 service.start(task.id,'outline');await until(()=>!!taskLaunch);assert.match(taskLaunch.args[taskLaunch.args.indexOf('-p')+1],/避免无理由大量连续使用同一布局/);service.cancel(task.id);taskLaunch.child.emit('close',1);await tick();taskLaunch=null;
 const attached=service.attach(task.id,{name:'source.pptx',base64});service.update(task.id,{...attached,creationMode:'update',sourceFileId:attached.files[0].id});service.start(task.id,'outline');await until(()=>!!taskLaunch);
 const input=JSON.parse(fs.readFileSync(path.join(taskLaunch.options.cwd,'input.json'),'utf8'));assert.equal(input.template.profile,'template-layout-index.json');const index=JSON.parse(fs.readFileSync(path.join(taskLaunch.options.cwd,input.template.profile),'utf8'));assert.ok(index.layoutGroups[0].guide);service.cancel(task.id);taskLaunch.child.emit('close',1);await tick();
 item=await service.templates.add({...body,useWorkBuddyGuide:false});assert.equal(item.guideEnabled,false);assert.equal(item.layoutGuide.status,'ready');assert.ok(item.profile.layoutGroups.every(g=>!g.guide));assert.ok(service.get(task.id).template.profile.layoutGroups[0].guide);assert.equal(guideLaunches,count);
 assert.throws(()=>guide.validate({layouts:[{id:'wrong',usage:'a',capacity:'b',limitations:'c'}]},[{id:'right'}]),/编号/);
 const restarted=require('../server/ppt/templates').createTemplates(path.join(root,'tasks','_templates'),require('../server/ppt/service').inspectPpt);const meta=path.join(root,'tasks','_templates',item.id,'template.json');item.layoutGuide.status='running';fs.writeFileSync(meta,JSON.stringify(item));assert.equal(restarted.get(item.id).layoutGuide.status,'failed');
 await uiCheck(false);await uiCheck(true);
 console.log('PASS: default checked upload option, unchecked skips model, invalid preferences, failed analysis/retry, concurrent deduplication, cached guides, manual selection mapping, task snapshots, create/update handoff, interrupted recovery; isolated data and fake model only');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
