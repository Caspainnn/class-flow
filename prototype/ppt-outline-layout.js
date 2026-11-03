'use strict';
// Isolated demonstration: no production scripts, API calls or teaching records.
(()=>{
 const root=document.getElementById('prototypeRoot'),list=document.getElementById('outlinePages'),picker=document.getElementById('layoutPicker'),discardDialog=document.getElementById('discardDialog'),toast=document.getElementById('toast');
 const storageKey='inclass.prototype.outline-layout.v1';
 const layouts=[
  {id:'cover',name:'课程封面',number:'首页专用',role:'cover',description:'课程名称、授课人和日期，使用已确认的封面页。',capacity:'主标题与少量课程信息',limit:'仅用于首页'},
  {id:'text',name:'标题与正文',number:'布局 1',description:'保留完整正文区域，适合概念讲解、归纳和知识梳理。',capacity:'一段简洁解释或若干条短要点',limit:'内容过多时应拆页，不缩小字号硬塞'},
  {id:'compare',name:'双栏对比',number:'布局 2',description:'两组内容并列呈现，便于比较概念、方案或正反案例。',capacity:'两个主题，每组约 2—4 条短要点',limit:'不适合两栏同时放置大段正文'},
  {id:'image',name:'左文右图',number:'布局 3',description:'左侧解释概念，右侧通过教学图片或图示辅助理解。',capacity:'一组短说明和一张相关教学图',limit:'需要与教学内容相关的图示'},
  {id:'steps',name:'横向流程',number:'布局 4',description:'按先后顺序组织内容，适合讲解操作步骤和处理流程。',capacity:'三个主要步骤，每步少量要点',limit:'不适合没有先后关系的长段内容'},
  {id:'three',name:'三项并列',number:'布局 5',description:'三个独立且同等重要的要点，以等宽区域并列展示。',capacity:'三个主题，每个约 1—3 条要点',limit:'不适合需要强调主次关系的内容'},
  {id:'case',name:'案例与解析',number:'布局 6',description:'左侧呈现案例情境，右侧提炼判断依据、分析或结论。',capacity:'一个短案例和一组分析结论',limit:'避免单页放入多个完整案例'},
  {id:'ending',name:'回顾与结束',number:'结束页专用',role:'ending',description:'简短回顾课程要点并结束课堂，使用已确认的结束页。',capacity:'一句结语和少量回顾提示',limit:'仅用于最后一页'}
 ];
 const initial=[
  {title:'AI安全第一课',minutes:1,source:'原第 1 页',content:'引出本课主题：识别 AI 使用中的风险，建立安全使用习惯。\n用一个生活中的 AI 使用场景开始课堂。',layout:'cover'},
  {title:'两类常见风险：信息泄露与错误信息',minutes:4,source:'原第 2—3 页 · 合并',content:'信息泄露：把个人资料、账号信息或内部文件交给 AI。\n错误信息：回答看似可信，但事实、来源或结论存在错误。\n通过两个简短情境，对比风险与应对方式。',layout:'compare'},
  {title:'使用 AI 前，先做这三个检查',minutes:4,source:'原第 4 页',content:'检查输入：是否包含个人信息或敏感资料。\n核实输出：关键事实是否有可靠来源。\n决定采用：结合使用场景，判断是否需要人工复核。',layout:'steps'},
  {title:'课堂讨论：这条回答可信吗？',minutes:5,source:'原第 5 页',content:'呈现一段带有可疑引用的 AI 回答。\n让学生找出需要核查的信息，并说明判断依据。\n讨论核实方法，归纳可以直接采用与需要复核的边界。',layout:'case'},
  {title:'把安全习惯用到日常学习中',minutes:5,source:'原第 6 页',content:'不输入不宜外发的个人资料和敏感信息。\n对关键事实、数据和引用进行核实。\n重要决定保留人工判断，不直接照搬 AI 回答。',layout:'text'},
  {title:'带着三个检查，再次出发',minutes:1,source:'原第 7 页',content:'回顾：检查输入、核实输出、人工复核。\n邀请学生说出下一次使用 AI 时会改变的一个做法。',layout:'ending'}
 ];
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const layout=id=>layouts.find(item=>item.id===id);
 const options=i=>i===0?layouts.filter(item=>item.role==='cover'):i===initial.length-1?layouts.filter(item=>item.role==='ending'):layouts.filter(item=>!item.role);
 const validPage=(page,i)=>page&&typeof page.title==='string'&&page.title.trim()&&page.title.length<=200&&typeof page.content==='string'&&page.content.trim()&&page.content.length<=6000&&Number.isFinite(page.minutes)&&page.minutes>=.5&&page.minutes<=240&&Number.isInteger(page.minutes*2)&&options(i).some(item=>item.id===page.layout);
 let pages=initial.map(page=>({...page})),editing=-1,draft=null,pickerIndex=-1,pendingLayout='',discardNext=null,toastTimer=null;
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved)&&saved.length===initial.length&&saved.every(validPage))pages=saved.map((page,i)=>({...initial[i],title:page.title,minutes:page.minutes,content:page.content,layout:page.layout}));}catch{}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify(pages));return true;}catch{return false;}}
 function message(text){clearTimeout(toastTimer);toast.textContent=text;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,3500);}
 function savedMessage(text){message(persist()?text:text+' 当前浏览器无法保存，刷新后将恢复示例。');}
 function lines(x,y,width){return `<rect class="diagram-line" x="${x}" y="${y}" width="${width}" height="4" rx="2"/><rect class="diagram-line" x="${x}" y="${y+11}" width="${width*.9}" height="4" rx="2"/><rect class="diagram-line" x="${x}" y="${y+22}" width="${width*.65}" height="4" rx="2"/>`;}
 function block(x,y,w,h,label){return `<rect class="diagram-block" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><text class="diagram-text" x="${x+10}" y="${y+21}">${label}</text>${lines(x+10,y+35,w-24)}`;}
 function diagram(id){
  let body='';
  if(id==='cover'||id==='ending')body=`<rect class="diagram-cover" width="320" height="180"/><rect class="diagram-line" x="32" y="37" width="28" height="4" rx="2"/><text class="diagram-cover-label" x="32" y="83">${id==='cover'?'课程主标题':'回顾与结束'}</text><text class="diagram-cover-subtitle" x="32" y="111">${id==='cover'?'授课人与日期':'一句结语 · 课堂回顾'}</text>`;
  else{
   if(id==='text')body=block(25,58,270,99,'正文区域');
   if(id==='compare')body=block(25,58,130,99,'对比主题 A')+block(165,58,130,99,'对比主题 B');
   if(id==='image')body=block(25,58,135,99,'文字说明')+'<rect class="diagram-image" x="171" y="58" width="124" height="99" rx="4"/><text class="diagram-text" x="201" y="110">教学图示</text>';
   if(id==='steps')body=[25,120,215].map((x,i)=>block(x,70,80,77,'步骤 '+(i+1))).join('')+'<polygon class="diagram-arrow" points="109,103 116,108 109,113"/><polygon class="diagram-arrow" points="204,103 211,108 204,113"/>';
   if(id==='three')body=[25,120,215].map((x,i)=>block(x,58,80,99,'要点 '+(i+1))).join('');
   if(id==='case')body=block(25,58,158,99,'案例情境')+block(194,58,101,99,'分析结论');
   body='<rect class="diagram-paper" width="320" height="180"/><rect class="diagram-accent" width="5" height="180"/><rect class="diagram-heading" x="25" y="25" width="125" height="10" rx="2"/>'+body;
  }
  return `<svg class="prototype-slide-diagram" viewBox="0 0 320 180" role="img" aria-label="${esc(layout(id).name)}结构示意">${body}</svg>`;
 }
 function editor(page,i){return `<form class="prototype-edit-form" data-page="${i}" novalidate><div class="prototype-edit-fields"><div><label for="pageTitle${i}">本页标题</label><input id="pageTitle${i}" name="title" maxlength="200" value="${esc(page.title)}" required></div><div><label for="pageMinutes${i}">时长（分钟）</label><input id="pageMinutes${i}" name="minutes" type="number" min="0.5" max="240" step="0.5" value="${page.minutes}" required></div></div><div><label for="pageContent${i}">本页展示内容、图示与课堂安排</label><textarea id="pageContent${i}" name="content" maxlength="6000" required>${esc(page.content)}</textarea></div><p class="prototype-field-error" role="alert" hidden></p><div class="prototype-form-actions"><button type="submit" class="primary">保存修改</button><button type="button" data-action="cancel-edit">取消编辑</button></div></form>`;}
 function render(){
  list.innerHTML=pages.map((saved,i)=>{
   const active=editing===i,page=active?draft:saved,chosen=layout(page.layout);
   return `<article class="outline-row prototype-outline-row ${active?'is-editing':''}" data-page="${i}" aria-label="第 ${i+1} 页大纲"><span class="prototype-page-number">第${i+1}页</span><div class="prototype-page-content"><div class="prototype-page-heading"><div><strong>${esc(saved.title)}</strong><div class="prototype-page-meta"><span>来源：${esc(initial[i].source)}</span><span>${page.minutes} 分钟</span></div></div>${active?'<span class="tag blue">编辑中</span>':`<button type="button" class="text-button" data-action="edit" data-page="${i}">编辑大纲</button>`}</div>${active?editor(page,i):`<p class="prototype-page-description">${esc(page.content)}</p>`}</div><aside class="prototype-page-layout" aria-label="第 ${i+1} 页模板布局">${diagram(page.layout)}<div class="prototype-layout-caption"><span>${esc(chosen.name)}</span><small>${esc(chosen.number)}</small></div><button type="button" class="text-button" data-action="choose" data-page="${i}">${chosen.role?'查看专用布局':'更换布局'}</button></aside></article>`;
  }).join('');
  const total=pages.reduce((sum,page,i)=>sum+(editing===i?(Number(draft.minutes)||0):page.minutes),0),summary=document.getElementById('outlineTotal');
  summary.textContent=`共 ${pages.length} 页 · 合计 ${total} / 20 分钟${total!==20?' · 请核对时长安排':''}${editing!==-1?' · 本页修改尚未保存':''}`;summary.classList.toggle('time-warning',total!==20);
 }
 function dirty(){return editing!==-1&&JSON.stringify(draft)!==JSON.stringify(pages[editing]);}
 function focusRow(i,action='edit'){list.querySelector(`[data-action="${action}"][data-page="${i}"]`)?.focus();}
 function finishEditing(){editing=-1;draft=null;render();}
 function requestEndEdit(next){if(dirty()){discardNext=next;discardDialog.showModal();return;}finishEditing();next();}
 function startEditing(i){editing=i;draft={...pages[i]};render();document.getElementById('pageTitle'+i).focus();}
 function updatePicker(){
  const current=(editing===pickerIndex?draft:pages[pickerIndex]),chosen=layout(pendingLayout),allowed=options(pickerIndex);
  document.getElementById('layoutPickerContext').textContent=`第 ${pickerIndex+1} 页 · ${current.title}`;
  document.getElementById('layoutOptions').innerHTML=allowed.map(item=>`<button type="button" class="prototype-layout-option" data-action="pick" data-layout="${item.id}" aria-pressed="${item.id===pendingLayout}">${diagram(item.id)}<span class="prototype-option-heading"><span>${esc(item.name)}</span><em>${item.id===pendingLayout?'✓ 已选':''}</em></span><span class="prototype-option-meta">${esc(item.number)}${item.id===current.layout?' · 当前使用':item.id===initial[pickerIndex].layout?' · 原推荐':''}</span></button>`).join('');
  document.getElementById('layoutDetail').innerHTML=diagram(chosen.id)+`<h3>${esc(chosen.name)}</h3><p>${esc(chosen.description)}</p><dl><dt>内容容量参考</dt><dd>${esc(chosen.capacity)}</dd><dt>使用限制</dt><dd>${esc(chosen.limit)}</dd></dl>`;
  picker.querySelector('[data-action="apply-layout"]').disabled=Boolean(chosen.role);
 }
 document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-demo-nav]');if(nav){event.preventDefault();message('当前为独立原型，仅演示大纲编辑与布局选择。');return;}
  const button=event.target.closest('button[data-action]');if(!button)return;
  const action=button.dataset.action,i=Number(button.dataset.page);
  if(action==='edit'){if(editing!==-1)requestEndEdit(()=>startEditing(i));else startEditing(i);}
  if(action==='cancel-edit'){const previous=editing;requestEndEdit(()=>focusRow(previous));}
  if(action==='choose'){pickerIndex=i;pendingLayout=(editing===i?draft:pages[i]).layout;updatePicker();picker.showModal();}
  if(action==='pick'&&options(pickerIndex).some(item=>item.id===button.dataset.layout)){pendingLayout=button.dataset.layout;updatePicker();picker.querySelector(`[data-layout="${pendingLayout}"]`).focus();}
  if(action==='close-picker'){picker.close();focusRow(pickerIndex,'choose');}
  if(action==='apply-layout'&&!layout(pendingLayout).role){
   if(editing===pickerIndex){draft.layout=pendingLayout;message(`第 ${pickerIndex+1} 页已选择「${layout(pendingLayout).name}」，保存修改后生效。`);}
   else{pages[pickerIndex].layout=pendingLayout;savedMessage(`第 ${pickerIndex+1} 页布局已更新为「${layout(pendingLayout).name}」。`);}
   picker.close();render();focusRow(pickerIndex,'choose');
  }
  if(action==='keep-editing'){discardDialog.close();discardNext=null;document.getElementById('pageTitle'+editing)?.focus();}
  if(action==='discard'){discardDialog.close();const next=discardNext;discardNext=null;finishEditing();next?.();message('已放弃本页修改。');}
  if(action==='confirm'){if(editing!==-1){message('请先保存或取消正在编辑的页面。');document.getElementById('pageTitle'+editing)?.focus();}else message('原型演示：已确认大纲，不会启动实际课件制作。');}
  if(action==='back'){const next=()=>message('原型演示：上一步为选择制作方式。');if(editing!==-1)requestEndEdit(next);else next();}
  if(action==='demo-nav')message('当前为独立原型，正式课件列表未接入。');
 });
 document.addEventListener('input',event=>{
  if(!event.target.closest('.prototype-edit-form')||editing===-1)return;
  const field=event.target.name;if(field==='title'||field==='content')draft[field]=event.target.value;if(field==='minutes')draft.minutes=Number(event.target.value);
  const error=list.querySelector('.prototype-field-error');if(error)error.hidden=true;
  event.target.removeAttribute('aria-invalid');
 });
 document.addEventListener('submit',event=>{
  if(!event.target.matches('.prototype-edit-form'))return;event.preventDefault();
  let invalid='',explanation='';
  if(!draft.title.trim()){invalid='title';explanation='请填写本页标题。';}
  else if(!Number.isFinite(draft.minutes)||draft.minutes<.5||draft.minutes>240||!Number.isInteger(draft.minutes*2)){invalid='minutes';explanation='时长请输入 0.5 至 240 分钟，并以 0.5 分钟递增。';}
  else if(!draft.content.trim()){invalid='content';explanation='请填写本页内容要点。';}
  if(invalid){const error=event.target.querySelector('.prototype-field-error');error.textContent=explanation;error.hidden=false;const input=event.target.querySelector(`[name="${invalid}"]`);input.setAttribute('aria-invalid','true');input.focus();return;}
  const i=editing;pages[i]={...draft,title:draft.title.trim(),content:draft.content.trim()};finishEditing();savedMessage(`第 ${i+1} 页修改已保存到本原型。`);focusRow(i);
 });
 picker.addEventListener('cancel',()=>{setTimeout(()=>focusRow(pickerIndex,'choose'),0);});
 discardDialog.addEventListener('cancel',()=>{discardNext=null;setTimeout(()=>document.getElementById('pageTitle'+editing)?.focus(),0);});
 window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
 render();
})();
