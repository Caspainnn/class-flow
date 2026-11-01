'use strict';
module.exports=function courses(store,activeCourse=()=>null){
  const rows=()=>store.read('courses',[]);
  const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
  function find(id){const c=rows().find(c=>c.id===id&&!c.deletedAt);if(!c)fail(404,'课程不存在');return c}
  function fields(b,old={}){const out={...old};for(const [k,max] of [['name',80],['term',40],['note',300]])if(b[k]!=null){out[k]=String(b[k]).trim();if(out[k].length>max)fail(400,'课程信息过长')}if(!out.name)fail(400,'课程名称不能为空');return out}
  function list(){const students=store.read('students',[]),sessions=store.read('sessions',[]),hw=store.read('homework',[]),batches=store.read('gradebatches',[]);return rows().filter(c=>!c.deletedAt).map(c=>({...c,count:students.filter(s=>s.courseId===c.id).length,sessions:sessions.filter(s=>s.courseId===c.id).length,assignments:hw.filter(h=>h.courseId===c.id&&!h.deletedAt).length+batches.filter(b=>b.courseId===c.id&&!b.deletedAt&&!b.hwId).length,ready:students.some(s=>s.courseId===c.id)}))}
  function create(b){const c={...fields(b),id:'c'+store.uid(8),createdAt:Date.now(),recentQuestions:[]};store.write('courses',[...rows(),c]);return c}
  function update(id,b){const old=find(id),c=fields(b,old);store.write('courses',rows().map(x=>x.id===id?c:x));return c}
  function remove(id,confirm){find(id);if(confirm!==true)fail(400,'请确认删除课程');if(activeCourse()===id)fail(409,'请先结束这门课正在进行的签到');const batches=store.read('gradebatches',[]);if(batches.some(b=>b.courseId===id&&!b.deletedAt&&b.status==='running'))fail(409,'这门课有正在运行的批改，请结束后再删除');const deletedAt=Date.now();store.write('courses',rows().map(c=>c.id===id?{...c,deletedAt}:c));for(const key of ['homework','gradebatches'])store.write(key,store.read(key,[]).map(x=>x.courseId===id?{...x,deletedAt}:x));const settings=store.read('settings',{});if(settings.activeCourseId===id){settings.activeCourseId=(rows().find(c=>!c.deletedAt)||{}).id||null;store.write('settings',settings)}return {ok:true}}
  return {list,create,update,remove};
};
