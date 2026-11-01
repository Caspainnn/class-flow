'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createService}=require('../server/ppt/service'),{validateHtml}=require('../server/ppt/html-deck');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-html-ppt-')),skill=path.join(root,'skill');fs.mkdirSync(skill);fs.writeFileSync(path.join(skill,'SKILL.md'),'test');
const settings={workbuddy:{enabled:true,path:__filename},ppt:{skillPath:skill,timeoutMs:60000}};
let launches=[];const launch=(exe,args,options)=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();launches.push({child,args,options});return child;};
const service=createService({root:path.join(root,'tasks'),getSettings:()=>settings,getCourses:()=>[],launch});
const html='<html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body><h1>Editable lesson</h1></body></html>';
const deliver=(run,value=html)=>{fs.writeFileSync(path.join(run.options.cwd,'01.html'),value);fs.writeFileSync(path.join(run.options.cwd,'html-delivery.json'),JSON.stringify({slides:[{title:'Lesson',file:'01.html',notes:'Teacher notes',speech:'A complete spoken explanation for the lesson, including a classroom question and transition.'}],sources:[]}));};
const settle=async id=>{for(let i=0;i<100;i++){const t=service.get(id);if(t.status!=='running')return t;await new Promise(r=>setTimeout(r,5));}throw Error('Fixture did not settle');};

const tick=()=>new Promise(r=>setImmediate(r));
async function beginHtml(id,count=1){
 service.start(id,'html');await tick();let run=launches.at(-1);
 for(let i=0;i<count;i++){run=launches.at(-1);const sub='pages/'+String(i+1).padStart(3,'0');fs.writeFileSync(path.join(run.options.cwd,sub,'slide.html'),i===0?html:html+' ');fs.writeFileSync(path.join(run.options.cwd,sub,'slide.json'),JSON.stringify({title:i===0?'Lesson':'Page '+(i+1),notes:i===0?'Teacher notes':'',speech:'A complete spoken explanation for the lesson, including a classroom question and transition.'}));run.child.emit('close',0);await tick();}
}

(async()=>{
 for(const unsafe of ['<script>alert(1)</script>','<img src="https://foreign.example/a">','<meta http-equiv="refresh" content="0;url=https://foreign.example">','<svg><a href="javascript:alert(1)">x</a></svg>'])assert.throws(()=>validateHtml(Buffer.from('<html><body>'+unsafe+'</body></html>')));
 const t=service.create({title:'Test',audience:'Grade 7',minutes:5,content:'Test lesson'});service.outline(t.id,{objective:'Learn',pages:[{title:'Lesson',minutes:5,description:'Teach lesson'}]});
 assert.throws(()=>service.start(t.id,'export',{htmlVersion:1,approved:true}));
 await beginHtml(t.id);let run=launches.at(-1);assert.ok(!run.args[run.args.indexOf('-p')+1].includes('先读取该目录的SKILL.md'));assert.ok(!run.args[run.args.indexOf('--tools')+1].includes('Bash'));
 let current=await settle(t.id);assert.equal(current.status,'html-ready');assert.equal(current.versions.length,0);assert.equal(current.htmlVersions.length,1);
 assert.throws(()=>service.start(t.id,'export',{htmlVersion:1}));
 service.start(t.id,'export',{htmlVersion:1,approved:true});run=launches.at(-1);assert.ok(run.args[run.args.indexOf('--tools')+1].includes('Bash'));assert.equal(fs.readFileSync(path.join(run.options.cwd,'input-html/001.html'),'utf8'),html);
 fs.copyFileSync(path.join(__dirname,'fixtures/ppt-service.pptx'),path.join(run.options.cwd,'lesson.pptx'));fs.writeFileSync(path.join(run.options.cwd,'delivery.json'),JSON.stringify({pptx:'lesson.pptx',sources:[]}));run.child.emit('close',0);
 current=await settle(t.id);assert.equal(current.status,'failed');assert.equal(current.versions.length,0);assert.match(current.error,/讲稿/);
 service.start(t.id,'export',{htmlVersion:1,approved:true});run=launches.at(-1);const zip=await require('../server/node_modules/jszip').loadAsync(fs.readFileSync(path.join(__dirname,'fixtures/ppt-service.pptx'))),notePath='ppt/notesSlides/notesSlide1.xml',noteXml=await zip.file(notePath).async('string');zip.file(notePath,noteXml.replace(/<a:t(?:\s[^>]*)?>[\s\S]*?<\/a:t>/,'<a:t>'+current.htmlVersions[0].slides[0].speech+'</a:t>'));fs.writeFileSync(path.join(run.options.cwd,'lesson.pptx'),await zip.generateAsync({type:'nodebuffer'}));fs.writeFileSync(path.join(run.options.cwd,'delivery.json'),JSON.stringify({pptx:'lesson.pptx',sources:[]}));run.child.emit('close',0);
 current=await settle(t.id);assert.equal(current.status,'complete');assert.equal(current.versions[0].htmlVersion,1);
 service.start(t.id,'html-modify',{page:1,note:'Change title'});run=launches.at(-1);deliver(run,html.replace('Editable lesson','Updated lesson'));run.child.emit('close',0);current=await settle(t.id);
 assert.equal(current.htmlVersions.length,2);assert.equal(current.versions.length,1);assert.equal(current.approvedHtmlVersion,null);assert.throws(()=>service.start(t.id,'export',{htmlVersion:1,approved:true}));assert.throws(()=>service.ready(t.id,1,true));
 service.start(t.id,'html-modify',{page:1,note:'Cancelled change'});run=launches.at(-1);service.cancel(t.id);deliver(run);run.child.emit('close',0);await new Promise(r=>setImmediate(r));assert.equal(service.get(t.id).htmlVersions.length,2);
 service.update(t.id,{title:'Changed requirement',audience:'Grade 7',minutes:5,content:'Changed'});assert.throws(()=>service.start(t.id,'export',{htmlVersion:2,approved:true}));
 service.outline(t.id,{objective:'New',pages:[{title:'New lesson',minutes:5,description:'New lesson'}]});assert.throws(()=>service.start(t.id,'html-modify',{page:1,note:'Modify stale lesson'}));
 const other=service.create({title:'Two pages',audience:'Test',minutes:5,content:'Test'});service.outline(other.id,{pages:[{title:'Lesson',minutes:2,description:'Teach lesson'},{title:'Page 2',minutes:3,description:'Practice'}]});await beginHtml(other.id,2);assert.equal((await settle(other.id)).htmlVersions.length,1);
 service.start(other.id,'html-modify',{page:1,note:'Change first page only'});run=launches.at(-1);deliver(run);fs.writeFileSync(path.join(run.options.cwd,'02.html'),html+' changed');fs.writeFileSync(path.join(run.options.cwd,'html-delivery.json'),JSON.stringify({slides:[{file:'01.html',notes:'Teacher notes',speech:'A complete spoken explanation for the lesson, including a classroom question and transition.'},{file:'02.html'}]}));run.child.emit('close',0);current=await settle(other.id);assert.equal(current.status,'failed');assert.equal(current.htmlVersions.length,1);
 console.log('PASS: safe real HTML, no PPTX before review, exact approved input, native export, new HTML invalidates approval, late cancel discarded, old versions retained');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
