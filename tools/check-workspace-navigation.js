'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const parentLocation=new URL('http://localhost/grading?id=demo');
const events={},childEvents={},replaced=[],active=[],pushes=[];
let allowed=true;
const child={appCanNavigate:()=>allowed,location:{href:parentLocation.href,replace(url){this.href=url;replaced.push(url)}}};
const frame={contentWindow:child,contentDocument:{title:'自动批改',addEventListener:(type,fn)=>childEvents[type]=fn},addEventListener:(type,fn)=>events['frame:'+type]=fn};
const mobile={options:[{value:'/'},{value:'/grading'},{value:'/homework'}],value:''};
const ctx=vm.createContext({URL,location:parentLocation,document:{getElementById:id=>id==='workspaceFrame'?frame:mobile,addEventListener:(type,fn)=>events[type]=fn},history:{pushState(a,b,url){pushes.push(url);parentLocation.href=url},replaceState(a,b,url){parentLocation.href=url}},window:{updateShellActive:key=>active.push(key),addEventListener:(type,fn)=>events[type]=fn}});
vm.runInContext(fs.readFileSync('server/public/workspace.js','utf8'),ctx);
assert.equal(frame.src,'http://localhost/grading?id=demo');
function click(href,options={}){
 let prevented=false;const a={href,target:'',hasAttribute:()=>false,...options};
 events.click({button:0,target:{closest:()=>a},currentTarget:{location:parentLocation},preventDefault(){prevented=true}});return prevented;
}
assert(click('http://localhost/homework'));assert.equal(replaced.at(-1),'http://localhost/homework');assert.equal(active.at(-1),'hw-list');assert.equal(pushes.length,1);
allowed=false;click('http://localhost/courses');assert.equal(replaced.length,1,'unsaved changes block leaving content');
allowed=true;assert(!click('http://localhost/api/export.xlsx?courseId=c1'));assert(!click('https://other.example/'));
assert(!click('http://localhost/grading',{target:'_blank'}));
events['frame:load']();assert.equal(ctx.document.title,'自动批改');assert(childEvents.click,'content links are intercepted too');
ctx.window.workspaceLocationChanged('http://localhost/courses#edit/demo');assert.equal(parentLocation.hash,'#edit/demo');assert.equal(active.at(-1),'course');
parentLocation.href='http://localhost/session?tab=records';events.popstate();assert.equal(replaced.at(-1),'http://localhost/session?tab=records');assert.equal(active.at(-1),'session');
console.log('PASS: stable workspace navigation, active state, query/hash, back navigation, unsaved guard, exports/external links untouched');
