'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),QR=require('qrcode');
let service,ai;
module.exports=async(req,res,ctx)=>{
 const {url,m,json,store,getCourses,getStudents}=ctx,p=url.pathname;if(!p.startsWith('/api/questionnaire')&&!p.startsWith('/questionnaire/')&&p!=='/questionnaires')return false;
 const send=(code,value)=>{json(res,code,value);return true;},publicRoute=/^\/api\/questionnaire-public\/[a-zA-Z0-9-]{6,80}(?:\/submit)?$/.test(p),host=req.headers.host||'',origin=`http://${host}`;
 if(!publicRoute&&!/^\/questionnaire\/(student\.html|student\.js|style\.css)$/.test(p)&&(!ctx.isLocal(req)||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)))return send(403,{error:'请在老师电脑的本机平台操作问卷。'});
 if(['POST','PUT','DELETE'].includes(m)&&(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==origin)||!/^application\/json\b/.test(req.headers['content-type']||'')))return send(403,{error:'请从问卷页面提交请求。'});
 service||=require('./service').createService({store,getCourses,getStudents});
 const body=()=>new Promise((resolve,reject)=>{let value='',size=0,overflow=false;const max=publicRoute?128*1024:8*1024*1024;req.on('data',b=>{if(overflow)return;size+=b.length;if(size>max){overflow=true;value='';reject(Object.assign(Error('请求内容过大。'),{status:413}));return;}value+=b;});req.on('end',()=>{if(overflow)return;try{resolve(JSON.parse(value));}catch{reject(Object.assign(Error('请求格式不正确。'),{status:400}));}});req.on('error',reject);});
 try{
  if(p==='/questionnaires'&&m==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(__dirname,'public/index.html')));return true;}
  const asset=p.match(/^\/questionnaire\/(teacher\.js|model\.js|ai\.js|dashboard\.js|style\.css|student\.js|student\.html)$/);if(asset&&m==='GET'){res.writeHead(200,{'Content-Type':asset[1].endsWith('.js')?'text/javascript; charset=utf-8':asset[1].endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(__dirname,'public',asset[1])));return true;}
  if(p.startsWith('/api/questionnaire-ai')){
   ai||=require('./generator').createService({root:path.join(store.DATA_DIR,'questionnaire-ai'),getSettings:()=>store.read('settings',{})});
   if(p==='/api/questionnaire-ai'&&m==='GET')return send(200,{connection:ai.connection(),jobs:ai.list()});
   if(p==='/api/questionnaire-ai'&&m==='POST')return send(202,ai.start(await body()));
   const job=p.match(/^\/api\/questionnaire-ai\/([a-f0-9]{24})(\/cancel)?$/);if(job&&m==='GET'&&!job[2])return send(200,ai.get(job[1]));if(job&&m==='POST'&&job[2])return send(200,ai.cancel(job[1]));
  }
  if(p==='/api/questionnaires'&&m==='GET')return send(200,{...service.snapshot(),studentOrigin:ctx.studentOrigin});
  if(p==='/api/questionnaires'&&m==='PUT')return send(200,service.sync(await body()));
  if(p==='/api/questionnaires/overview'&&m==='GET')return send(200,service.overview(url.searchParams.get('courseId')));
  if(p==='/api/questionnaires/qr'&&m==='GET'){const sid=url.searchParams.get('id');service.publicSurvey(sid);const svg=await QR.toString(ctx.studentOrigin+'/questionnaire/student.html#'+sid,{type:'svg',margin:1,width:360});res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store'});res.end(svg);return true;}
  const match=p.match(/^\/api\/questionnaire-public\/([a-zA-Z0-9-]{6,80})(\/submit)?$/);if(match){
   let device=(req.headers.cookie||'').match(/(?:^|;\s*)survey_device=([a-f0-9]{48})(?:;|$)/)?.[1];if(!device){device=crypto.randomBytes(24).toString('hex');res.setHeader('Set-Cookie',`survey_device=${device}; Path=/api/questionnaire-public/; HttpOnly; SameSite=Lax; Max-Age=31536000`);}
   if(m==='GET'&&!match[2])return send(200,service.publicSurvey(match[1]));if(m==='POST'&&match[2])return send(200,service.submit(match[1],await body(),device));
  }
  return send(404,{error:'问卷入口不存在。'});
 }catch(e){return send(e.status||400,{error:e.status||!['ENOENT','EACCES','EPERM'].includes(e.code)?e.message:'问卷存储不可用，请检查本地目录。'});}
};
