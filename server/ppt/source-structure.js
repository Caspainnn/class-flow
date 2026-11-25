'use strict';
const {xml}=require('./package');
const all=(n,name)=>n?[...(n.name===name?[n]:[]),...(n.children||[]).flatMap(c=>all(c,name))]:[];
// Keep every text run, table cell, formula and geometry; no long-line XML is sent to Read.
function describe(raw){
 const root=xml(raw,true),plain=n=>{if(['lstStyle','effectLst','effectDag'].includes(n.name))return null;const attributes=Object.fromEntries(Object.entries(n.attrs).filter(([key])=>!key.startsWith('xmlns')));return [n.name,...(Object.keys(attributes).length?[attributes]:[]),...(n.text!==undefined?[n.text]:[]),...n.children.map(plain).filter(Boolean)];};
 const tree=all(root,'spTree')[0];
 return {format:'对象树数组依次为元素名、可选属性、原文及子元素；仅省略被新模板替换的默认列表样式和视觉效果。文字、表格、公式、几何和关联标识完整保留。',textRuns:all(root,'t').map(n=>n.text||''),objects:(tree?.children||[]).filter(n=>!['nvGrpSpPr','grpSpPr'].includes(n.name)).map(plain),...(!tree?{data:plain(root)}:{})};
}
function writeJson(fs,file,value){
 // Split unusually long strings losslessly so the CLI cannot truncate a single JSON line.
 const safe=(_,v)=>typeof v==='string'&&v.length>250?{joinedText:Array.from({length:Math.ceil(v.length/250)},(_,i)=>v.slice(i*250,(i+1)*250)),instruction:'按顺序连接joinedText，完整保留原文。'}:v;
 const raw=JSON.stringify(value,safe);let output='',quoted=false,escaped=false,column=0;
 for(const char of raw){output+=char;column++;if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}else if(char==='"')quoted=true;else if(column>160&&',]}'.includes(char)){output+='\n';column=0;}}
 fs.writeFileSync(file,output);
}
module.exports={describe,writeJson};
