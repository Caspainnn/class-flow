'use strict';
const fs=require('node:fs'),path=require('node:path'),answers=require('../lib/answers');
const day=t=>{const d=new Date(Number(t)+8*3600000);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';};
const sum=(a,k)=>a.reduce((n,x)=>n+(Number(x[k])||0),0);
const fail=message=>{throw Object.assign(Error(message),{status:400});};
function range(query,now){
 const period=query.get('period')||'30',today=day(now);if(!['7','30','all','custom'].includes(period))fail('日期范围无效。');
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const from=period==='all'?'0001-01-01':period==='custom'?query.get('from')||'':day(now-(Number(period)-1)*86400000),to=period==='custom'?query.get('to')||'':today;
 if(!valid(from)||!valid(to)||from>to)fail('请选择有效日期范围，开始日期不能晚于结束日期。');
 return {period,from,to,includes:t=>{const d=day(t);return !!d&&d>=from&&d<=to;}};
}
function createService({root,now=Date.now}){
 function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Object.assign(Error('统计数据暂时无法读取，请稍后刷新；若仍失败，请检查本地数据文件。'),{status:503});}}
 const data=(name,fallback)=>read(path.join(root,name+'.json'),fallback);
 function folders(dir,file){let list;try{list=fs.readdirSync(dir);}catch(e){if(e.code==='ENOENT')return [];throw e;}return list.filter(id=>/^[a-f0-9]{24}$/.test(id)).map(id=>read(path.join(dir,id,file),null)).filter(Boolean);}
 function normalized(hw,b){const max=sum(b?.questions||[],'points')||100;return Object.fromEntries(Object.entries(hw.scores||{}).map(([id,e])=>[id,e&&Number.isFinite(e.score)&&b&&e.rawMax==null&&!['grading','manual'].includes(e.source)?{...e,score:Math.round(e.score/max*1000)/10}:e]));}
 function snapshot(query=new URLSearchParams()){
  const time=now(),r=range(query,time),allCourses=data('courses',[]).filter(c=>!c.deletedAt),allStudents=data('students',[]),allSessions=data('sessions',[]),homes=data('homework',[]),batches=data('gradebatches',[]),surveyStore=data('questionnaires',{surveys:[]});
  const courseId=query.get('courseId')||'all',term=query.get('term')||'all';if(courseId!=='all'&&!allCourses.some(c=>c.id===courseId))fail('所选课程不存在，请重新选择。');
  const selected=allCourses.filter(c=>(courseId==='all'||c.id===courseId)&&(term==='all'||(c.term||'未设置')===term)),ids=new Set(selected.map(c=>c.id));
  const roster=c=>allStudents.filter(s=>s.courseId===c),related=x=>ids.has(x.courseId)||(!x.courseId&&courseId==='all'&&term==='all');
  const hwRows=homes.filter(h=>ids.has(h.courseId)&&!h.deletedAt),batchRows=batches.filter(b=>ids.has(b.courseId)&&!b.deletedAt&&(!b.hwId||hwRows.some(h=>h.id===b.hwId)));
  const linked=h=>batchRows.find(b=>b.hwId===h.id),scoredHomes=hwRows.map(h=>({...h,scores:normalized(h,linked(h))}));
  const published=scoredHomes.filter(h=>h.published!==false);
  const R={absenceRun:2,corLastN:5,corMinAns:3,corRate:20,hwMiss:2,hwLow:2,hwLowScore:60,...(data('settings',{}).xqRules||{})};
  // Preserve existing xueqing rule semantics, including historical max absence run.
  function warnCount(c){const ss=allSessions.filter(s=>s.courseId===c.id).sort((a,b)=>a.startedAt-b.startedAt),hh=published.filter(h=>h.courseId===c.id);return roster(c.id).filter(st=>{let run=0,max=0,ans=0,cor=0;ss.forEach(s=>{run=(s.records||[]).some(x=>x.studentId===st.id)?0:run+1;max=Math.max(max,run);});ss.slice(-R.corLastN).forEach(s=>{const v=(s.records||[]).find(x=>x.studentId===st.id);if(v&&answers.answered(v.answer)){ans++;if(v.correct)cor++;}});const done=hh.map(h=>(h.scores||{})[st.id]).filter(e=>e&&e.st!=='no');return max>=R.absenceRun||(ans>=R.corMinAns&&Math.round(cor/ans*100)<R.corRate)||(hh.length-done.length)>=R.hwMiss||done.filter(e=>e.score<R.hwLowScore).length>=R.hwLow;}).length;}
  const courses=selected.map(c=>({id:c.id,name:c.name,term:c.term||'未设置',students:roster(c.id).length,warn:warnCount(c)}));
  const sessions=[],active=[],emptySessions=[];
  for(const s of allSessions.filter(x=>ids.has(x.courseId)&&!x.deletedAt)){
   const studentIds=new Set(roster(s.courseId).map(st=>st.id)),records=[...new Map((s.records||[]).filter(x=>studentIds.has(x.studentId)).map(x=>[x.studentId,x])).values()];
   const href='/session',open=!s.closed&&s.endsAt>time;
   if(open){active.push({title:allCourses.find(c=>c.id===s.courseId)?.name||'当前课堂',sub:'签到进行中',kind:'classroom',href});continue;}
   if(!r.includes(s.startedAt))continue;
   if(!records.length){emptySessions.push(s.id);continue;}
   const valid=records.filter(v=>answers.answered(v.answer));sessions.push({id:s.id,courseId:s.courseId,date:day(s.startedAt),at:s.startedAt,total:studentIds.size,present:records.length,answered:valid.length,correct:valid.filter(v=>v.correct).length,late:records.filter(v=>v.status==='late').length,href});
  }
  sessions.sort((a,b)=>a.at-b.at);
  function homeworkRow(h,b){const students=roster((h||b).courseId),studentIds=new Set(students.map(s=>s.id)),scores=h?.scores||{},results=b?.results||{},matched=new Set((b?.files||[]).filter(f=>f.status==='matched'&&studentIds.has(f.sid)).map(f=>f.sid)),valid=Object.entries(scores).filter(([id,e])=>studentIds.has(id)&&e&&e.st!=='no'&&Number.isFinite(e.score));
   const max=sum(b?.questions||[],'points')||100;
   const counts=(!h?Object.entries(results).filter(([id,v])=>studentIds.has(id)&&v?.total!=null&&!v.abnormal).map(([id,v])=>[id,{score:Math.round(v.total/max*1000)/10}]):valid);
   return {id:(h||b).id,courseId:(h||b).courseId,name:(h||b).name,date:day((h||b).createdAt),total:students.length,scored:counts.length,missing:students.filter(s=>h?.manualMissing?.[s.id]||scores[s.id]?.st==='no').length,matched:matched.size,pending:(b?.files||[]).filter(f=>f.status!=='matched'||!studentIds.has(f.sid)).length,abnormal:Object.entries(results).filter(([id,v])=>studentIds.has(id)&&v?.abnormal).length,ungraded:[...matched].filter(id=>!results[id]||results[id].total==null||results[id].abnormal).length,mean:counts.length?Math.round(counts.reduce((n,[,e])=>n+e.score,0)/counts.length*10)/10:null,status:b?.status||(h?.published===false?'draft':'published'),href:'/homework?id='+encodeURIComponent((h||b).id)};
  }
  const allHomework=[...scoredHomes.map(h=>homeworkRow(h,linked(h))),...batchRows.filter(b=>!b.hwId).map(b=>homeworkRow(null,b))];
  const homework=allHomework.filter(h=>r.includes(Date.parse(h.date+'T00:00:00+08:00')));
  const surveys=(surveyStore.surveys||[]).filter(s=>ids.has(s.courseId)&&s.status!=='draft').map(s=>{const named=s.mode==='named',target=new Set((s.target||[]).map(t=>t.id)),responses=s.responses||[],valid=named?[...new Map(responses.filter(v=>target.has(v.studentId)).map(v=>[v.studentId,v])).values()]:responses;const count=valid.filter(v=>r.includes(v.submittedAt)).length;return {id:s.id,courseId:s.courseId,name:s.title,mode:s.mode,target:named?target.size:0,count,totalCount:valid.length,date:day(s.publishedAt),status:s.status==='archived'?'已归档':s.status==='ended'||(s.deadline&&Date.parse(s.deadline)<=time)?'已结束':'回收中',href:'/questionnaires#detail/'+encodeURIComponent(s.id)+'/analysis'};});
  const resources=[],tasks=[...active];
  for(const [folder,type] of [['ppt','PPT'],['lesson-plan','教案']]){
   for(const t of folders(path.join(root,folder),'task.json').filter(t=>!t.deletedAt&&related(t))){
    const href=type==='PPT'?'/preparation?type=ppt#task/'+t.id:'/preparation?type=plan#'+t.id;
    const vv=[...(t.htmlVersions||[]),...(t.versions||[])],at=Math.max(t.createdAt||0,...vv.map(v=>v.createdAt||0)),hasOutput=vv.length>0;
    const status=t.status==='running'?'制作中':t.status==='failed'?'本轮失败':t.status==='cancelled'?'已取消':t.status==='ready'?'可授课':hasOutput?'已有产物':t.status==='outline'?'待确认大纲':'草稿';
    const row={id:t.id,courseId:t.courseId||'',name:t.title||'未命名',type,date:day(at),at,status,versions:(t.versions||[]).length,htmlVersions:(t.htmlVersions||[]).length,hasOutput,href};
    if(vv.some(v=>r.includes(v.createdAt)))resources.push(row);
    if(['running','failed','outline','html-ready'].includes(t.status))tasks.push({title:row.name,sub:status+(hasOutput?' · 已有产物保留':''),kind:t.status==='failed'?'red':t.status==='running'?'resources':'amber',href});
   }
  }
  for(const b of batchRows){const row=allHomework.find(h=>h.id===(b.hwId||b.id));if(b.status==='running'||row?.pending||row?.abnormal||row?.ungraded)tasks.push({title:b.name,sub:b.status==='running'?'自动批改进行中':`待匹配 ${row.pending} 份 · 异常 ${row.abnormal} 份 · 待批改 ${row.ungraded} 人`,kind:b.status==='running'?'homework':'amber',href:'/grading?id='+encodeURIComponent(b.id)});}
  for(const h of allHomework.filter(h=>!batchRows.some(b=>(b.hwId||b.id)===h.id))){const remaining=h.total-h.scored-h.missing;if(remaining>0)tasks.push({title:h.name,sub:`待录分 ${remaining} 人 · 不代表未交`,kind:'homework',href:h.href});}
  for(const s of surveys.filter(s=>s.status==='回收中'))tasks.push({title:s.name,sub:s.mode==='named'?`问卷回收中 · 未提交 ${Math.max(0,s.target-s.totalCount)} 人`:`匿名问卷回收中 · 已收到 ${s.totalCount} 份`,kind:'survey',href:s.href});
  if(courseId==='all'&&term==='all')for(const job of folders(path.join(root,'questionnaire-ai'),'task.json').filter(j=>['running','failed'].includes(j.status)))tasks.push({title:'问卷初版生成',sub:job.status==='running'?'正在生成 · 尚未关联课程':'生成失败 · 可在问卷管理查看',kind:job.status==='failed'?'red':'survey',href:'/questionnaires'});
  tasks.sort((a,b)=>(a.kind==='red'?0:a.kind==='classroom'?1:2)-(b.kind==='red'?0:b.kind==='classroom'?1:2));
  const pptTemplates=folders(path.join(root,'ppt','_templates'),'template.json').filter(t=>!t.deletedAt);
  let planTemplates=[];const templateDir=path.join(root,'lesson-plan','templates');if(fs.existsSync(templateDir))planTemplates=fs.readdirSync(templateDir).filter(n=>/^[a-f0-9]{24}\.json$/.test(n)).map(n=>read(path.join(templateDir,n),{}));
  const templateCounts={ppt:pptTemplates.length,layouts:pptTemplates.reduce((n,t)=>n+(t.profile?.confirmed?(t.profile.layoutGroups||[]).length:0),0),plan:planTemplates.length+1};
  const byDate=new Map();sessions.forEach(s=>{let v=byDate.get(s.date);if(!v){v={date:s.date,total:0,present:0,answered:0,correct:0,late:0};byDate.set(s.date,v);}for(const k of ['total','present','answered','correct','late'])v[k]+=s[k];});
  return {generatedAt:time,range:{from:r.from,to:r.to},options:{courses:allCourses.map(c=>({id:c.id,name:c.name})),terms:[...new Set(allCourses.map(c=>c.term||'未设置'))]},courses,sessions,trend:[...byDate.values()],homework,surveys,resources:resources.sort((a,b)=>b.at-a.at),tasks,templateCounts,emptySessions:emptySessions.length,activeSessions:active.length,notice:'历史课堂按当前名单统计；关注人次按当前课程全量规则计算，缺成绩不等于已核实未交。',filters:{courseId,term}};
 }
 return {snapshot};
}
module.exports={createService,range,day};
