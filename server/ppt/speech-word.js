'use strict';
const ZIP=require('jszip');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const esc=value=>String(value).replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

module.exports=async function speechWord(manuscript){
 const zip=new ZIP();
 const body=manuscript.replace(/\r\n?/g,'\n').split('\n').map(line=>{
  const heading=line.match(/^(#{1,2})\s+(.*)$/),text=heading?heading[2]:line;
  return `<w:p><w:pPr>${heading?'<w:keepNext/>':''}<w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体"/>${heading?`<w:b/><w:color w:val="185FA5"/><w:sz w:val="${heading[1].length===1?32:28}"/>`:'<w:sz w:val="24"/>'}</w:rPr>${text.split('\t').map((part,i)=>(i?'<w:tab/>':'')+`<w:t xml:space="preserve">${esc(part)}</w:t>`).join('')}</w:r></w:p>`;
 }).join('');
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
};
