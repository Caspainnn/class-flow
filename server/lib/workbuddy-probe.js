'use strict';
const fs=require('node:fs'),os=require('node:os'),{spawn}=require('node:child_process');
function script(file){if(/\.(?:mjs|cjs|js)$/i.test(file))return true;let fd;try{fd=fs.openSync(file,'r');const b=Buffer.alloc(2);fs.readSync(fd,b,0,2,0);return b.toString()==='#!';}catch{return false;}finally{if(fd!==undefined)fs.closeSync(fd);}}
function probe(file,timeoutMs,{launch=spawn,model='default'}={}){
 return new Promise(resolve=>{
  const isScript=script(file),args=[...(isScript?[file]:[]),'-p','只回复两个字母：OK','--output-format','stream-json','--verbose','--tools','','--permission-mode','dontAsk','--no-session-persistence','--port','0'];
  if(model&&model!=='default')args.push('--model',model);
  const env={...process.env};for(const name of Object.keys(env))if(name.startsWith('CODEBUDDY_')||name==='NODE_OPTIONS')delete env[name];
  let child,out='',settled=false,timer;const started=Date.now();
  const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve({...result,ms:Date.now()-started});};
  try{child=launch(isScript?process.execPath:file,args,{cwd:os.tmpdir(),windowsHide:true,env,stdio:['ignore','pipe','pipe']});}catch{return finish({ok:false,why:'无法启动 CLI，请检查实际入口路径。'});}
  timer=setTimeout(()=>{finish({ok:false,why:'连接检测超时，请检查登录和网络后重试。'});if(child.pid&&process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('error',()=>{});else child.kill?.();},timeoutMs);
  child.stdout.on('data',b=>out=(out+String(b)).slice(-32768));
  // Drain stderr without printing possible account or connection details.
  child.stderr.on('data',()=>{});
  child.on('error',()=>finish({ok:false,why:'无法执行 CLI，请检查实际入口路径。'}));
  child.on('close',code=>{let result;for(const line of out.split(/\r?\n/)){try{const value=JSON.parse(line);if(value.type==='result')result=value;}catch{}}const ok=code===0&&result?.is_error!==true&&typeof result?.result==='string'&&result.result.trim()==='OK';finish({ok,why:ok?null:code===0?'未收到模型的 OK 回复，请检查登录、模型和网络。':'CLI 未成功退出，请在本机终端检查登录和网络。'});});
 });
}
module.exports={probe};
