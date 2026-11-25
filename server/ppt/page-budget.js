'use strict';
// Stop only this page's child; its owner waits for close before releasing the task.
function watch(child,budget,stop){
 let failure=null,resultFailure=null,buffer='',outputChars=0;
 function halt(reason){if(failure)return;failure=Object.assign(new Error(reason+' 已完成且通过校验的页面已保留，可从中断处续做；未完成页可重试。'),{code:'page_budget_exceeded'});stop(child);}
 const timer=setTimeout(()=>halt(`本页制作已达到${Math.round(budget.timeoutMs/1000)}秒上限。`),budget.timeoutMs);timer.unref?.();
 const consume=chunk=>{buffer+=String(chunk);const lines=buffer.split(/\r?\n/);buffer=lines.pop();if(buffer.length>2*1024*1024){buffer='';halt('本页制作输出超过限制。');}for(const line of lines){let value;try{value=JSON.parse(line);}catch{continue;}if(value.type==='stream_event'&&value.event?.type==='content_block_delta'){const delta=value.event.delta||{};outputChars+=(delta.text||delta.thinking||delta.reasoning_content||delta.partial_json||'').length;}if(value.type==='result'&&value.is_error){const diagnosed=require('./diagnostics').diagnoseLog(line);resultFailure=Object.assign(new Error(diagnosed?.message||'本页制作工具未正常完成，已有页面保留。'),{code:diagnosed?.code||'page_incomplete'});}if(outputChars>budget.maxOutputChars)halt('本页模型输出已达到预算。');}};
 const clear=()=>{clearTimeout(timer);child.stdout.removeListener?.('data',consume);};
 child.stdout.on('data',consume);child.once('close',clear);child.once('error',clear);
 return {get failure(){return failure||resultFailure;},clear};
}
module.exports={watch};
