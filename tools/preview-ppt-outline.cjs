'use strict';
// Static, loopback-only preview. No production routes, uploads or data access.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files={
 '/prototype/ppt-outline-layout.html':['prototype/ppt-outline-layout.html','text/html; charset=utf-8'],
 '/prototype/ppt-outline-layout.css':['prototype/ppt-outline-layout.css','text/css; charset=utf-8'],
 '/prototype/ppt-outline-layout.js':['prototype/ppt-outline-layout.js','text/javascript; charset=utf-8'],
 '/shell.css':['server/public/shell.css','text/css; charset=utf-8'],
 '/assets/logo.svg':['server/public/assets/logo.svg','image/svg+xml'],
 '/ppt.css':['server/ppt/public/ppt.css','text/css; charset=utf-8'],
 '/ppt-management.css':['server/ppt/public/ppt-management.css','text/css; charset=utf-8']
};
function createServer(){return http.createServer((req,res)=>{
 const name=new URL(req.url,'http://127.0.0.1').pathname;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end('Read-only prototype');}
 if(name==='/'){res.writeHead(302,{Location:'/prototype/ppt-outline-layout.html'});return res.end();}
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"};
 if(name==='/narrow'){res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>390px · 大纲原型</title><link rel="stylesheet" href="/prototype/ppt-outline-layout.css"><body class="prototype-narrow-check"><iframe src="/prototype/ppt-outline-layout.html" title="390px大纲布局原型"></iframe></body></html>');}
 const file=files[name];if(!file){res.writeHead(404,headers);return res.end('Not found');}
 fs.readFile(path.join(root,file[0]),(error,body)=>{if(error){res.writeHead(500,headers);return res.end('Prototype file unavailable');}res.writeHead(200,{...headers,'Content-Type':file[1]});res.end(req.method==='HEAD'?undefined:body);});
 });}
module.exports={createServer};
if(require.main===module)createServer().listen(3016,'127.0.0.1',()=>console.log('Outline prototype: http://127.0.0.1:3016/prototype/ppt-outline-layout.html'));
