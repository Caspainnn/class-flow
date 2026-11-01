'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const images=require('../server/ppt/images'),{validate}=require('../server/ppt/outline'),{createService}=require('../server/ppt/service');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSioAAAAASUVORK5CYII=','base64');
const intent={kind:'web',subject:'Solar panels',purpose:'Identify a real device',query:'solar panels'},region={kind:'image',x:.55,y:.2,w:.4,h:.6};
const photo=n=>({status:'ready',id:String(n),...intent,title:'Solar panels '+n,author:'Test author',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',source:'https://commons.wikimedia.org/wiki/File:Test'+n+'.png',data:'data:image/png;base64,'+png.toString('base64')});
const base={title:'Synthetic image lesson',audience:'Test audience',minutes:5,content:'Test only',pageCount:2};
const pages=[{title:'Device',minutes:2,description:'Identify the device',image:intent},{title:'Summary',minutes:3,description:'Summarize'}];
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 assert.throws(()=>validate({pages:pages.map(s=>({...s,image:intent}))},base),/最多一张/);
 assert.throws(()=>images.intent({kind:'web',subject:'Only a name'}),/教学用途/);
 const planned=validate({pages},{...base,template:{profile:{layoutGroups:[{id:'image-layout',shapes:[region]},{id:'text',shapes:[]}]}}});assert.equal(planned.sections[0].layoutId,'image-layout');assert.deepEqual(planned.sections[0].imageRegion,region);
 assert.equal(validate(planned,{...base,template:{profile:{layoutGroups:[{id:'image-layout',shapes:[region]}]}}}).sections[0].layoutId,'image-layout');
 let requested=[];const api={query:{pages:{7:{pageid:7,index:1,title:'File:Solar panels',imageinfo:[{mime:'image/png',thumburl:'https://thumb.wikimedia.org/wikipedia/commons/thumb/test.png',descriptionurl:'https://commons.wikimedia.org/wiki/File:Solar_panels.png',extmetadata:{Artist:{value:'<a>Author &amp; Co</a>'},LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'}}}]}}}};
 const fetcher=async url=>{requested.push(url);return new Response(url.includes('/w/api.php?')?JSON.stringify(api):png);};
 const found=await images.search(intent,{fetcher});assert.equal(found.status,'ready');assert.equal(found.author,'Author & Co');assert.equal(requested.length,2);assert.ok(!JSON.stringify(images.metadata(found)).includes('base64'));
 requested=[];assert.equal((await images.search(intent,{exclude:['7'],fetcher})).status,'missing');assert.equal(requested.length,1);
 api.query.pages[7].imageinfo[0].thumburl='https://127.0.0.1/private';requested=[];assert.equal((await images.search(intent,{fetcher})).status,'missing');assert.equal(requested.length,1);
 assert.throws(()=>images.inject('<html><body>no slot</body></html>',photo(1),region),/预留/);assert.throws(()=>images.noUnplannedImages('<img src="data:image/png;base64,a">'),/未在大纲/);
 assert.throws(()=>images.inject('<html><head><style>/*'+images.SLOT+'*/</style></head><body></body></html>',photo(1),region),/独立图片占位/);
 assert.throws(()=>images.noUnplannedImages('<img src="data:image/&#112;ng;base64,abc">'),/未在大纲/);
 assert.throws(()=>images.noUnplannedImages('<style>body{background:url("data:im\\61 ge/png;base64,abc")}</style>'),/未在大纲/);
 assert.throws(()=>images.noUnplannedImages('<style>body{background-image:image-set("data:image/png;base64,abc" 1x)}</style>'),/未在大纲/);
 assert.throws(()=>images.noUnplannedImages('<svg><filter><feImage href="data:image/png;base64,abc"/></filter></svg>'),/未在大纲/);
 assert.throws(()=>images.noUnplannedImages('<!--PPT_IMAGE_START--><!--PPT_IMAGE_END--><!--PPT_IMAGE_START--><!--PPT_IMAGE_END-->'),/一个平台/);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-images-')),skill=path.join(root,'skill');fs.mkdirSync(skill);fs.writeFileSync(path.join(skill,'SKILL.md'),'fixture');let searches=0,searchFailure=false,hold=null;
 const searchImages=async()=>{searches++;if(hold)await hold;if(searchFailure)throw Error('offline');return photo(searches);};
 let lastRun;
 const launch=(command,args,options)=>{
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};lastRun={args,options,child};
  queueMicrotask(()=>{const prompt=args[args.indexOf('-p')+1],input=JSON.parse(fs.readFileSync(path.join(options.cwd,'input.json'),'utf8'));
   if(input.htmlVersion)return; // Modifications are completed explicitly below.
   const i=Number(prompt.match(/只制作第 (\d+)\//)[1])-1,sub='pages/'+String(i+1).padStart(3,'0');
   fs.writeFileSync(path.join(options.cwd,sub,'slide.html'),'<html><body><h1>'+pages[i].title+'</h1>'+(i===0?images.SLOT:'')+'</body></html>');
   fs.writeFileSync(path.join(options.cwd,sub,'slide.json'),JSON.stringify({title:pages[i].title,notes:'Notes',speech:'A full spoken explanation for this synthetic lesson, with a question and a transition.'}));child.emit('close',0);
  });return child;
 };
 const svc=createService({root:path.join(root,'tasks'),getSettings:()=>({workbuddy:{enabled:true,path:__filename},ppt:{skillPath:skill}}),getCourses:()=>[],launch,searchImages});
 try{
  const task=svc.create(base);svc.outline(task.id,{pages});assert.equal(searches,0,'outline review must not search');svc.start(task.id,'html');
  let t;for(let n=0;n<100;n++){await tick();t=svc.get(task.id);if(t.status!=='running')break;}assert.equal(t.status,'html-ready',t.error);assert.equal(searches,1);assert.equal(t.htmlVersions[0].slides[0].image.status,'ready');assert.ok(!t.htmlVersions[0].slides[1].image);assert.match(fs.readFileSync(svc.file(t.id,t.htmlVersions[0].slides[0].file),'utf8'),/data:image\/png/);
  const original=fs.readFileSync(svc.file(t.id,t.htmlVersions[0].slides[0].file),'utf8');
  svc.start(t.id,'html-modify',{page:1,note:'Clarify the heading'});const run=lastRun;
  const inputHtml=fs.readFileSync(path.join(run.options.cwd,'input-html/001.html'),'utf8');assert.ok(inputHtml.includes(images.SLOT));assert.ok(!inputHtml.includes('base64'));
  fs.writeFileSync(path.join(run.options.cwd,'changed.html'),inputHtml.replace('Device','Device explained'));
  fs.writeFileSync(path.join(run.options.cwd,'image-plan.json'),'[]'); // Model-written plans must never override platform state.
  fs.writeFileSync(path.join(run.options.cwd,'html-delivery.json'),JSON.stringify({slides:t.htmlVersions[0].slides.map((s,i)=>({...s,notes:i===0?'Changed teaching notes':s.notes,file:i===0?'changed.html':'input-html/002.html'})),sources:[]}));run.child.emit('close',0);await tick();t=svc.get(t.id);assert.equal(t.status,'html-ready',t.error);assert.equal(t.htmlVersions.length,2);assert.match(t.htmlVersions[1].slides[0].notes,/https:\/\/commons/);assert.match(fs.readFileSync(svc.file(t.id,t.htmlVersions[1].slides[0].file),'utf8'),/data:image\/png/);
  let release;hold=new Promise(r=>release=r);const replacement=svc.image(t.id,{action:'replace',version:2,page:1});assert.throws(()=>svc.outline(t.id,{pages}),/等待或取消/);release();hold=null;t=await replacement;assert.equal(t.htmlVersions.length,3);assert.equal(t.htmlVersions.at(-1).slides[0].image.id,'2');assert.equal(t.approvedHtmlVersion,null);
  assert.equal(fs.readFileSync(svc.file(t.id,t.htmlVersions[0].slides[0].file),'utf8'),original);
  await assert.rejects(svc.image(t.id,{action:'replace',version:2,page:1}),/版本/);
  searchFailure=true;await assert.rejects(svc.image(t.id,{action:'replace',version:3,page:1}),/原图片和课件已保留/);assert.equal(svc.get(t.id).htmlVersions.length,3);
  t=await svc.image(t.id,{action:'remove',version:3,page:1});assert.equal(t.htmlVersions.length,4);assert.equal(t.htmlVersions.at(-1).slides[0].image.status,'removed');assert.ok(!fs.readFileSync(svc.file(t.id,t.htmlVersions.at(-1).slides[0].file),'utf8').includes('data:image/'));
  const missing=svc.create(base);svc.outline(missing.id,{pages});svc.start(missing.id,'html');let failedLookup;
  for(let n=0;n<100;n++){await tick();failedLookup=svc.get(missing.id);if(failedLookup.status!=='running')break;}
  assert.equal(failedLookup.status,'html-ready',failedLookup.error);assert.equal(failedLookup.htmlVersions[0].slides[0].image.status,'missing');assert.match(failedLookup.htmlVersions[0].summary,/公开图库暂不可用/);
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync('server/ppt/public/ppt-html-view.js','utf8'),ctx);const view=ctx.window.PptHtmlView.render({task:t,version:t.htmlVersions[2],page:0,draft:'',connected:true});assert.match(view,/换一张/);assert.match(view,/取消配图/);assert.match(view,/查看图片来源/);assert.match(view,/image-replace" disabled/,'historical image action is disabled');
  console.log('PASS: image intent/max-one, template matching, bounded safe source lookup, real HTML embedding, image-preserving edits, replace/remove versions, locks, stale requests and failure preservation');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
