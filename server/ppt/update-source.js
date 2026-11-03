'use strict';
const fs=require('node:fs'),path=require('node:path'),ZIP=require('jszip'),{xml,validatePackage}=require('./package');
function nodes(n,name){return n?[...(n.name===name?[n]:[]),...(n.children||[]).flatMap(c=>nodes(c,name))]:[];}
async function prepare({source,readFile,runDir,inspectPpt,prepareVisuals,cacheRoot,signal}){
 const buffer=fs.readFileSync(readFile(source.file)),slides=await inspectPpt(buffer);
 if(!slides.length||slides.length>150)throw Error('更新原稿须为1至150页的有效PPTX。');
 const zip=await ZIP.loadAsync(buffer),{names}=await validatePackage(zip),folder=path.join(runDir,'source-reference');fs.mkdirSync(folder,{recursive:true});
 const media=[];
 for(const entry of Object.values(zip.files).filter(e=>!e.dir&&/^ppt\/media\//.test(e.name))){
  const ext=path.extname(entry.name).toLowerCase();if(!['.png','.jpg','.jpeg','.gif','.webp','.svg'].includes(ext))continue;
  const data=await entry.async('nodebuffer'),relative='source-reference/media-'+media.length+ext;
  fs.writeFileSync(path.join(runDir,relative),data);const type=ext==='.svg'?'svg+xml':ext==='.jpg'?'jpeg':ext.slice(1);
  const dataFile=relative+'.json';fs.writeFileSync(path.join(runDir,dataFile),JSON.stringify({dataUri:`data:image/${type};base64,${data.toString('base64')}`}));media.push({packagePath:entry.name,file:relative,dataFile});
 }
 const parts=new Map();
 const part=async name=>{
  if(parts.has(name))return parts.get(name);
  const entry=zip.file(name);if(!entry)return null;
  const isXml=/\.(xml|rels)$/i.test(name),relative='source-reference/part-'+parts.size+(isXml?'.xml':'.bin');
  const value={packagePath:name,file:relative,readable:isXml};parts.set(name,value);
  fs.writeFileSync(path.join(runDir,relative),await entry.async('nodebuffer'));return value;
 };
 const dependencies=async(name,visited=new Set())=>{
  if(visited.has(name))return [];visited.add(name);
  const relName=path.posix.join(path.posix.dirname(name),'_rels',path.posix.basename(name)+'.rels'),rels=zip.file(relName);if(!rels)return [];
  const result=[];for(const rel of nodes(xml(await rels.async('string')),'Relationship')){
   if(rel.attrs.TargetMode==='External'){result.push({relationshipId:rel.attrs.Id,external:true,readable:false,check:'外部对象未下载，须标记待核对，不可猜测数据。'});continue;}
   const target=path.posix.normalize(rel.attrs.Target.startsWith('/')?decodeURIComponent(rel.attrs.Target.slice(1)):path.posix.join(path.posix.dirname(name),decodeURIComponent(rel.attrs.Target))),asset=media.find(m=>m.packagePath===target);
   if(asset){result.push({...asset,relationshipId:rel.attrs.Id,readable:true});continue;}
   const value=await part(target);if(!value)continue;
   result.push({...value,relationshipId:rel.attrs.Id,...(!value.readable?{check:'嵌入二进制对象无法直接读取；结合截图核对并报告，不得声称已完全保留。'}:{})});
   if(value.readable)result.push(...await dependencies(target,visited));
  }return result;
 };
 const pages=[];
 for(let i=0;i<slides.length;i++){
  const raw=await zip.file(names[i]).async('string'),relatedParts=await dependencies(names[i]);
  const contentFile=`source-reference/page-${i+1}.xml`;fs.writeFileSync(path.join(runDir,contentFile),raw);
  pages.push({number:i+1,text:slides[i].text,notes:slides[i].notes,contentFile,media:relatedParts.filter(p=>p.dataFile),relatedParts,check:'完整XML与关联图表/SmartArt/备注数据保留；须结合真实截图逐页核对，不可猜测。外部及不可读取二进制对象须列为待核对事项。'});
 }
 const references=await prepareVisuals({file:readFile(source.file),profile:{layoutGroups:pages.map(p=>({id:'source-'+p.number,name:'原第'+p.number+'页',representativeSlide:p.number}))},cacheRoot,runDir:folder,signal});
 if(signal?.aborted)throw Error('本轮已停止。');
 pages.forEach((p,i)=>p.screenshot='source-reference/'+references[i].file.replace(/\\/g,'/'));
 const indexPages=pages.map(p=>{
  const detailsFile=`source-reference/page-${p.number}.json`;fs.writeFileSync(path.join(runDir,detailsFile),JSON.stringify(p,null,2));
  return {number:p.number,detailsFile,screenshot:p.screenshot};
 });
 const batches=[];
 for(let offset=0;offset<pages.length;offset+=10){
  const file=`source-reference/outline-${String(batches.length+1).padStart(3,'0')}.json`;
  const rows=pages.slice(offset,offset+10).map(p=>{const text=p.text.replace(/\s+/g,' ').trim();return {number:p.number,text:text.slice(0,1600),textTruncated:text.length>1600,detailsFile:indexPages[p.number-1].detailsFile,needsVisualReview:!text};});
  fs.writeFileSync(path.join(runDir,file),JSON.stringify({pages:rows},null,2));batches.push(file);
 }
 const result={file:source.id+'-'+source.name,name:source.name,pageCount:pages.length,batches,pages:indexPages};fs.writeFileSync(path.join(runDir,'source-content.json'),JSON.stringify(result,null,2));return result;
}
module.exports={prepare};
