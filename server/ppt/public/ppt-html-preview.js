'use strict';
window.PptHtmlPreview={async mount(frame,status){
 const policy="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 try{
  const response=await fetch(frame.dataset.htmlUrl,{cache:'no-store'});if(!response.ok)throw new Error('课件页面读取失败，请重新选择这一页重试。');
  const html=await response.text();if(!frame.isConnected)return;
  const doc=new DOMParser().parseFromString(html,'text/html'),meta=doc.createElement('meta');meta.setAttribute('http-equiv','Content-Security-Policy');meta.setAttribute('content',policy);doc.head.prepend(meta);
  frame.onload=()=>{if(frame.isConnected)status.hidden=true;};frame.srcdoc='<!DOCTYPE html>'+doc.documentElement.outerHTML;
 }catch(error){if(frame.isConnected){status.textContent=error.message;status.classList.add('error-text');}}
}};
