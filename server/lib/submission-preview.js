'use strict';
const path = require('path');
const JSZip = require('jszip');
const decode = s => s.replace(/&#(x[0-9a-f]+|\d+);|&(lt|gt|amp|quot|apos);/gi, (_,n,key) => {
  if (n) { const code = n[0].toLowerCase()==='x' ? parseInt(n.slice(1),16) : Number(n); return code<=0x10ffff ? String.fromCodePoint(code) : ''; }
  return {lt:'<',gt:'>',amp:'&',quot:'"',apos:"'"}[key.toLowerCase()];
});
module.exports = async (name, buffer) => {
  const ext = path.extname(name).toLowerCase();
  if (['.txt','.md'].includes(ext)) return {text:buffer.toString('utf8'),kind:'text'};
  if (ext!=='.docx') throw new Error('此格式暂不支持在线预览，请下载原件查看');
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('Word 文件缺少正文，无法预览');
  if (entry._data && entry._data.uncompressedSize > 10*1024*1024) throw new Error('Word 正文过大，请下载查看');
  const xml = await entry.async('string');
  const text = xml.replace(/<w:tab\b[^>]*\/?\s*>/g,'\t').replace(/<w:(?:br|cr)\b[^>]*\/?\s*>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<\/w:tc>/g,'\t').replace(/<[^>]*>/g,'');
  return {text:decode(text).trim(),kind:'docx',note:'Word 正文预览，图片、公式对象和版式请下载原件核对。'};
};
