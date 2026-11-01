'use strict';
// Temporary prototype uploads only. Never reads or writes the formal data directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectPpt}=require('../server/ppt/service'),{profile}=require('../server/ppt/templates'),{prepare}=require('../server/ppt/template-visuals');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function createPreview({root,render=prepare}){
 fs.mkdirSync(root,{recursive:true});let active=false;
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const folder=id=>path.join(root,id);
 const read=req=>new Promise((resolve,reject)=>{let size=0,tooLarge=false;const chunks=[];req.on('data',b=>{size+=b.length;if(size>29*1024*1024){if(!tooLarge)reject(fail('文件超过20MB，请精简后上传。',413));tooLarge=true;}if(!tooLarge)chunks.push(b);});req.on('end',()=>{if(tooLarge)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(fail('上传内容无效，请重新选择PPTX文件。'));}});req.on('error',reject);});
 return async(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;if(!pathname.startsWith('/prototype-preview'))return false;
  const host=req.headers.host||'';
  if(!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==`http://${host}`){json(res,403,{error:'请在本机原型页面内上传和预览模板。'});return true;}
  try{
   if(pathname==='/prototype-preview'&&req.method==='POST'){
    if(!/^application\/json\b/i.test(req.headers['content-type']||''))throw fail('上传内容类型无效。');
    const b=await read(req);
    if(active)throw fail('另一份模板正在生成预览，请稍后重试。',409);
    if(typeof b.name!=='string'||b.name.length>120||!/^([^<>:"/\\|?*\x00-\x1f]+)\.pptx$/i.test(b.name)||b.name.includes('..'))throw fail('请选择名称有效的PPTX文件。');
    if(typeof b.base64!=='string'||b.base64.length>28*1024*1024||!/^[\w+/]*={0,2}$/.test(b.base64))throw fail('上传文件为空或超过20MB。');
    const bytes=Buffer.from(b.base64,'base64');if(!bytes.length||bytes.length>20*1024*1024)throw fail('上传文件为空或超过20MB。');
    if(fs.readdirSync(root).filter(n=>/^[a-f0-9]{24}$/.test(n)&&fs.existsSync(path.join(root,n,'preview.json'))).length>=20)throw fail('原型临时预览已达到20份，请联系开发者清理后再试。',429);
    active=true;const controller=new AbortController(),cancel=()=>{if(!res.writableEnded)controller.abort();};res.once('close',cancel);
    let jobDir=null;
    try{
     const slides=await inspectPpt(bytes),analysis=await profile(bytes,slides);if(controller.signal.aborted)throw fail('本次预览已取消。');
     const id=crypto.randomBytes(12).toString('hex'),dir=folder(id);jobDir=dir;fs.mkdirSync(dir);const input=path.join(dir,'template.pptx');fs.writeFileSync(input,bytes);
     const refs=await render({file:input,profile:{layoutGroups:slides.map((s,i)=>({id:'page-'+(i+1),name:'第'+(i+1)+'页',representativeSlide:i+1}))},cacheRoot:path.join(root,'cache'),runDir:dir,signal:controller.signal});
     if(controller.signal.aborted)throw fail('本次预览已取消。');
     const sourceSlides=refs.map((r,i)=>`/prototype-preview/${id}/${String(i+1).padStart(3,'0')}.png`);
     const groups=analysis.smart.selectedIds.map(layoutId=>analysis.layoutGroups.find(g=>g.id===layoutId));
     const layouts=groups.map((g,i)=>({id:i,name:'布局 '+(i+1),source:g.representativeSlide,kept:true,preview:sourceSlides[g.representativeSlide-1]}));
     const result={id:'uploaded-'+id,name:String(b.templateName||b.name.replace(/\.pptx$/i,'')).trim().slice(0,60),description:String(b.description||'').trim().slice(0,160),file:b.name,original:slides.length,layouts,sourceSlides,ready:false,uses:0,date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),color:'#2563eb',dark:false,realUpload:true};
     fs.writeFileSync(path.join(dir,'preview.json'),JSON.stringify(result));fs.unlinkSync(input);json(res,201,result);
    }catch(error){
     await error.cleanup;
     if(jobDir&&fs.existsSync(jobDir)){const actual=fs.realpathSync(jobDir),base=fs.realpathSync(root);if(actual.startsWith(base+path.sep)&&/^[a-f0-9]{24}$/.test(path.basename(actual)))fs.rmSync(actual,{recursive:true,force:true});}
     throw error;
    }finally{res.removeListener('close',cancel);active=false;}
    return true;
   }
   const match=pathname.match(/^\/prototype-preview\/([a-f0-9]{24})(?:\/(\d{3})\.png)?$/);
   if(match&&req.method==='GET'){
    let meta;try{meta=JSON.parse(fs.readFileSync(path.join(folder(match[1]),'preview.json'),'utf8'));}catch{throw fail('预览不存在，请重新上传模板。',404);}
    if(!match[2]){json(res,200,meta);return true;}
    const page=Number(match[2]);if(page<1||page>meta.original)throw fail('原PPT页面不存在。',404);
    const bytes=fs.readFileSync(path.join(folder(match[1]),'template-reference',match[2]+'.png'));
    res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;
   }
   throw fail('预览接口不存在。',404);
  }catch(error){if(!res.destroyed&&!res.writableEnded)json(res,error.status||503,{error:error.status?error.message:'无法生成真实PPT预览，请确认本机PowerPoint能正常打开此文件，再重试。'});return true;}
 };
}
module.exports={createPreview};
