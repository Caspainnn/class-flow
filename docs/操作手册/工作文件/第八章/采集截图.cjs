'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1104-1290-0_26.1104.1290.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const {chromium}=require(runtime+'/playwright');
const root=path.resolve(__dirname,'../../../..');
const out=path.join(__dirname,'原始截图');fs.mkdirSync(out,{recursive:true});
const data=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-ch8-manual-'));
const save=(key,value)=>fs.writeFileSync(path.join(data,key+'.json'),JSON.stringify(value));
const courseId='manual-hw-course',batchId='manual-grade-batch',hwManual='manual-score-homework',hwFile='manual-file-homework',now=Date.now();
const students=['示例甲','示例乙','示例丙','示例丁','示例戊','示例己'].map((name,i)=>({id:String(20268001+i),name,courseId}));
const ids=students.map(s=>s.id),score=(value,st='ok')=>({score:value,st,source:'manual'});
const homework=[
 {id:hwManual,courseId,name:'数据整理练习',due:'2026-11-12',mode:'manual',published:true,createdAt:now-86400000,scores:{[ids[0]]:score(88),[ids[1]]:score(76,'late'),[ids[2]]:score(91),[ids[4]]:score(64)}},
 {id:hwFile,courseId,name:'综合分析报告',due:'2026-11-18',mode:'file',published:false,createdAt:now,batchId,scores:{[ids[0]]:score(86),[ids[1]]:score(79,'late')}}
];
const questions=[
 {text:'说明数据清洗的主要步骤',points:30,rubric:'识别缺失值、重复值和异常值各6分；说明处理依据12分。'},
 {text:'完成描述统计并解释结果',points:35,rubric:'统计量计算正确20分；结合业务语境解释15分。'},
 {text:'提出可复现的分析结论',points:35,rubric:'结论与证据一致20分；说明限制和复现步骤15分。'}
];
const files=[
 {orig:ids[0]+'示例甲.txt',size:180,sid:ids[0],status:'matched',note:'文件名含学号+姓名'},
 {orig:ids[1]+'示例乙.txt',size:190,sid:ids[1],status:'matched',note:'文件名含学号+姓名'},
 {orig:'待确认报告.txt',size:170,sid:null,status:'pending',note:'文件名识别不出是谁'},
 {orig:ids[3]+'示例丁.txt',size:175,sid:ids[3],status:'matched',note:'文件名含学号+姓名'},
 {orig:ids[4]+'示例戊.txt',size:200,sid:ids[4],status:'matched',note:'文件名含学号+姓名'}
];
const result=(sid,total,parts,comment,extra={})=>({name:students.find(s=>s.id===sid).name,sid,total,items:parts.map((n,i)=>({score:n,max:questions[i].points,note:['步骤完整，异常值说明较清楚。','统计结果正确，解释可进一步联系场景。','结论有依据，复现步骤完整。'][i]})),comment,abnormal:'',source:'run',modified:false,...extra});
const results={
 [ids[0]]:result(ids[0],86,[27,30,29],'结构完整，统计解释清楚。'),
 [ids[1]]:result(ids[1],79,[24,29,26],'主要步骤正确，结论说明可更具体。',{modified:true,modifyReason:'复核原件后补回过程分'}),
 [ids[3]]:result(ids[3],92,[29,33,30],'论证充分，复现信息完整。'),
 [ids[4]]:result(ids[4],58,[18,22,18],'缺少异常值处理依据，结论与证据联系不足。')
};
const batch={id:batchId,hwId:hwFile,courseId,name:'综合分析报告',due:'2026-11-18',questions,pass:60,scale:'std',extra:'引用数据来源并保留处理过程。',createdAt:now,status:'done',files,results,runLog:['批改目录已准备','已完成 4 份作业批改'],dir:'prepared'};
save('courses',[{id:courseId,name:'作业管理示例课',term:'2026秋'}]);save('students',students);save('sessions',[]);save('homework',homework);save('gradebatches',[batch]);
save('settings',{workbuddy:{enabled:true,path:'C:/Example/WorkBuddy/codebuddy',version:'1.0',model:'default',timeoutMs:60000,background:true,noHistory:true,keepRaw:false,verifiedAt:now,lastError:null}});
save('questionnaires',{version:1,revision:0,surveys:[]});
const batchDir=path.join(data,'批改',batchId),finalDir=path.join(batchDir,'final');fs.mkdirSync(finalDir,{recursive:true});
for(const file of files)fs.writeFileSync(path.join(batchDir,file.orig),'数据分析作业\n\n本作业使用虚构数据说明数据清洗、统计解释和结论复现过程。\n\n1. 检查缺失值与重复值。\n2. 计算均值、中位数和离散程度。\n3. 结合限制说明结论。');
fs.writeFileSync(path.join(finalDir,'提示词-手动调用.txt'),'请逐份批改目录中的学生作业，依据评分标准生成作业批改结果.xlsx。');
const port=31858,origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,[path.join(root,'server/server.js')],{cwd:root,env:{...process.env,DATA_DIR:data,HOST:'127.0.0.1',PORT:String(port)},windowsHide:true,stdio:'pipe'});
let logs='';child.stderr.on('data',b=>logs+=b);child.stdout.on('data',b=>logs+=b);
const manifest=[];let browser;
async function shot(page,name,region,targets,sensitive=[]){
 const loc=page.locator(region);await loc.scrollIntoViewIfNeeded();const clip=await loc.boundingBox();if(!clip)throw Error('Missing region '+region);
 const boxes=[];for(const sel of targets){const b=await page.locator(sel).first().boundingBox();if(!b)throw Error('Missing '+sel);boxes.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}
 const redact=[];for(const sel of sensitive){for(const el of await page.locator(sel).all()){const b=await el.boundingBox();if(b)redact.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}}
 await (page.page?page.page():page).screenshot({path:path.join(out,name+'.png'),clip});manifest.push({name,boxes,redact});
}
async function inner(shell){await shell.locator('#workspaceFrame').waitFor();const handle=await shell.locator('#workspaceFrame').elementHandle();const frame=await handle.contentFrame();if(!frame)throw Error('workspace iframe missing');return frame;}
async function grading(){const shell=await browser.newPage({viewport:{width:1380,height:980},deviceScaleFactor:1});await shell.goto(origin+'/grading?id='+batchId);const p=await inner(shell);await p.locator('#currentBatch').waitFor();await p.locator('#workspaceMessage').waitFor({state:'hidden'});return p;}
(async()=>{try{
 for(let i=0;i<100;i++){try{const r=await fetch(origin+'/api/ping');if(r.ok)break;}catch{}if(i===99)throw Error(logs);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const shell=await browser.newPage({viewport:{width:1180,height:900},deviceScaleFactor:1});
 shell.on('pageerror',e=>{logs+='\nPAGE '+e.stack});shell.on('console',m=>{if(m.type()==='error')logs+='\nCONSOLE '+m.text()});shell.on('response',r=>{if(r.status()>=500)logs+='\nHTTP '+r.status()+' '+r.url()});
 const firstResponse=await shell.goto(origin+'/homework');if(!firstResponse||!firstResponse.ok())throw Error('homework '+(firstResponse&&firstResponse.status())+' '+await firstResponse.text().catch(()=>''));
 let p=await inner(shell);
 try{await p.locator('.hw-table').waitFor({timeout:15000});}catch(e){throw Error(e.message+'\nURL '+shell.url()+'\n'+await p.locator('#hwRoot').innerText().catch(()=>'(no root)')+'\n'+(await p.content()).slice(0,2000)+'\n'+logs);}
 await shot(p,'01-作业列表','.wrap',['#hwCourseFilter','.hw-table'],['#hwCourseFilter','.hw-table tbody td:first-child']);
 await p.locator('#hwNew').click();await p.locator('#hwCreateDialog').waitFor();
 await shot(p,'02-新建作业','#hwCreateDialog',['#hwCourse','#hwName','#hwDue','#hwCreate'],['#hwCourse']);
 await p.goto(origin+'/homework?id='+hwManual);await p.locator('#hwInfoForm').waitFor();
 await shot(p,'03-基本信息','#hwInfoForm',['#hwCourseReadonly','#hwName','#hwDue','#hwSaveInfo'],['#hwCourseReadonly']);
 await shot(p,'04-处理方式','.hw-card:nth-of-type(2)',['#hwEnableGrading','#hwDirectScores']);
 await shot(p,'05-批量录分','#hwScoresForm',['#hwScoreHelp','#hwScores','#hwSaveScores'],['#hwScores']);
 await p.locator('#hwDelete').click();
 await shot(p,'06-删除确认','section.hw-card:first-of-type',['#hwDeletePanel','#hwConfirmDelete','#hwCancelDelete']);
 p=await grading();
 await shot(p,'07-选择课程作业','.grading-context',['#currentCourse','#currentBatch','#batchStatus','#manageAssignment'],['#currentCourse','#currentBatch']);
 await p.evaluate(()=>go(1));await p.locator('#p1').waitFor({state:'visible'});
 await shot(p,'08-直接评分标准','#p1 .card',['.batch-basics','.rubric-methods','#qlist','#saveStandardsBtn'],['#course','#name']);
 await p.evaluate(()=>{rubricFileLabel='评分标准模板.xlsx';rubricMethod(true);document.getElementById('rubricMessage').textContent='模板已解析，可直接保存，无需逐题重复填写。';});
 await shot(p,'09-模板导入','#p1 .card',['#rubricTemplate','#rubricImportPanel','#rubricPreview','#saveStandardsBtn']);
 await p.evaluate(()=>go(2));await p.locator('#p2').waitFor({state:'visible'});
 await shot(p,'10-上传作业','#p2 .card',['#p2 .drop','#files'],['#files .fn','#files select']);
 await shot(p,'11-核对匹配','#p2 .card',['#files','#matchHint'],['#files .fn','#files select']);
 await shot(p,'12-准备目录','#p2',['#matchHint','#p2 .actions .btn:nth-last-child(1)'],['#files .fn','#files select']);
 await p.evaluate(()=>go(3));await p.locator('#p3').waitFor({state:'visible'});await p.waitForTimeout(300);
 await shot(p,'13-平台自动调用','#p3',['#wayA','#paneA']);
 await p.locator('#wayB').click();
 await shot(p,'14-手动调用导入','#p3',['#wayB','#promptBox','#paneB .card:nth-child(2)']);
 await p.evaluate(()=>go(4));await p.locator('#p4').waitFor({state:'visible'});await p.locator('#grades table').waitFor();
 await shot(p,'15-成绩总览','#p4 .card',['#gstats','#grades table'],['#grades td:first-child']);
 await p.evaluate(()=>openDetailedReview(0));await p.locator('.review-grid').waitFor();
 await shot(p,'16-详细复核','#p4 .card',['.review-list','.review-document','.review-score'],['.review-person','.review-heading span:first-child']);
 await p.evaluate(()=>openQuestionScores());await p.locator('#questionScoreDialog').waitFor();
 await shot(p,'17-小题依据','#questionScoreDialog',['#questionScoreBody','.question-dialog-head button'],['#questionScoreTitle']);
 await p.locator('.question-dialog-head button').click();
 await p.evaluate(()=>renderReviewOverview());await p.locator('#grades table').waitFor();
 await shot(p,'18-导出归档','#p4 .card',['#p4 .rt button:first-child','#p4 .rt button:last-child']);
 fs.writeFileSync(path.join(__dirname,'截图坐标.json'),JSON.stringify({dataDirectory:data,origin,items:manifest},null,2));
 console.log(JSON.stringify({screenshots:manifest.length,dataDirectory:data}));
 }finally{if(browser)await browser.close();child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
