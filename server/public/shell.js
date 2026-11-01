/* 应用外壳 · 注入侧边导航
 * 用法：<body class="shelled" data-active="home">
 *   <div class="app"><aside class="sh-side" id="shSide"></aside><main class="sh-main">…</main></div>
 */
(function () {
  const NAV = [
    { grp: '概览', items: [{ k: 'home', t: '工作台', ico: '▤', href: '/' }, { k: 'dashboard', t: '数据看板', ico: '▦', href: '/dashboard' }] },
    { grp: '课前', items: [
      { k: 'course', t: '课程管理', ico: '☰', href: '/courses' },
      { k: 'ppt', t: 'PPT管理', ico: '▧', href: '/preparation?type=ppt' },
      { k: 'plan', t: '教案制作', ico: '✎', href: '/preparation?type=plan' },
    ]},
    { grp: '课中', items: [
      { k: 'session', t: '签到管理', ico: '◉', href: '/session' },
    ]},
    { grp: '课后', items: [
      { k: 'xq', t: '学情分析', ico: '▦', href: '/xueqing?tab=warn' },
      { k: 'xq-warn', t: '预警名单', sub: true, href: '/xueqing?tab=warn' },
      { k: 'xq-stu', t: '个体画像', sub: true, href: '/xueqing?tab=stu' },
      { k: 'xq-surveys', t: '问卷管理', sub: true, href: '/questionnaires' },
      { k: 'xq-prac', t: '练习分析', sub: true, href: '/xueqing?tab=prac' },
      { k: 'hw', t: '作业管理', ico: '✓', href: '/homework' },
      { k: 'hw-list', t: '作业列表', sub: true, href: '/homework' },
      { k: 'gb', t: '自动批改', sub: true, href: '/grading' },
    ]},
    { grp: '设置', items: [
      { k: 'wb', t: 'WorkBuddy', ico: '◉', href: '/workbuddy' },
      { k: 'rules', t: '预警规则', ico: '⚑', href: '/admin?pane=set#rules' },
      { k: 'sys', t: '系统设置', ico: '⚙', href: '/admin?pane=set' },
      { k: 'backup', t: '数据与备份', ico: '⛁', href: '/backup' },
    ]},
  ];

  if (window.parent !== window && window.frameElement && window.frameElement.id === 'workspaceFrame') {
    document.body.classList.add('shelled','workspace-embedded');
    const sync = () => window.parent.workspaceLocationChanged?.(location.href);
    for (const method of ['pushState','replaceState']) {
      const original = history[method].bind(history);
      history[method] = (...args) => { const result=original(...args);sync();return result; };
    }
    window.addEventListener('hashchange',sync);
    return;
  }
  const active = document.body.dataset.active || '';
  const html = NAV.map(g => {
    const items = g.items.map(it => {
      if (!it.href) {
        return `<a class="${it.sub ? 'sub' : ''} off"><span class="ico">${it.ico || ''}</span>${it.t}` +
          (it.soon ? '<span class="soon">规划中</span>' : '') + '</a>';
      }
      const cls = [it.sub ? 'sub' : '', it.k === active || (it.k === 'xq' && active.indexOf('xq') === 0) || (it.k === 'hw' && (active.indexOf('hw') === 0 || active === 'gb')) ? 'on' : '']
        .join(' ').trim();
      return `<a class="${cls}" data-nav-key="${it.k}" href="${it.href}"><span class="ico">${it.ico || ''}</span>${it.t}</a>`;
    }).join('');
    return `<div class="sh-grp"><b>${g.grp}</b><span class="ln"></span></div>${items}`;
  }).join('');

  const side = document.getElementById('shSide');
  if (side) {
    side.innerHTML = `
      <a class="sh-brand" href="/"><img class="sh-logo" src="/assets/logo.svg" alt="一堂课 Logo" width="28" height="28"><span class="t">一堂课</span><span class="v">v3</span></a>
      <nav class="sh-nav">${html}</nav>
      <a class="sh-ft" href="/workbuddy" id="shWb" style="text-decoration:none"><i></i><span id="shWbTx">检测 WorkBuddy…</span></a>`;
    /* WorkBuddy 连接状态（失败就静默保持中性显示，不打扰） */
    fetch('/api/gb/settings').then(r => r.ok ? r.json() : null).then(wb => {
      const ft = document.getElementById('shWb');
      const tx = document.getElementById('shWbTx');
      if (!ft || !tx || !wb) return;
      if (wb.enabled) {
        tx.textContent = 'WorkBuddy 已连接' + (wb.version ? ' · v' + wb.version : '');
        ft.style.color = 'var(--ink2)';
      } else {
        tx.textContent = '未连接 WorkBuddy';
        ft.style.color = '#8a5a12';
        const dot = ft.querySelector('i');
        if (dot) { dot.style.background = 'var(--amber)'; dot.style.boxShadow = '0 0 0 3px rgba(186,117,23,.14)'; }
      }
    }).catch(() => {
      const tx = document.getElementById('shWbTx');
      if (tx) tx.textContent = '服务运行中';
    });
  }
  document.body.classList.add('shelled');
  window.updateShellActive = key => {
    document.body.dataset.active=key;
    document.querySelectorAll('[data-nav-key]').forEach(a=>{
      const k=a.dataset.navKey;
      a.classList.toggle('on',k===key||(k==='xq'&&key.startsWith('xq'))||(k==='hw'&&(key.startsWith('hw')||key==='gb')));
    });
  };
})();
