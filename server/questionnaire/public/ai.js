'use strict';
// AI draft generation is real; publishing and collection remain isolated demo actions.
window.QuestionnaireAI=(()=>{
 let ui,draft={goal:'',audience:'本课程学生',focus:'',count:6},timer=null,currentJob=null,submitting=false;
 const KEY='inclass.questionnaire.ai-requirements.v1';
 try{draft={...draft,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{}
 const e=v=>ui.esc(v),view=()=>document.getElementById('view'),el=id=>document.getElementById(id);
 const head=(title,description)=>`<header class="page-head"><div><h1>${e(title)}</h1><p>${e(description)}</p></div></header>`;
 async function api(url,body){const response=await fetch('/api/questionnaire-ai'+url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'生成服务暂时不可用。');return data;}
 function init(options){ui=options;}
 function methods(){clearTimeout(timer);view().innerHTML=head('新建问卷','选择制作方式，完成后都可以逐题编辑、预览和确认。')+ui.flow(2)+`<div class="ai-methods"><section class="panel"><span class="badge anonymous">直接编辑</span><h2>手动创建</h2><p>自己编写题目和选项，也可以复制已有问卷。</p><button data-action="new-manual" class="primary">开始填写问卷</button></section><section class="panel"><span class="badge collecting">AI 辅助</span><h2>WorkBuddy 辅助制作</h2><p>描述调查目的，让 WorkBuddy 生成初版，再由你检查和修改。</p><button data-action="ai-enter" class="primary">填写调查需求</button></section></div><div class="form-footer"><button data-action="creation-basic">← 上一步</button></div>`;}
 function form(){clearTimeout(timer);view().innerHTML=head('让 WorkBuddy 起草问卷','先说明想了解什么，生成后由你逐题确认。')+ui.flow(3)+`<section class="panel setting-panel"><div class="notice">这里会真实调用本机已连接的生成工具，并使用模型额度。只交接下面填写的需求，不交接学生名单或答卷。生成后需由教师确认发布。</div><div class="field"><label for="aiGoal">调查目的</label><textarea id="aiGoal" data-ai-field="goal" maxlength="1000" placeholder="例如：了解 GAN 课堂的学习困难、节奏和练习需求">${e(draft.goal)}</textarea></div><div class="two-fields"><div class="field"><label for="aiAudience">调查对象</label><input id="aiAudience" data-ai-field="audience" maxlength="200" value="${e(draft.audience)}"></div><div class="field"><label for="aiCount">题目数量</label><input id="aiCount" data-ai-field="count" type="number" min="3" max="20" step="1" value="${e(draft.count)}"><p class="helper">3–20题，默认6题。</p></div></div><div class="field"><label for="aiFocus">关注点或补充要求<small>选填</small></label><textarea id="aiFocus" data-ai-field="focus" maxlength="1500" placeholder="例如：希望了解哪些知识点难理解，留一道选填建议题">${e(draft.focus)}</textarea></div><p class="helper">支持单选、多选、1–5分量表和简答。默认匿名，生成后可在设置发放中调整。</p><p id="aiError" class="inline-error" role="alert"></p><div class="form-footer"><button data-action="ai-methods">← 上一步</button><button class="primary" data-action="ai-start" id="aiStart">生成问卷初版</button></div></section>`;
 view().oninput=event=>{const field=event.target.dataset.aiField;if(!field)return;draft[field]=event.target.value;localStorage.setItem(KEY,JSON.stringify(draft));};}
 function job(id){clearTimeout(timer);view().innerHTML=head('生成问卷初版','正在根据调查需求生成题目，完成后自动进入审阅。')+ui.flow(3)+`<section class="panel setting-panel"><span class="badge collecting" id="aiStatus">正在同步任务</span><h2 id="aiStage">正在读取执行状态…</h2><p class="helper" id="aiTiming"></p><div class="notice" id="aiRequirements"></div><p id="aiError" class="inline-error" role="alert"></p><div id="aiResult"></div><details style="margin-top:20px"><summary>查看本轮执行活动</summary><ul id="aiEvents" class="ai-events"></ul></details><div class="form-footer"><button data-action="ai-enter">← 上一步</button><div><button data-action="ai-refresh" data-id="${id}">刷新状态</button><button class="danger" id="aiStop" data-action="ai-stop" data-id="${id}" hidden>停止本轮生成</button></div></div></section>`;poll(id);}
 async function poll(id){clearTimeout(timer);try{const j=await api('/'+id);if(location.hash!=='#ai/'+id)return;currentJob=j;if(j.status==='complete'){await ui.importDraft(j);return;}el('aiError').textContent=j.error||'';el('aiStatus').textContent={running:'正在生成',complete:'待教师确认',failed:'生成失败',cancelled:'已停止'}[j.status];el('aiStage').textContent=j.stage;
 el('aiTiming').textContent=`已用时 ${Math.floor(((j.finishedAt||Date.now())-j.startedAt)/60000)}分${Math.floor(((j.finishedAt||Date.now())-j.startedAt)/1000)%60}秒`+(j.lastActivityAt?' · 最近执行活动 '+new Date(j.lastActivityAt).toLocaleTimeString('zh-CN'):' · 等待工具反馈')+' · 最长等待2小时';
 el('aiRequirements').textContent=j.requirements.goal+' · '+j.requirements.audience+' · '+j.requirements.count+'题';el('aiStop').hidden=j.status!=='running';el('aiEvents').innerHTML=j.events.map(x=>`<li>${e(new Date(x.at).toLocaleTimeString('zh-CN'))}　${e(x.text)}</li>`).join('');
 el('aiResult').innerHTML=j.status==='failed'||j.status==='cancelled'?'<p class="helper">调查需求已保留，已有问卷不受影响。</p><button data-action="ai-retry">调整需求并重新生成</button>':'';
 if(j.status==='running')timer=setTimeout(()=>poll(id),3000);
 }catch(err){if(location.hash!=='#ai/'+id)return;el('aiError').textContent='状态同步失败，任务不一定已经停止。'+err.message;timer=setTimeout(()=>poll(id),6000);}}
 async function action(a,b){
  if(a==='ai-enter')return ui.goto('ai');if(a==='ai-methods')return ui.goto('create');if(a==='ai-job')return ui.goto('ai/'+b.dataset.id);
  if(a==='ai-start'){
   if(submitting)return;const count=Number(draft.count);if(!draft.goal.trim()||!draft.audience.trim()||!Number.isInteger(count)||count<3||count>20){el('aiError').textContent='请填写调查目的、对象，以及3至20之间的整数题量。';el(!draft.goal.trim()?'aiGoal':!draft.audience.trim()?'aiAudience':'aiCount').focus();return;}
   submitting=true;el('aiStart').disabled=true;el('aiStart').textContent='正在发起…';try{const j=await api('',draft);ui.goto('ai/'+j.id);}catch(err){el('aiError').textContent=err.message;}finally{submitting=false;if(el('aiStart')){el('aiStart').disabled=false;el('aiStart').textContent='生成问卷初版';}}return;
  }
  if(a==='ai-refresh')return poll(b.dataset.id);
  if(a==='ai-stop')return ui.dialog('停止本轮问卷生成？','<p>将中断当前生成，调查需求和已有问卷会保留。已经消耗的模型额度不会退回。</p>',`<button data-action="close" autofocus>继续等待</button><button class="danger" data-action="ai-confirm-stop" data-id="${b.dataset.id}">确认停止生成</button>`);
  if(a==='ai-confirm-stop'){b.disabled=true;try{await api('/'+b.dataset.id+'/cancel',{});el('dialog').close();await poll(b.dataset.id);}finally{b.disabled=false;}return;}
  if(a==='ai-retry'){if(currentJob){draft={...currentJob.requirements};localStorage.setItem(KEY,JSON.stringify(draft));}return ui.goto('ai');}
  if(a==='ai-review'){const j=await api('/'+b.dataset.id);if(j.status!=='complete')throw Error('初版尚未生成，请刷新状态。');return await ui.importDraft(j);}
 }
 return {init,methods,form,job,action,poll};
})();
