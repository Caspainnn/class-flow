// Throwaway export spike: browser layout -> editable text/rectangles; SVG stays an image.
function extractScene() {
 const objects=[],warnings=[];
 const box=r=>({x:r.left,y:r.top,w:r.width,h:r.height});
 const visible=(r)=>r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<1280&&r.top<720;
 const painted=c=>c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)';
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
  if(el.tagName.toLowerCase()==='svg'){objects.push({kind:'raster',...box(r),reason:'inline SVG diagram'});return;}
  if(el.tagName==='IMG'){objects.push({kind:'image',...box(r),src:el.currentSrc||el.src});return;}
  if(painted(s.backgroundColor)||s.backgroundImage!=='none')objects.push({kind:'rect',...box(r),color:s.backgroundColor,gradient:s.backgroundImage,radius:parseFloat(s.borderRadius)||0});
  if(s.boxShadow!=='none')warnings.push('CSS shadow omitted');
  for(const [side,points] of Object.entries({Top:[r.left,r.top,r.right,r.top],Bottom:[r.left,r.bottom,r.right,r.bottom],Left:[r.left,r.top,r.left,r.bottom],Right:[r.right,r.top,r.right,r.bottom]})){
   const width=parseFloat(s['border'+side+'Width']);if(width&&s['border'+side+'Style']!=='none')objects.push({kind:'line',points,color:s['border'+side+'Color'],width});
  }
  // Bullet/accent pseudo-elements in the current HTML use fixed px positions.
  for(const pseudo of ['::before','::after']){const p=getComputedStyle(el,pseudo);if(p.content==='none'||p.content==='normal'||p.display==='none')continue;
   if(p.content==='""'&&p.position==='absolute'&&parseFloat(p.width)>0&&parseFloat(p.height)>0&&painted(p.backgroundColor))objects.push({kind:'rect',x:r.left+(parseFloat(p.left)||0),y:r.top+(parseFloat(p.top)||0),w:parseFloat(p.width),h:parseFloat(p.height),color:p.backgroundColor,radius:parseFloat(p.borderRadius)||0});
   else if(['"▪"','"•"','"●"'].includes(p.content)&&p.position==='absolute'){const size=parseFloat(p.fontSize);objects.push({kind:'rect',x:r.left+(parseFloat(p.left)||0),y:r.top+(parseFloat(p.top)||0)+size*.45,w:size*.25,h:size*.25,color:p.color,radius:p.content==='"▪"'?0:size});}
   else warnings.push('Unsupported pseudo-element: '+pseudo);
  }
  for(const child of el.childNodes){if(child.nodeType===Node.TEXT_NODE)text(child);else if(child.nodeType===Node.ELEMENT_NODE)walk(child);}
 }
 walk(document.body);return {width:1280,height:720,objects,warnings:[...new Set(warnings)]};
}
module.exports=extractScene;
