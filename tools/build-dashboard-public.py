"""Build accepted prototype visuals into independent formal dashboard assets."""
from pathlib import Path
root=Path(__file__).resolve().parent.parent
out=root/'server/dashboard/public';out.mkdir(parents=True,exist_ok=True)
html=(root/'prototype/dashboard.html').read_text(encoding='utf-8')
a=html.index('<aside class="sidebar">');b=html.index('<main>',a)
html=html[:a]+html[b:]
html=html.replace('<body>','<body data-active="dashboard">').replace('href="dashboard.css"','href="/dashboard/style.css"')
html=html.replace('<b>示例数据</b>','<b class="local-badge">本机统计</b>')
html=html.replace('<span id="syncTime">尚未刷新</span>','<span id="syncTime">正在读取数据</span>')
a=html.index('<label>课程<select');b=html.index('<label>活动日期',a)
html=html[:a]+'<label>课程<select id="course"><option value="all">全部课程</option></select></label><label>学期<select id="term"><option value="all">全部学期</option></select></label>'+html[b:]
html=html.replace(' value="2026-10-01"','').replace(' value="2026-10-31"','')
html=html.replace('<div id="content"></div>','<div id="loadError" class="error" role="alert" hidden></div><div id="content" aria-busy="true"><section class="panel empty"><p>正在读取教学数据…</p></section></div>')
a=html.index('<footer>');b=html.index('</main>',a)
html=html[:a]+'<footer><span>教师端 · 只读统计 · 数据保存在本机</span><span>当前名单与历史名单可能存在差异</span></footer>'+html[b:]
a=html.index('<dialog');html=html[:a]+'<div id="toast" role="status" hidden></div><script src="/shell.js"></script><script src="/dashboard/view.js"></script><script src="/dashboard/app.js"></script></body></html>'
(out/'index.html').write_text(html,encoding='utf-8')
css=(root/'prototype/dashboard.css').read_text(encoding='utf-8')+'\n/* The application shell owns navigation and page margins. */\nmain{margin-left:0;max-width:none}body{margin:0}.eyebrow b.local-badge{background:#edf5f1;color:#57917d;border-color:#dcece3}a.text-button{display:inline-block}#loadError{margin-bottom:14px}#loadError button{font-size:11px}#content[aria-busy="true"]{opacity:.65}@media(max-width:760px){main{margin-left:0}}\n'
(out/'style.css').write_text(css+'\n.todo-symbol svg{width:16px;height:16px}\n',encoding='utf-8')
s=(root/'prototype/dashboard.js').read_text(encoding='utf-8')
a=s.index('const $=');b=s.index('function questionCharts()',a);s=s[a:b]
a=s.index('const names=');b=s.index('function badge',a);s=s[:a]+s[b:]
a=s.index('function todos(');b=s.index('function overview(',a)
s=s[:a]+'''function todos(d){return d.tasks.slice(0,5).map(t=>`<a class="todo" href="${esc(t.href)}"><span class="todo-symbol ${t.kind==='red'?'red':t.kind==='amber'?'amber':''}">${iconFor(t.kind)}</span><div><div class="todo-title">${esc(t.title)}</div><small>${esc(t.sub)}</small></div><span class="count">↗</span></a>`).join('')||'<p class="caption" style="padding:15px 0">当前没有需要处理的任务</p>';}
''' + s[b:]
s=s.replace('示例数据截至2026-10-31。','').replace('示例数据','教学数据').replace('查看全部示例数据','查看全部数据')
s=s.replace('没有活动记录','暂无活动记录')
s=s.replace("if(!d.sessions.length&&!d.homework.length&&!d.surveys.length&&!d.resources.length)return stats+empty();",'')
s=s.replace('chart(d.sessions)','chart(d.trend)')
s=s.replace("sum(named,'count')","sum(named,'totalCount')")
s=s.replace('期间 · 实名按发布名单，匿名仅计份数','期间答卷按提交时间 · 实名总回收按发布名单')
s=s.replace("`<button class=\"text-button\" data-homework=\"${i}\">明细</button>`","`<a class=\"text-button\" href=\"${esc(h.href)}\">明细</a>`")
s=s.replace("`<button class=\"text-button\" data-survey=\"${i}\">分析</button>`","`<a class=\"text-button\" href=\"${esc(q.href)}\">分析</a>`")
s=s.replace("q.mode==='named'?`${q.count}/${q.target}`:`${q.count} 份`","q.mode==='named'?`${q.totalCount}/${q.target}<small>期间 ${q.count} 份</small>`:`${q.totalCount} 份<small>期间 ${q.count} 份</small>`")
s=s.replace("h.mean,", "h.mean==null?'—':h.mean,")
s=s.replace("'关注规则 ↗'", "'关注规则 ↗'")
s=s.replace("'<button class=\"text-button\" data-detail=\"warnings\">关注规则 ↗</button>'", "'<a class=\"text-button\" href=\"/xueqing?tab=warn\">关注名单 ↗</a>'")
s=s.replace('PPT <b>${d.resources.filter', 'PPT <b>${d.resources.filter')
s=s.replace('<button class="text-button" data-detail="templates">模板 4 PPT / 3 教案 ↗</button>', '<a class="text-button" href="/preparation?type=ppt&section=templates">模板 ${d.templateCounts.ppt} PPT / ${d.templateCounts.plan} 教案 ↗</a>')
s=s.replace('<button class="text-button" data-resource="${i}">查看</button>','<a class="text-button" href="${esc(r.href)}">查看</a>')
s=s.replace("d.resources.slice(0,3)","d.resources.slice(0,4)")
s=s.replace('${todos(d)}','${todos(d)}')
s=s.replace('优先查看异常与待确认事项','当前 · '+"${d.tasks.length} 项待办，展示前5项")
# The subtitle above must remain a JS string argument, not an uninterpolated literal.
s=s.replace("'当前 · ${d.tasks.length} 项待办，展示前5项'", "`当前 · ${d.tasks.length} 项待办，展示前5项`")
for name in ['h.name','q.name','c.name','r.name']:
 s=s.replace('${'+name+'}', '${esc('+name+')}')
