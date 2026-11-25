// Browser layout -> editable text/rectangles; complex SVG fragments stay images.
function extractScene() {
 const objects=[],warnings=[];
 const box=r=>({x:r.left,y:r.top,w:r.width,h:r.height});
 const visible=(r)=>r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<1280&&r.top<720;
 const painted=c=>c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)';
 const activeZ=el=>{const s=getComputedStyle(el),p=el.parentElement&&getComputedStyle(el.parentElement);return s.position!=='static'||p&&/flex|grid/.test(p.display)?s.zIndex:'auto';};
 // Fit overflowing image rows without stretching their source images.
 for(const row of document.body.querySelectorAll('*')){
  const style=getComputedStyle(row),r=row.getBoundingClientRect(),cards=[...row.children];
  if(!['flex','inline-flex'].includes(style.display)||style.flexDirection!=='row'||!visible(r)||r.right>1281||
     cards.length<2||!cards.every(card=>card.children.length===1&&card.firstElementChild.tagName==='IMG')||
     !cards.some(card=>card.getBoundingClientRect().right>r.right+1))continue;
  for(const card of cards){
   card.style.minWidth='0';
   Object.assign(card.firstElementChild.style,{maxWidth:'100%',objectFit:'contain'});
  }
 }
 // An absolute box that fits its containing block can be moved inside it.
 for(const el of document.body.querySelectorAll('*')){
  const style=getComputedStyle(el),r=el.getBoundingClientRect(),parent=el.offsetParent?.getBoundingClientRect();
  if(style.position!=='absolute'||!parent||!visible(r)||r.right<=1281||parent.right>1281||
     r.width>parent.width||style.left==='auto'||style.right!=='auto')continue;
  el.style.left=`${parseFloat(style.left)-(r.right-parent.right)}px`;
 }
 // Materialize literal pseudo-elements so text stays editable and empty
 // decorations can be captured independently.
 const decorations=[];
 // Handle the common code-list counter: reset on the container, increment on each row.
 const counterValue=(el,name,pseudo)=>{
  let parent=el.parentElement;
  if(!parent)return;
  // A code block can wrap all rows in a single neutral <code> element.
  const wrapper=getComputedStyle(parent);
  if(parent.tagName==='CODE'&&parent.parentElement?.tagName==='PRE'&&
     parent.parentElement.children.length===1&&wrapper.counterReset==='none'&&
     wrapper.counterIncrement==='none'&&wrapper.counterSet==='none')parent=parent.parentElement;
  const [reset,start='0',...rest]=getComputedStyle(parent).counterReset.split(/\s+/);
  if(reset!==name||rest.length||!/^[-+]?\d+$/.test(start))return;
  let value=Number(start);
  for(const sibling of el.parentElement.children){
   const style=getComputedStyle(sibling);
   if(style.display==='none')continue;
   if(style.counterReset!=='none'||style.counterSet!=='none')return;
   const marker=getComputedStyle(sibling,pseudo);
   const increments=[style.counterIncrement,marker.display!=='none'&&!['none','normal'].includes(marker.content)?marker.counterIncrement:'none'];
   for(const entry of increments.filter(v=>v!=='none')){
    const [increment,step='1',...extra]=entry.split(/\s+/);
    if(increment!==name||extra.length||!/^[-+]?\d+$/.test(step))return;
    value+=Number(step);
   }
   if(sibling===el)return String(value);
  }
 };
 for(const el of [document.body,...document.body.querySelectorAll('*')])for(const pseudo of ['::before','::after']){
  const s=getComputedStyle(el,pseudo);if(s.display==='none')continue;
  let content;
  const counter=s.content.match(/^(?:"([^"\\]*)"\s*)?counter\(([\w-]+)(?:,\s*decimal)?\)(?:\s*"([^"\\]*)")?$/);
  if(counter&&s.counterReset==='none'&&s.counterSet==='none'){
   const value=counterValue(el,counter[2],pseudo);
   if(value!==undefined)content=(counter[1]||'')+value+(counter[3]||'');
  }
  else if(el.tagName==='Q'&&s.quotes==='auto'&&['open-quote','close-quote'].includes(s.content)){
   const nested=Boolean(el.parentElement?.closest('q'));
   content=(nested?['‘','’']:['“','”'])[s.content==='close-quote'?1:0];
  }
  else if(s.content.startsWith('"')){try{content=JSON.parse(s.content);}catch{continue;}}
  if(content===undefined)continue;
  const properties=[...s].filter(name=>name!=='content').map(name=>[name,s.getPropertyValue(name)]);
  decorations.push({el,pseudo,properties,content});
 }
 const sheet=document.createElement('style');sheet.textContent='[data-ppt-before]::before,[data-ppt-after]::after{content:none!important}';document.head.append(sheet);
 for(const [i,item] of decorations.entries()){
  const node=document.createElement('span');
  if(item.content)node.textContent=item.content;
  else{node.dataset.pptDecoration='pseudo-'+i;node.dataset.pptDecorationOnly='1';}
  for(const [name,value] of item.properties)node.style.setProperty(name,value,'important');
  item.el.setAttribute(item.pseudo==='::before'?'data-ppt-before':'data-ppt-after','');
  item.pseudo==='::before'?item.el.prepend(node):item.el.append(node);
 }
 function text(node){
  const parent=node.parentElement,s=getComputedStyle(parent);let current=null,opacity=1;
  for(let element=parent;element;element=element.parentElement)opacity*=Number(getComputedStyle(element).opacity);
  for(let offset=0;offset<node.length;){
   const value=String.fromCodePoint(node.data.codePointAt(offset)),range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+value.length);offset+=value.length;
   const r=range.getBoundingClientRect();if(!visible(r)||(!value.trim()&&!current))continue;
   if(current&&Math.abs(current.y-r.top)<1&&Math.abs(current.x+current.w-r.left)<2){current.text+=value;current.w=r.right-current.x;continue;}
   current={kind:'text',...box(r),text:value,font:s.fontFamily,size:parseFloat(s.fontSize),weight:s.fontWeight,color:s.color,opacity,italic:s.fontStyle==='italic',decoration:s.textDecorationLine};objects.push(current);
  }
 }
 let decorationIndex=0;
 function decorationBox(el,r,padding=0){
  let left=Math.max(0,r.left-padding),top=Math.max(0,r.top-padding),right=Math.min(1280,r.right+padding),bottom=Math.min(720,r.bottom+padding);
  for(let parent=el.parentElement;parent;parent=parent.parentElement){const p=getComputedStyle(parent),b=parent.getBoundingClientRect();if(/hidden|clip|scroll|auto/.test(p.overflowX)){left=Math.max(left,b.left+parent.clientLeft);right=Math.min(right,b.left+parent.clientLeft+parent.clientWidth);}if(/hidden|clip|scroll|auto/.test(p.overflowY)){top=Math.max(top,b.top+parent.clientTop);bottom=Math.min(bottom,b.top+parent.clientTop+parent.clientHeight);}}
  return right>left&&bottom>top?{x:left,y:top,w:right-left,h:bottom-top}:null;
 }
 function walk(el){
  const s=getComputedStyle(el),r=el.getBoundingClientRect();if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return;
  if(el.tagName==='SCRIPT'||el.tagName==='STYLE'||el.tagName==='HEAD')return;
  // Absolutely positioned children can be visible even when their wrapper has no box.
  if(visible(r)){
  if(el.dataset.pptDecorationOnly!==undefined){
   const clipped=decorationBox(el,r);if(clipped)objects.push({kind:'decoration',...clipped,marker:el.dataset.pptDecoration,reason:'decorative pseudo-element'});return;
  }
  if(activeZ(el)!=='auto'&&el.parentElement&&el.parentElement!==document.body){
   const parent=el.parentElement,p=getComputedStyle(parent);
   if(activeZ(parent)==='auto'&&p.transform==='none'&&Number(p.opacity)===1&&p.isolation!=='isolate'){
    const overlaps=[...document.body.querySelectorAll('*')].some(other=>{
     if(parent.contains(other)||other.contains(parent))return false;
     // An ancestor's unlayered ::before is emitted before its positive-z descendants.
     if(Number(activeZ(el))>0&&other.dataset.pptDecorationOnly!==undefined&&
        other.parentElement.hasAttribute('data-ppt-before')&&other===other.parentElement.firstChild&&
        other.parentElement.contains(parent)&&activeZ(other)==='auto')return false;
     const style=getComputedStyle(other),rect=other.getBoundingClientRect();
     if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||!visible(rect))return false;
     const clipped=other.dataset.pptDecorationOnly!==undefined?decorationBox(other,rect):box(rect);
     if(!clipped)return false;
     const paints=painted(style.backgroundColor)||style.backgroundImage!=='none'||['IMG','svg'].includes(other.tagName)||[...other.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
     return paints&&r.left<clipped.x+clipped.w&&r.right>clipped.x&&r.top<clipped.y+clipped.h&&r.bottom>clipped.y;
    });
    if(overlaps)throw Error('此页使用跨容器叠放层级，请简化层级后再导出。');
   }
  }
  if(el.tagName.toLowerCase()==='svg'){
   const marker='element-'+decorationIndex++,clipped=decorationBox(el,r);el.dataset.pptDecoration=marker;
   if(clipped)objects.push({kind:'raster',...clipped,marker,reason:'inline SVG diagram'});return;
  }
  if(el.tagName==='IMG'){
   const src=el.currentSrc||el.src;if(!el.naturalWidth||!el.naturalHeight)throw Error('课件中存在无法读取的图片。');
   if(/^data:image\/svg\+xml/i.test(src)){
    const marker='element-'+decorationIndex++,clipped=decorationBox(el,r);el.dataset.pptDecoration=marker;
    if(clipped)objects.push({kind:'raster',...clipped,marker,reason:'SVG image'});return;
   }
   const o={kind:'image',...box(r),src},fit=s.objectFit;
   if(fit!=='fill'){
    const position=s.objectPosition.split(' ');if(!position.every(v=>/^[-\d.]+%$/.test(v)))throw Error('暂不支持此图片定位方式，请使用百分比定位后导出。');
    const px=parseFloat(position[0])/100,py=parseFloat(position[1]||'50%')/100;
    let scale=fit==='cover'?Math.max(r.width/el.naturalWidth,r.height/el.naturalHeight):Math.min(r.width/el.naturalWidth,r.height/el.naturalHeight);if(fit==='none')scale=1;if(fit==='scale-down')scale=Math.min(scale,1);
    const w=el.naturalWidth*scale,h=el.naturalHeight*scale;
    if(w>r.width||h>r.height)o.crop={left:Math.max(0,(w-r.width)*px/w),right:Math.max(0,(w-r.width)*(1-px)/w),top:Math.max(0,(h-r.height)*py/h),bottom:Math.max(0,(h-r.height)*(1-py)/h)};
    else{o.x+=(r.width-w)*px;o.y+=(r.height-h)*py;o.w=w;o.h=h;}
   }
   objects.push(o);return;
  }
  const maskImage=s.maskImage||s.webkitMaskImage||'none',complexDecoration=s.backgroundImage!=='none'||s.boxShadow!=='none'||maskImage!=='none';
  if(complexDecoration){
   const marker='element-'+decorationIndex++,clipped=decorationBox(el,r,s.boxShadow==='none'?0:64);el.dataset.pptDecoration=marker;
   if(clipped)objects.push({kind:'decoration',...clipped,marker,reason:'complex CSS decoration'});
  }else{
   if(painted(s.backgroundColor))objects.push({kind:'rect',...box(r),color:s.backgroundColor,gradient:'none',radius:parseFloat(s.borderRadius)||0});
   for(const [side,points] of Object.entries({Top:[r.left,r.top,r.right,r.top],Bottom:[r.left,r.bottom,r.right,r.bottom],Left:[r.left,r.top,r.left,r.bottom],Right:[r.right,r.top,r.right,r.bottom]})){
    const width=parseFloat(s['border'+side+'Width']);if(width&&s['border'+side+'Style']!=='none')objects.push({kind:'line',points,color:s['border'+side+'Color'],width});
   }
  }
  // Bullet/accent pseudo-elements in the current HTML use fixed px positions.
  for(const pseudo of ['::before','::after']){const p=getComputedStyle(el,pseudo);if(p.content==='none'||p.content==='normal'||p.display==='none')continue;
   if(p.content==='""'&&p.position==='absolute'&&parseFloat(p.width)>0&&parseFloat(p.height)>0&&painted(p.backgroundColor))objects.push({kind:'rect',x:r.left+(parseFloat(p.left)||0),y:r.top+(parseFloat(p.top)||0),w:parseFloat(p.width),h:parseFloat(p.height),color:p.backgroundColor,radius:parseFloat(p.borderRadius)||0});
   else if(['"▪"','"•"','"●"'].includes(p.content)&&p.position==='absolute'){const size=parseFloat(p.fontSize);objects.push({kind:'rect',x:r.left+(parseFloat(p.left)||0),y:r.top+(parseFloat(p.top)||0)+size*.45,w:size*.25,h:size*.25,color:p.color,radius:p.content==='"▪"'?0:size});}
   else throw Error(`此页含尚未支持的自动编号或伪元素内容（${el.localName}${pseudo}，${p.content.split('(')[0].slice(0,30)}），请改成普通文字后再导出。`);
  }
  }
  const children=[...el.childNodes];
  // Positioned sibling layers are emitted back-to-front; nested cross-context
  // z-index requires rejection rather than silently hiding confirmed text.
  const paintKey=node=>{if(node.nodeType!==Node.ELEMENT_NODE)return [1,0];const s=getComputedStyle(node),z=Number.parseInt(activeZ(node))||0;return z<0?[0,z]:z>0?[3,z]:s.position!=='static'||activeZ(node)!=='auto'?[2,0]:[1,0];};
  children.sort((a,b)=>{const x=paintKey(a),y=paintKey(b);return x[0]-y[0]||x[1]-y[1];});
  for(const child of children){if(child.nodeType===Node.TEXT_NODE)text(child);else if(child.nodeType===Node.ELEMENT_NODE)walk(child);}
 }
 walk(document.body);return {width:1280,height:720,objects,warnings:[...new Set(warnings)]};
}
module.exports=extractScene;
