'use strict';
// Isolated prototype preview with temporary PPT rendering; formal data/business APIs stay private.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files={
  '/prototype/ppt-management.css':['prototype/ppt-management.css','text/css; charset=utf-8'],
  '/prototype/assets/template-ai-original/001.png':['prototype/assets/template-ai-original/001.png','image/png'],
  '/prototype/assets/template-ai-original/002.png':['prototype/assets/template-ai-original/002.png','image/png'],
  '/prototype/assets/template-ai-original/003.png':['prototype/assets/template-ai-original/003.png','image/png'],
  '/prototype/assets/template-ai-original/004.png':['prototype/assets/template-ai-original/004.png','image/png'],
  '/prototype/assets/template-ai-original/005.png':['prototype/assets/template-ai-original/005.png','image/png'],
  '/prototype/assets/template-ai-original/006.png':['prototype/assets/template-ai-original/006.png','image/png'],
  '/prototype/assets/template-ai-original/007.png':['prototype/assets/template-ai-original/007.png','image/png'],
  '/prototype/assets/template-ai-original/008.png':['prototype/assets/template-ai-original/008.png','image/png'],
  '/prototype/assets/template-ai-original/009.png':['prototype/assets/template-ai-original/009.png','image/png'],
  '/prototype/assets/template-ai-original/010.png':['prototype/assets/template-ai-original/010.png','image/png'],
  '/prototype/assets/template-ai-original/011.png':['prototype/assets/template-ai-original/011.png','image/png'],
  '/prototype/assets/template-ai-original/012.png':['prototype/assets/template-ai-original/012.png','image/png'],
  '/prototype/assets/template-ai-original/013.png':['prototype/assets/template-ai-original/013.png','image/png'],
  '/prototype/assets/template-ai-original/014.png':['prototype/assets/template-ai-original/014.png','image/png'],
  '/prototype/assets/template-ai-original/015.png':['prototype/assets/template-ai-original/015.png','image/png'],
  '/prototype/assets/template-ai-original/016.png':['prototype/assets/template-ai-original/016.png','image/png'],
  '/prototype/assets/template-ai-original/017.png':['prototype/assets/template-ai-original/017.png','image/png'],
  '/prototype/assets/template-ai-original/018.png':['prototype/assets/template-ai-original/018.png','image/png'],
  '/prototype/assets/template-ai-original/019.png':['prototype/assets/template-ai-original/019.png','image/png'],
  '/prototype/assets/template-ai-original/020.png':['prototype/assets/template-ai-original/020.png','image/png'],
  '/prototype/assets/template-ai-original/021.png':['prototype/assets/template-ai-original/021.png','image/png'],
  '/prototype/assets/template-ai-original/022.png':['prototype/assets/template-ai-original/022.png','image/png'],
  '/prototype/assets/template-ai-original/023.png':['prototype/assets/template-ai-original/023.png','image/png'],
  '/prototype/assets/template-ai-original/024.png':['prototype/assets/template-ai-original/024.png','image/png'],
  '/prototype/assets/template-ai-original/025.png':['prototype/assets/template-ai-original/025.png','image/png'],
  '/prototype/assets/template-ai-original/026.png':['prototype/assets/template-ai-original/026.png','image/png'],
  '/prototype/assets/template-ai-original/027.png':['prototype/assets/template-ai-original/027.png','image/png'],
  '/prototype/assets/template-ai-original/028.png':['prototype/assets/template-ai-original/028.png','image/png'],
  '/prototype/assets/template-ai-original/029.png':['prototype/assets/template-ai-original/029.png','image/png'],
  '/prototype/assets/template-ai-original/030.png':['prototype/assets/template-ai-original/030.png','image/png'],

  '/prototype/assets/template-ai/001.png':['prototype/assets/template-ai/001.png','image/png'],
  '/prototype/assets/template-ai/002.png':['prototype/assets/template-ai/002.png','image/png'],
  '/prototype/assets/template-ai/003.png':['prototype/assets/template-ai/003.png','image/png'],
  '/prototype/assets/template-ai/004.png':['prototype/assets/template-ai/004.png','image/png'],
  '/prototype/assets/template-ai/016.png':['prototype/assets/template-ai/016.png','image/png'],

  '/prototype/ppt-templates.html':['prototype/ppt-templates.html','text/html; charset=utf-8'],
  '/prototype/ppt-templates.css':['prototype/ppt-templates.css','text/css; charset=utf-8'],
  '/prototype/ppt-templates.js':['prototype/ppt-templates.js','text/javascript; charset=utf-8'],
  '/server/public/vendor/element-upload.js':['server/public/vendor/element-upload.js','text/javascript; charset=utf-8'],
  '/server/public/vendor/element-upload.css':['server/public/vendor/element-upload.css','text/css; charset=utf-8'],
  '/':['prototype/ppt-preparation.html','text/html; charset=utf-8'],
  '/prototype/ppt-preparation.html':['prototype/ppt-preparation.html','text/html; charset=utf-8'],
  '/prototype/ppt-preparation.css':['prototype/ppt-preparation.css','text/css; charset=utf-8'],
  '/prototype/ppt-preparation.js':['prototype/ppt-preparation.js','text/javascript; charset=utf-8'],
  '/server/public/shell.css':['server/public/shell.css','text/css; charset=utf-8'],
  '/server/public/assets/logo.svg':['server/public/assets/logo.svg','image/svg+xml']
};
const previewUpload=require('./ppt-template-preview-server.cjs').createPreview({root:path.join(root,'.tmp-ppt-template-prototype-uploads')});
http.createServer(async(req,res)=>{
  if(await previewUpload(req,res))return;
  const name=new URL(req.url,'http://127.0.0.1').pathname;
  if(name==='/templates-mobile'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    return res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>模板管理 · 窄屏检查</title><style>body{margin:0;background:#dfe6ee;display:grid;justify-content:center}iframe{width:390px;height:900px;border:0;background:white;max-width:100vw}</style><iframe src="/prototype/ppt-templates.html" title="390px模板管理预览"></iframe></html>');
  }
  if(name==='/mobile'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    return res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>PPT原型 · 390px窄屏检查</title><style>body{margin:0;background:#e4e9ef;display:grid;justify-content:center}iframe{width:390px;height:844px;border:0;background:white;max-width:100vw}</style><iframe src="/prototype/ppt-preparation.html" title="390px原型预览"></iframe></html>');
  }
  // The short root URL uses redirects so relative assets retain their correct base.
  if(name==='/'&&req.method==='GET'){res.writeHead(302,{Location:'/prototype/ppt-preparation.html'});return res.end();}
  const entry=files[name];
  if(!entry||!['GET','HEAD'].includes(req.method)){res.writeHead(404);return res.end('Not found');}
  fs.readFile(path.join(root,entry[0]),(err,body)=>{if(err){res.writeHead(500);return res.end('Preview file unavailable');}res.writeHead(200,{'Content-Type':entry[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);});
}).listen(3011,'127.0.0.1',()=>console.log('PPT prototype: http://127.0.0.1:3011/prototype/ppt-preparation.html'));
