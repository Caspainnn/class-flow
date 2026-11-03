'use strict';
const path=require('node:path'),crypto=require('node:crypto'),ZIP=require('jszip'),{xml,validatePackage}=require('./package');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function descendants(node,name){return node?[...(node.name===name?[node]:[]),...node.children.flatMap(n=>descendants(n,name))]:[];}
function describe(slide,layout,master,canvas){
 const tree=descendants(slide,'spTree')[0],result=[];
 const walk=(node,t={sx:1,sy:1,tx:0,ty:0})=>{for(const shape of node?.children||[]){if(shape.name==='grpSp'){
   const geom=shape.children.find(n=>n.name==='grpSpPr')?.children.find(n=>n.name==='xfrm'),off=descendants(geom,'off')[0]?.attrs,ext=descendants(geom,'ext')[0]?.attrs,chOff=descendants(geom,'chOff')[0]?.attrs,chExt=descendants(geom,'chExt')[0]?.attrs;
   if(off&&ext&&Number(chExt?.cx)>0&&Number(chExt?.cy)>0){const sx=Number(ext.cx)/Number(chExt.cx),sy=Number(ext.cy)/Number(chExt.cy);walk(shape,{sx:t.sx*sx,sy:t.sy*sy,tx:t.tx+t.sx*(Number(off.x)-Number(chOff?.x||0)*sx),ty:t.ty+t.sy*(Number(off.y)-Number(chOff?.y||0)*sy)});}else if(off&&ext)result.push({kind:'group-'+crypto.createHash('sha256').update(JSON.stringify(shape)).digest('hex').slice(0,8),x:t.tx+t.sx*Number(off.x),y:t.ty+t.sy*Number(off.y),w:t.sx*Number(ext.cx),h:t.sy*Number(ext.cy)});continue;
  }if(!['sp','pic','graphicFrame','cxnSp'].includes(shape.name))continue;
  const ph=descendants(shape,'ph')[0]?.attrs;
  const inherited=[layout,master].flatMap(n=>descendants(n,'sp')).filter(n=>{const p=descendants(n,'ph')[0]?.attrs;return p&&ph&&(ph.idx!==undefined?p.idx===ph.idx:(p.type||'body')===(ph.type||'body'));});
  const geom=descendants(shape,'xfrm')[0]||inherited.map(n=>descendants(n,'xfrm')[0]).find(Boolean),off=descendants(geom,'off')[0]?.attrs,ext=descendants(geom,'ext')[0]?.attrs;
  if(!off||!ext)continue;
  const kind=shape.name==='pic'?'image':descendants(shape,'tbl').length?'table':descendants(shape,'chart').length?'chart':ph?.type==='title'||ph?.type==='ctrTitle'?'title':descendants(shape,'t').length?'text':shape.name==='cxnSp'?'line':'shape';
  result.push({kind,x:t.tx+t.sx*Number(off.x),y:t.ty+t.sy*Number(off.y),w:t.sx*Number(ext.cx),h:t.sy*Number(ext.cy)});
 }};walk(tree);
 const w=canvas?.width||12192000,h=canvas?.height||6858000;
 return result.filter(s=>[s.x,s.y,s.w,s.h].every(Number.isFinite)&&s.w>=0&&s.h>=0).slice(0,100).map(s=>({...s,x:s.x/w,y:s.y/h,w:s.w/w,h:s.h/h}));
}
function group(slides){
 const groups=new Map();for(const s of slides){const structure=s.shapes.map(shape=>[shape.kind,...['x','y','w','h'].map(k=>Math.round(shape[k]*50))]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  // Empty/unsupported geometry is never assumed to be the same layout.
  const key=JSON.stringify([s.background,s.style,structure.length?structure:['unknown',s.slide]]);
  let g=groups.get(key);if(!g){g={id:'layout-'+crypto.createHash('sha256').update(key).digest('hex').slice(0,12),name:`布局 ${groups.size+1}`,representativeSlide:s.slide,sourceSlides:[],shapes:s.shapes,style:s.style||[],background:s.background||null};groups.set(key,g);}g.sourceSlides.push(s.slide);
 }return [...groups.values()];
}
async function subset(buffer,selected){
 const zip=await ZIP.loadAsync(buffer),{names}=await validatePackage(zip),keep=new Set(selected.map(n=>names[n-1]));
 const rels=new Map(),allNames=Object.keys(zip.files);
 for(const name of allNames.filter(n=>n.endsWith('.rels'))){const root=xml(await zip.file(name).async('string')),owner=name==='_rels/.rels'?'':path.posix.join(path.posix.dirname(path.posix.dirname(name)),path.posix.basename(name,'.rels'));
  const entries=root.children.filter(n=>{const type=n.attrs.Type||'',target=n.attrs.Target.startsWith('/')?n.attrs.Target.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(owner),n.attrs.Target));return !type.endsWith('/notesSlide')&&!type.endsWith('/comments')&&(!type.endsWith('/slide')||keep.has(target));}).map(n=>n.attrs);
  rels.set(owner,{name,entries});
 }
 const presentation=await zip.file('ppt/presentation.xml').async('string'),parsed=xml(presentation),ids=parsed.children.find(n=>n.name==='sldIdLst').children,original=xml(await zip.file('ppt/_rels/presentation.xml.rels').async('string'));
 const selectedIds=ids.filter(n=>{const r=original.children.find(r=>r.attrs.Id===n.relationshipId);const target=r.attrs.Target.startsWith('/')?r.attrs.Target.slice(1):path.posix.normalize(path.posix.join('ppt',r.attrs.Target));return keep.has(target);});
 const list='<p:sldIdLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+selectedIds.map(n=>`<p:sldId id="${escape(n.attrs.id)}" r:id="${escape(n.relationshipId)}"/>`).join('')+'</p:sldIdLst>';
 zip.file('ppt/presentation.xml',presentation.replace(/<(?:\w+:)?sldIdLst\b[^>]*>[\s\S]*?<\/(?:\w+:)?sldIdLst>/,list).replace(/<(?:\w+:)?(?:custShowLst|extLst)\b[^>]*>[\s\S]*?<\/(?:\w+:)?(?:custShowLst|extLst)>/g,''));
 const reachable=new Set(),out=new ZIP();
 async function visit(part){if(reachable.has(part))return;reachable.add(part);if(part){let content=await zip.file(part).async('nodebuffer');if(keep.has(part))content=Buffer.from(content.toString('utf8').replace(/<(?:[\w.-]+:)?hlink(?:Click|Hover)\b[^>]*(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?hlink(?:Click|Hover)>)/g,''));out.file(part,content);}const graph=rels.get(part);if(!graph)return;
  const relXml='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+graph.entries.map(a=>'<Relationship '+Object.entries(a).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>').join('')+'</Relationships>';out.file(graph.name,relXml);
  for(const a of graph.entries)if(a.TargetMode!=='External'){const target=a.Target.startsWith('/')?a.Target.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(part),a.Target));await visit(target);}
 }await visit('');
 if(out.file('docProps/app.xml')){const app=await out.file('docProps/app.xml').async('string');out.file('docProps/app.xml',app.replace(/(<(?:[\w.-]+:)?Slides\b[^>]*>)[\s\S]*?(<\/(?:[\w.-]+:)?Slides>)/,'$1'+selectedIds.length+'$2'));}
 const types=xml(await zip.file('[Content_Types].xml').async('string'));out.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+types.children.filter(n=>n.name!=='Override'||reachable.has(n.attrs.PartName.replace(/^\//,''))).map(n=>'<'+n.name+' '+Object.entries(n.attrs).filter(([k])=>!k.startsWith('xmlns')).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>').join('')+'</Types>');
 for(const part of reachable){if(!part.endsWith('.xml'))continue;const parser=new (require('saxes').SaxesParser)({xmlns:true}),ids=new Set(rels.get(part)?.entries.map(a=>a.Id)||[]);parser.on('opentag',tag=>{for(const a of Object.values(tag.attributes))if(a.uri==='http://schemas.openxmlformats.org/officeDocument/2006/relationships'&&!ids.has(a.value)){const error=new Error('精简模板仍含无效页面关联，请调整保留布局后重试。');error.status=400;throw error;}});parser.write(await out.file(part).async('string')).close();}
 const result=await out.generateAsync({type:'nodebuffer',compression:'DEFLATE'});await validatePackage(await ZIP.loadAsync(result));return result;
}
module.exports={describe,group,subset};
