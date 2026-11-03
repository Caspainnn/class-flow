'use strict';
function pythonCommandRules(pythonPath){
 const rules=['Bash(python:*)','Bash(python3:*)'];
 if(pythonPath){const configured=String(pythonPath);rules.push(`Bash(${configured}:*)`,`Bash(${configured.replace(/\\/g,'/')}:*)`);}
 return [...new Set(rules)];
}
function permissionFailure(value){
 const content=typeof value==='string'?value:JSON.stringify(value);
 if(/Permission to use Bash has been denied|Bash.{0,30}(?:权限.{0,15}拒绝|permission.{0,15}denied)/is.test(content))return {code:'script_permission_denied',message:'制作脚本的执行权限被拦截，未能完成课件制作。教学要求和大纲已保留；需要检查制作工具的命令授权。'};
 return null;
}
function diagnoseLog(raw){
 for(const line of String(raw).split(/\r?\n/)){let value;try{value=JSON.parse(line);}catch{continue;}
  for(const block of value.message?.content||[])if(block.type==='tool_result'&&block.is_error){const failure=permissionFailure(block.content);if(failure)return failure;}
  if(value.type==='result'){if(/Max turns\s*\(?\d*\)?\s*exceeded/i.test(JSON.stringify(value.errors||value.result||'')))return {code:'tool_turn_limit',message:'制作工具已用尽本轮调用次数，尚未交付完整文件。原稿和教学要求已保留，请重新发起本轮。'};const failure=permissionFailure(value.result);if(failure)return failure;if(value.is_error&&(value.errors_info?.some(e=>e.category==='empty_model_response')||/Empty stream.*upstream|finish_reason=error/is.test(JSON.stringify(value.errors||[]))))return {code:'model_empty_response',message:'制作工具连接的模型服务返回空响应，本轮未完成。教学要求、大纲和已有版本已保留，可稍后重试。'};}
 }
 return permissionFailure(raw);
}
function diagnoseFile(file){const fs=require('node:fs'),fd=fs.openSync(file,'r');try{const size=fs.fstatSync(fd).size,buffer=Buffer.alloc(Math.min(size,512*1024));fs.readSync(fd,buffer,0,buffer.length,size-buffer.length);return diagnoseLog(buffer.toString('utf8'));}finally{fs.closeSync(fd);}}
module.exports={pythonCommandRules,permissionFailure,diagnoseLog,diagnoseFile};
