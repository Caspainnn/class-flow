'use strict';
const fs=require('node:fs'),path=require('node:path');let locked=false,requests=0,pendingFile=null;
function configure(root){pendingFile=path.join(path.dirname(root),'.inclass-backups-'+path.basename(root),'pending-restore.json');}
const restoring=()=>{if(!pendingFile||!fs.existsSync(pendingFile))return false;try{return JSON.parse(fs.readFileSync(pendingFile,'utf8')).phase!=='committed';}catch{return true;}};
function gate(req,res,url,json){
 if(!url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/backup/')||url.pathname==='/api/ping')return false;
 if(locked||restoring()){json(res,503,{error:'平台正在备份或恢复，暂时停止教学数据操作，请稍后重试。'});return true;}
 requests++;let done=false;const finish=()=>{if(!done){done=true;requests--;}};res.once('finish',finish);res.once('close',finish);return false;
}
function acquire(){if(locked||requests||restoring())throw Object.assign(Error('当前仍有任务或请求进行中，请稍后再试。'),{status:409});locked=true;}
function release(){locked=false;}
module.exports={gate,acquire,release,configure,isLocked:()=>locked||restoring()};
