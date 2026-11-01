'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parse}=require('parse5');
const CSP="sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
function bad(message){const error=new Error(message);error.status=400;throw error;}
function validateHtml(buffer){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>1024*1024)bad('每页HTML必须是有效的非空文件，且不超过1MB。');
 const html=buffer.toString('utf8');if(!/<html[\s>]/i.test(html)||!/<body[\s>]/i.test(html))bad('请交付完整HTML页面。');
 let visible='';
 function styles(value){if(/@import/i.test(value))bad('HTML课件须内嵌样式，不能加载外部样式。');for(const m of value.matchAll(/url\s*\(([^)]*)\)/gi)){const url=m[1].trim().replace(/^['"]|['"]$/g,'');if(!/^(data:|#)/i.test(url))bad('HTML课件的图片和字体须内嵌，不能引用外部资源。');}}
 function walk(node,hidden=false){
  const tag=node.tagName?.toLowerCase();
  if(['script','iframe','frame','frameset','object','embed','form','base','link'].includes(tag))bad('HTML课件只能包含静态页面，不能执行脚本或嵌入外部内容。');
  const attrs=node.attrs||[];
  for(const a of attrs){const name=a.name.toLowerCase(),value=a.value.trim();
   if(/^on/i.test(name)||name==='srcdoc'||name==='srcset')bad('HTML课件包含不支持的活动内容。');
   if(tag==='meta'&&name==='http-equiv'&&!/^content-type$/i.test(value))bad('HTML课件不能改变页面导航或安全策略。');
   if(['src','href','action','poster'].includes(name)&&value&&!/^(#|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);)/i.test(value))bad('HTML课件须为独立页面，不能包含外部链接或资源。');
   if(name==='style')styles(value);
  }
  if(tag==='style')styles((node.childNodes||[]).map(n=>n.value||'').join(''));
  const skip=hidden||['head','style','title','template'].includes(tag);if(node.nodeName==='#text'&&!skip)visible+=' '+node.value;
  for(const child of node.childNodes||[])walk(child,skip);
  if(node.content)walk(node.content,true);
 }
 walk(parse(html));return {html,text:visible.replace(/\s+/g,' ').trim(),sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
}
function outlineHash(task){return crypto.createHash('sha256').update(JSON.stringify(task.outline||null)).digest('hex');}
function collectHtml({task,runId,taskDir,readFile,phase,page,imagePlan=null,restoreImages=false}){
 const runDir=path.join(taskDir,'runs',runId),manifest=JSON.parse(fs.readFileSync(readFile(`runs/${runId}/html-delivery.json`),'utf8'));
 if(!Array.isArray(manifest.slides)||manifest.slides.length<1||manifest.slides.length>150)bad('HTML课件须包含1至150页。');
 if(task.pageCount&&manifest.slides.length!==task.pageCount)bad(`课件页数与要求的${task.pageCount}页不一致，本轮新版本未收录。`);
 let total=0;const used=new Set(),buffers=[];
 if(imagePlan&&(!Array.isArray(imagePlan)||imagePlan.length>150||imagePlan.filter(i=>i?.status==='ready').length>1))bad('配图计划格式不正确或超过一张外部图片。');
 const safe=relative=>{if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('\\')||relative.split('/').some(v=>!v||v==='.'||v==='..'))bad('HTML交付文件路径无效。');const full=readFile(`runs/${runId}/${relative}`);if(!fs.realpathSync(full).startsWith(fs.realpathSync(runDir)+path.sep))bad('HTML交付必须位于本轮目录。');return full;};
 const slides=manifest.slides.map((slide,index)=>{
  if(used.has(slide.file)||!String(slide.file).endsWith('.html'))bad('HTML页面路径重复或类型不正确。');used.add(slide.file);
  const full=safe(slide.file),stat=fs.statSync(full);if(stat.size>1024*1024)bad('单页HTML超过1MB。');total+=stat.size;if(total>20*1024*1024)bad('HTML课件总大小超过20MB。');
  let buffer=fs.readFileSync(full);
  if(restoreImages&&index===page-1&&task.htmlVersions?.at(-1)?.slides[index]?.image?.status==='ready'){
   const original=fs.readFileSync(readFile(task.htmlVersions.at(-1).slides[index].file),'utf8');
   buffer=Buffer.from(require('./images').restore(buffer.toString('utf8'),original));
  }
  const validated=validateHtml(buffer);buffers.push(buffer);
  const old=task.htmlVersions?.at(-1)?.slides[index],speech=slide.speech??(phase==='html-modify'&&index!==page-1?old?.speech:'');
  if(typeof speech!=='string'||speech.length>40000)bad('逐页讲稿格式不正确或过长。');
  if((phase==='html'&&manifest.speechRequired||phase==='html-modify'&&old?.speech&&index===page-1)&&speech.trim().length<40)bad('本页缺少完整口语讲稿，请重新制作本页。');
  const image=imagePlan?imagePlan[index]||null:phase==='html-modify'?old?.image||null:null;
  if(image?.status==='ready'&&!/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(image.source||''))bad('配图来源无效。');
  if(imagePlan||image){const images=require('./images');images.noUnplannedImages(validated.html);const marker=validated.html.includes('<!--PPT_IMAGE_START-->');if(marker!==(image?.status==='ready'))bad('配图与页面计划不一致，请保留原图片区域。');}
  let notes=String(slide.notes||'').slice(0,20000);const imageCredit=require('./images').credit(image);if(imageCredit&&!notes.includes(imageCredit))notes=notes.slice(0,17000)+'\n'+imageCredit;
  return {number:index+1,title:String(slide.title||`第${index+1}页`).trim().slice(0,200),notes,speech:speech.trim(),text:validated.text,sha256:validated.sha256,...(image?{image}:{})};
 });
 const previous=task.htmlVersions?.at(-1);
 if(phase==='html-modify'&&(!previous||slides.length!==previous.slides.length||slides.some((slide,i)=>i!==page-1&&(slide.sha256!==previous.slides[i].sha256||slide.notes!==previous.slides[i].notes||slide.title!==previous.slides[i].title||slide.speech!==(previous.slides[i].speech||'')))))bad('指定页以外的HTML页面或讲稿发生变化，本轮新版本未收录。');
 const sourceFiles=[];for(const relative of (Array.isArray(manifest.sources)?manifest.sources:[]).slice(0,30)){const full=safe(relative),stat=fs.statSync(full);total+=stat.size;if(stat.size>20*1024*1024||total>40*1024*1024)bad('HTML源文件过大。');sourceFiles.push({full,name:path.basename(full)});}
 const versionId=crypto.randomBytes(12).toString('hex'),folder=path.join(taskDir,'html',versionId);fs.mkdirSync(folder,{recursive:true});
 slides.forEach((slide,i)=>{slide.file=`html/${versionId}/${String(i+1).padStart(3,'0')}.html`;fs.writeFileSync(path.join(taskDir,slide.file),buffers[i],{flag:'wx'});});
 const sources=sourceFiles.map((source,i)=>{const file=`html/${versionId}/source-${i}-${source.name}`;fs.copyFileSync(source.full,path.join(taskDir,file));return {name:source.name,file};});
 const number=(task.htmlVersions?.length||0)+1;
 let speechFile=null;
 if(slides.every(s=>s.speech)){speechFile=`html/${versionId}/逐页演讲稿.md`;const manuscript=[`# ${task.title}｜逐页演讲稿`,`课件版本：${number}；总课时：${task.minutes}分钟；共${slides.length}页。`,`教师动作以方括号标注，无需念出。`,...slides.flatMap(s=>[`## 第${s.number}页｜${s.title}`,s.speech])].join('\n\n');fs.writeFileSync(path.join(taskDir,speechFile),manuscript,{flag:'wx'});}
 return {number,createdAt:Date.now(),requirementsRevision:task.requirementsRevision||0,outlineHash:outlineHash(task),template:task.template?{id:task.template.id,name:task.template.name,sha256:task.template.sha256}:null,slides,sources,speechFile,hash:crypto.createHash('sha256').update(JSON.stringify(slides.map(s=>({sha256:s.sha256,notes:s.notes,...(s.speech?{speech:s.speech}:{})})))).digest('hex'),summary:String(manifest.summary||'').slice(0,6000)};
}
function approvedHtml(task,version,approved){
 const latest=task.htmlVersions?.at(-1);
 if(!latest||latest.number!==version||latest.requirementsRevision!==(task.requirementsRevision||0)||latest.outlineHash!==outlineHash(task))bad('HTML版本或教学要求已变化，请检查最新HTML课件后再确认。');
 if(approved!==true&&task.approvedHtmlVersion!==latest.number)bad('请先确认HTML成品，再导出可编辑PPTX。');
 return latest;
}
module.exports={CSP,validateHtml,collectHtml,approvedHtml,outlineHash};
