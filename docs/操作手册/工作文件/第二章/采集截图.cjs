const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1105-1297-0_26.1105.1297.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
const origin='http://manual.test',out=path.join(__dirname,'原始截图');
const courses=[{id:'demo',name:'示例课程',students:28,warn:2}];
const sessions=[{courseId:'demo',date:'2026-11-03',total:28,present:25,late:1,answered:20,correct:16},{courseId:'demo',date:'2026-11-06',total:28,present:27,late:2,answered:24,correct:21}];
const data={options:{courses,terms:['2026 秋季']},range:{from:'2026-10-09',to:'2026-11-07'},generatedAt:Date.now(),courses,sessions,trend:sessions,
homework:[{name:'示例作业',scored:24,total:28,missing:1,pending:2,abnormal:1,mean:86,href:'/homework?id=demo'}],
surveys:[{courseId:'demo',name:'课堂反馈示例',mode:'named',count:23,totalCount:23,target:28,status:'回收中',href:'/questionnaires'}],
resources:[{type:'PPT',name:'示例课件',status:'已完成',href:'/preparation?type=ppt'},{type:'教案',name:'示例教案',status:'已完成',href:'/preparation?type=plan'}],templateCounts:{ppt:3,plan:2},
tasks:[{kind:'amber',title:'示例作业待录分',sub:'4 人尚未录分',href:'/homework?id=demo'},{kind:'red',title:'学情关注',sub:'2 人次需要关注',href:'/xueqing?tab=warn'}]};
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:1350,height:1000},timezoneId:'Asia/Shanghai'});
const root=path.resolve(__dirname,'../../../../server');
await page.route('**/*',async r=>{
const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();
if(u.pathname==='/api/dashboard')return r.fulfill({json:{...data,range:{from:u.searchParams.get('from')||data.range.from,to:u.searchParams.get('to')||data.range.to}}});
if(u.pathname.startsWith('/api/'))return r.fulfill({json:{}});
const frame=r.request().frame().parentFrame();
const name=u.pathname==='/dashboard'?(frame?'dashboard/public/index.html':'public/workspace.html'):u.pathname.slice(1);
const file=[name,'public/'+name,'dashboard/public/'+path.basename(name)].map(n=>path.join(root,n)).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
return file?r.fulfill({path:file}):r.abort();
});
await page.goto(origin+'/dashboard');
const p=page.frameLocator('#workspaceFrame');
await p.locator('.stat').first().waitFor();
const items=[];
async function shot(name,region,selectors){
 const loc=p.locator(region).first();await loc.scrollIntoViewIfNeeded();const clip=await loc.boundingBox();
 const boxes=[];for(const sel of selectors){const b=await p.locator(sel).first().boundingBox();if(!b)throw Error(sel);boxes.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}
 await loc.screenshot({path:path.join(out,name+'.png')});items.push({name,boxes,redact:[]});
}
await p.locator('#period').selectOption('custom');
await p.locator('#refresh').and(p.locator(':enabled')).waitFor();
await shot('01-筛选','.filters',['#course','#term','#period','#customDates']);
await shot('02-指标','.stats',['.stat:nth-child(1)','.stat:nth-child(2)','.stat:nth-child(3)','.stat:nth-child(4)','.stat:nth-child(5)','.stat:nth-child(6)']);
await shot('03-课堂','#classroom .panel',['#classroom .inline-kpis','#classroom .legend','#classroom .chart']);
await shot('04-待办','#tasks .panel',['#tasks .todo:nth-of-type(1)','#tasks .todo:nth-of-type(2)']);
await shot('05-作业','#homework .panel',['#homework .inline-kpis','#homework .table-wrap']);
await shot('06-问卷','#survey .panel',['#survey .inline-kpis','#survey .table-wrap']);
await shot('07-课程','#courses .panel',['#courses .text-button','#courses .table-wrap']);
await shot('08-备课','#resources .panel',['#resources .inline-kpis','#resources .resource-line'].slice(0,2));
fs.writeFileSync(path.join(__dirname,'截图坐标.json'),JSON.stringify({items},null,2));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
