'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createService}=require('./service');
let service;
module.exports=async(req,res,ctx)=>{
 const {url,m,json,readBody,store,getCourses}=ctx,p=url.pathname;
 if(!p.startsWith('/api/ppt/'))return false;
 const host=req.headers.host||'';
 if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${host}`)){
  json(res,403,{error:'请在本机平台页面内操作课件。'});return true;
 }
 service||=createService({root:path.join(store.DATA_DIR,'ppt'),getSettings:()=>{const settings=store.read('settings',{});if(!settings.ppt){try{settings.ppt=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../.local-ppt-skills/config.json'),'utf8'));}catch{}}return settings;},getCourses});
 const send=(code,value)=>{json(res,code,value);return true;};
 try{
  if(p==='/api/ppt/connection'&&m==='GET')return send(200,service.connection());
  if(p==='/api/ppt/templates'&&m==='GET'){const tasks=service.list();return send(200,{items:service.templates.list().map(t=>({...t,uses:tasks.filter(task=>task.template?.id===t.id).length}))});}
  if(p==='/api/ppt/templates'&&m==='POST')return send(201,await service.templates.add(await readBody(req,30*1024*1024)));
  const templateGuide=p.match(/^\/api\/ppt\/templates\/([a-f0-9]{24})\/guide$/);
  if(templateGuide&&m==='POST')return send(200,await service.templates.guide(templateGuide[1]));
  const templateItem=p.match(/^\/api\/ppt\/templates\/([a-f0-9]{24})$/);
  if(templateItem&&m==='GET')return send(200,service.templates.get(templateItem[1]));
  if(templateItem&&m==='PUT')return send(200,service.templates.update(templateItem[1],await readBody(req)));
  if(templateItem&&m==='DELETE')return send(200,service.templates.remove(templateItem[1]));
  const templatePreview=p.match(/^\/api\/ppt\/templates\/([a-f0-9]{24})\/preview(?:\/(\d{3})\.png)?$/);
  if(templatePreview&&m==='POST'&&!templatePreview[2])return send(200,await service.templates.preview(templatePreview[1]));
  if(templatePreview&&m==='GET'&&templatePreview[2]){const buffer=fs.readFileSync(service.templates.previewFile(templatePreview[1],Number(templatePreview[2])));res.writeHead(200,{'Content-Type':'image/png','Content-Length':buffer.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(buffer);return true;}
  const templateAction=p.match(/^\/api\/ppt\/templates\/([a-f0-9]{24})\/(analyze|confirm)$/);
  if(templateAction&&m==='POST')return send(200,templateAction[2]==='analyze'?await service.templates.analyze(templateAction[1]):await service.templates.confirm(templateAction[1],await readBody(req)));
  const templateMatch=p.match(/^\/api\/ppt\/templates\/([a-f0-9]{24})\/file$/);
  if(templateMatch&&m==='GET'){const item=service.templates.get(templateMatch[1]),buffer=fs.readFileSync(service.templates.file(item.id));res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':`attachment; filename="template.pptx"; filename*=UTF-8''${encodeURIComponent(item.name)}`,'Content-Length':buffer.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(buffer);return true;}
  if(p==='/api/ppt/tasks'&&m==='GET')return send(200,{items:service.list().map(t=>({id:t.id,title:t.title,courseId:t.courseId,minutes:t.minutes,status:t.status,updatedAt:t.updatedAt,runId:t.run?.id,phase:t.run?.phase,version:t.versions.length,cover:t.htmlVersions?.length?{type:'html',version:t.htmlVersions.at(-1).number}:t.versions.length?{type:'pptx',version:t.versions.at(-1).number}:null}))});
  if(p==='/api/ppt/tasks'&&m==='POST')return send(201,service.create(await readBody(req)));
  const match=p.match(/^\/api\/ppt\/tasks\/([a-f0-9]{24})(?:\/(prompt|files|file|html|cover|image|template|manual|outline|run|cancel|recover|import|ready|source-info|page-count-choice|resume-info))?$/);if(!match)return send(404,{error:'课件接口不存在。'});
  const [,id,action]=match;
  if(!action&&m==='GET')return send(200,service.get(id));
  if(!action&&m==='DELETE')return send(200,service.remove(id));
  if(!action&&m==='PUT')return send(200,service.update(id,await readBody(req)));
  if(action==='resume-info'&&m==='GET')return send(200,service.resumeInfo(id));
  if(action==='source-info'&&m==='POST')return send(200,await service.sourceInfo(id));
  if(action==='page-count-choice'&&m==='POST')return send(200,await service.pageCountChoice(id,await readBody(req)));
  if(action==='template'&&m==='PUT'){const body=await readBody(req);return send(200,service.selectTemplate(id,body.templateId,body.confirmationRevision));}
  if(action==='cover'&&m==='GET'){const buffer=fs.readFileSync(await service.cover(id));res.writeHead(200,{'Content-Type':'image/png','Content-Length':buffer.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(buffer);return true;}
  if(action==='prompt'&&m==='GET')return send(200,{text:service.prompt(service.get(id))});
  if(action==='html'&&m==='GET'){const t=service.get(id),version=Number(url.searchParams.get('version')),page=Number(url.searchParams.get('page'));const html=t.htmlVersions?.find(v=>v.number===version);if(!Number.isInteger(version)||!Number.isInteger(page)||!html||!html.slides[page])return send(404,{error:'HTML\u9875\u9762\u4e0d\u5b58\u5728\u3002'});const buffer=fs.readFileSync(service.file(id,html.slides[page].file));require('./html-deck').validateHtml(buffer,html);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':buffer.length,'Content-Security-Policy':require('./html-deck').CSP,'X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN'});res.end(buffer);return true;}
  if(action==='file'&&m==='GET'){
   const t=service.get(id),relative=url.searchParams.get('path');
   // Only published attachments/versions/sources can be downloaded, never task state or CLI input.
   const preview=url.searchParams.get('inline')==='1';
   const previews=t.versions.flatMap(v=>v.previews||[]);
   const published=[...(t.template?[t.template.file]:[]),...(t.htmlVersions||[]).flatMap(v=>[...v.slides.map(s=>s.file),...v.sources.map(s=>s.file),...(v.speechFile?[v.speechFile]:[])]),...t.files.map(f=>f.file),...t.versions.flatMap(v=>[v.file,...v.sources.map(f=>f.file)]),...previews];if(!published.includes(relative)||(preview&&!previews.includes(relative)))return send(404,{error:'文件不存在。'});
   if(url.searchParams.get('format')==='docx'){
    if(!(t.htmlVersions||[]).some(v=>v.speechFile===relative)||preview)return send(404,{error:'逐页讲稿不存在。'});
    const buffer=await require('./speech-word')(fs.readFileSync(service.file(id,relative),'utf8'));
    const name=require('./presentation-rules').filename(t.title).replace(/\.pptx$/, ' · 逐页讲稿.docx');
    res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="speech.docx"; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g,'%27')}`,'Content-Length':buffer.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(buffer);return true;
   }
   const file=service.file(id,relative),buffer=fs.readFileSync(file);if(preview&&relative.endsWith('.svg')&&(!buffer.toString().includes('<svg')||/<(?:script|foreignObject|!DOCTYPE)|\bon\w+\s*=|(?:href|src)\s*=\s*[\"'](?!data:|#)/i.test(buffer.toString())))return send(400,{error:'\u8be5SVG\u4e0d\u9002\u5408\u76f4\u63a5\u9884\u89c8\uff0c\u8bf7\u4e0b\u8f7dPPTX\u67e5\u770b\u3002'});res.writeHead(200,{'Content-Type':preview?(relative.endsWith('.svg')?'image/svg+xml':'image/png'):relative.endsWith('.pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/octet-stream','Content-Disposition':`${preview?'inline':'attachment'}; filename="download"; filename*=UTF-8''${encodeURIComponent(t.versions.some(v=>v.file===relative)?require('./presentation-rules').filename(t.title):path.basename(file))}`,'Content-Length':buffer.length,'Cache-Control':'no-store','Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",'X-Content-Type-Options':'nosniff'});res.end(buffer);return true;
  }
  if(action==='files'&&m==='POST')return send(200,service.attach(id,await readBody(req,30*1024*1024)));
  if(action==='files'&&m==='DELETE')return send(200,service.removeFile(id,(await readBody(req)).fileId));
  if(action==='manual'&&m==='POST')return send(200,((b)=>service.manual(id,b.sent===true))(await readBody(req)));
  if(action==='image'&&m==='POST')return send(200,await service.image(id,await readBody(req)));
  if(action==='outline'&&m==='PUT')return send(200,service.outline(id,await readBody(req)));
  if(action==='run'&&m==='POST'){const b=await readBody(req);return send(202,service.start(id,b.phase,b));}
  if(action==='recover'&&m==='POST')return send(200,await service.recover(id));
  if(action==='cancel'&&m==='POST')return send(200,service.cancel(id));
  if(action==='import'&&m==='POST')return send(200,await service.importPpt(id,await readBody(req,30*1024*1024)));
  if(action==='ready'&&m==='POST'){const b=await readBody(req);return send(200,service.ready(id,b.version,b.reviewed));}
  return send(405,{error:'请求方法不支持。'});
 }catch(error){return send(error.status||500,{error:error.status?error.message:'操作未完成，请检查文件和本地存储后重试。'});}
};
