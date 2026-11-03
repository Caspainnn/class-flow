'use strict';
// Keep the animated track and <details> alive across polling/timer updates.
window.PptExecutionView=(()=>{
 const mounted=new WeakMap(),historyOpen=new Map();
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const teacherText=value=>String(value??'').replace(/HTML/g,'课件').replace(/PPTX/g,'可编辑PPT');
 const duration=ms=>{const seconds=Math.max(0,Math.floor(ms/1000));return `${Math.floor(seconds/60)}分${String(seconds%60).padStart(2,'0')}秒`;};
 function update(target,run,now=Date.now()){
  let state=mounted.get(target);
  if(!state||state.runId!==run.id){
   const labels=run.phase==='outline'?['启动任务','读取要求','整理大纲','交付与校验']:run.phase==='export'?['启动任务','读取当前课件','导出可编辑PPT','检查与交付']:['启动任务','读取大纲','编写课件','检查与交付'];
   target.innerHTML=`<ol class="execution-steps">${labels.map((label,i)=>`<li><span>${i+1}</span>${label}</li>`).join('')}</ol><div class="execution-activity" data-progress="activity" role="status"></div><div class="execution-indeterminate" role="progressbar" aria-label="正在处理，暂无可计算的完成百分比"></div><dl class="execution-metrics"><div><dt>已用时间</dt><dd data-progress="elapsed"></dd></div><div><dt>最近执行活动</dt><dd data-progress="recent"></dd></div><div><dt>进程状态</dt><dd data-progress="process"></dd></div></dl><p class="helper" data-progress="files" hidden></p><p class="execution-sync" data-progress="sync"></p><p class="execution-sync" data-progress="limit"></p><div class="execution-quiet" data-progress="quiet" role="status" hidden>较长时间未收到新的执行活动。工具可能正在等待模型或运行脚本；平台暂时无法判定是否卡住。可继续等待，或取消本次制作。</div><details class="execution-history" hidden><summary>查看本轮执行活动</summary><div class="execution-history-events"></div></details>`;
   const fields={};for(const name of ['activity','elapsed','recent','process','files','sync','limit','quiet'])fields[name]=target.querySelector(`[data-progress="${name}"]`);
   const details=target.querySelector('details');details.open=historyOpen.get(run.id)||false;details.addEventListener('toggle',()=>historyOpen.set(run.id,details.open));
   state={runId:run.id,fields,details,events:target.querySelector('.execution-history-events'),steps:[...target.querySelectorAll('li')],historyKey:null};mounted.set(target,state);
  }
  const p=run.progress||{},last=p.lastActivityAt||run.startedAt,stage={starting:0,reading:1,authoring:2,checking:3,exporting:run.phase==='export'?2:3,delivery:3}[p.stage]??0,f=state.fields;
  state.steps.forEach((node,i)=>{node.classList.toggle('active',i===stage);node.classList.toggle('past',i<stage);});
  f.activity.textContent=teacherText(p.activity)||'任务已提交，等待制作工具返回执行状态';f.elapsed.textContent=duration(now-run.startedAt);f.recent.textContent=duration(now-last)+'前';
  f.process.textContent=p.processAlive===true?'制作进程仍在运行':p.processAlive===false?'正在处理返回结果':'等待状态同步';
  f.files.hidden=!(p.sourceFiles||p.exportFiles||p.pageProgress?.total);f.files.textContent=p.pageProgress?.total?(run.engine==='local'?`${p.pageProgress.stage==='reading'?'已读取排版':'已导出'} ${p.pageProgress.completed} / ${p.pageProgress.total} 页；全部完成并校验后提供下载。`:`已完成 ${p.pageProgress.completed} / ${p.pageProgress.total} 页及对应讲稿；全部完成后统一交付。`):`已发现 ${p.sourceFiles||0} 份页面源文件、${p.exportFiles||0} 份导出文件；文件仍需通过交付校验。`;
  f.sync.textContent=(p.serverAt?`上次同步：${new Date(p.serverAt).toLocaleTimeString()}`:'正在获取执行状态')+' · 根据真实反馈更新，不推测完成百分比';
  f.limit.textContent=run.timeoutMs?`本轮最长等待 ${Math.round(run.timeoutMs/3600000*10)/10} 小时，可随时取消。`:'本轮等待上限以发起时的设置为准。';f.quiet.hidden=now-last<90000;
  const history=p.history||[],key=JSON.stringify(history);state.details.hidden=!history.length;
  if(state.historyKey!==key){state.events.innerHTML=history.map(e=>`<p><time>${esc(new Date(e.time).toLocaleTimeString())}</time> ${esc(teacherText(e.message))}</p>`).join('');state.historyKey=key;}
 }
 return {update};
})();
