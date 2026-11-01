'use strict';
const TWO_HOURS=2*60*60*1000;
function runTimeoutMs(config={}){const value=Number(config.timeoutMs);return Math.max(60000,Math.min(Number.isFinite(value)&&value>0?value:TWO_HOURS,TWO_HOURS));}
module.exports={TWO_HOURS,runTimeoutMs};
