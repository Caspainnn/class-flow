'use strict';
const crypto=require('node:crypto'),Q=require('./public/model');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{6,80}$/.test(value);
const text=(value,max,label)=>{if(typeof value!=='string'||value.length>max)fail(label+'格式不正确或过长。');return value.trim();};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function createService({store,getCourses,getStudents}){
 const read=()=>{const state=store.read('questionnaires',{version:1,revision:0,surveys:[]});for(const s of state.surveys)if(s.status==='collecting'&&s.deadline&&new Date(s.deadline).getTime()<=Date.now())s.status='ended';return state;};
 const write=s=>{s.revision++;store.write('questionnaires',s);return s;};
 const roster=course=>getStudents(course).map(s=>({id:String(s.id),name:s.name}));
 const courses=()=>getCourses().map(c=>({id:c.id,name:c.name}));
 const teacher=s=>({...s,surveys:s.surveys.map(t=>({...t,responses:t.responses.map(({client,requestId,...r})=>r)}))});
 function snapshot(){return {...teacher(read()),courses:courses(),rosters:Object.fromEntries(courses().map(c=>[c.id,roster(c.id)]))};}
 function normalize(raw){
  if(!raw||!id(raw.id))fail('问卷标识无效。');
  if(!['anonymous','named'].includes(raw.mode)||!['draft','collecting','ended','archived'].includes(raw.status))fail('问卷状态或身份方式无效。');
  if(!Array.isArray(raw.questions)||raw.questions.length>50)fail('最多设置50题。');
  const s={id:raw.id,title:text(raw.title,80,'标题'),description:text(raw.description||'',500,'说明'),courseId:text(raw.courseId||'',100,'课程'),mode:raw.mode,status:raw.status,deadline:text(raw.deadline||'',40,'截止时间'),noDeadline:raw.deadline?false:raw.noDeadline!==false,questions:[],createdAt:Date.now(),updatedAt:Date.now(),responses:[],target:[]};
  if(!s.title)fail('请填写问卷标题。');if(s.deadline&&!Number.isFinite(new Date(s.deadline).getTime()))fail('截止时间无效。');
  const ids=new Set();for(const q of raw.questions){if(!q||!id(q.id)||ids.has(q.id)||!['single','multi','scale','text'].includes(q.type)||typeof q.required!=='boolean')fail('题目标识、题型或必答设置无效。');ids.add(q.id);const item={id:q.id,type:q.type,title:text(q.title,160,'题干'),required:q.required,options:[],low:text(q.low||'',25,'量表含义'),high:text(q.high||'',25,'量表含义')};if(['single','multi'].includes(q.type)){if(!Array.isArray(q.options)||q.options.length>12)fail('选项最多12个。');const seen=new Set();for(const o of q.options){if(!o||!id(o.id)||seen.has(o.id))fail('选项标识无效。');seen.add(o.id);item.options.push({id:o.id,text:text(o.text,100,'选项')});}}s.questions.push(item);}
  if(raw.aiJobId&&/^[a-f0-9]{24}$/.test(raw.aiJobId))s.aiJobId=raw.aiJobId;return s;
 }
 function sync(body){
  const state=read();if(body.revision!==state.revision)fail('问卷已有新答卷或在其他页面更新。请刷新后重试，当前编辑内容已保留。',409);
  if(!Array.isArray(body.surveys)||body.surveys.length>2000)fail('问卷列表无效。');const next=[],seen=new Set();
  for(const raw of body.surveys){const n=normalize(raw);if(seen.has(n.id))fail('问卷标识重复。');seen.add(n.id);const old=state.surveys.find(s=>s.id===n.id);
   if(!old&&n.status!=='draft')fail('新问卷须先保存为草稿。');
   if(old){
    n.createdAt=old.createdAt;n.responses=old.responses;n.target=old.target;n.publishedAt=old.publishedAt;n.questionVersion=old.questionVersion;
    if(['title','description','courseId','mode','status','deadline','noDeadline','questions','aiJobId'].every(key=>eq(n[key],old[key])))n.updatedAt=old.updatedAt;
    if(old.status!=='draft'){
     for(const key of ['title','description','courseId','mode','questions'])if(!eq(n[key],old[key]))fail('已发布问卷内容已锁定，请复制后修改。',409);
     const allowed={collecting:['collecting','ended'],ended:['ended','collecting','archived'],archived:['archived','ended']};if(!allowed[old.status].includes(n.status))fail('问卷状态转换无效。');
    }
    if(old.status==='draft'&&n.status!=='draft'){
     if(n.status!=='collecting')fail('草稿只能发布为回收中。');if(!n.noDeadline&&!n.deadline)fail('请填写回收截止时间，或勾选“不设置截止时间”。');const error=Q.validate(n,1);if(error)fail(error);
     if(!courses().some(c=>c.id===n.courseId))fail('课程不存在，请重新选择。');n.target=n.mode==='named'?roster(n.courseId):[];if(n.mode==='named'&&!n.target.length)fail('该课程暂无名单，不能发布实名问卷。');n.publishedAt=Date.now();n.questionVersion=1;
    }
    if(n.status==='collecting'&&old.status!=='collecting'&&n.deadline&&new Date(n.deadline).getTime()<=Date.now())fail('截止时间应晚于当前时间。');
   }
   next.push(n);
  }
  for(const old of state.surveys)if(!seen.has(old.id)&&old.status!=='draft')fail('已发布问卷不能删除，请归档。');
  state.surveys=next;return teacher(write(state));
 }
 const find=(state,sid)=>{const s=state.surveys.find(s=>s.id===sid);if(!s||s.status==='draft')fail('问卷不存在或尚未发布。',404);return s;};
 function publicSurvey(sid){const s=find(read(),sid);return {id:s.id,title:s.title,description:s.description,mode:s.mode,status:Q.closed(s)?'ended':'collecting',courseName:courses().find(c=>c.id===s.courseId)?.name||'课程问卷',questions:s.questions,deadline:s.deadline};}
 function submit(sid,body,device){
  if(!body||!id(body.requestId)||!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))fail('提交格式不正确。');
  const state=read(),s=find(state,sid),client=crypto.createHash('sha256').update(sid+':'+device).digest('hex');
  for(const q of s.questions){const v=body.answers[q.id];if(v==null||v==='')continue;if(q.type==='multi'&&!Array.isArray(v)||q.type==='scale'&&typeof v!=='number'||['single','text'].includes(q.type)&&typeof v!=='string')fail('题目作答格式不正确。');}
  const existing=s.responses.find(r=>r.requestId===body.requestId);if(existing){if(existing.client!==client)fail('该提交凭证已被使用。',409);return {ok:true,id:existing.id};}
  const r=Q.submit(s,{requestId:body.requestId,answers:body.answers,studentId:body.studentId,name:body.name,client});r.client=client;write(state);return {ok:true,id:r.id};
 }
 function overview(courseId){const list=read().surveys.filter(s=>s.status!=='draft'&&s.courseId===courseId);return {published:list.length,collecting:list.filter(s=>!Q.closed(s)).length,responses:list.reduce((n,s)=>n+s.responses.length,0),recent:list.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,5).map(s=>({id:s.id,title:s.title,mode:s.mode,responses:s.responses.length,status:Q.closed(s)?s.status==='archived'?'archived':'ended':'collecting',rate:s.mode==='named'&&s.target.length?Math.round(s.responses.length/s.target.length*1000)/10:null,missing:s.mode==='named'?s.target.filter(st=>!s.responses.some(r=>r.studentId===st.id)).length:null}))};}
 return {snapshot,sync,publicSurvey,submit,overview};
}
module.exports={createService};
