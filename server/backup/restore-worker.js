'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),{atomic}=require('./service');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
function locations(dataRoot,jobId){const backupRoot=path.join(path.dirname(dataRoot),'.inclass-backups-'+path.basename(dataRoot));return {backupRoot,original:path.join(backupRoot,'rollbacks',jobId),failed:path.join(backupRoot,'jobs',jobId,'failed-data'),pending:path.join(backupRoot,'pending-restore.json')};}
function recover(dataRoot,{ownerPid=null}={}){const base=path.join(path.dirname(dataRoot),'.inclass-backups-'+path.basename(dataRoot)),pending=path.join(base,'pending-restore.json');if(!fs.existsSync(pending))return;const p=JSON.parse(fs.readFileSync(pending,'utf8'));if(!/^[a-f0-9]{24}$/.test(p.jobId)||path.resolve(p.dataRoot)!==path.resolve(dataRoot))throw Error('恢复事务位置无效，请检查本地备份记录。');const file=path.join(base,'jobs',p.jobId,'job.json'),j=JSON.parse(fs.readFileSync(file,'utf8'));if(p.phase==='committed'||j.status==='complete'){j.status='complete';j.recoveryRequired=false;j.progress=100;j.stage='教学数据已恢复，平台启动检查通过';atomic(file,j);fs.unlinkSync(pending);return;}if(alive(p.workerPid)&&p.workerPid!==ownerPid){if(process.env.BACKUP_TX_ID===p.jobId){if(p.serverPid&&p.serverPid!==process.pid&&alive(p.serverPid))throw Error('恢复后的平台进程已经启动，请勿重复运行。');p.serverPid=process.pid;atomic(pending,p);return;}throw Error('独立恢复进程仍在运行，请等待完成后启动平台。');}if(p.serverPid&&alive(p.serverPid))throw Error('恢复后的平台进程仍在运行，必须先安全退出，才能回滚数据目录。');const loc=locations(dataRoot,p.jobId);if(fs.existsSync(loc.original)){if(fs.existsSync(dataRoot))fs.renameSync(dataRoot,loc.failed+'-interrupted-'+Date.now());fs.renameSync(loc.original,dataRoot);}j.status='failed';j.recoveryRequired=false;j.rolledBack=true;j.stage='恢复中断，已保留原数据';j.error='恢复进程中断，平台已回到恢复前的数据，请核对后重试。';atomic(file,j);fs.unlinkSync(pending);}
function healthy(port,jobId){return new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port,path:'/api/backup/health',timeout:1200},res=>{let s='';res.on('data',b=>s+=b);res.on('end',()=>{try{const v=JSON.parse(s);resolve(res.statusCode===200&&v.transaction===jobId);}catch{resolve(false);}});});req.on('timeout',()=>req.destroy());req.on('error',()=>resolve(false));});}
async function start(c,jobId,{launch=spawn,ready=healthy,wait=sleep,live=alive,persist=atomic}={}){
 let child;
 try{
  const log=fs.openSync(path.join(c.backupRoot,'jobs',jobId,'restart.log'),'a');
  try{child=launch(process.execPath,[c.script],{cwd:c.projectRoot,env:{...process.env,DATA_DIR:c.dataRoot,PORT:String(c.port),HOST:c.host,BACKUP_TX_ID:jobId},windowsHide:true,detached:true,stdio:['ignore',log,log]});}finally{fs.closeSync(log);}
  child.unref();child.on('error',()=>{});
  const pending=locations(c.dataRoot,jobId).pending;
  if(fs.existsSync(pending)){const p=JSON.parse(fs.readFileSync(pending,'utf8'));p.serverPid=child.pid;persist(pending,p);}
  for(let i=0;i<60;i++){if(await ready(c.port,jobId))return child;if(child.exitCode!=null)break;await wait(250);}
  throw Error('恢复后的服务未通过启动检查。');
 }catch(e){
  // Every post-spawn failure, including journal writes, must confirm child exit.
  if(child){try{child.kill();}catch{}for(let i=0;i<30&&live(child.pid);i++)await wait(100);if(live(child.pid))throw Object.assign(Error('启动检查未完成，尚未确认新服务退出；请先安全重启再恢复原数据。'),{processAlive:true,childPid:child.pid});}
  throw e;
 }
}
async function transaction(jobFile,{restart=start}={}){
 const j=JSON.parse(fs.readFileSync(jobFile,'utf8')),c=j.config,loc=locations(c.dataRoot,j.id);if(path.resolve(c.backupRoot)!==loc.backupRoot||path.resolve(c.staging)!==path.join(loc.backupRoot,'jobs',j.id,'staged'))throw Error('恢复暂存位置无效。');fs.mkdirSync(path.dirname(loc.original),{recursive:true});
 const write=(stage,progress)=>{j.stage=stage;j.progress=progress;atomic(jobFile,j);};
 atomic(loc.pending,{jobId:j.id,dataRoot:c.dataRoot,workerPid:process.pid,phase:'prepared'});
 const phase=value=>{const p=JSON.parse(fs.readFileSync(loc.pending,'utf8'));p.phase=value;atomic(loc.pending,p);};
 try{write('正在保留原始数据目录',75);fs.renameSync(c.dataRoot,loc.original);phase('original-kept');fs.renameSync(c.staging,c.dataRoot);phase('swapped');write('数据已替换，正在重新启动平台',85);await restart(c,j.id);phase('committed');j.status='complete';j.recoveryRequired=false;j.progress=100;j.stage='教学数据已恢复，平台启动检查通过';j.completedAt=Date.now();atomic(jobFile,j);fs.unlinkSync(loc.pending);}
 catch(e){let committed=false;try{committed=JSON.parse(fs.readFileSync(loc.pending,'utf8')).phase==='committed';}catch{}if(committed||j.status==='complete'){j.status='complete';j.progress=100;try{atomic(jobFile,j);}catch{}return j;}if(e.processAlive){j.status='failed';j.recoveryRequired=true;j.error=e.message;j.stage='保留维护状态，等待安全重启回滚';atomic(jobFile,j);return j;}write('启动检查未完成，正在回滚原有数据',90);try{if(fs.existsSync(loc.original)){if(fs.existsSync(c.dataRoot))fs.renameSync(c.dataRoot,loc.failed);fs.renameSync(loc.original,c.dataRoot);}phase('rolled-back');j.rolledBack=true;await restart(c,j.id);j.status='failed';j.recoveryRequired=false;j.error='恢复未完成，已回滚到恢复前的数据。'+e.message;j.stage='原有数据已恢复，平台可继续使用';atomic(jobFile,j);fs.unlinkSync(loc.pending);}catch(rollbackError){j.status='failed';j.error='恢复或重启未完成，原数据目录与安全备份均已保留。请查看恢复记录后重新启动平台。';j.stage='需要检查恢复状态';j.recoveryRequired=true;atomic(jobFile,j);/* pending retained for next startup recovery */}}
 return j;
}
if(require.main===module){(async()=>{const file=process.argv[2],j=JSON.parse(fs.readFileSync(file,'utf8'));if(!process.send)throw Error('恢复进程必须由平台启动。');process.send('ready');for(let i=0;i<120&&alive(j.config.parentPid);i++)await sleep(250);if(alive(j.config.parentPid))throw Error('原服务尚未退出，未替换教学数据。');if(process.argv[3]==='--rollback'){recover(j.config.dataRoot,{ownerPid:process.pid});await start(j.config,j.id);const done=JSON.parse(fs.readFileSync(file,'utf8'));done.recoveryRequired=false;done.stage='原有数据已恢复，平台可继续使用';atomic(file,done);}else await transaction(file);})().catch(async e=>{try{const f=process.argv[2],j=JSON.parse(fs.readFileSync(f,'utf8'));j.status='failed';j.error=e.message;j.stage='恢复未完成';atomic(f,j);if(!alive(j.config.parentPid)&&fs.existsSync(j.config.dataRoot)&&!fs.existsSync(locations(j.config.dataRoot,j.id).pending))await start(j.config,j.id);}catch{}process.exitCode=1;});}
module.exports={transaction,recover,locations,start};
