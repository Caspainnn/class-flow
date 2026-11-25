'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1104-1290-0_26.1104.1290.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const {chromium}=require(runtime+'/playwright');
const root=path.resolve(__dirname,'../../../..');
const out=path.join(__dirname,'原始截图');fs.mkdirSync(out,{recursive:true});
const data=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-ch7-manual-'));
const save=(key,value)=>fs.writeFileSync(path.join(data,key+'.json'),JSON.stringify(value));
const courseId='manual-xq-course',now=Date.now();
const names=['示例甲','示例乙','示例丙','示例丁','示例戊','示例己','示例庚','示例辛'];
const students=names.map((name,i)=>({id:String(20261001+i),name,courseId}));
const questions=[
 {text:'数据预处理的第一步通常是什么？',options:['检查数据质量','直接删除全部记录','只保留结论','跳过异常值'],type:'single',correct:0},
 {text:'下列哪些属于常见的数据质量问题？',options:['缺失值','统一格式','重复记录','完整说明'],type:'multiple',correct:[0,2]},
 {text:'处理异常值前应优先做什么？',options:['确认业务背景','立即改成零','忽略来源','删除数据表'],type:'single',correct:0},
 {text:'可复现分析通常需要保留哪些内容？',options:['原始数据','处理步骤','随机删除记录','参数设置'],type:'multiple',correct:[0,1,3]},
 {text:'比较两组结果时首先应核对什么？',options:['统计口径','图表颜色','文件名称','页面顺序'],type:'single',correct:0},
 {text:'下列哪项更适合作为分类变量？',options:['专业类别','身高数值','实验时间','温度读数'],type:'single',correct:0},
 {text:'解释相关关系时应避免什么？',options:['直接认定因果','说明样本范围','检查异常点','报告限制'],type:'single',correct:0},
 {text:'提交分析报告前应完成哪些检查？',options:['核对数据来源','复查计算过程','删除不利结果','说明限制'],type:'multiple',correct:[0,1,3]}
];
const answerFor=(q,correct)=>correct?q.correct:(Array.isArray(q.correct)?[1]:1);
const sessions=questions.map((question,n)=>{
 const startedAt=now-(8-n)*86400000;
 const records=[];
 students.forEach((student,i)=>{
  const absent=(i===0&&n>=5)||(i===2&&n===2)||(i===5&&n===4);
  if(absent)return;
  const correct=i===1&&n>=3?false:((i+n)%3!==0);
  records.push({studentId:student.id,name:student.name,status:(i===4&&n%3===0)?'late':'present',claimedAt:startedAt+12000,submittedAt:startedAt+25000,answer:answerFor(question,correct),correct});
 });
 return {id:'manual-xq-session-'+n,courseId,question,startedAt,endsAt:startedAt+90000,closed:true,records};
});
const score=(value,st='ok')=>({score:value,st,source:'manual'});
const ids=students.map(s=>s.id);
const homework=[
 {id:'manual-hw-1',courseId,name:'数据清洗练习',due:'2026-10-12',mode:'manual',published:true,createdAt:now-28*86400000,scores:{[ids[0]]:score(82),[ids[1]]:score(76),[ids[3]]:score(55),[ids[4]]:score(91),[ids[5]]:score(88),[ids[6]]:score(79),[ids[7]]:score(95)}},
 {id:'manual-hw-2',courseId,name:'描述统计作业',due:'2026-10-19',mode:'manual',published:true,createdAt:now-21*86400000,scores:{[ids[0]]:score(74,'late'),[ids[1]]:score(84),[ids[3]]:score(58),[ids[4]]:score(86),[ids[5]]:score(80),[ids[6]]:score(72),[ids[7]]:score(90)}},
 {id:'manual-hw-3',courseId,name:'可视化报告',due:'2026-10-26',mode:'manual',published:true,createdAt:now-14*86400000,scores:{[ids[0]]:score(89),[ids[1]]:score(78),[ids[3]]:score(77),[ids[4]]:score(93),[ids[5]]:score(81),[ids[6]]:score(68),[ids[7]]:score(92)}},
 {id:'manual-hw-4',courseId,name:'综合案例分析',due:'2026-11-02',mode:'manual',published:true,createdAt:now-7*86400000,scores:{[ids[0]]:score(92),[ids[1]]:score(73),[ids[3]]:score(85),[ids[4]]:score(88),[ids[5]]:score(79),[ids[6]]:score(75),[ids[7]]:score(94)}}
];
save('courses',[{id:courseId,name:'学情操作示例',term:'2026秋'}]);save('students',students);save('sessions',sessions);save('homework',homework);save('gradebatches',[]);
save('settings',{xqRules:{absenceRun:2,corLastN:5,corMinAns:3,corRate:20,hwMiss:2,hwLow:2,hwLowScore:60}});
save('questionnaires',{version:1,revision:0,surveys:[]});
const port=31849,origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,[path.join(root,'server/server.js')],{cwd:root,env:{...process.env,DATA_DIR:data,HOST:'127.0.0.1',PORT:String(port)},windowsHide:true,stdio:'pipe'});
let logs='';child.stderr.on('data',b=>logs+=b);child.stdout.on('data',b=>logs+=b);
const manifest=[];let browser;
async function shot(page,name,region,targets,sensitive=[]){
 await page.locator(region).scrollIntoViewIfNeeded();
 const clip=await page.locator(region).boundingBox();if(!clip)throw Error('Missing region '+region);
 const rects=[];for(const sel of targets){const b=await page.locator(sel).first().boundingBox();if(!b)throw Error('Missing '+sel);rects.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}
 const hides=[];for(const sel of sensitive){for(const el of await page.locator(sel).all()){const b=await el.boundingBox();if(b)hides.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}}
 await (page.page ? page.page() : page).screenshot({path:path.join(out,name+'.png'),clip});manifest.push({name,boxes:rects,redact:hides});
}
async function shotShell(shell,page,name){
 const clip=await shell.locator('body').boundingBox(),rects=[];
 for(const sel of ['[data-nav-key="xq-warn"]','[data-nav-key="xq-stu"]','[data-nav-key="xq-prac"]']){const b=await shell.locator(sel).boundingBox();if(!b)throw Error('Missing shell '+sel);rects.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}
 const course=await page.locator('#course').boundingBox();if(!course)throw Error('Missing course');rects.push([course.x-clip.x,course.y-clip.y,course.x+course.width-clip.x,course.y+course.height-clip.y]);
 const redact=[[course.x-clip.x,course.y-clip.y,course.x+course.width-clip.x,course.y+course.height-clip.y]];
 for(const sel of ['#warnBody td:nth-child(1)','#warnBody td:nth-child(2)']){for(const el of await page.locator(sel).all()){const b=await el.boundingBox();if(b)redact.push([b.x-clip.x,b.y-clip.y,b.x+b.width-clip.x,b.y+b.height-clip.y]);}}
 await shell.screenshot({path:path.join(out,name+'.png'),clip});manifest.push({name,boxes:rects,redact});
}
(async()=>{try{
 for(let i=0;i<80;i++){try{const r=await fetch(origin+'/api/ping');if(r.ok)break;}catch{}if(i===79)throw Error(logs);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const shell=await browser.newPage({viewport:{width:1180,height:940},deviceScaleFactor:1});
 await shell.goto(origin+'/xueqing?tab=warn');await shell.locator('#workspaceFrame').waitFor();
 const page=await shell.locator('#workspaceFrame').contentFrame().owner().elementHandle().then(e=>e.contentFrame());
 await page.locator('#warnBody tr').first().waitFor();
 await shotShell(shell,page,'01-入口课程');
 await shot(page,'02-导出','.top',['#course','#expAll'],['#course']);
 await shot(page,'03-预警','#p2 .card',['#warnBody','#warnSub'],['#warnBody td:nth-child(1)','#warnBody td:nth-child(2)']);
 await page.evaluate(()=>switchPane('p3'));await page.locator('#p3').waitFor({state:'visible'});await page.locator('#wAnsBox table').waitFor();
 await shot(page,'04-画像选择','#p3 .side',['#whoSearch','#nameList'],['#nameList .nitem span:first-child']);
 await shot(page,'05-画像概览','#p3 .main .card:first-child',['#who','.kv','#wDots','#wHwDots','#wNote'],['#who']);
 await shot(page,'06-答题明细','#p3 .main .card:nth-child(2)',['#wAnsBox']);
 await shot(page,'07-作业明细','#p3 .main .card:nth-child(3)',['#wHwBox']);
 await page.evaluate(()=>switchPane('p4'));await page.locator('#p4').waitFor({state:'visible'});await page.locator('#qlist .qbar').waitFor();
 await shot(page,'08-课堂题目','#p4 .card:first-child',['#qSession','#qlist .qbar']);
 await page.locator('#qlist .qbar').click();await page.locator('#qlist .qdetail.on').waitFor();
 await shot(page,'09-选项分布','#p4 .card:first-child',['#qlist .qbar','#qlist .qdetail.on']);
 await shot(page,'10-作业分析','#p4 .card:nth-child(2)',['#hwBody']);
 await page.locator('#hwBody [data-hw-toggle]').first().click();await page.locator('#hwBody .hwdetail.on').waitFor();
 await shot(page,'11-作业展开','#p4 .card:nth-child(2)',['#hwBody .hwrow:first-child','#hwBody .hwdetail.on'],['#hwBody .hwdetail.on .chips']);
 fs.writeFileSync(path.join(__dirname,'截图坐标.json'),JSON.stringify({dataDirectory:data,origin,items:manifest},null,2));
 console.log(JSON.stringify({screenshots:manifest.length,dataDirectory:data}));
 }finally{if(browser)await browser.close();child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
