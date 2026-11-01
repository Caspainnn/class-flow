'use strict';
let latest=0,loaded=false,controller,lastData;
const initialCourse=new URLSearchParams(location.search).get('courseId')||'all';
function dateToday(){const d=new Date(Date.now()+8*3600000);return d.toISOString().slice(0,10);}
$('#to').value=dateToday();$('#from').value=new Date(Date.now()+8*3600000-29*86400000).toISOString().slice(0,10);
function error(message){$('#loadError').hidden=false;$('#loadError').innerHTML=`${esc(message)}${lastData?' 已保留上次成功的数据，请注意更新时间。':''} <button id="retryLoad">重试</button>`;$('#retryLoad').onclick=load;}
async function load(){
 $('#customDates').hidden=$('#period').value!=='custom';const custom=$('#period').value==='custom';
 const invalid=custom&&(!$('#from').value||!$('#to').value||$('#from').value>$('#to').value);$('#dateError').hidden=!invalid;$('#dateError').textContent='请选择有效日期范围，开始日期不能晚于结束日期。';
 const id=++latest;controller?.abort();if(invalid){$('#content').setAttribute('aria-busy','false');return;}
 controller=new AbortController();const params=new URLSearchParams({courseId:loaded?$('#course').value:initialCourse,term:$('#term').value,period:$('#period').value});if(custom){params.set('from',$('#from').value);params.set('to',$('#to').value);}
 $('#refresh').disabled=true;$('#content').setAttribute('aria-busy','true');
 try{const response=await fetch('/api/dashboard?'+params,{signal:controller.signal,cache:'no-store'});const d=await response.json();if(id!==latest)return;if(!response.ok)throw Error(d.error||'看板暂时无法读取，请重试。');
  const course=params.get('courseId'),term=params.get('term');$('#course').innerHTML='<option value="all">全部课程</option>'+d.options.courses.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');$('#course').value=course;$('#term').innerHTML='<option value="all">全部学期</option>'+d.options.terms.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('#term').value=term;loaded=true;lastData=d;
  $('#content').innerHTML=overview(d);$('#loadError').hidden=true;$('#syncTime').textContent=`${d.range.from==='0001-01-01'?'全部记录':d.range.from} 至 ${d.range.to} · 更新 ${new Date(d.generatedAt).toLocaleTimeString('zh-CN',{hour12:false})}`;
 }catch(e){if(id===latest&&e.name!=='AbortError'){error(e.message);if(!loaded){$('#content').innerHTML='<section class="panel empty"><h2>看板暂时无法载入</h2><p>请检查本地服务后重试，未加载的数据不会按0显示。</p></section>';if(initialCourse!=='all'){$('#course').innerHTML='<option value="all">全部课程</option>';loaded=true;}}}}
 finally{if(id===latest){$('#refresh').disabled=false;$('#content').setAttribute('aria-busy','false');}}
}
['course','term','period','from','to'].forEach(id=>$('#'+id).addEventListener('change',load));$('#refresh').onclick=load;
document.addEventListener('click',e=>{const b=e.target.closest('[data-tab],[data-reset]');if(!b)return;if(b.hasAttribute('data-reset')){$('#course').value='all';$('#term').value='all';$('#period').value='all';loaded=true;load();return;}$('#'+b.dataset.tab)?.scrollIntoView({behavior:'smooth',block:'start'});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&loaded)load();});
setInterval(()=>{if(!document.hidden&&loaded&&!$('#refresh').disabled)load();},60000);load();
