'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createDesktop({projectRoot,dataRoot,runtime,backupActive=()=>false,exit=()=>process.exit(0)}){
 const normalized=p=>path.resolve(p).replace(/\\/g,'/').replace(/\/$/,'').toLowerCase();
 const identity=crypto.createHash('sha256').update(normalized(projectRoot)+'|'+normalized(dataRoot)).digest('hex');
 fs.mkdirSync(dataRoot,{recursive:true});const keyFile=path.join(dataRoot,'.desktop-key');let key;
 try{key=fs.readFileSync(keyFile,'utf8').trim();}catch(e){if(e.code!=='ENOENT')throw e;key=crypto.randomBytes(32).toString('hex');fs.writeFileSync(keyFile,key,{flag:'wx'});}
 let closing=false;
 const busy=()=>[...require('./backup/activity').busy(dataRoot),...(runtime.isLocked()||backupActive()?['备份、检查或恢复正在进行']:[])];
 return {get closing(){return closing;},handle(req,res,{url,json}){
  if(!url.pathname.startsWith('/api/desktop/'))return false;
  const host=req.headers.host||'',ip=req.socket.remoteAddress||'';
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==`http://${host}`){json(res,403,{error:'请在本机操作启动器。'});return true;}
  try{
   if(url.pathname==='/api/desktop/status'&&req.method==='GET'){json(res,200,{app:'inclass',protocol:1,identity,pid:process.pid,busy:busy(),closing});return true;}
   if(url.pathname==='/api/desktop/stop'&&req.method==='POST'){
    const supplied=Buffer.from(String(req.headers['x-inclass-desktop-key']||'')),expected=Buffer.from(key);if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected)){json(res,403,{error:'启动器校验失败，未停止服务。'});return true;}
    const reasons=busy();if(reasons.length){json(res,409,{error:reasons.join('；')+'。请先结束相关任务，平台继续运行。'});return true;}
    runtime.acquire();closing=true;res.once('finish',()=>setTimeout(exit,200));json(res,200,{ok:true});return true;
   }
   json(res,404,{error:'启动器接口不存在。'});
  }catch(e){json(res,e.status||503,{error:e.message});}return true;
 }};
}
module.exports={createDesktop};
