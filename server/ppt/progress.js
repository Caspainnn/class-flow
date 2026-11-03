'use strict';
const fs=require('node:fs'),path=require('node:path');
const labels={starting:'制作进程已启动',reading:'正在读取要求与参考资料',authoring:'正在编写课件内容',checking:'正在运行检查',exporting:'正在导出课件',delivery:'已发现交付文件，等待最终校验'};
const rank={starting:0,reading:1,authoring:2,checking:3,exporting:4,delivery:5};
function createProgress({runDir,phase,startedAt,now=Date.now}){
 let stage='starting',activity=labels.starting,lastActivityAt=startedAt,buffer='',finalText='',failure=null,history=[{time:startedAt,message:labels.starting}],seen=new Map(),sourceFiles=0,exportFiles=0,pageProgress=null;
 function mark(next,message){if(rank[next]>rank[stage])stage=next;lastActivityAt=now();if(activity!==message){activity=message;history.push({time:lastActivityAt,message});history=history.slice(-12);}}
 function tool(name,input={}){
  if(name==='Read'||name==='Glob'||name==='Grep')mark('reading','正在读取制作所需文件');
  else if(name==='Write'||name==='Edit')mark('authoring',phase==='outline'?'正在整理教学目标与大纲':'正在编写或调整课件源文件');
  else if(name==='Bash'){const command=String(input.command||'');if(/svg_to_pptx|export.*pptx/i.test(command))mark('exporting',labels.exporting);else if(/checker|postflight|quality|validate/i.test(command))mark('checking',labels.checking);else mark(stage,'正在执行制作脚本');}
 }
 function consume(chunk){
  buffer=(buffer+String(chunk)).slice(-262144);
  const lines=buffer.split(/\r?\n/);buffer=lines.pop();
  for(const line of lines){let value;try{value=JSON.parse(line);}catch{continue;}
   failure=require('./diagnostics').diagnoseLog(line)||failure;
   if(value.type==='local_export_progress'&&phase==='export'&&Number.isInteger(value.completed)&&Number.isInteger(value.total)&&value.completed>=0&&value.completed<=value.total&&value.total<=150){pageProgress={completed:value.completed,total:value.total,stage:value.stage,message:String(value.message||'').slice(0,200)};mark(value.stage==='delivery'?'delivery':value.stage==='exporting'?'exporting':'reading',pageProgress.message);continue;}
   if(value.type==='system'&&value.subtype==='init')mark('starting','已连接制作工具，正在准备本轮任务');
   const blocks=value.message?.content||[];for(const block of Array.isArray(blocks)?blocks:[]){if(block.type==='tool_use'){lastActivityAt=now();tool(block.name,block.input);}if(block.type==='tool_result')lastActivityAt=now();if(block.type==='text'&&value.type==='assistant'){lastActivityAt=now();finalText=(finalText+'\n'+block.text).slice(-32000);}}
   if(value.type==='stream_event'&&['content_block_start','content_block_delta'].includes(value.event?.type))lastActivityAt=now();
   if(value.type==='result'&&typeof value.result==='string'){lastActivityAt=now();finalText=value.result.slice(-32000);}
  }
 }
 function snapshot(processAlive){
  let visited=0,sources=0,exports=0,latestChangedAt=0;const found=new Map();
  function walk(dir,depth){if(depth>7||visited>2500)return;let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
   for(const entry of entries){if(++visited>2500)break;if(entry.isSymbolicLink())continue;const full=path.join(dir,entry.name);
    if(entry.isDirectory()){if(!entry.name.startsWith('browser-')&&!['node_modules','.git','backup','.cache','input-html','files'].includes(entry.name))walk(full,depth+1);continue;}
    if(!entry.isFile()||!(/\.(svg|html|pptx)$/i.test(entry.name)||['outline.json','delivery.json','html-delivery.json'].includes(entry.name)))continue;
    const relative=path.relative(runDir,full).replace(/\\/g,'/');if(relative==='previous.pptx'||relative==='template.pptx'||relative.startsWith('files/')||/^[a-f0-9]{24}-/.test(relative))continue;
    let stat;try{stat=fs.statSync(full);}catch{continue;}if(!stat.size)continue;found.set(relative,stat.mtimeMs+':'+stat.size);if(seen.get(relative)!==found.get(relative))latestChangedAt=Math.max(latestChangedAt,stat.mtimeMs);
    if((/\.svg$/i.test(relative)&&/(?:^|\/)svg_output\//.test(relative))||(/\.html$/i.test(relative)&&phase!=='export'))sources++;
    if(/\.pptx$/i.test(relative)&&!/(?:^|\/)(sources|analysis)\//.test(relative))exports++;
   }
  }
  walk(runDir,0);
  const changed=[...found].some(([key,value])=>seen.get(key)!==value);seen=found;sourceFiles=sources;exportFiles=exports;
  if(changed){const previousActivity=lastActivityAt;if(found.has('delivery.json')||found.has('outline.json')||found.has('html-delivery.json'))mark('delivery',phase==='outline'?'已发现大纲文件，等待校验':found.has('html-delivery.json')?'已发现HTML课件，等待校验':labels.delivery);else if(exports)mark('exporting','已发现导出文件，等待交付与校验');else if(sources)mark('authoring',`已发现${sources}份页面源文件，仍在制作`);lastActivityAt=Math.max(previousActivity,Math.min(now(),latestChangedAt));}
  return {stage,activity:pageProgress?pageProgress.message:activity,lastActivityAt,serverAt:now(),processAlive:Boolean(processAlive),sourceFiles,exportFiles,history,pageProgress};
 }
 return {consume,snapshot,page(value){pageProgress=value;mark('authoring',value.message);},get finalText(){return finalText;},get failure(){return failure;}};
}
module.exports={createProgress};
