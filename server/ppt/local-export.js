'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
function dependencies(config={}){
 const browser=[config.browserPath,process.env.PPT_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
 const python=config.pythonPath||process.env.PPT_PYTHON||path.resolve(__dirname,'../../.local-ppt-python/Scripts/python.exe');
 return {browser,python,ready:Boolean(browser&&fs.existsSync(python)),reason:!browser?'本机未找到 Chrome 或 Edge，请安装后重试导出。':!fs.existsSync(python)?'本机导出所需 Python 尚未配置，请检查 PPT 设置。':'已就绪：在本机转换已确认的课件，不调用模型。'};
}
function launch({runDir,config={}}){
 const deps=dependencies(config);if(!deps.ready)throw Error(deps.reason);
 const env={...process.env,PPT_BROWSER:deps.browser,PPT_PYTHON:deps.python};
 for(const name of Object.keys(env))if(name.startsWith('CODEBUDDY_')||name==='NODE_OPTIONS')delete env[name];
 return spawn(process.execPath,['--experimental-websocket',path.join(__dirname,'local-export-worker.cjs'),runDir],{cwd:runDir,windowsHide:true,env,stdio:['ignore','pipe','pipe']});
}
module.exports={dependencies,launch};
