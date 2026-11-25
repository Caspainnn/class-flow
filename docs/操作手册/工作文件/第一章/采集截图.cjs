const fs=require('fs'), path=require('path');
const {chromium}=require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1105-1297-0_26.1105.1297.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'原始截图');
const origin='http://manual.test';
const now=Date.now(), courses=[{id:'demo-a',name:'示例课程 A',term:'2026 秋季'},{id:'demo-b',name:'示例课程 B',term:'2026 秋季'}];
const students=Array.from({length:52},(_,i)=>({courseId:i<28?'demo-a':'demo-b'}));
const sessions=[{id:'demo-session',courseId:'demo-a',startedAt:now-3600000,present:25,total:28,late:1,absent:3,rate:89,correctRate:80,question:'下列哪项属于课堂讨论的基本规则？'}];
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:1360,height:1000},timezoneId:'Asia/Shanghai'});
let empty=false;
await page.route('**/*',async r=>{
const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();
if(u.pathname==='/api/all')return r.fulfill({json:empty?{courses:[],students:[]}:{courses,students,active:'demo-session'}});
if(u.pathname==='/api/sessions')return r.fulfill({json:{sessions:empty?[]:sessions}});
if(u.pathname==='/api/xq/data')return r.fulfill({json:u.searchParams.get('courseId')==='demo-a'?{overall:{warns:1},students:[{name:'示例学生',warns:['出勤']}],homework:[{id:'demo-homework',name:'示例作业',sub:24,total:28}]}:{overall:{warns:0},students:[],homework:[]}});
if(u.pathname.startsWith('/api/'))return r.fulfill({json:{}});
const file=path.resolve(__dirname,'../../../../server/public','.'+(u.pathname==='/'?(r.request().frame().parentFrame()?'/home.html':'/workspace.html'):u.pathname));
if(fs.existsSync(file)&&fs.statSync(file).isFile())return r.fulfill({path:file});return r.abort();
});
const items=[];
async function open(){
 await page.goto(origin+'/');const frame=page.frameLocator('#workspaceFrame');await frame.locator('.stat').first().waitFor();return frame;
}
async function shot(p,name,region,selectors,redactions=[]){
 const loc=p.locator(region).first();await loc.scrollIntoViewIfNeeded();const clip=await loc.boundingBox();
 const rect=async s=>{const b=await p.locator(s).first().boundingBox();if(!b)throw Error(s);return [b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y];};
 const boxes=await Promise.all(selectors.map(rect)),redact=await Promise.all(redactions.map(rect));
 await loc.screenshot({path:path.join(out,name+'.png')});items.push({name,boxes,redact});
}
const p=await open();
await shot(page,'01-入口','.sh-nav',['[data-nav-key="home"]']);
await shot(p,'02-概览','#stats',['.stat:nth-child(1)','.stat:nth-child(2)','.stat:nth-child(3)','.stat:nth-child(4)']);
await shot(p,'03-待办','.home-todos',['.todo:nth-child(1)','.todo:nth-child(2)','.todo:nth-child(3)'],[]);
await shot(p,'04-点名','#lastCard',['#lastCard .more','.last-metrics','.last-question']);
await shot(p,'05-课程','.home-courses',['.crow:first-child .meta','.crow:first-child .btn']);
await shot(p,'06-常用功能','.card:has(.grid3)',['.fn:nth-child(1)','.fn:nth-child(2)','.fn:nth-child(3)','.fn:nth-child(7)']);
empty=true;const e=await open();
await shot(e,'07-首次使用','.home-columns',['.home-todos .empty','#last .empty','#courses .empty']);
fs.writeFileSync(path.join(__dirname,'截图坐标.json'),JSON.stringify({items},null,2));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
