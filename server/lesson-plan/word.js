'use strict';
const fs=require('node:fs'),path=require('node:path');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// Rebuild authored content; never copy sample paragraphs, comments, links or metadata.
async function exportDocx(plan,title,{templateBuffer}={},io){
 const {ZIP,openPackage,readEntry,parse,descendants,content,local,esc}=io;
 const source=await openPackage(templateBuffer||fs.readFileSync(path.join(__dirname,'assets/default-template.docx'))),budget={bytes:0};
 const tree=parse(await readEntry(source,'word/document.xml',budget)),bodyNode=descendants(tree,'body')[0];
 if(!bodyNode)throw Error('模板缺少正文。');
 const child=(n,name)=>n?.children.find(c=>local(c)===name),children=(n,name)=>n?.children.filter(c=>local(c)===name)||[];
 const attr=(n,name)=>n?.attrs['w:'+name];
 const number=(n,name,fallback)=>{const value=attr(n,name);return value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):fallback;};
 const nodeXML=n=>n?`<${n.name}${Object.entries(n.attrs).map(([k,v])=>` ${k}="${esc(v)}"`).join('')}>${esc(n.value||'')}${n.children.map(nodeXML).join('')}</${n.name}>`:'';
 const selected=(n,names)=>n?.children.filter(c=>names.includes(local(c))).map(nodeXML).join('')||'';
 const pStyle=p=>attr(child(child(p,'pPr'),'pStyle'),'val');
 const paragraphs=children(bodyNode,'p'),numbered=paragraphs.some(p=>/^[一二三四五六七八九十百]+[、.．]/.test(content(p)));
 const isChapter=p=>/^[一二三四五六七八九十百]+[、.．]/.test(content(p))||(!numbered&&/^(Heading1|1|标题1)$/i.test(pStyle(p)||''));
 const chapter=paragraphs.find(isChapter);
 const headingStyle=pStyle(chapter)||'Heading2',titleStyle=pStyle(paragraphs[0])||'Heading1';
 const section=descendants(tree,'sectPr').at(-1),size=child(section,'pgSz'),margins=child(section,'pgMar');
 const pageWidth=number(size,'w',11906),pageHeight=number(size,'h',16838);
 const usableWidth=pageWidth-number(margins,'left',1800)-number(margins,'right',1800);
 const usableHeight=pageHeight-number(margins,'top',1440)-number(margins,'bottom',1440);
 // Match inspectTemplate: cover tables before the first recognized chapter are not lesson blocks.
 const tableSources=[];let inChapter=false,tableIndex=0;
 for(const node of bodyNode.children){if(local(node)==='p'&&isChapter(node))inChapter=true;else if(local(node)==='tbl'&&inChapter)tableSources.push(node);}
 const z=new ZIP(),parts=[],relations=[];
 for(const [file,type,relation] of [
  ['word/styles.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml','styles'],
  ['word/numbering.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml','numbering'],
  ['word/theme/theme1.xml','application/vnd.openxmlformats-officedocument.theme+xml','theme']
 ])if(source.file(file)){const xml=await readEntry(source,file,budget);parse(xml);z.file(file,xml);parts.push([file,type]);relations.push([relation,file.slice(5),relation]);}
 let styles=z.file('word/styles.xml')?await z.file('word/styles.xml').async('string'):`<w:styles xmlns:w="${W}"></w:styles>`;
 // Templates without explicit body defaults still need deterministic, portable text.
 if(!/<w:docDefaults[\s>]/.test(styles))styles=styles.replace(/(<w:styles\b[^>]*>)/,'$1<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>');
 const styleIds=new Set(descendants(parse(styles),'style').map(n=>attr(n,'styleId')));
 const fallback=[['Normal',''],['Heading1','<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2F5496"/><w:sz w:val="56"/></w:rPr>'],['Heading2','<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2F5496"/><w:sz w:val="44"/></w:rPr>'],['Heading3','<w:pPr><w:keepNext/><w:spacing w:before="180" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="32"/></w:rPr>'],['ListParagraph',''],['Code','<w:pPr><w:shd w:fill="F0F0F0"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr>']];
 styles=styles.replace('</w:styles>',fallback.filter(([id])=>!styleIds.has(id)).map(([id,properties])=>`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/>${id==='Normal'?'':'<w:basedOn w:val="Normal"/>'}${properties}</w:style>`).join('')+'</w:styles>');
 z.file('word/styles.xml',styles);if(!parts.some(([p])=>p==='word/styles.xml')){parts.push(['word/styles.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml']);relations.push(['styles','styles.xml','styles']);}

 function paragraph(value,{style='Normal',bold=false,keep=false,cell=false,sample,list=false,chapter=false,muted=false}={}){
  const sampleP=child(sample,'p'),sourcePPr=child(sampleP,'pPr'),sourceRPr=child(child(sampleP,'r'),'rPr');
  const sampleStyle=attr(child(sourcePPr,'pStyle'),'val');
  const spacing=child(sourcePPr,'spacing')?nodeXML(child(sourcePPr,'spacing')):cell?'<w:spacing w:after="60" w:line="260" w:lineRule="auto"/>':'';
  const listTab=cell?480:1080;
  const pPr=`<w:pStyle w:val="${esc(sampleStyle||style)}"/>${keep?'<w:keepNext/>':''}${list?`<w:tabs><w:tab w:val="left" w:pos="${listTab}"/></w:tabs>`:''}${spacing}${list?`<w:ind w:left="${listTab}" w:hanging="${cell?240:360}"/>`:selected(sourcePPr,['ind','jc'])}`;
  const properties=emphasis=>['rFonts','b','i','color','sz','szCs','lang'].map(name=>name==='b'&&emphasis?'<w:b/>':nodeXML(child(sourceRPr,name))).join('');
  const rPr=chapter?'<w:rFonts w:ascii="DengXian" w:hAnsi="DengXian" w:eastAsia="等线" w:hint="eastAsia"/><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/>':muted?'<w:rFonts w:ascii="DengXian" w:hAnsi="DengXian" w:eastAsia="等线"/><w:color w:val="7F8C9B"/><w:sz w:val="20"/>':properties(bold);
  const text=list?String(value).replace(/^(\s*(?:[•●·]|\d{1,2}(?:[）)、]|[.．](?=\s))|[（(]\d{1,2}[）)]|[①②③④⑤⑥⑦⑧⑨⑩]))[ \t]*/,'$1\t'):String(value),lead=!bold&&style!=='Code'&&text.match(/^(要求|提交要求|评价要点|评价标准)[：:]/);
  const run=(v,properties)=>`<w:r><w:rPr>${properties}</w:rPr>${v.split('\n').map((line,i)=>(i?'<w:br/>':'')+line.split('\t').map((part,k)=>(k?'<w:tab/>':'')+`<w:t xml:space="preserve">${esc(part)}</w:t>`).join('')).join('')}</w:r>`;
  return `<w:p><w:pPr>${pPr}</w:pPr>${lead?run(lead[0],properties(true))+run(text.slice(lead[0].length),rPr):run(text,rPr)}</w:p>`;
 }
 function isCode(text){
  if(/`|(^|\n)\s*(?:\/\/|#|\/\*|--|def\s|class\s|for\s.+:|if\s.+:|import\s|from\s|(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*\s*\(|(?:const|let|var|function|return|echo|SELECT|INSERT|UPDATE|DELETE)\s|[A-Za-z_]\w*\s*=)/m.test(text))return true;
  let quote='';for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='\n')return true;if(c==='\\')i++;else if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;}return false;
 }
 function splitProse(value){
  const text=String(value).replace(/\r\n?/g,'\n');if(isCode(text))return [{text,code:true}];
  return text.split('\n').filter(line=>line.trim()).map(text=>({text}));
 }
 function prose(value,options={}){
  const lines=splitProse(value);if(!lines.length)return paragraph('',options);
  return lines.map(({text,code})=>{
   if(code)return paragraph(text,{...options,style:'Code',sample:null});
   const heading=!options.cell&&text.match(/^((?:课堂讨论与检测|课后实践与评价|教师准备|学生准备|环境检查|分组|安全与规范|材料准备|设备准备|场地准备|必做[一二三四五六七八九十\d]*|选做|思考题?)(?:[（(][^）)\n]{0,80}[）)])?[：:])/);
   if(heading)return paragraph(heading[1],{style:'Heading3',keep:true})+(text.slice(heading[1].length).trim()?paragraph(text.slice(heading[1].length).trim(),{...options,style:/^\d+[）)、]/.test(text.slice(heading[1].length).trim())?'ListParagraph':'Normal',list:/^\d+[）)、]/.test(text.slice(heading[1].length).trim())}):'');
   const list=/^(?:[•●·]|\d{1,2}(?:[）)、]|[.．](?=\s))|[（(]\d{1,2}[）)]|[①②③④⑤⑥⑦⑧⑨⑩])/.test(text);
   return paragraph(text,{...options,style:list?'ListParagraph':'Normal',list});
  }).join('');
 }
 function table(block){
  const original=tableSources[tableIndex++],properties=child(original,'tblPr'),sourceGrid=children(child(original,'tblGrid'),'gridCol').map(n=>Number(attr(n,'w'))||1),rows=children(original,'tr');
  const originalWidth=Number(attr(child(properties,'tblW'),'w')),width=Math.max(500,Math.min(usableWidth,originalWidth>0&&attr(child(properties,'tblW'),'type')==='dxa'?originalWidth:usableWidth));
  const sourceHeaders=children(rows[0],'tc').map(content),average=sourceGrid.length?sourceGrid.reduce((a,b)=>a+b,0)/sourceGrid.length:1;
  const weights=sourceGrid.length===block.headers.length?sourceGrid:block.headers.map(h=>sourceGrid[sourceHeaders.indexOf(h)]||average),sum=weights.reduce((a,b)=>a+b,0),grid=weights.map(w=>Math.floor(width*w/sum));grid[grid.length-1]+=width-grid.reduce((a,b)=>a+b,0);
  const hasStyle=Boolean(child(properties,'tblStyle'));
  const borders=child(properties,'tblBorders')?nodeXML(child(properties,'tblBorders')):hasStyle?'':`<w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(x=>`<w:${x} w:val="single" w:sz="4" w:color="BFBFBF"/>`).join('')}</w:tblBorders>`;
  const margins=child(properties,'tblCellMar')?nodeXML(child(properties,'tblCellMar')):hasStyle?'':'<w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>';
  let xml=`<w:tbl><w:tblPr>${selected(properties,['tblStyle'])}<w:tblW w:w="${width}" w:type="dxa"/>${selected(properties,['jc','tblInd'])}${borders}<w:tblLayout w:type="fixed"/>${margins}${selected(properties,['tblLook'])}</w:tblPr><w:tblGrid>${grid.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  [block.headers,...block.rows].forEach((row,k)=>{
   // A long row must be allowed to continue, while ordinary rows stay together.
   const estimatedHeight=Math.max(...row.map((c,l)=>{const units=[...String(c)].reduce((n,ch)=>n+(ch.charCodeAt(0)>255?1:.55),0);return (Math.ceil(units/Math.max(1,(grid[l]-160)/220))+String(c).split('\n').length-1)*260+140;}));
   xml+=`<w:tr><w:trPr>${estimatedHeight<usableHeight*.7?'<w:cantSplit/>':''}${k===0?'<w:tblHeader/>':''}</w:trPr>`;
   row.forEach((value,l)=>{const sample=children(rows[k===0?0:1],'tc')[l],tcPr=child(sample,'tcPr');xml+=`<w:tc><w:tcPr><w:tcW w:w="${grid[l]}" w:type="dxa"/>${nodeXML(child(tcPr,'shd'))||(k===0&&!hasStyle?'<w:shd w:fill="D9E2F3"/>':'')}${nodeXML(child(tcPr,'tcMar'))}${nodeXML(child(tcPr,'vAlign'))||(!hasStyle?'<w:vAlign w:val="top"/>':'')}</w:tcPr>${k===0?paragraph(value,{bold:!hasStyle,keep:true,cell:true,sample}):prose(value,{cell:true,sample})}</w:tc>`;});xml+='</w:tr>';
  });return xml+'</w:tbl>'+paragraph('');
 }
 let body=paragraph(title,{style:titleStyle,keep:true});
 const basic=Object.fromEntries(plan.sections.find(s=>/课程基本信息/.test(s.title))?.blocks.find(b=>b.type==='table'&&b.headers.join('/')==='项目/内容')?.rows||[]),summary=[plan.summary?.lessonType?'课型：'+plan.summary.lessonType:'',basic['课时安排']&&!/待教师|待核对|待填写/.test(basic['课时安排'])?'课时：'+basic['课时安排']:'',plan.summary?.previousTopic?'衔接：'+plan.summary.previousTopic:''].filter(Boolean).join('　｜　');
 if(summary)body+=paragraph(summary,{muted:true,keep:true});
 for(const section of plan.sections){
  body+=paragraph(section.title,{style:headingStyle,keep:true,chapter:true});
  for(const [index,block] of section.blocks.entries()){
   if(block.type==='table')body+=(/教学重点与难点/.test(section.title)&&!section.blocks.some(b=>/难点与突破策略/.test(b.label||''))?paragraph('难点与突破策略',{style:'Heading3',keep:true}):'')+table(block);
   else if(/学情分析/.test(section.title)&&['已有基础','困难','诊断','支持'].includes(block.label))body+=paragraph(`• ${block.label}：${block.text}`,{style:'ListParagraph',list:true});
   else {const label=/教学目标/.test(section.title)?`${index+1}. ${(block.label||'').replace(/^\d+[.．、]\s*/,'')}`:block.label;body+=(label?paragraph(label,{style:'Heading3',keep:true}):'')+prose(block.text);}
  }
 }
 body+=`<w:sectPr><w:footerReference w:type="default" r:id="footer"/>${size?nodeXML(size):'<w:pgSz w:w="11906" w:h="16838"/>'}${margins?nodeXML(margins):'<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="720" w:footer="720"/>'}${selected(section,['cols','docGrid'])}</w:sectPr>`;
 z.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}</w:body></w:document>`);
 z.file('word/footer1.xml',`<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="${W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="667085"/></w:rPr><w:t xml:space="preserve">第 </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> 页</w:t></w:r></w:p></w:ftr>`);parts.push(['word/footer1.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml']);relations.push(['footer','footer1.xml','footer']);
 z.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations.map(([id,target,type])=>`<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`).join('')}</Relationships>`);
 z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${parts.map(([part,type])=>`<Override PartName="/${part}" ContentType="${type}"/>`).join('')}</Types>`);
 z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`);
 return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
module.exports={exportDocx};
