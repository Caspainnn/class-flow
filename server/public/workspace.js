'use strict';
(() => {
  const frame=document.getElementById('workspaceFrame'), mobile=document.getElementById('workspaceMobileNav');
  const pages=new Set(['/','/session','/compose','/live','/courses','/preparation','/homework','/grading','/workbuddy','/xueqing','/admin','/questionnaires','/dashboard','/backup']);
  const route=value=>{const u=new URL(value,location.href);if(u.pathname==='/admin'&&u.searchParams.get('pane')==='set'&&u.hash==='#data'){u.pathname='/backup';u.search='';u.hash='';}return u.origin===location.origin&&pages.has(u.pathname)?u:null;};
  let current=location.href;
  function activeFor(url){
    const p=url.pathname,q=url.searchParams;
    if(p==='/dashboard')return 'dashboard';
    if(p==='/backup')return 'backup';
    if(p==='/questionnaires')return 'xq-surveys';
    if(p==='/xueqing')return 'xq-'+(q.get('tab')||'warn');
    if(p==='/preparation')return q.get('type')==='plan'?'plan':'ppt';
    if(p==='/admin')return q.get('pane')==='course'?'course':url.hash==='#rules'?'rules':url.hash==='#data'?'backup':'sys';
    return {'/':'home','/session':'session','/compose':'session','/live':'session','/courses':'course','/homework':'hw-list','/grading':'gb','/workbuddy':'wb'}[p]||'home';
  }
  function sync(value){
    const url=route(value);if(!url)return;
    current=url.href;
    window.PptNotifications?.viewed(url.href);
    if(location.href!==current)history.replaceState(null,'',current);
    window.updateShellActive(activeFor(url));
    const option=Array.from(mobile.options).find(o=>activeFor(new URL(o.value,location.origin))===activeFor(url));
    if(option)mobile.value=option.value;
  }
  window.workspaceLocationChanged=sync;
  function canLeave(nextUrl){
    try{return frame.contentWindow.appCanNavigate?frame.contentWindow.appCanNavigate(nextUrl):true;}
    catch{return true;}
  }
  function navigate(value,push=true){
    const url=route(value);if(!url)return false;
    if(url.href===current)return true;
    if(!canLeave(url.href))return false;
    if(push)history.pushState(null,'',url.href);
    current=url.href;
    frame.contentWindow.location.replace(url.href);
    window.updateShellActive(activeFor(url));
    return true;
  }
  function intercept(event){
    const a=event.target.closest('a[href]');
    if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
    const url=route(a.href);if(!url)return;
    const from=new URL(event.currentTarget.location?.href||location.href);
    if(url.pathname===from.pathname&&url.search===from.search&&url.hash)return;
    event.preventDefault();navigate(url.href);
  }
  document.addEventListener('click',intercept);
  mobile.onchange=()=>{if(!navigate(mobile.value))sync(current);};
  frame.addEventListener('load',()=>{
    try {
      sync(frame.contentWindow.location.href);
      document.title=frame.contentDocument.title;
      frame.contentDocument.addEventListener('click',intercept);
    }catch{ /* A non-workspace document remains confined to the content frame. */ }
  });
  window.addEventListener('popstate',()=>{
    if(!canLeave(location.href)){history.pushState(null,'',current);return;}
    const url=route(location.href);if(url){current=url.href;frame.contentWindow.location.replace(url.href);window.updateShellActive(activeFor(url));}
  });
  sync(location.href);frame.src=current;
})();
