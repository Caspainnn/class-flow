'use strict';
(function(root){
 const uid=()=>globalThis.crypto?.randomUUID?.()||('demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 const courses=[{id:'math',name:'高等数学（上）',count:47},{id:'ai',name:'人工智能导论',count:40}];
 const roster=course=>Array.from({length:courses.find(c=>c.id===course)?.count||0},(_,i)=>({id:'S'+String(i+1).padStart(3,'0'),name:'示例学生'+String(i+1).padStart(2,'0')}));
 const fail=message=>{throw Error(message);};
 function question(type='single'){return {id:uid(),type,title:'',required:type!=='text',options:['选项一','选项二'].map(text=>({id:uid(),text})),low:'完全不理解',high:'非常理解'};}
 function blank(courseId='math'){return {id:uid(),title:'',description:'',courseId,mode:'anonymous',status:'draft',deadline:'',noDeadline:false,questions:[question()],responses:[],target:[],createdAt:Date.now(),updatedAt:Date.now()};}
 function seed(){
  const questions=[{id:'pace',type:'single',title:'你觉得本节课的节奏如何？',required:true,options:[{id:'fast',text:'偏快，希望多一点讲解'},{id:'right',text:'适中，能够跟上'},{id:'slow',text:'偏慢，可以适当加快'}]},{id:'help',type:'multi',title:'哪些学习方式对你更有帮助？',required:true,options:[{id:'case',text:'结合生活的例子'},{id:'steps',text:'分步骤的板书推导'},{id:'practice',text:'课堂练习与讲评'},{id:'discuss',text:'与同学讨论'}]},{id:'understand',type:'scale',title:'你对本节课核心知识的理解程度',required:false,low:'完全不理解',high:'非常理解'},{id:'advice',type:'text',title:'你希望下一节课有哪些调整？',required:false}];
  const ratings=[1,...Array(2).fill(2),...Array(6).fill(3),...Array(17).fill(4),...Array(8).fill(5),null,null];
  const texts=['希望板书推导时再慢一点，关键步骤多停留一下。','例子很贴近生活，希望以后多一些这样的例子。','想增加一道可以自己动手做的课堂练习。','和同学讨论后更容易理解，希望保留讨论环节。','有几个概念的区别还不太清楚，希望再比较一下。',''];
  const start=new Date('2026-10-31T09:00:00+08:00').getTime();
  const responses=Array.from({length:36},(_,i)=>({id:'response-'+(i+1),requestId:'seed-'+i,client:'seed-client-'+i,submittedAt:start+i*25000,answers:{pace:i<14?'fast':i<32?'right':'slow',help:[i%2?'case':'steps',i%3?'practice':'discuss'],understand:ratings[i],advice:texts[i%texts.length]},tags:i%6===0?{advice:['节奏']}:i%6===2?{advice:['练习']}: {}}));
  const anon={...blank(),id:'feedback-anon',title:'本节课学习反馈',description:'用两分钟告诉老师你的学习体验，帮助我们把下一节课安排得更好。',questions,responses,createdAt:start,publishedAt:start,status:'collecting',questionVersion:1,updatedAt:start+36*25000};
  const named={...structuredClone(anon),id:'prep-named',title:'课前知识自评',description:'了解已有基础，帮助老师调整讲解重点。',mode:'named',target:roster('math'),responses:responses.map((r,i)=>({...structuredClone(r),studentId:roster('math')[i].id})),status:'ended'};
  named.description='回顾上节课，了解已有基础，帮助老师调整本节课的讲解重点。';named.questions[0].title='你对上节课核心概念的掌握情况？';named.questions[0].options[0].text='还不太清楚，需要复习';named.questions[0].options[1].text='基本理解，可以继续';named.questions[0].options[2].text='掌握较好，希望拓展';named.questions[1].title='你希望本节课补充哪些学习活动？';named.questions[2].title='你对相关基础知识的熟悉程度';named.questions[2].low='完全不熟悉';named.questions[2].high='非常熟悉';named.questions[3].title='课前还有哪些困惑希望老师解答？';
  const draft={...blank('ai'),id:'draft-example',title:'人工智能导论 · 课后反馈',questions:structuredClone(questions.slice(0,2))};
  const empty={...structuredClone(anon),id:'empty-example',title:'第二次课学习反馈',responses:[]};
  const archived={...structuredClone(named),id:'archive-example',title:'第一周课程适应调查',status:'archived'};
  return {version:1,surveys:[anon,named,draft,empty,archived]};
 }
 function validate(s,stage=1){
  if(!s.title.trim())return '请填写问卷标题。';
  if(stage===0)return '';
  if(!s.questions.length)return '请至少添加一道题目。';
  for(let i=0;i<s.questions.length;i++){const q=s.questions[i];if(!q.title.trim())return `请填写第${i+1}题的题目。`;if(['single','multi'].includes(q.type)){if(q.options.length<2||q.options.some(o=>!o.text.trim()))return `第${i+1}题至少需要两个非空选项。`;if(new Set(q.options.map(o=>o.text.trim())).size!==q.options.length)return `第${i+1}题存在重复选项，请调整。`;}if(q.type==='scale'&&(!q.low.trim()||!q.high.trim()))return `请补全第${i+1}题的量表含义。`;}
  if(stage>=2){if(s.noDeadline===false&&!s.deadline)return '请填写回收截止时间，或勾选“不设置截止时间”。';if(!courses.some(c=>c.id===s.courseId))return '请选择发放课程。';if(s.mode==='named'&&!roster(s.courseId).length)return '该课程暂无名单，请先录入名单或选择匿名。';if(s.deadline&&(!Number.isFinite(new Date(s.deadline).getTime())||new Date(s.deadline).getTime()<=Date.now()))return '截止时间应晚于当前时间。';}
  return '';
 }
 function publish(s){if(s.status!=='draft')fail('已发布问卷不能重复发布，请复制一份新问卷。');const error=validate(s,2);if(error)fail(error);s.status='collecting';s.questionVersion=1;s.publishedAt=Date.now();s.updatedAt=Date.now();s.target=s.mode==='named'?roster(s.courseId):[];return s;}
 function transition(s,action){
  const allowed={stop:['collecting','ended'],resume:['ended','collecting'],archive:['ended','archived'],unarchive:['archived','ended']},rule=allowed[action];if(!rule||s.status!==rule[0])fail('当前问卷状态已变化，请刷新后重试。');if(action==='resume'&&s.deadline&&(!Number.isFinite(new Date(s.deadline).getTime())||new Date(s.deadline).getTime()<=Date.now()))fail('截止时间已过，请选择新的截止时间或清除截止时间。');s.status=rule[1];s.updatedAt=Date.now();return s;
 }
 function closed(s,now=Date.now()){return s.status!=='collecting'||!!(s.deadline&&new Date(s.deadline).getTime()<=now);}
 function submit(s,payload,now=Date.now()){
  const duplicate=s.responses.find(r=>r.requestId===payload.requestId);if(duplicate)return duplicate;
  if(closed(s,now))fail('本问卷已停止回收，当前回答尚未提交。');
  let studentId;
  if(s.mode==='named'){const student=s.target.find(x=>x.id===String(payload.studentId||'').trim()&&x.name===String(payload.name||'').trim());if(!student)fail('学号与姓名不匹配，请核对课程名单中的信息。');studentId=student.id;if(s.responses.some(r=>r.studentId===studentId))fail('该学号已经提交过这份问卷。');}
  else if(s.responses.some(r=>r.client===payload.client))fail('本浏览器已经提交过这份问卷。');
  const answers={};
  for(let i=0;i<s.questions.length;i++){const q=s.questions[i],raw=payload.answers[q.id],v=q.type==='text'&&typeof raw==='string'?raw.trim():raw,empty=v===undefined||v===null||v===''||Array.isArray(v)&&v.length===0;if(q.required&&empty)fail(`请完成第${i+1}题。`);if(empty){answers[q.id]=null;continue;}if(q.type==='single'&&!q.options.some(o=>o.id===v))fail(`第${i+1}题的选项无效。`);if(q.type==='multi'&&(!Array.isArray(v)||new Set(v).size!==v.length||v.some(id=>!q.options.some(o=>o.id===id))))fail(`第${i+1}题的选项无效。`);if(q.type==='scale'&&(!Number.isInteger(Number(v))||Number(v)<1||Number(v)>5))fail(`请为第${i+1}题选择1至5分。`);if(q.type==='text'&&(typeof v!=='string'||v.length>500))fail(`第${i+1}题请填写不超过500字的文字。`);answers[q.id]=q.type==='scale'?Number(v):typeof v==='string'?v.trim():v;}
  const r={id:uid(),requestId:payload.requestId,submittedAt:now,answers,tags:{},...(studentId?{studentId}:{client:payload.client})};s.responses.push(r);s.updatedAt=now;return r;
 }
 function filter(s,{questionId='',optionId='',period='all'}={}){return s.responses.filter(r=>(!questionId||!optionId||(Array.isArray(r.answers[questionId])?r.answers[questionId].includes(optionId):r.answers[questionId]===optionId))&&(period!=='recent'||r.submittedAt>=s.responses.reduce((n,x)=>Math.max(n,x.submittedAt),0)-5*60000));}
 function stats(s,rows=s.responses){return s.questions.map(q=>{const answered=rows.filter(r=>{const v=r.answers[q.id];return v!==null&&v!==undefined&&v!==''&&(!Array.isArray(v)||v.length>0);}),counts=q.type==='scale'?Array.from({length:5},(_,i)=>({label:String(i+1)+'分',value:answered.filter(r=>Number(r.answers[q.id])===i+1).length})):['single','multi'].includes(q.type)?q.options.map(o=>({label:o.text,value:answered.filter(r=>Array.isArray(r.answers[q.id])?r.answers[q.id].includes(o.id):r.answers[q.id]===o.id).length})):[];return {question:q,valid:answered.length,missing:rows.length-answered.length,counts,mean:q.type==='scale'&&answered.length?answered.reduce((n,r)=>n+Number(r.answers[q.id]),0)/answered.length:null};});}
 function answerText(q,value){if(value===undefined||value===null||value==='')return '—';if(q.type==='text')return value;if(q.type==='scale')return value+'分';return (Array.isArray(value)?value:[value]).map(id=>q.options.find(o=>o.id===id)?.text||'—').join('；');}
 const api={uid,courses,roster,question,blank,seed,validate,publish,transition,closed,submit,filter,stats,answerText};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.QuestionnaireDemo=api;
})(globalThis);
