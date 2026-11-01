'use strict';
// Isolated questionnaire prototype plus local AI drafts. No formal survey data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),QR=require('../server/node_modules/qrcode');
const root=path.resolve(__dirname,'..'),port=Number(process.env.QUESTIONNAIRE_PREVIEW_PORT||3013);
const files={
 '/prototype/questionnaire.html':['prototype/questionnaire.html','text/html; charset=utf-8'],
 '/prototype/questionnaire.css':['prototype/questionnaire.css','text/css; charset=utf-8'],
 '/prototype/questionnaire-model.js':['prototype/questionnaire-model.js','text/javascript; charset=utf-8'],
 '/prototype/questionnaire.js':['prototype/questionnaire.js','text/javascript; charset=utf-8'],
 '/prototype/questionnaire-ai.js':['prototype/questionnaire-ai.js','text/javascript; charset=utf-8'],
 '/prototype/questionnaire-dashboard.js':['prototype/questionnaire-dashboard.js','text/javascript; charset=utf-8'],
 '/server/public/shell.css':['server/public/shell.css','text/css; charset=utf-8'],
 '/server/public/assets/logo.svg':['server/public/assets/logo.svg','image/svg+xml']
};
function createServer({ai}={}){ai||=require('./questionnaire-ai.cjs').createService({root:path.join(root,'.tmp-questionnaire-ai'),getSettings:()=>{try{return {workbuddy:JSON.parse(fs.readFileSync(path.join(root,'data/settings.json'),'utf8')).workbuddy};}catch{return {};}}});return http.createServer(async(req,res)=>{
 const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)){res.writeHead(403);return res.end('Local prototype only');}
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname.startsWith('/api/questionnaire-ai')){
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   if(req.method==='POST'){
    if(req.headers.origin!==`http://${host}`||!/^application\/json\b/.test(req.headers['content-type']||''))return json(403,{error:'请从本机问卷页面提交生成请求。'});
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return json(413,{error:'调查需求过长。'});}let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'请求格式不正确。'});}
    if(url.pathname==='/api/questionnaire-ai')return json(202,ai.start(body));
    const match=url.pathname.match(/^\/api\/questionnaire-ai\/([a-f0-9]{24})\/cancel$/);if(match)return json(200,ai.cancel(match[1]));
   }
   if(req.method==='GET'){
    if(url.pathname==='/api/questionnaire-ai')return json(200,{connection:ai.connection(),jobs:ai.list()});
    const match=url.pathname.match(/^\/api\/questionnaire-ai\/([a-f0-9]{24})$/);if(match)return json(200,ai.get(match[1]));
   }
   return json(404,{error:'生成接口不存在。'});
  }catch(e){return json(e.status||500,{error:e.status?e.message:'生成服务暂时不可用，请重试。'});}
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Prototype does not accept submissions');}
 if(url.pathname==='/'){res.writeHead(302,{Location:'/prototype/questionnaire.html#list'});return res.end();}
 if(url.pathname==='/mobile'){const view=url.searchParams.get('view'),hash=view==='student'?'student/feedback-anon':view==='analysis'?'detail/feedback-anon/analysis':'list';res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>问卷原型 · 390px窄屏检查</title><style>body{margin:0;background:#dfe6ed;display:grid;justify-content:center}iframe{width:390px;height:940px;border:0;max-width:100vw}</style><iframe title="390像素问卷原型" src="/prototype/questionnaire.html#'+hash+'"></iframe></html>');}
 if(url.pathname==='/demo-qr.svg'){
  const id=url.searchParams.get('id');if(!/^[a-zA-Z0-9-]{1,80}$/.test(id||'')){res.writeHead(400);return res.end('Invalid demo id');}
  const body=await QR.toString(`http://${host}/prototype/questionnaire.html#student/${id}`,{type:'svg',margin:1,width:360,color:{dark:'#204866',light:'#ffffff'}});res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(req.method==='HEAD'?undefined:body);
 }
 const entry=files[url.pathname];if(!entry){res.writeHead(404);return res.end('Not found');}
 fs.readFile(path.join(root,entry[0]),(error,body)=>{if(error){res.writeHead(500);return res.end('Prototype asset unavailable');}res.writeHead(200,{'Content-Type':entry[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);});
});}
if(require.main===module)createServer().listen(port,'127.0.0.1',()=>console.log(`Questionnaire prototype: http://127.0.0.1:${port}/prototype/questionnaire.html#list`));
module.exports={createServer};
