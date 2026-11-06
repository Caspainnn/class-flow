'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{pipeline}=require('node:stream/promises'),{Transform}=require('node:stream'),{createService}=require('./service'),runtime=require('./runtime'),{LIMITS,hashFile}=require('./archive');let service;
module.exports=async(req,res,ctx)=>{
 const {url,m,json,store,isLocal,serverConfig}=ctx,p=url.pathname;if(p!=='/backup'&&!p.startsWith('/backup/')&&!p.startsWith('/api/backup/'))return false;
 const send=(code,v)=>{json(res,code,v);return true;},host=req.headers.host||'';
 if(!isLocal(req)||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==`http://${host}`)return send(403,{error:'请在老师电脑的本机平台操作备份与恢复。'});
 service||=createService({dataRoot:store.DATA_DIR,runtime,serverConfig,exitForRestore:()=>setTimeout(()=>process.exit(0),400)});
 const body=async()=>{let s='';for await(const b of req){s+=b;if(Buffer.byteLength(s)>8000)throw Error('请求过长。');}return JSON.parse(s||'{}');};
 try{
  if(p==='/api/backup/health'&&m==='GET')return send(200,{ok:true,transaction:process.env.BACKUP_TX_ID||null,pid:process.pid});
  if(p==='/api/backup/status'&&m==='GET')return send(200,service.stats());
  if(p==='/api/backup/create'&&m==='POST')return send(202,service.backup());
  const job=p.match(/^\/api\/backup\/jobs\/([a-f0-9]{24})$/);if(job&&m==='GET')return send(200,service.get(job[1]));
  const recheck=p.match(/^\/api\/backup\/jobs\/([a-f0-9]{24})\/recheck$/);if(recheck&&m==='POST')return send(202,await service.recheck(recheck[1]));
  if(p==='/api/backup/open-folder'&&m==='POST'){await new Promise((resolve,reject)=>execFile(process.platform==='win32'?'explorer':process.platform==='darwin'?'open':'xdg-open',[service.backupRoot],{windowsHide:true},e=>e&&(process.platform!=='win32'||e.code!==1)?reject(Error('无法打开文件夹，请复制路径后手动打开。')):resolve()));return send(200,{ok:true});}
  const record=p.match(/^\/api\/backup\/records\/([a-f0-9]{24})(\/download|\/inspect)$/);if(record&&record[2]==='/inspect'&&m==='POST')return send(202,await service.inspectRecord(record[1]));
  if(record&&record[2]==='/download'&&m==='GET'){const {record:r,file}=service.recordFile(record[1]);if(await hashFile(file)!==r.sha256)return send(409,{error:'备份文件校验失败，未开始下载。请使用其他备份。'});res.writeHead(200,{'Content-Type':'application/zip','Content-Length':fs.statSync(file).size,'Content-Disposition':`attachment; filename="inclass-backup.zip"; filename*=UTF-8''${encodeURIComponent('一堂课_'+new Date(r.createdAt).toISOString().slice(0,10)+'_'+r.id.slice(0,6)+'.zip')}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});await pipeline(fs.createReadStream(file),res);return true;}
  if(p==='/api/backup/import'&&m==='POST'){
   if(!/^application\/zip\b/.test(req.headers['content-type']||''))return send(415,{error:'请选择平台ZIP备份包。'});if(Number(req.headers['content-length'])>LIMITS.zip)return send(413,{error:'备份包超过256MB。'});
   let name;try{name=decodeURIComponent(req.headers['x-file-name']||'备份.zip');}catch{name='备份.zip';}const x=service.startImport({name});let bytes=0;
   try{await pipeline(req,new Transform({transform(b,e,cb){bytes+=b.length;if(bytes>LIMITS.zip)return cb(Error('备份包超过256MB。'));cb(null,b);}}),fs.createWriteStream(x.file,{flags:'wx'}));if(!bytes)throw Error('备份文件为空。');return send(202,service.inspectJob(x.job.id));}catch(e){service.failImport(x.job.id,e.message);if(!res.destroyed)return send(400,{error:e.message});return true;}
  }
  if(p==='/api/backup/restore'&&m==='POST'){const b=await body();return send(202,await service.restore(b.inspectionId,b.confirmed));}
  if(p==='/api/backup/recover'&&m==='POST'){const b=await body();return send(202,service.recoveryRestart(b.jobId,b.confirmed));}
  const assets={'/backup':'index.html','/backup/style.css':'style.css','/backup/app.js':'app.js'},name=assets[p];if(name&&m==='GET'){res.writeHead(200,{'Content-Type':(name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html')+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(__dirname,'public',name)));return true;}
  return send(404,{error:'备份入口不存在。'});
 }catch(e){if(res.headersSent)return true;return send(e.status||400,{error:e.message||'备份操作失败，请重试。'});}
};

module.exports.hasActive=()=>Boolean(service?.hasActive());
