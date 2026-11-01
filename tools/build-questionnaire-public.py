"""Port the accepted isolated UI to server-backed assets; never migrates demo data."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
out=root/'server/questionnaire/public'
out.mkdir(parents=True,exist_ok=True)
def source(name):return (root/'prototype'/name).read_text(encoding='utf-8')
def write(name,s):(out/name).write_text(s,encoding='utf-8')
write('style.css',source('questionnaire.css')+'\nbody.workspace-embedded .prototype-banner{display:none}body.workspace-embedded .survey-main{padding:24px 32px!important}\n')
model=source('questionnaire-model.js')
model=re.sub(r' const courses=\[.*?;\n',' const courses=[];\n',model,count=1)
start=model.index(' function seed(){');end=model.index(' function validate(',start)
model=model[:start]+" function seed(){return {version:1,surveys:[]};}\n"+model[end:]
model=re.sub(r' const roster=course=>.*?;\n'," const roster=course=>root.QuestionnaireRosters?.[course]||[];\n",model,count=1)
write('model.js',model)
html=source('questionnaire.html')
a=html.index('<aside ');b=html.index('</aside>',a)+len('</aside>')
html=html[:a]+'<aside class="sh-side" id="shSide"></aside>'+html[b:]
a=html.index('<div class="prototype-banner">');b=html.index('<div id="view">',a)
html=html[:a]+'<div class="prototype-banner" hidden><p></p><button data-action="reset" hidden></button></div>'+html[b:]
html=html.replace('/server/public/shell.css','/shell.css').replace('href="questionnaire.css"','href="/questionnaire/style.css"')
html=html.replace('/server/public/assets/logo.svg','/assets/logo.svg')
for old,new in [('questionnaire-model.js','model.js'),('questionnaire-ai.js','ai.js'),('questionnaire-dashboard.js','dashboard.js'),('questionnaire.js','teacher.js')]:html=html.replace('src="'+old+'"','src="/questionnaire/'+new+'"')
html=html.replace('</body>','<script src="/shell.js"></script></body>').replace('<body class="shelled">','<body class="shelled" data-active="xq-surveys">').replace('原型','')
write('index.html',html)
ui=source('questionnaire.js')
start=ui.index('function student(id)');end=ui.index('function notFound(',start)
ui=ui[:start]+ui[end:]
ui=ui.replace("else if(parts[0]==='student')student(parts[1]);",'')
ui=re.sub(r'function shellStudent\(isStudent\)\{[^\n]*\}',"function shellStudent(){document.title='问卷管理 · 一堂课';document.querySelector('[data-action=\\\"reset\\\"]').hidden=true;}",ui,count=1)
ui='\n'.join(line for line in ui.split('\n') if "if(a==='student-reset-view')" not in line)
ui=ui.replace("courseFilter='all'", "courseFilter=new URLSearchParams(location.search).get('courseId')||'all'",1)
a=ui.index('let state;');b=ui.index('\nlet clients=',a)
ui=ui[:a]+"let state=await request('/api/questionnaires');const studentOrigin=state.studentOrigin;Q.courses.splice(0,Q.courses.length,...state.courses);window.QuestionnaireRosters=state.rosters;"+ui[b:]
a=ui.index('function persist(){');b=ui.index('\nfunction toast',a)
ui=ui[:a]+'''async function persist(){busy=true;try{const saved=await request('/api/questionnaires',{method:'PUT',body:JSON.stringify({revision:state.revision,surveys:state.surveys})});state=saved;}catch(e){try{state=await request('/api/questionnaires');}catch{}throw e;}finally{busy=false;}}
'''+ui[b:]
ui=ui.replace("location.origin+location.pathname+'#student/'+s.id", "studentOrigin+'/questionnaire/student.html#'+s.id")
ui=ui.replace('src="/demo-qr.svg?id=', 'src="/api/questionnaires/qr?id=')
ui=ui.replace("courseFilter==='all'?'math':courseFilter", "courseFilter==='all'?(Q.courses[0]?.id||''):courseFilter")
# Rendering only derives deadline status; no save is started by a render.
ui=ui.replace("s.status='ended';persist();", "s.status='ended';")
ui=ui.replace('function saveDraft(){','async function saveDraft(){').replace('if(!saveDraft())','if(!await saveDraft())').replace('if(saveDraft())','if(await saveDraft())').replace('&&!saveDraft()', '&&!await saveDraft()')
ui=ui.replace('work.updatedAt=Date.now();',"work.status='draft';work.updatedAt=Date.now();")
ui=ui.replace("if(a==='publish'){", "if(a==='publish'){if(!await saveDraft())return;")
ui=ui.replace('importDraft(job){','async importDraft(job){').replace('persist();','await persist();')
# Reset is deliberately absent from formal UI and handlers.
ui='\n'.join(line for line in ui.split('\n') if "if(a==='reset')" not in line and "if(a==='confirm-reset')" not in line and not line.startswith("window.addEventListener('storage'"))
ui=ui.replace("if(a==='refresh'){try{const stored=JSON.parse(localStorage.getItem(STORE));if(stored?.version===1)state=stored;}catch{}", "if(a==='refresh'){state=await request('/api/questionnaires');")
ui=ui.replace('原型已模拟发布，未向真实学生发放','问卷已发布，可在课堂展示二维码').replace('演示草稿已保存','草稿已保存').replace('演示数据已导出','数据已导出').replace('演示数据','数据').replace('学生端演示','学生填写').replace('更新演示回收情况','更新回收情况').replace('已更新演示回收情况','已更新回收情况')
ui=ui.replace('if(a===\'refresh\'){',"if(a==='refresh'){")
ui=ui.replace('当前为交互原型，只模拟发布，不向真实学生发放。','发布后学生可通过课堂二维码填写问卷。')
ui=ui.replace('当前为本机原型演示。此二维码不是正式课堂发放地址，手机扫描本机地址无法访问。','学生与老师需处于可互通的同一网络，老师电脑应保持运行。')
ui=ui.replace('仅本机演示，不是可直接发给学生的正式局域网地址。','请在课堂展示二维码，学生与老师需处于可互通网络。')
ui=ui.replace('正式发放会使用老师电脑的局域网地址，学生与老师需处于可互通的网络，老师电脑保持运行。原型没有连接正式名单或收集真实回答。','链接使用已配置的学生访问地址。同一网络不一定互通，请确认防火墙允许课堂设备访问。')
ui=ui.replace('所有数据均为合成演示数据。','').replace('只移除此原型中的草稿','只移除此问卷草稿')
ui=ui.replace('原型会下载可在Excel打开的CSV文件。正式版计划提供多工作表XLSX导出。','下载可在Excel打开的CSV文件，按所选范围导出。')
ui=ui.replace("document.title=isStudent?'问卷填写 · 一堂课原型':'问卷管理 · 一堂课原型'", "document.title='问卷管理 · 一堂课'")
pending="""async function loadPendingGeneration(){if(location.hash!=='#list')return;try{const data=await request('/api/questionnaire-ai');if(location.hash!=='#list')return;const job=data.jobs.find(j=>['running','complete','failed'].includes(j.status)&&!state.surveys.some(s=>s.aiJobId===j.id));document.getElementById('pendingGeneration')?.remove();if(job)$('view').insertAdjacentHTML('afterbegin',`<div id="pendingGeneration" class="notice">${job.status==='running'?'WorkBuddy 正在后台制作问卷':job.status==='complete'?'WorkBuddy 初版已生成，待教师审阅':'上次问卷生成未完成，可查看并重试'}：${esc(job.requirements.goal)} <a href="#ai/${job.id}">继续制作 →</a></div>`);}catch{}}
"""
ui=pending+ui
ui=ui.replace('function renderList(){',"function renderList(){setTimeout(loadPendingGeneration,0);")
ui=ui.replace("if(!location.hash)history.replaceState(null,'','#list');render();", "if(!location.hash)history.replaceState(null,'','#list');render();window.appCanNavigate=()=>{if(!dirty())return true;askLeave('#list');return false;};setInterval(async()=>{if(work||busy||$('dialog').open||document.activeElement?.matches?.('input,textarea,select'))return;try{const fresh=await request('/api/questionnaires');if(fresh.revision!==state.revision){state=fresh;const scroll=document.querySelector('.sh-main').scrollTop;render();document.querySelector('.sh-main').scrollTop=scroll;}else loadPendingGeneration();}catch{error('本地服务连接中断，当前内容已保留，请稍后刷新。');}},5000);")
ui="(async()=>{\nasync function request(url,options={}){const r=await fetch(url,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||'操作未完成，请重试。');return data;}\n"+ui+"\n})().catch(e=>{document.getElementById('view').textContent='问卷加载失败：'+e.message;});\n"
write('teacher.js',ui)
ai=source('questionnaire-ai.js').replace('ui.importDraft(j);','await ui.importDraft(j);').replace("'inclass.questionnaire.prototype.ai-requirements.v1'","'inclass.questionnaire.ai-requirements.v1'")
ai=ai.replace('问卷发布和回收仍为原型演示。','生成后需由教师确认发布。')
write('ai.js',ai)
write('dashboard.js',source('questionnaire-dashboard.js').replace('问卷看板原型 · 使用本机问卷演示数据。正式出勤、作业和学生预警数据未混入此页。','问卷统计来自本机已发布问卷。').replace('http://127.0.0.1:3000/xueqing?tab=dash','/xueqing?tab=dash'))
