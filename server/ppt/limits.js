'use strict';
const TWO_HOURS=2*60*60*1000;
function runTimeoutMs(config={}){const value=Number(config.timeoutMs);return Math.max(60000,Math.min(Number.isFinite(value)&&value>0?value:TWO_HOURS,TWO_HOURS));}
const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))&&Number(value)>0?Math.round(Math.max(min,Math.min(Number(value),max))):fallback;
function execution(config={},workbuddy={},phase='html'){
 const page=['html','html-modify'].includes(phase),effort=page?config.htmlReasoningEffort||config.reasoningEffort:config.reasoningEffort;
 return {model:config.model&&config.model!=='default'?config.model:workbuddy.model&&workbuddy.model!=='default'?workbuddy.model:'deepseek-v4.1-flash',reasoningEffort:['minimal','low','medium','high','xhigh','max'].includes(effort)?effort:page?'low':'medium',pageBudget:{timeoutMs:bounded(config.pageTimeoutMs,420000,1000,900000),maxTurns:bounded(config.pageMaxTurns,128,4,128),maxOutputChars:bounded(config.pageMaxOutputChars,80000,2000,400000)}};
}
module.exports={TWO_HOURS,runTimeoutMs,execution};
