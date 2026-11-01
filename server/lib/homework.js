'use strict';
// A request owns its snapshots; async grading saves only its own batch.
module.exports = function homeworkService({store, findCourse, getStudents}) {
  let homes, batches;
  const all = () => homes || (homes = store.read('homework', []));
  const allBatches = () => batches || (batches = store.read('gradebatches', []));
  const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
  const save = () => { store.write('homework', all()); store.write('gradebatches', allBatches()); };
  const batchFor = hw => allBatches().find(b => b.hwId === hw.id);
  const max = b => (b.questions || []).reduce((n,q) => n + Number(q.points || 0),0) || 100;
  function locate(id) {
    const hw = all().find(h => h.id === id);
    const batch = hw ? batchFor(hw) : allBatches().find(b => b.id === id);
    const linked = hw || (batch && batch.hwId && all().find(h=>h.id===batch.hwId));
    if ((!linked && !batch) || (linked && linked.deletedAt) || (batch && batch.deletedAt)) fail(404,'作业不存在');
    return {hw:linked || null,batch};
  }
  function canonical(ref) {
    if (ref.hw) return ref.hw;
    const b=ref.batch;
    // A dangling explicit reference must never resurrect a removed homework.
    if (b.hwId) fail(409,'关联作业不存在');
    const hw={id:'h'+store.uid(5),courseId:b.courseId,name:b.name,due:b.due||'',createdAt:b.createdAt||Date.now(),mode:'file',published:false,scores:{}};
    all().push(hw);b.hwId=hw.id;ref.hw=hw;return hw;
  }
  function scoresOf(hw,b) {
    if (!hw) return Object.fromEntries(Object.entries(b.results||{}).filter(([sid,r])=>getStudents(b.courseId).some(s=>s.id===sid)&&r.total!=null&&!r.abnormal).map(([sid,r])=>[sid,{score:Math.round(r.total/max(b)*1000)/10,st:'ok',rawTotal:r.total,rawMax:max(b)}]));
    // Old archives stored batch totals directly. Project these on read without
    // changing historical records; newer hundred-point entries carry markers.
    return Object.fromEntries(Object.entries(hw.scores||{}).map(([sid,e])=>{
      if (!b || !e || !Number.isFinite(e.score) || e.rawMax != null || ['grading','manual'].includes(e.source)) return [sid,e];
      return [sid,{...e,score:Math.round(e.score/max(b)*1000)/10,rawTotal:e.score,rawMax:max(b)}];
    }));
  }
  const analysisHomework = () => all().map(hw=>({...hw,scores:scoresOf(hw,batchFor(hw))}));
  function item(hw,b) {
    const scores=scoresOf(hw,b),vals=Object.values(scores).filter(e=>Number.isFinite(e.score));
    return {id:hw?hw.id:b.id,courseId:(hw||b).courseId,courseName:(findCourse((hw||b).courseId)||{}).name||'?',name:(hw||b).name,due:(hw||b).due||'',mode:b?'file':(hw.mode||'manual'),status:b?b.status:(hw.published===false?'draft':'published'),published:hw?hw.published!==false:false,batchId:b?b.id:null,submitted:vals.length,total:getStudents((hw||b).courseId).length,average:vals.length?Math.round(vals.reduce((n,e)=>n+e.score,0)/vals.length*10)/10:null};
  }
  function list(courseId) {
    const rows=[];
    all().filter(h=>!h.deletedAt).forEach(h=>{const b=batchFor(h);if(!b||!b.deletedAt) rows.push(item(h,b));});
    allBatches().filter(b=>!b.deletedAt&&!b.hwId).forEach(b=>rows.push(item(null,b)));
    return rows.filter(h=>!courseId||h.courseId===courseId);
  }
  function detail(id) {
    const {hw,batch:b}=locate(id),v=hw||b;
    return {homework:{...item(hw,b),scores:scoresOf(hw,b),questions:b?b.questions||[]:[],pass:b?b.pass:60,scale:b?b.scale:'std',extra:b?b.extra||'':''},students:getStudents(v.courseId).map(s=>({id:s.id,name:s.name}))};
  }
  function questions(input, expectedTotal = 100) {
    if (!Array.isArray(input)||!input.length) fail(400,'至少要有一道题');
    const qs=input.map(q=>({text:String(q.text||'').trim(),points:Number(q.points),...(q.rubric!==undefined?{rubric:String(q.rubric||'').trim()}: {})}));
    if(qs.some(q=>(q.rubric||'').length>10000))fail(400,'单题评分标准不能超过10000字');
    if(qs.some(q=>!q.text||!Number.isFinite(q.points)||q.points<=0)||Math.abs(qs.reduce((n,q)=>n+q.points,0)-expectedTotal)>0.0001) fail(400,'题目总分必须为100分');
    return qs;
  }
  function create(body) {
    const courseId=String(body.courseId||'').trim(),name=String(body.name||'').trim(),mode=body.mode||'manual';
    if(!findCourse(courseId)) fail(400,'课程不存在');if(!name) fail(400,'作业名称不能为空');if(!['file','manual'].includes(mode)) fail(400,'作业类型无效');
    const qs=mode==='file'?questions(body.questions):null;
    const hw={id:'h'+store.uid(5),courseId,name,due:String(body.due||'').trim(),mode,published:false,createdAt:Date.now(),scores:{}};
    let b=null;
    if(qs) {b={id:'g'+store.uid(5),hwId:hw.id,courseId,name,due:hw.due,questions:qs,pass:validPass(body.pass),scale:validScale(body.scale),extra:String(body.extra||'').trim(),createdAt:Date.now(),status:'collect',files:[],results:{},runLog:[]};allBatches().push(b);}
    all().push(hw);save();return {ok:true,id:hw.id,batchId:b?b.id:null};
  }
  function validPass(v) {const n=v===undefined?60:Number(v);if(!Number.isFinite(n)||n<0||n>100)fail(400,'及格线必须在0到100之间');return n;}
  function enableGrading(id){
    const ref=locate(id);if(ref.batch)return {ok:true,id:ref.hw?ref.hw.id:id,batchId:ref.batch.id};
    const hw=ref.hw;if(!findCourse(hw.courseId))fail(404,'课程不存在');
    const batch={id:'g'+store.uid(8),hwId:hw.id,courseId:hw.courseId,name:hw.name,due:hw.due||'',questions:[],pass:60,scale:'std',extra:'',createdAt:Date.now(),status:'collect',files:[],results:{},runLog:[]};
    hw.mode='file';allBatches().push(batch);save();return {ok:true,id:hw.id,batchId:batch.id};
  }
  function validScale(v) {if(v!==undefined&&!['std','strict','loose'].includes(v))fail(400,'评分尺度无效');return v||'std';}
  function update(id,body) {
    const ref=locate(id),b=ref.batch,v=ref.hw||b;
    const prior=b?JSON.stringify([b.name,b.questions,b.pass,b.scale,b.extra]):null;
    if(body.courseId!==undefined&&body.courseId!==v.courseId) fail(400,'不能更改课程');
    if(b&&b.status==='running')fail(409,'批改运行中，不能修改作业');
    let qs;
    if(body.questions!==undefined){qs=questions(body.questions,b?max(b):100);if(b&&Object.keys(b.results||{}).length&&JSON.stringify(qs.map(q=>q.points))!==JSON.stringify(b.questions.map(q=>q.points)))fail(409,'已有结果，不能修改题目分值');}
    const name=body.name===undefined?v.name:String(body.name||'').trim();if(!name)fail(400,'作业名称不能为空');
    const pass=body.pass===undefined?undefined:validPass(body.pass),scale=body.scale===undefined?undefined:validScale(body.scale);
    const hw=canonical(ref);hw.name=name;if(body.due!==undefined)hw.due=String(body.due||'').trim();
    if(b){b.name=hw.name;b.due=hw.due;if(qs)b.questions=qs;if(pass!==undefined)b.pass=pass;if(scale!==undefined)b.scale=scale;if(body.extra!==undefined)b.extra=String(body.extra||'').trim();}
    if(b&&prior!==JSON.stringify([b.name,b.questions,b.pass,b.scale,b.extra])){b.dir=null;if(b.status==='ready')b.status='collect';}
    save();return {ok:true,id:hw.id,batchId:b?b.id:null};
  }
  function inputScores(id,text) {
    const ref=locate(id),b=ref.batch;if(b&&b.status==='running')fail(409,'批改运行中，不能录分');
    const hw=canonical(ref),ids=new Set(getStudents(hw.courseId).map(s=>s.id)),bad=[];let n=0;
    hw.scores=hw.scores||{};hw.manualMissing=hw.manualMissing||{};
    String(text||'').split(/\r?\n/).forEach(line=>{const t=line.trim();if(!t)return;const cells=t.split(/[\s,，、;；]+/).filter(Boolean),sid=cells[0],rest=cells.slice(1);
      if(!ids.has(sid)){bad.push(t);return;}
      if(rest.some(c=>/未交|缺交|没交/.test(c))){delete hw.scores[sid];hw.manualMissing[sid]=true;if(b&&b.results&&b.results[sid]){b.results[sid].total=null;b.results[sid].modified=true;b.results[sid].abnormal='手动标记未交';}n++;return;}
      const sc=rest.map(c=>/^\d{1,3}(\.\d+)?$/.test(c)?Number(c):null).find(v=>v!=null);
      if(sc==null||sc>100){bad.push(t);return;}const st=rest.some(c=>/^补|^迟|late$/i.test(c))?'late':'ok';hw.scores[sid]={score:sc,st,source:'manual'};delete hw.manualMissing[sid];
      if(b&&(b.questions||[]).length){b.results=b.results||{};b.results[sid]={...(b.results[sid]||{}),sid,name:(getStudents(hw.courseId).find(s=>s.id===sid)||{}).name,total:sc*max(b)/100,modified:true,source:'manual',abnormal:'',items:(b.results[sid]||{}).items||[]};}n++;
    });
    if(n)hw.published=true;save();return {ok:true,n,bad:bad.slice(0,10)};
  }
  function remove(id,confirm) {
    if(!confirm)fail(400,'请确认删除');const ref=locate(id);if(ref.batch&&ref.batch.status==='running')fail(409,'批改运行中，不能删除');const now=Date.now();
    if(ref.hw)ref.hw.deletedAt=now;if(ref.batch)ref.batch.deletedAt=now;
    if(ref.hw)allBatches().filter(b=>b.hwId===ref.hw.id).forEach(b=>{if(b.status==='running')fail(409,'批改运行中，不能删除');b.deletedAt=now;});save();return {ok:true};
  }
  function archive(batch) {
    const ref=locate(batch.hwId||batch.id);if(batch.deletedAt)fail(404,'作业不存在');if(batch.status==='running')fail(409,'批改运行中');
    const hw=canonical(ref);hw.scores=hw.scores||{};let n=0;const ids=new Set(getStudents(batch.courseId).map(s=>s.id));
    Object.entries(batch.results||{}).forEach(([sid,r])=>{if(!ids.has(sid)||r.total==null||r.abnormal||(hw.manualMissing||{})[sid])return;const old=hw.scores[sid];if(old&&old.source!=='grading')return;
      hw.scores[sid]={score:Math.round(r.total/max(batch)*1000)/10,st:old&&old.st||'ok',source:r.modified?'manual':'grading',rawTotal:r.total,rawMax:max(batch)};n++;});
    hw.published=true;batch.hwId=hw.id;batch.status='archived';save();return {ok:true,hwId:hw.id,written:n,roster:ids.size};
  }
  function saveBatch(batch) {const fresh=store.read('gradebatches',[]),i=fresh.findIndex(b=>b.id===batch.id);if(i<0||fresh[i].deletedAt)return;fresh[i]=batch;store.write('gradebatches',fresh);}
  function syncReview(batch,sid) {const hw=batch.hwId&&all().find(h=>h.id===batch.hwId);if(!hw||hw.deletedAt||hw.published===false)return;const r=batch.results[sid],old=(hw.scores||{})[sid];hw.scores=hw.scores||{};hw.scores[sid]={score:Math.round(r.total/max(batch)*1000)/10,st:old&&old.st||'ok',source:'manual',rawTotal:r.total,rawMax:max(batch)};if(hw.manualMissing)delete hw.manualMissing[sid];store.write('homework',all());}
  return {allBatches,analysisHomework,list,detail,create,update,enableGrading,inputScores,remove,archive,saveBatch,syncReview};
};
