'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1104-1290-0_26.1104.1290.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const {chromium}=require(runtime+'/playwright');
const root=path.resolve(__dirname,'../../../..');
const out=path.join(__dirname,'原始截图');fs.mkdirSync(out,{recursive:true});
const data=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-ch9-manual-'));
const save=(key,value)=>fs.writeFileSync(path.join(data,key+'.json'),JSON.stringify(value));
const now=Date.now();
save('courses',[{id:'manual-settings-course',name:'设置示例课程',term:'2026秋'}]);
save('students',[{id:'20269001',name:'示例甲',courseId:'manual-settings-course'},{id:'20269002',name:'示例乙',courseId:'manual-settings-course'}]);
save('sessions',[]);save('homework',[]);save('gradebatches',[]);save('questionnaires',{version:1,revision:0,surveys:[]});
save('settings',{codeRefreshMs:3000,tokenGrace:3,windowMs:90000,lateGraceMs:600000,ticketTtlMs:120000,xqRules:{absenceRun:2,corLastN:5,corMinAns:3,corRate:60,hwMiss:2,hwLow:2,hwLowScore:60},workbuddy:{enabled:true,path:'C:/Example/WorkBuddy/codebuddy',version:'1.8.2',model:'default',timeoutMs:60000,background:true,noHistory:true,keepRaw:false,verifiedAt:now,lastError:null}});
const port=31991,origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,[path.join(root,'server/server.js')],{cwd:root,env:{...process.env,DATA_DIR:data,HOST:'127.0.0.1',PORT:String(port)},windowsHide:true,stdio:'pipe'});
let logs='';child.stderr.on('data',b=>logs+=b);child.stdout.on('data',b=>logs+=b);
const manifest=[];let browser;
async function shot(page,name,region,targets,sensitive=[]){
 const loc=page.locator(region);await loc.scrollIntoViewIfNeeded();const clip=await loc.boundingBox();if(!clip)throw Error('Missing region '+region);
 const boxes=[];for(const sel of targets){const b=await page.locator(sel).first().boundingBox();if(!b)throw Error('Missing '+sel);boxes.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}
 const redact=[];for(const sel of sensitive){for(const el of await page.locator(sel).all()){const b=await el.boundingBox();if(b)redact.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}}
 await (page.page?page.page():page).screenshot({path:path.join(out,name+'.png'),clip});manifest.push({name,boxes,redact});
}
async function pageAt(url,width=1220,height=920){const shell=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});shell.on('pageerror',e=>logs+='\nPAGE '+e.stack);await shell.goto(origin+url);await shell.locator('#workspaceFrame').waitFor();const handle=await shell.locator('#workspaceFrame').elementHandle();const frame=await handle.contentFrame();if(!frame)throw Error('workspace iframe missing');return frame;}
const baseState={
 counts:{courses:4,students:126,sessions:38,homework:17,ppt:12,plan:9,surveys:6,responses:214},files:486,totalBytes:84213760,
 parts:{ppt:25165824,grading:31457280,plan:15728640,other:11993016},busy:[],maintenance:false,current:null,
 dataPath:'D:/Inclass/示例教学数据',backupPath:'D:/Inclass/示例备份',
 records:[{id:'aaaaaaaaaaaaaaaaaaaaaaaa',name:'完整备份-20261106-1430',createdAt:now-3600000,bytes:38797312,type:'manual',formatVersion:1,counts:{courses:4,students:126,sessions:38,homework:17,ppt:12,plan:9,surveys:6,responses:214}}]
};
const inspection={id:'bbbbbbbbbbbbbbbbbbbbbbbb',type:'inspect',status:'complete',name:'完整备份-20261106-1430.zip',bytes:38797312,requiredBytes:124780544,progress:100,stage:'检查完成',counts:{courses:4,students:126,sessions:38,homework:17,ppt:12,plan:9,surveys:6,responses:214},currentCounts:{courses:5,students:148,sessions:43,homework:21,ppt:13,plan:10,surveys:7,responses:248}};
(async()=>{try{
 for(let i=0;i<100;i++){try{const r=await fetch(origin+'/api/ping');if(r.ok)break;}catch{}if(i===99)throw Error(logs);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});

 let p=await pageAt('/workbuddy');await p.locator('#wstate').waitFor();
 await p.evaluate(()=>render({enabled:true,path:'C:/Example/WorkBuddy/resources/codebuddy',version:'1.8.2',model:'default',timeoutMs:60000,background:true,noHistory:true,keepRaw:false}));
 await shot(p,'01-连接状态','#wsec-link .card',['#wstate','#wPath'],['#wPath']);
 await p.evaluate(()=>{togglePathInput();document.getElementById('pathIn').value='C:/Example/WorkBuddy/resources/codebuddy';});
 await shot(p,'02-手动指定路径','#wsec-link .card',['#pathRow','.actions button:first-child'],['#pathIn']);
 await p.evaluate(()=>{document.getElementById('pathRow').style.display='none';render({enabled:false,path:'',version:'',model:'default',timeoutMs:60000,background:true,noHistory:true,keepRaw:false,lastError:'未检测到可用连接'});});
 await shot(p,'03-断开连接','#wsec-link .card',['#wstate','.actions button:last-child']);
 await p.evaluate(()=>{render({enabled:true,path:'C:/Example/WorkBuddy/resources/codebuddy',version:'1.8.2',model:'deep-model',timeoutMs:90000,background:true,noHistory:true,keepRaw:true});wsec('grade');document.getElementById('saveHint').textContent='已保存';});
 await shot(p,'04-批改参数','#wsec-grade .card',['#model','#timeout','#wsec-grade .opts','#wsec-grade .actions .btn']);await p.page().close();

 p=await pageAt('/admin?pane=set');await p.locator('#pane-set').waitFor();await p.waitForTimeout(400);
 await shot(p,'05-签到参数','#pane-set .card:nth-child(1)',['#setRefresh','#setGrace','#setWindow','#setLate','#setTicket','#saveSet']);
 await shot(p,'06-参数说明','#pane-set .card:nth-child(1)',['#setHint','#saveSet']);
 await shot(p,'07-数据目录','#data',['#setDataPath','#data .hint:nth-of-type(2)'],['#setDataPath']);
 await shot(p,'08-出勤预警','#rules fieldset:nth-of-type(1)',['#setAbsRun']);
 await shot(p,'09-答题预警','#rules fieldset:nth-of-type(2)',['#setCorN','#setCorMin','#setCorRate']);
 await shot(p,'10-作业预警','#rules fieldset:nth-of-type(3)',['#setHwMiss','#setHwLow','#setHwLowScore']);
 await p.evaluate(()=>{toast('预警规则已保存');const r=document.getElementById('rules'),t=document.getElementById('toast');r.style.position='relative';r.style.paddingBottom='58px';r.appendChild(t);t.style.position='absolute';t.style.bottom='12px';t.style.left='50%';t.style.opacity='1';});await shot(p,'11-保存预警','#rules',['#saveRules','#toast']);await p.page().close();

 p=await pageAt('/backup',1260,960);await p.locator('#view').waitFor();await p.waitForTimeout(300);
 await p.evaluate(s=>{state=s;step=0;operation=null;job=null;render();},baseState);
 await shot(p,'12-备份概况','#view',['.stats','.right .panel:last-child'],['.path code']);
 await shot(p,'13-创建备份','.left .panel:first-child',['.left .panel:first-child .scope','.left .panel:first-child .notice','.left .panel:first-child .row-actions']);
 await p.evaluate(()=>document.querySelector('[data-action="details"]').click());await p.locator('#dialog[open]').waitFor();
 await shot(p,'14-备份记录','#dialog',['#dialogBody','#dialogActions']);await p.evaluate(()=>document.getElementById('dialog').close());
 await p.evaluate(()=>{selection=null;inspection=null;checked=false;step=1;render();});
 await shot(p,'15-恢复来源','.workflow',['.steps','#upload','.step-actions']);
 await p.evaluate(x=>{selection={name:x.name,bytes:x.bytes};inspection=x;operation=null;step=2;render();},inspection);
 await shot(p,'16-检查内容','.workflow',['.file-info','.check-list','.table-wrap','.step-actions']);
 await p.evaluate(()=>{checked=true;step=3;render();});
 await shot(p,'17-确认范围','.workflow',['.notice.warn','.comparison','.check-label','.step-actions']);
 await p.evaluate(()=>{document.getElementById('ack').checked=true;checked=true;document.querySelector('[data-action="ask-restore"]').disabled=false;document.querySelector('[data-action="ask-restore"]').click();});await p.locator('#dialog[open]').waitFor();
 await shot(p,'18-恢复确认','#dialog',['#dialogBody','#dialogActions .danger']);await p.evaluate(()=>document.getElementById('dialog').close());
 await p.evaluate(()=>{step=4;operation='restore';job={id:'cccccccccccccccccccccccc',type:'restore',status:'running',stage:'正在替换教学数据并重启平台',progress:72};render();});
 await shot(p,'19-恢复进度','.workflow',['.result','.progress']);
 await p.evaluate(()=>{step=4;operation=null;job={id:'cccccccccccccccccccccccc',type:'restore',status:'complete',record:{id:'dddddddddddddddddddddddd'}};render();});
 await shot(p,'20-恢复结果','.workflow',['.workflow .result','.workflow .notice','.workflow .step-actions']);await p.page().close();

 fs.writeFileSync(path.join(__dirname,'截图坐标.json'),JSON.stringify({dataDirectory:data,origin,items:manifest},null,2));
 console.log(JSON.stringify({screenshots:manifest.length,dataDirectory:data}));
 }finally{if(browser)await browser.close();child.kill();}})().catch(e=>{console.error(e);console.error(logs);process.exitCode=1;});
