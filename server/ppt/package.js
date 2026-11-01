'use strict';
const path=require('node:path'),crypto=require('node:crypto'),{SaxesParser}=require('saxes');
const NS={types:'http://schemas.openxmlformats.org/package/2006/content-types',rels:'http://schemas.openxmlformats.org/package/2006/relationships',p:'http://schemas.openxmlformats.org/presentationml/2006/main'};
function invalid(message='PPTX结构损坏，请用PowerPoint重新保存后导入。'){const error=new Error(message);error.status=400;throw error;}
function xml(value){const nodes=[],parser=new SaxesParser({xmlns:true});let root;
 parser.on('doctype',()=>invalid());parser.on('error',()=>invalid());
 parser.on('opentag',tag=>{const node={name:tag.local,ns:tag.uri,attrs:Object.fromEntries(Object.entries(tag.attributes).map(([key,a])=>[key,a.value])),children:[],relationshipId:Object.values(tag.attributes).find(a=>a.local==='id'&&a.uri==='http://schemas.openxmlformats.org/officeDocument/2006/relationships')?.value};if(nodes.length)nodes.at(-1).children.push(node);else if(root)invalid();else root=node;nodes.push(node);});parser.on('closetag',()=>nodes.pop());parser.write(value).close();if(!root)invalid();return root;
}
async function validatePackage(zip){
 const read=async name=>{const f=zip.file(name);if(!f)invalid();return f.async('string');};
 const types=xml(await read('[Content_Types].xml'));if(types.name!=='Types'||types.ns!==NS.types)invalid();
 const ct=new Map(types.children.filter(n=>n.name==='Override').map(n=>[(n.attrs.PartName||'').replace(/^\//,''),n.attrs.ContentType]));
 const defaults=new Map(types.children.filter(n=>n.name==='Default').map(n=>[n.attrs.Extension,n.attrs.ContentType]));
 if(ct.size!==types.children.filter(n=>n.name==='Override').length||defaults.size!==types.children.filter(n=>n.name==='Default').length||types.children.some(n=>n.ns!==NS.types||!n.attrs.ContentType||(!n.attrs.PartName&&!n.attrs.Extension)))invalid();
 const contentType=part=>ct.get(part)||defaults.get(path.posix.extname(part).slice(1));
 if(ct.get('ppt/presentation.xml')!=='application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml')invalid('请选择标准PPTX文件，不支持宏或其他Office格式。');
 const graphs=new Map();
 for(const name of Object.keys(zip.files).filter(n=>n.endsWith('.rels'))){
  const root=xml(await read(name));if(root.name!=='Relationships'||root.ns!==NS.rels)invalid();
  const owner=name==='_rels/.rels'?'':path.posix.join(path.posix.dirname(path.posix.dirname(name)),path.posix.basename(name,'.rels'));
  const rels=new Map();for(const node of root.children){if(node.name!=='Relationship')invalid();const a=node.attrs;if(!a.Id||!a.Target||!a.Type||rels.has(a.Id))invalid();let target=null;if(a.TargetMode!=='External'){try{target=path.posix.normalize(a.Target.startsWith('/')?decodeURIComponent(a.Target.slice(1)):path.posix.join(path.posix.dirname(owner),decodeURIComponent(a.Target)));}catch{invalid();}if(target.startsWith('../')||!zip.file(target)||!contentType(target))invalid();}rels.set(a.Id,{target,type:a.Type});}graphs.set(owner,{rels,file:name});
 }
 if(![...(graphs.get('')?.rels.values()||[])].some(r=>r.type.endsWith('/officeDocument')&&r.target==='ppt/presentation.xml'))invalid();
 const presentation=xml(await read('ppt/presentation.xml'));if(presentation.name!=='presentation'||presentation.ns!==NS.p)invalid();
 const ids=presentation.children.find(n=>n.name==='sldIdLst')?.children||[];if(!ids.length||ids.length>150)invalid('课件必须包含1至150页。');
 const names=ids.map(node=>{const r=graphs.get('ppt/presentation.xml')?.rels.get(node.relationshipId);if(node.name!=='sldId'||!r?.type.endsWith('/slide')||!r.target)invalid();return r.target;});
 if(names.some(name=>contentType(name)!=='application/vnd.openxmlformats-officedocument.presentationml.slide+xml'))invalid();
 if(new Set(names).size!==names.length)invalid();
 const fingerprints=[];
 for(const name of names){const root=xml(await read(name));if(root.name!=='sld'||root.ns!==NS.p||!root.children.find(n=>n.name==='cSld')?.children.some(n=>n.name==='spTree'))invalid();const visited=new Set(),hashes=[];
  const visit=async part=>{if(visited.has(part))return;visited.add(part);const buffer=await zip.file(part).async('nodebuffer');hashes.push(part+':'+crypto.createHash('sha256').update(buffer).digest('hex'));const graph=graphs.get(part);if(graph){hashes.push(graph.file+':'+crypto.createHash('sha256').update(await read(graph.file)).digest('hex'));for(const rel of graph.rels.values())if(rel.target)await visit(rel.target);}};
  await visit(name);fingerprints.push(crypto.createHash('sha256').update(hashes.sort().join('\n')).digest('hex'));
 }
 return {names,fingerprints};
}
module.exports={validatePackage,xml};
