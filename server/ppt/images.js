'use strict';
const {randomInt}=require('node:crypto');
const {parse}=require('parse5');
const START='<!--PPT_IMAGE_START-->',END='<!--PPT_IMAGE_END-->',SLOT='<!--PPT_IMAGE_SLOT-->';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function plain(value,max=240){let result='';const walk=n=>{if(n.nodeName==='#text')result+=n.value;for(const c of n.childNodes||[])walk(c);};walk(parse(String(value||'')));return result.replace(/\s+/g,' ').trim().slice(0,max);}
function intent(value){
 if(value==null)return {kind:'none',subject:'',purpose:'',query:''};
 if(!value||typeof value!=='object'||!['none','web'].includes(value.kind))throw Object.assign(new Error('配图方式须为不配图或网上找图。'),{status:400});
 const out={kind:value.kind,subject:String(value.subject||'').trim().slice(0,100),purpose:String(value.purpose||'').trim().slice(0,120),query:String(value.query||value.subject||'').trim().slice(0,160)};
 if(out.kind==='web'&&(!out.subject||!out.purpose||!out.query))throw Object.assign(new Error('请填写配图内容、教学用途和检索关键词。'),{status:400});
 return out;
}
function layout(page,groups=[]){
 const candidates=groups.flatMap(g=>(g.shapes||[]).filter(s=>s.kind==='image'&&s.w*s.h>=.06&&s.w*s.h<=.72&&s.x>=0&&s.y>=0&&s.x+s.w<=1.01&&s.y+s.h<=1.01).sort((a,b)=>b.w*b.h-a.w*a.h).slice(0,1).map(region=>({layoutId:g.id,region})));
 if(candidates.length){const chosen=candidates.find(c=>c.layoutId===page.layoutId)||candidates[randomInt(candidates.length)];page.layoutId=chosen.layoutId;return chosen.region;}
 // A known fallback region is supplied to the page author, rather than guessing afterwards.
 return {x:.57,y:.22,w:.37,h:.57};
}
function safeUrl(value,host){try{if(typeof value!=='string'||value.length>2048)return null;const u=new URL(value);return u.protocol==='https:'&&[].concat(host).includes(u.hostname)&&!u.port&&!u.username&&!u.password?u.href:null;}catch{return null;}}
async function bounded(url,max,signal,fetcher){
 const response=await fetcher(url,{redirect:'error',signal,headers:{'User-Agent':'InclassLesson/1.0 (educational slide image lookup)'}});
 if(!response.ok||Number(response.headers.get('content-length')||0)>max)throw Error('Image source unavailable');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Image too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
async function search(image,{exclude=[],signal,fetcher=fetch}={}){
 const timeout=AbortSignal.timeout(18000),abort=signal?AbortSignal.any([timeout,signal]):timeout;
 const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:image.query+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'800'});
 const result=JSON.parse((await bounded('https://commons.wikimedia.org/w/api.php?'+params,1024*1024,abort,fetcher)).toString('utf8'));
 const pages=Object.values(result.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0));
 for(const page of pages){
  const info=page.imageinfo?.[0],meta=info?.extmetadata||{},license=plain(meta.LicenseShortName?.value,60),licenseUrl=String(meta.LicenseUrl?.value||'');
  const publicDomain=['Public domain','CC0'].includes(license),by=/^CC BY (?:2\.0|2\.5|3\.0|4\.0)$/.test(license)&&/^https?:\/\/creativecommons\.org\/licenses\/by\/(?:2\.0|2\.5|3\.0|4\.0)\/?$/.test(licenseUrl);
  if(!publicDomain&&!by||plain(meta.Restrictions?.value)||exclude.includes(String(page.pageid)))continue;
  const url=safeUrl(info?.thumburl||info?.url,['upload.wikimedia.org','thumb.wikimedia.org']),source=safeUrl(info?.descriptionurl,'commons.wikimedia.org'),author=plain(meta.Artist?.value,160);
  if(!url||!source||!author||!['image/jpeg','image/png'].includes(info.mime))continue;
  try{
   const bytes=await bounded(url,420*1024,abort,fetcher),png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   if(!png&&!jpeg)continue;
   return {status:'ready',id:String(page.pageid),subject:image.subject,purpose:image.purpose,query:image.query,title:plain(page.title,160),author,license,licenseUrl:publicDomain?(license==='CC0'?'https://creativecommons.org/publicdomain/zero/1.0/':'https://creativecommons.org/publicdomain/mark/1.0/'):licenseUrl.replace(/^http:/,'https:'),source,data:`data:image/${png?'png':'jpeg'};base64,${bytes.toString('base64')}`};
  }catch(error){if(abort.aborted)throw error;}
 }
 return {status:'missing',subject:image.subject,purpose:image.purpose,query:image.query,message:'未找到满足检索和授权条件的图片，本页使用文字或原生图示。'};
}
function metadata(image){if(!image)return null;const {data,...value}=image;return value;}
function credit(image){return image?.status==='ready'?`配图：${image.title}；作者：${image.author}；${image.license}；来源：${image.source}；许可：${image.licenseUrl}；缩放适配，未改写原图。`:'';}
function block(image,region){
 if(image?.status!=='ready')return '';
 const r=region||{x:.57,y:.22,w:.37,h:.57};
 return START+`<figure style="position:absolute;left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%;margin:0;display:flex;flex-direction:column"><img alt="${escape(image.subject)}" src="${image.data}" style="width:100%;height:calc(100% - 40px);object-fit:contain"><figcaption style="font-size:10px;line-height:13px;color:#526070;background:#fff;overflow:hidden">${escape(image.author)} · ${escape(image.license)} · Wikimedia Commons</figcaption></figure>`+END;
}
function inject(html,image,region){
 if(image?.status==='ready')checkSlot(html);
 return html.replace(SLOT,block(image,region));
}
function replace(html,image,region){const start=html.indexOf(START),end=html.indexOf(END);if(start<0||end<start||html.indexOf(START,start+1)>=0)throw Error('当前页面没有可更换的配图区域，请重新制作本页。');return html.slice(0,start)+block(image,region)+html.slice(end+END.length);}
function extract(html){const start=html.indexOf(START),end=html.indexOf(END);if(start<0||end<start)throw Error('配图区域缺失。');return html.slice(start,end+END.length);}
function checkSlot(html){let count=0;const walk=(n,parent)=>{if(n.nodeName==='#comment'&&n.data==='PPT_IMAGE_SLOT'&&parent?.tagName==='body')count++;for(const c of n.childNodes||[])walk(c,n);};walk(parse(html));if(count!==1||html.split(SLOT).length!==2)throw Error('配图页须在body中预留唯一独立图片占位注释，请重试该页。');}
function restore(html,original){checkSlot(html);return html.replace(SLOT,extract(original));}
function noUnplannedImages(html){
 if(html.split(START).length>2||html.split(END).length>2)throw Error('每页只允许一个平台配图区域。');
 const rest=html.replace(/<!--PPT_IMAGE_START-->[\s\S]*?<!--PPT_IMAGE_END-->/g,'');
 const bad=()=>{throw Error('本页包含未在大纲中确认的外部图片，请使用原生形状或保留平台图片占位。');};
 const css=value=>{value=value.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\\([\da-f]{1,6})\s?|\\(.)/gi,(_,hex,char)=>hex?String.fromCodePoint(Math.min(0x10ffff,parseInt(hex,16))):char);if(/data\s*:|image-set\s*\(/i.test(value))bad();for(const m of value.matchAll(/url\s*\(([^)]*)\)/gi))if(!/^['"]?#/.test(m[1].trim()))bad();};
 const walk=n=>{if(['img','image','feimage','picture','video','canvas'].includes(n.tagName?.toLowerCase()))bad();for(const a of n.attrs||[]){if(a.name==='style')css(a.value);else if(/data\s*:/i.test(a.value))bad();}if(n.tagName==='style')css((n.childNodes||[]).map(c=>c.value||'').join(''));for(const c of n.childNodes||[])walk(c);if(n.content)walk(n.content);};walk(parse(rest));
}
module.exports={intent,layout,search,metadata,credit,inject,replace,extract,restore,noUnplannedImages,SLOT};
