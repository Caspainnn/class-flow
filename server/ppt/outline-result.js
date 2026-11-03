'use strict';
const fs=require('node:fs'),path=require('node:path');
function read({runDir,finalText='',task}){
 const invalid=(code,message)=>{const error=new Error(message);error.code=code;throw error;};
 let raw;try{raw=fs.readFileSync(path.join(runDir,'outline.json'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;const response=String(finalText).trim();raw=response.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||response.slice(response.indexOf('{'),response.lastIndexOf('}')+1);}
 raw=String(raw||'').replace(/^\uFEFF/,'').trim();
 if(!raw)invalid('outline_missing','制作工具尚未交付大纲文件。原稿和教学要求已保留，请重新生成大纲。');
 let value;try{value=JSON.parse(raw);}catch{invalid('outline_invalid_json','大纲文件未完整写入或格式不正确。原稿和教学要求已保留，请重新生成大纲。');}
 return require('./outline').validate(value,task);
}
module.exports={read};
