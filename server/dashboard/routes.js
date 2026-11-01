'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createService}=require('./service');let service;
module.exports=(req,res,{url,m,json,store,isLocal})=>{
 const p=url.pathname;if(p!=='/dashboard'&&p!=='/api/dashboard'&&!p.startsWith('/dashboard/'))return false;
 const send=(code,value)=>{json(res,code,value);return true;};
 if(!isLocal(req)||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host||'')||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'请在老师电脑的本机平台查看数据看板。'});
 if(m!=='GET')return send(405,{error:'数据看板仅提供查看。'});
 try{
  if(p==='/api/dashboard'){service||=createService({root:store.DATA_DIR});return send(200,service.snapshot(url.searchParams));}
  const assets={'/dashboard':'index.html','/dashboard/style.css':'style.css','/dashboard/view.js':'view.js','/dashboard/app.js':'app.js'},f=assets[p];if(!f)return send(404,{error:'看板资源不存在。'});
  res.writeHead(200,{'Content-Type':(f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':'text/html')+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(__dirname,'public',f)));return true;
 }catch(e){return send(e.status||503,{error:e.status?e.message:'看板暂时无法读取，请稍后刷新。'});}
};
