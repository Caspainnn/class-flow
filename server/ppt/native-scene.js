// Browser layout -> editable text/rectangles; complex SVG fragments stay images.
function extractScene() {
 const objects=[],warnings=[];
 const box=r=>({x:r.left,y:r.top,w:r.width,h:r.height});
 const visible=(r)=>r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<1280&&r.top<720;
 const painted=c=>c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)';
 const activeZ=el=>{const s=getComputedStyle(el),p=el.parentElement&&getComputedStyle(el.parentElement);return s.position!=='static'||p&&/flex|grid/.test(p.display)?s.zIndex:'auto';};
 function text(node){
  const parent=node.parentElement,s=getComputedStyle(parent);let current=null;
  for(let offset=0;offset<node.length;){
   const value=String.fromCodePoint(node.data.codePointAt(offset)),range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+value.length);offset+=value.length;
   const r=range.getBoundingClientRect();if(!visible(r)||(!value.trim()&&!current))continue;
   if(current&&Math.abs(current.y-r.top)<1&&Math.abs(current.x+current.w-r.left)<2){current.text+=value;current.w=r.right-current.x;continue;}
   current={kind:'text',...box(r),text:value,font:s.fontFamily,size:parseFloat(s.fontSize),weight:s.fontWeight,color:s.color,italic:s.fontStyle==='italic',decoration:s.textDecorationLine};objects.push(current);
  }
 }
 function walk(el){
  const s=getComputedStyle(el),r=el.getBoundingClientRect();if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||!visible(r))return;
  if(el.tagName==='SCRIPT'||el.tagName==='STYLE'||el.tagName==='HEAD')return;
  if(activeZ(el)!=='auto'&&el.parentElement&&el.parentElement!==document.body){const parent=getComputedStyle(el.parentElement);if(activeZ(el.parentElement)==='auto'&&parent.transform==='none'&&Number(parent.opacity)===1&&parent.isolation!=='isolate')throw Error('此页使用跨容器叠放层级，请简化层级后再导出。');}
  if(el.tagName.toLowerCase()==='svg'){objects.push({kind:'raster',...box(r),reason:'inline SVG diagram'});return;}
  if(el.tagName==='IMG'){
   const src=el.currentSrc||el.src;if(!el.naturalWidth||!el.naturalHeight)throw Error('课件中存在无法读取的图片。');
   if(/^data:image\/svg\+xml/i.test(src)){objects.push({kind:'raster',...box(r),reason:'SVG image'});return;}
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
  if(painted(s.backgroundColor)||s.backgroundImage!=='none')objects.push({kind:'rect',...box(r),color:s.backgroundColor,gradient:s.backgroundImage,radius:parseFloat(s.borderRadius)||0});
  if(s.boxShadow!=='none')warnings.push('CSS shadow omitted');
  if(s.backgroundImage.includes('url('))throw Error('存在暂不支持的背景图片，请将其改为普通图片后导出。');
  for(const [side,points] of Object.entries({Top:[r.left,r.top,r.right,r.top],Bottom:[r.left,r.bottom,r.right,r.bottom],Left:[r.left,r.top,r.left,r.bottom],Right:[r.right,r.top,r.right,r.bottom]})){
   const width=parseFloat(s['border'+side+'Width']);if(width&&s['border'+side+'Style']!=='none')objects.push({kind:'line',points,color:s['border'+side+'Color'],width});
  }
  // Bullet/accent pseudo-elements in the current HTML use fixed px positions.
  for(const pseudo of ['::before','::after']){const p=getComputedStyle(el,pseudo);if(p.content==='none'||p.content==='normal'||p.display==='none')continue;
   if(p.content==='""'&&p.position==='absolute'&&parseFloat(p.width)>0&&parseFloat(p.height)>0&&painted(p.backgroundColor))objects.push({kind:'rect',x:r.left+(parseFloat(p.left)||0),y:r.top+(parseFloat(p.top)||0),w:parseFloat(p.width),h:parseFloat(p.height),color:p.backgroundColor,radius:parseFloat(p.borderRadius)||0});
   else if(['"▪"','"•"','"●"'].includes(p.content)&&p.position==='absolute'){const size=parseFloat(p.fontSize);objects.push({kind:'rect',x:r.left+(parseFloat(p.left)||0),y:r.top+(parseFloat(p.top)||0)+size*.45,w:size*.25,h:size*.25,color:p.color,radius:p.content==='"▪"'?0:size});}
   else throw Error('此页含尚未支持的自动编号或伪元素内容，请改成普通文字后再导出。');
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
