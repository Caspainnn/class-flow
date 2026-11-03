'use strict';
const fs=require('node:fs'),path=require('node:path'),{parse}=require('parse5');
// Only embed media explicitly extracted from the mapped source pages, never arbitrary local files.
function inline(html,{runDir,htmlFile,pages=[]}){
 const root=fs.realpathSync(runDir),canonical=file=>process.platform==='win32'?file.toLowerCase():file;
 const safe=relative=>{if(typeof relative!=='string'||!/^source-reference\/(?:page-\d+\.json|media-\d+\.(?:png|jpe?g|gif|webp|svg))$/i.test(relative))return null;try{const actual=fs.realpathSync(path.join(root,relative));return actual.startsWith(root+path.sep)&&fs.statSync(actual).isFile()?actual:null;}catch{return null;}};
 const allowed=new Map();for(const page of pages){const details=safe(page.detailsFile);if(!details)continue;for(const asset of JSON.parse(fs.readFileSync(details,'utf8')).media||[]){const file=safe(asset.file);if(file)allowed.set(canonical(path.resolve(root,asset.file)),{file,relative:asset.file});}}
 const edits=[];
 function walk(node){for(const attr of node.attrs||[]){if(!(node.tagName==='img'&&attr.name==='src'||node.tagName==='image'&&attr.name==='href'))continue;const value=attr.value.trim();if(!value||/^(?:data:|#|[a-z][a-z\d+.-]*:)/i.test(value))continue;
  let decoded;try{decoded=decodeURIComponent(value);}catch{continue;}if(path.isAbsolute(decoded)||/^[\\/]|^[a-z][a-z\d+.-]*:/i.test(decoded))continue;
  const lexical=path.resolve(path.dirname(htmlFile),decoded);let asset=allowed.get(canonical(lexical));if(!asset){asset=[...allowed.values()].find(a=>a.relative===decoded);}
  const location=node.sourceCodeLocation?.attrs?.[attr.prefix?attr.prefix+':'+attr.name:attr.name];if(!asset||!location)continue;
  const ext=path.extname(asset.file).slice(1).toLowerCase(),mime=ext==='svg'?'svg+xml':ext==='jpg'?'jpeg':ext,bytes=fs.readFileSync(asset.file);if(bytes.length>20*1024*1024)throw Error('原稿图片超过可内嵌大小限制。');
  edits.push({start:location.startOffset,end:location.endOffset,text:`${attr.prefix?attr.prefix+':':''}${attr.name}="data:image/${mime};base64,${bytes.toString('base64')}"`});
 }for(const child of node.childNodes||[])walk(child);if(node.content)walk(node.content);}
 walk(parse(html,{sourceCodeLocationInfo:true}));for(const edit of edits.sort((a,b)=>b.start-a.start))html=html.slice(0,edit.start)+edit.text+html.slice(edit.end);return html;
}
module.exports={inline};
