'use strict';
const {StringDecoder}=require('node:string_decoder');
function createProgress({startedAt,now=Date.now}){
 let stage='starting',activity='正在连接WorkBuddy',lastActivityAt=startedAt,buffer='',streamText='';
 const history=[{time:startedAt,message:activity}],output=[],decoder=new StringDecoder('utf8');
 function safe(value){return String(value||'').replace(/\x1b\[[0-9;]*m/g,'').replace(/(?:[A-Z]:[\\/]|\/Users\/|\/home\/)[^\s"'<>]+/gi,'[本机文件]').replace(/((?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*)[^\s,;]+/gi,'$1[已隐藏]').slice(0,4000);}
 function mark(next,message){stage=next;lastActivityAt=now();if(activity!==message){activity=message;history.push({time:lastActivityAt,message});if(history.length>30)history.shift();}}
 function publicText(text){const value=safe(text).trim();if(!value||/^[{\[]|^```/.test(value))return;lastActivityAt=now();if(output.at(-1)?.text!==value)output.push({time:lastActivityAt,text:value});while(output.length>12||output.reduce((n,v)=>n+v.text.length,0)>14000)output.shift();}
 function consume(chunk){buffer=(buffer+(Buffer.isBuffer(chunk)?decoder.write(chunk):String(chunk))).slice(-262144);const lines=buffer.split(/\r?\n/);buffer=lines.pop();
  for(const line of lines){let v;try{v=JSON.parse(line);}catch{continue;}
   if(v.type==='system'&&v.subtype==='init'&&stage==='starting')mark('starting','WorkBuddy已连接');
   if(v.type==='stream_event'&&v.event?.delta?.type==='text_delta'){streamText=(streamText+v.event.delta.text).slice(-4000);lastActivityAt=now();}
   if(v.type==='assistant')for(const b of Array.isArray(v.message?.content)?v.message.content:[]){
    if(b.type==='text'){publicText(b.text);streamText='';}
    if(b.type==='tool_use'){const repairing=stage==='repairing';if(['Read','Glob','Grep'].includes(b.name))mark(repairing?'repairing':'reading',repairing?'WorkBuddy正在核对格式问题':'WorkBuddy正在读取要求与参考资料');if(['Write','Edit'].includes(b.name))mark(repairing?'repairing':'authoring',repairing?'WorkBuddy正在修正教案格式':'WorkBuddy正在编写教案内容');}
   }
   if(v.type==='user'&&Array.isArray(v.message?.content)&&v.message.content.some(b=>b.type==='tool_result'))lastActivityAt=now();
   if(v.type==='result'&&typeof v.result==='string'){publicText(v.result);streamText='';}
  }
 }
 function snapshot(processAlive){return {stage,activity,lastActivityAt,serverAt:now(),processAlive:Boolean(processAlive),history:history.map(h=>({...h})),output:[...output.map(o=>({...o})),...(streamText?[{time:lastActivityAt,text:safe(streamText)}]:[])]};}
 return {consume,mark,snapshot};
}
module.exports={createProgress};