s=s.replace('[h.name,','[esc(h.name),').replace('[q.name,','[esc(q.name),').replace('[c.name,','[esc(c.name),')
s=s.replace('h.scored/h.total*100','(h.total?h.scored/h.total*100:0)')
s=s.replace("sum(d.surveys.filter(s=>s.mode==='anonymous'),'count')", "sum(d.surveys.filter(s=>s.mode==='anonymous'),'count')")
s=s.replace('历史课堂按当前名单；迟到已包含在到课中；关注人次按当前课程全量规则统计。','历史课堂按当前名单；迟到已包含在到课中；关注人次按当前课程全量规则统计，缺成绩不代表已核实未交。')
s=s.replace('期间 · 有效签到记录','期间 · 按日加权汇总，空签到不计入比例')
a=s.index('function chart(');b=s.index('function trend(',a)
s=s[:a]+'''function chart(s){
 if(!s.length)return '<div class="empty"><p>期间暂无有效课堂记录</p></div>';
 const X=i=>42+i*(560/Math.max(1,s.length-1)),Y=v=>155-v*1.3;
 const series=[['出勤率','#6272dc',x=>x.total?x.present/x.total*100:null],['答题参与率','#2ca997',x=>x.total?x.answered/x.total*100:null],['答对率','#d6a14b',x=>x.answered?x.correct/x.answered*100:null]];
 const grid=[0,25,50,75,100].map(v=>`<line x1="42" y1="${Y(v)}" x2="608" y2="${Y(v)}"/><text x="4" y="${Y(v)+4}">${v}%</text>`).join('');
 const lines=series.map(([name,color,value])=>{let connected=false;const points=s.map((x,i)=>{const v=value(x);if(v==null){connected=false;return '';}const op=connected?'L':'M';connected=true;return `${op}${X(i)} ${Y(v)}`;}).join(' ');return `<path class="series" stroke="${color}" d="${points}"/>`+s.map((x,i)=>{const v=value(x);return v==null?'':`<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${color}"><title>${x.date} ${name} ${v.toFixed(1)}%</title></circle>`;}).join('');}).join('');
 const area=s.length>1?`<defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6475e8" stop-opacity=".17"/><stop offset="100%" stop-color="#6475e8" stop-opacity="0"/></linearGradient></defs><path d="M${X(0)} 155 L${s.map((x,i)=>`${X(i)} ${Y(x.present/x.total*100)}`).join(' L')} L${X(s.length-1)} 155 Z" fill="url(#attendanceFill)"/>`:'';
 return `<svg class="chart" viewBox="0 0 620 190" role="img" aria-label="所选日期按人次加权的出勤、答题参与与答对趋势">${grid}${area}${lines}${s.filter((_,i)=>i%Math.max(1,Math.ceil(s.length/6))===0||i===s.length-1).map(x=>`<text text-anchor="middle" x="${X(s.indexOf(x))}" y="180">${x.date.slice(5)}</text>`).join('')}</svg>`;
}
''' + s[b:]
# The unused prototype trend helper is intentionally omitted from the runtime.
a=s.index('function trend(');b=s.index('function todos(',a);s=s[:a]+s[b:]
(out/'view.js').write_text("'use strict';\n"+s,encoding='utf-8')
