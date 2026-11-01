'use strict';
(function(root){
 const uid=()=>globalThis.crypto?.randomUUID?.()||('demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 const courses=[];
 const roster=course=>root.QuestionnaireRosters?.[course]||[];
 const fail=message=>{throw Error(message);};
 function question(type='single'){return {id:uid(),type,title:'',required:type!=='text',options:['选项一','选项二'].map(text=>({id:uid(),text})),low:'完全不理解',high:'非常理解'};}
 function blank(courseId='math'){return {id:uid(),title:'',description:'',courseId,mode:'anonymous',status:'draft',deadline:'',noDeadline:false,questions:[question()],responses:[],target:[],createdAt:Date.now(),updatedAt:Date.now()};}
 function seed(){return {version:1,surveys:[]};}
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
