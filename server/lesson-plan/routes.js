'use strict';
const fs=require('node:fs'),path=require('node:path');
let service;
function readJson(req,max=1000000){return new Promise((resolve,reject)=>{const chunks=[];let length=0,failed=false;req.on('data',b=>{length+=b.length;if(length>max){if(!failed){failed=true;reject(Object.assign(new Error('上传内容过大，请精简后重试。'),{status:413}));}return;}chunks.push(b);});req.on('error',reject);req.on('end',()=>{if(failed)return;try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw Error();resolve(value);}catch{reject(Object.assign(new Error('请求内容格式不正确，请重新载入后重试。'),{status:400}));}});});}
module.exports=async(req,res,{url,m,json,store,getCourses})=>{
 const p=url.pathname;if(!p.startsWith('/api/lesson-plan/'))return false;
 const host=req.headers.host||'';
 if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${host}`)){json(res,403,{error:'请在本机平台页面内操作教案。'});return true;}
 service||=require('./service').createService({root:path.join(store.DATA_DIR,'lesson-plan'),getSettings:()=>store.read('settings',{}),getCourses});
 const send=(status,value)=>{json(res,status,value);return true;};
 const download=(file,name)=>{const buffer=fs.readFileSync(file);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="lesson.docx"; filename*=UTF-8''${encodeURIComponent(name).replace(/[\x27()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,'Content-Length':buffer.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(buffer);return true;};
 try{
  if(p==='/api/lesson-plan/connection'&&m==='GET')return send(200,service.connection());
  if(p==='/api/lesson-plan/templates'&&m==='GET')return send(200,{items:service.templates()});
  if(p==='/api/lesson-plan/templates'&&m==='POST')return send(201,await service.addTemplate(await readJson(req,29*1024*1024)));
  const template=p.match(/^\/api\/lesson-plan\/templates\/([a-f0-9]{24})\/file$/);if(template&&m==='GET')return download(service.templateFile(template[1]),'教案模板.docx');
  if(p==='/api/lesson-plan/tasks'&&m==='GET')return send(200,{items:service.list().map(t=>({id:t.id,title:t.title,minutes:t.minutes,status:t.status,updatedAt:t.updatedAt,version:t.versions.length}))});
  if(p==='/api/lesson-plan/tasks'&&m==='POST')return send(201,service.create(await readJson(req)));
  const match=p.match(/^\/api\/lesson-plan\/tasks\/([a-f0-9]{24})(?:\/(template|files|file|run|cancel|plan|sections|versions|restore))?$/);if(!match)return send(404,{error:'教案接口不存在。'});
  const [,id,action]=match;
  if(!action&&m==='GET')return send(200,service.get(id));
  if(!action&&m==='PUT')return send(200,service.update(id,await readJson(req)));
  if(action==='template'&&m==='PUT')return send(200,service.selectTemplate(id,await readJson(req)));
  if(action==='files'&&m==='POST')return send(200,await service.attach(id,await readJson(req,29*1024*1024)));
  if(action==='files'&&m==='DELETE')return send(200,service.removeFile(id,await readJson(req)));
  if(action==='run'&&m==='POST')return send(202,service.start(id,await readJson(req)));
  if(action==='cancel'&&m==='POST')return send(200,service.cancel(id,await readJson(req)));
  if(action==='plan'&&m==='PUT')return send(200,await service.savePlan(id,await readJson(req)));
  if(action==='sections'&&m==='PUT')return send(200,service.saveSection(id,await readJson(req)));
  if(action==='versions'&&m==='POST')return send(200,await service.saveVersion(id,await readJson(req)));
  if(action==='restore'&&m==='POST')return send(200,await service.restore(id,await readJson(req)));
  if(action==='file'&&m==='GET'){const relative=url.searchParams.get('path');const file=service.download(id,relative);return download(file,service.downloadName(id,relative));}
  return send(405,{error:'请求方法不支持。'});
 }catch(e){return send(e.status||500,{error:e.status?e.message:'操作未完成，请检查本地存储后重试；草稿和历史版本保留。'});}
};
