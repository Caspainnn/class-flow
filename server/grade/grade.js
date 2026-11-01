'use strict';
/**
 * 作业批改模块（课后 → 作业批改）
 *
 * 两种批改方式：
 *   平台调用 —— spawn 本机 WorkBuddy 自带的 codebuddy 命令，在批改目录里逐份批改，
 *              要求它写回 批改结果.json，平台解析后进成绩表；
 *   手动调用 —— 平台准备好目录和提示词，老师自己粘到 WorkBuddy 里批，
 *              批完把 Excel（姓名/得分/作业情况）导回平台。
 *
 * 归档：结果按学号写进 data/homework.json 的 scores，学情分析直接吃。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');           // 项目根
const homeworkService = require('../lib/homework');

const DEFAULT_WB = {
  enabled: false, path: null, version: null,
  model: 'default', timeoutMs: 60000,
  background: true, noHistory: true, keepRaw: false,
  verifiedAt: null, lastError: null,
};

module.exports = async function (req, res, ctx) {
  const { url, m, json, readBody, store, ExcelJS, findCourse, getStudents, getSessions } = ctx;
  const p = url.pathname;
  const GB_DIR = path.join(store.DATA_DIR, '\u6279\u6539');
  const homework = homeworkService(ctx);

  /* ---------- 页面 ---------- */
  if (p === '/homework') return sendPage(res, 'homework.html');
  if (p === '/grading') return sendPage(res, 'grading.html');
  if (p === '/workbuddy') return sendPage(res, 'wbset.html');

  const J = (...a) => { json(...a); return true; };

  /* ---------- 工具 ---------- */
  /* 批次列表：内存缓存。getBatches 每次重读会让路由里对 batch 的修改
     在 homework.saveBatch(batch) 时被新数组覆盖丢失，必须持有同一引用 */
  const getBatches = () => homework.allBatches().filter(b => !b.deletedAt);
  const getWb = () => Object.assign({}, DEFAULT_WB, (store.read('settings', {}) || {}).workbuddy || {});
  const saveWb = patch => {
    const s = store.read('settings', {});
    s.workbuddy = Object.assign({}, getWb(), patch);
    store.write('settings', s);
    return s.workbuddy;
  };
  const batchDir = id => path.join(GB_DIR, id);

  function sendPage(res, name) {
    try {
      const buf = fs.readFileSync(path.join(__dirname, 'public', name));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(buf);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('页面文件缺失：' + name);
    }
  }

  /* 批次下文件的匹配名：学号+姓名.扩展名 */
  function matchName(stu) { return (stu.id || '') + (stu.name || ''); }

  /* 生成批改提示词（手动调用用，也作为平台调用的内核） */
  function buildPrompt(batch, dirAbs, asJson) {
    const roster = getStudents(batch.courseId);
    const total = batch.questions.reduce((a, q) => a + Number(q.points || 0), 0);
    const lines = [];
    lines.push(dirAbs);
    lines.push(`该目录中有学生作业和 1 份「标准答案和评分规则.txt」，请帮我逐份批改（名单共 ${roster.length} 人，已收到 ${batch.files.filter(f => f.status === 'matched').length} 份）。`);
    if (asJson) {
      lines.push('批完后，把结果写入同一目录下的「批改结果.json」文件（用 Write 工具，路径就是目录路径加文件名），格式为 JSON 数组，每个学生一个对象：');
      lines.push('{"姓名":"…","得分":数字,"题目":[{"得分":数字,"满分":数字,"说明":"扣在哪"}],"总评":"一句话"}');
      lines.push('交了别人作业、正文署名与文件名不符、无法读取的，得分填 null，并在对象里加 "异常":"原因"。');
      lines.push('重要：必须真的用工具写出这个文件；如果写文件失败，必须把完整 JSON 数组（从 [ 到 ]）打印在最终回复的最后，不要只给表格摘要。');
    } else {
      lines.push('把结果输出为 Excel 表格，保存到同一目录下「作业批改结果.xlsx」：');
      lines.push('第一列 姓名；第二列 得分；第三列 作业情况。');
      lines.push('作业情况里写清每题得分和失分原因，最后给一句总评；');
      lines.push('正文署名与文件名不符（交了别人的）在作业情况里标注「异常」，不要给分。');
    }
    lines.push('题目与分值：' + batch.questions.map((q, i) => `题${i + 1} ${Number(q.points)}分（${q.text}）`).join('；') + `，满分 ${total} 分。`);
    lines.push('逐题评分标准：\n'+require('../lib/rubric').describe(batch.questions));
    if (batch.extra) lines.push('补充要求：' + batch.extra);
    if (batch.scale === 'strict') lines.push('评分尺度：从严，拿不准的扣分。');
    if (batch.scale === 'loose') lines.push('评分尺度：从宽，能给则给。');
    return lines.join('\n');
  }

  /* ============ 探测本机 codebuddy ============ */
  function candidates(extraPath) {
    const list = [];
    const push = (p2, from) => {
      if (!p2) return;
      const norm = path.resolve(p2);
      if (list.some(x => x.path.toLowerCase() === norm.toLowerCase())) return;
      list.push({ path: norm, from });
    };
    const REL = [
      ['resources', 'app.asar.unpacked', 'cli', 'bin', 'codebuddy'],
      ['resources', 'app.asar.unpacked', 'cli', 'dist', 'codebuddy-lite-wb.mjs'],
      ['resources', 'app.asar.unpacked', 'cli', 'dist', 'codebuddy-headless.js'],
    ];
    const under = base => REL.map(seg => base && path.join(base, ...seg));
    const saved = getWb();
    if (extraPath) push(extraPath, '手动指定');
    if (saved.path) push(saved.path, '上次连接');
    if (process.env.CODEBUDDY_CODE_PATH) push(process.env.CODEBUDDY_CODE_PATH, '环境变量');
    const bases = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']];
    for (const b of bases) {
      if (!b) continue;
      under(path.join(b, 'WorkBuddy')).forEach(x => push(x, '常见位置'));
      under(path.join(b, 'Programs', 'WorkBuddy')).forEach(x => push(x, '常见位置'));
    }
    if (process.platform === 'win32') {
      for (const ch of 'CDEFG') {
        const drive = ch + ':\\';
        if (!fs.existsSync(drive)) continue;
        let top = [];
        try { top = fs.readdirSync(drive, { withFileTypes: true }); } catch { continue; }
        for (const d of top) {
          if (!d.isDirectory()) continue;
          if (/^workbuddy/i.test(d.name)) under(path.join(drive, d.name)).forEach(x => push(x, `扫描 ${ch}: 盘`));
          if (/^(software|软件|apps|tools)$/i.test(d.name)) {
            let sub = [];
            try { sub = fs.readdirSync(path.join(drive, d.name), { withFileTypes: true }); } catch { continue; }
            for (const s2 of sub) if (s2.isDirectory() && /^workbuddy/i.test(s2.name))
              under(path.join(drive, d.name, s2.name)).forEach(x => push(x, `扫描 ${ch}: 盘`));
          }
        }
      }
    }
    return list;
  }

  function looksLikeScript(file) {
    try {
      const fd = fs.openSync(file, 'r');
      const b = Buffer.alloc(2);
      fs.readSync(fd, b, 0, 2, 0);
      fs.closeSync(fd);
      return b[0] === 0x23 && b[1] === 0x21;
    } catch { return false; }
  }

  function probe(file, timeoutMs) {
    return new Promise(resolve => {
      const isScript = /\.(mjs|cjs|js)$/i.test(file) || looksLikeScript(file);
      const cmd = isScript ? process.execPath : file;
      const args = (isScript ? [file] : []).concat([
        '-p', '只回复两个字母：OK',
        '--output-format', 'text', '--tools', '',
        '--permission-mode', 'dontAsk', '--no-session-persistence',
      ]);
      const t0 = Date.now();
      let out = '', settled = false, child;
      try {
        child = spawn(cmd, args, { cwd: os.tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) { return resolve({ ok: false, why: '启动失败：' + e.message }); }
      const timer = setTimeout(() => {
        if (settled) return; settled = true;
        try { child.kill(); } catch {}
        resolve({ ok: false, why: `超时（${Math.round(timeoutMs / 1000)} 秒无响应）` });
      }, timeoutMs);
      child.stdout.on('data', b => { out += b.toString(); });
      child.on('error', e => { if (!settled) { settled = true; clearTimeout(timer); resolve({ ok: false, why: '无法执行：' + e.message }); } });
      child.on('close', code => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (code === 0 && /\bOK\b/i.test(out)) resolve({ ok: true, ms: Date.now() - t0 });
        else resolve({ ok: false, why: code === 0 ? '有响应但内容异常（可能未登录）' : `退出码 ${code}` });
      });
    });
  }

  async function detectWorkbuddy(manualPath) {
    const list = candidates(manualPath);
    const wb = getWb();
    const timeoutMs = Math.min(30000, Math.max(8000, wb.timeoutMs || 20000));
    for (const it of list) {
      if (!fs.existsSync(it.path)) continue;
      const r = await probe(it.path, timeoutMs);
      if (r.ok) {
        let version = null;
        try {
          let d = path.dirname(it.path);
          for (let i = 0; i < 6; i++) {
            const pj = path.join(d, 'package.json');
            if (fs.existsSync(pj)) { version = JSON.parse(fs.readFileSync(pj, 'utf8')).version || null; break; }
            const up = path.dirname(d); if (up === d) break; d = up;
          }
        } catch {}
        return saveWb({ enabled: true, path: it.path, version, verifiedAt: Date.now(), lastError: null });
      }
      wb.lastError = `${path.basename(it.path)}：${r.why}`;
    }
    return saveWb({ enabled: false, path: manualPath && fs.existsSync(manualPath) ? manualPath : null, verifiedAt: Date.now(), lastError: list.length ? (wb.lastError || '全部候选未连通') : '未找到 codebuddy' });
  }

  /* ============ 接口 ============ */

  /* WorkBuddy 配置 */
  const hm = p.match(/^\/api\/homework(?:\/([\w-]+)(?:\/(scores|grading))?)?$/);
  if (hm) {
    try {
      if (m === 'GET' && !hm[1]) return J(res, 200, {items:homework.list(url.searchParams.get('courseId'))});
      if (m === 'GET' && hm[1] && !hm[2]) return J(res, 200, homework.detail(hm[1]));
      const body = await readBody(req);
      if (m === 'POST' && !hm[1]) return J(res, 200, homework.create(body));
      if (m === 'PUT' && hm[1] && !hm[2]) return J(res, 200, homework.update(hm[1], body));
      if (m === 'POST' && hm[2]==='grading') return J(res,200,homework.enableGrading(hm[1]));
      if (m === 'POST' && hm[2]==='scores') return J(res, 200, homework.inputScores(hm[1], body.text));
      if (m === 'DELETE' && hm[1] && !hm[2]) return J(res, 200, homework.remove(hm[1], body.confirm === true));
      return J(res, 405, {error:'不支持的操作'});
    } catch (e) { if (!e.status) throw e; return J(res, e.status, {error:e.message}); }
  }

  if (p === '/api/gb/settings' && m === 'GET') {
    return J(res, 200, getWb());
  }
  if (p === '/api/gb/settings' && m === 'PUT') {
    const b = await readBody(req);
    const patch = {};
    if (b.path !== undefined) patch.path = b.path || null;
    if (b.model) patch.model = String(b.model);
    if (b.timeoutMs) patch.timeoutMs = Math.max(10000, Number(b.timeoutMs) || 60000);
    ['background', 'noHistory', 'keepRaw'].forEach(k => { if (b[k] !== undefined) patch[k] = !!b[k]; });
    if (b.action === 'disconnect') { patch.enabled = false; patch.lastError = '手动断开'; }
    return J(res, 200, saveWb(patch));
  }
  if (p === '/api/gb/probe' && m === 'POST') {
    const b = await readBody(req).catch(() => ({}));
    const wb = await detectWorkbuddy(b.path);
    return J(res, 200, wb);
  }

  /* 模板导入仅预览，保存走统一作业接口。 */
  const rubricRoute=p.match(/^\/api\/gb\/([\w-]+)\/(rubric-template\.xlsx|rubric-import)$/);
  if(rubricRoute){
    const batch=getBatches().find(b=>b.id===rubricRoute[1]);
    if(!batch)return J(res,404,{error:'作业不存在'});
    const rubric=require('../lib/rubric');
    if(rubricRoute[2]==='rubric-template.xlsx'&&m==='GET'){
      const bytes=await rubric.template(ExcelJS,batch.questions||[]);
      res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename=grading-rubric.xlsx; filename*=UTF-8''"+encodeURIComponent('评分标准模板.xlsx'),'Cache-Control':'no-store'});return res.end(Buffer.from(bytes));
    }
    if(rubricRoute[2]==='rubric-import'&&m==='POST'){
      if(batch.status==='running'||Object.keys(batch.results||{}).length)return J(res,409,{error:'已有批改结果或正在运行，不能导入新的题目结构'});
      const body=await readBody(req,8*1024*1024);
      if(!/\.xlsx$/i.test(String(body.fileName||'')))return J(res,400,{error:'请上传xlsx评分标准模板'});
      const bytes=Buffer.from(String(body.fileBase64||'').replace(/^data:[^,]*,/,''),'base64');
      if(!bytes.length||bytes.length>5*1024*1024)return J(res,400,{error:'模板文件须在5MB以内且不能为空'});
      try {const total=(batch.questions||[]).reduce((n,q)=>n+Number(q.points),0)||100;const questions=await rubric.parse(ExcelJS,bytes,total);return J(res,200,{questions,total});}
      catch(e){return J(res,400,{error:e.message});}
    }
  }

  /* 批次 CRUD */
  if (p === '/api/gb/batches' && m === 'GET') {
    return J(res, 200, getBatches().map(b => ({
      id: b.id, courseId: b.courseId, courseName: (findCourse(b.courseId) || {}).name || '?',
      name: b.name, createdAt: b.createdAt, status: b.status, hwId:b.hwId || null, due:b.due || '', scale:b.scale, extra:b.extra,
      files: (b.files || []).length,
      graded: Object.keys(b.results || {}).length,
      roster: getStudents(b.courseId).length,
    })));
  }
  if (p === '/api/gb/batches' && m === 'POST') {
    const b = await readBody(req);
    try { const created = homework.create({...b,mode:'file'}); return J(res, 200, {...created,id:created.batchId,hwId:created.id}); }
    catch(e) { if(!e.status) throw e; return J(res,e.status,{error:e.message}); }
  }
  if (p === '/api/gb/batches' && m === 'DELETE') {
    try { return J(res,200,homework.remove(url.searchParams.get('id'),true)); }
    catch(e) { if(!e.status) throw e; return J(res,e.status,{error:e.message}); }
  }

  /* 上传作业文件（一次一个，base64） */
  const upm = p.match(/^\/api\/gb\/batches\/([\w-]+)\/files$/);
  if (upm && m === 'POST') {
    const b = await readBody(req, 60 * 1e6);
    const batch = getBatches().find(x => x.id === upm[1]);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    if (batch.status === 'running') return J(res,409,{error:'批改运行中，不能修改作业'});
    const fileName = String(b.fileName || '作业.docx');
    if (!/\.(docx|doc|pdf|txt|md|zip)$/i.test(fileName)) return J(res, 400, { error: '只支持 docx / pdf / txt / md / zip' });
    let buf;
    try { buf = Buffer.from(String(b.fileBase64 || '').replace(/^data:[^,]*,/, ''), 'base64'); } catch {}
    if (!buf || !buf.length) return J(res, 400, { error: '文件内容为空' });
    const dir = batchDir(batch.id);
    fs.mkdirSync(dir, { recursive: true });
    const safe = fileName.replace(/[\\/:*?"<>|]/g, '_');
    fs.writeFileSync(path.join(dir, safe), buf);
    if (!batch.files.some(f => f.orig === safe)) {
      batch.files.push({ orig: safe, size: buf.length, sid: null, status: 'pending', note: '' });
    }
    batch.status = batch.status === 'collect' ? 'collect' : batch.status;
    homework.saveBatch(batch);
    return J(res, 200, { ok: true, files: batch.files.length });
  }

  /* 老师复核时读取原始提交，按批次已登记的文件定位。 */
  const originalMatch = p.match(/^\/api\/gb\/batches\/([\w-]+)\/files\/(\d+)\/original$/);
  if (originalMatch && m === 'GET') {
    const batch = getBatches().find(x => x.id === originalMatch[1]);
    if (!batch) return J(res,404,{error:'批次不存在'});
    const file = (batch.files || [])[Number(originalMatch[2])];
    if (!file) return J(res,404,{error:'提交原件不存在'});
    const base = path.resolve(batchDir(batch.id));
    const target = path.resolve(base,file.orig);
    if (path.dirname(target) !== base) return J(res,400,{error:'无效的文件路径'});
    let content;
    try {
      const real = fs.realpathSync(target);
      if (path.dirname(real) !== fs.realpathSync(base)) return J(res,400,{error:'无效的文件路径'});
      content = fs.readFileSync(real);
    } catch { return J(res,404,{error:'提交原件已不存在，请重新上传'}); }
    const ext = path.extname(file.orig).toLowerCase();
    if (url.searchParams.get('preview') === '1') {
      try { return J(res,200,{name:file.orig,...await require('../lib/submission-preview')(file.orig,content)}); }
      catch (e) { return J(res,415,{error:e.message || '无法预览，请下载原件查看'}); }
    }
    const type = {'.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'}[ext];
    res.writeHead(200,{
      'Content-Type':type || 'application/octet-stream',
      'Content-Disposition':`${type && url.searchParams.get('download')!=='1'?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(file.orig)}`,
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"sandbox; default-src 'none'",
    });
    res.end(content);
    return true;
  }

  /* 重新匹配（前端传 每个文件的 sid 指定；null=自动按文件名猜） */
  const remm = p.match(/^\/api\/gb\/batches\/([\w-]+)\/match$/);
  if (remm && m === 'POST') {
    const b = await readBody(req);
    const batch = getBatches().find(x => x.id === remm[1]);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    if (batch.status === 'running') return J(res,409,{error:'批改运行中，不能修改匹配'});
    const roster = getStudents(batch.courseId);
    const byId = new Map(roster.map(s => [s.id, s]));
    (b.files || []).forEach(f => {
      const target = batch.files.find(x => x.orig === f.orig);
      if (!target) return;
      if (f.sid) { const s = byId.get(f.sid); if (s) { target.sid = s.id; target.status = 'matched'; target.note = '手动指定'; } }
      else { target.sid = null; target.status = 'pending'; target.note = '待确认'; }
    });
    /* 自动匹配剩余的 */
    batch.files.forEach(f => {
      if (f.status === 'matched' && f.sid) return;
      const m2 = guessStudent(f.orig, roster);
      if (m2) { f.sid = m2.id; f.status = 'matched'; f.note = m2.how; }
      else { f.sid = null; f.status = 'pending'; f.note = '文件名识别不出是谁'; }
    });
    homework.saveBatch(batch);
    return J(res, 200, { ok: true, files: batch.files });
  }

  /* 从文件名猜学生：优先完整「学号+姓名」，其次纯学号，再姓名 */
  function guessStudent(orig, roster) {
    const base = path.basename(orig, path.extname(orig));
    for (const s of roster) {
      if (base.includes(s.id) && base.includes(s.name || '★不存在的名字★')) return { id: s.id, how: '文件名含学号+姓名' };
    }
    for (const s of roster) if (base.includes(s.id)) return { id: s.id, how: '文件名含学号' };
    const nm = base.replace(/[\s\d._\-（）()]+/g, '');
    for (const s of roster) if (s.name && nm === s.name) return { id: s.id, how: '按姓名' };
    return null;
  }

  /* 准备批改目录（手动调用 & 平台调用共用） */
  const prm = p.match(/^\/api\/gb\/batches\/([\w-]+)\/prepare$/);
  if (prm && m === 'POST') {
    const batch = getBatches().find(x => x.id === prm[1]);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    if (batch.status === 'running') return J(res,409,{error:'批改运行中，不能重新准备目录'});
    if (!(batch.questions||[]).length || batch.questions.some(q=>!String(q.rubric||'').trim())) return J(res,400,{error:'请先在评分标准中填写并保存每道题的标准'});
    const roster = getStudents(batch.courseId);
    const byId = new Map(roster.map(s => [s.id, s]));
    const src = batchDir(batch.id);
    const finalDir = path.join(src, 'final');
    fs.rmSync(finalDir, { recursive: true, force: true });
    fs.mkdirSync(finalDir, { recursive: true });
    fs.mkdirSync(path.join(finalDir, '_待确认'), { recursive: true });

    const pending = [];
    (batch.files || []).forEach(f => {
      const s = f.sid && byId.get(f.sid);
      const srcFile = path.join(src, f.orig);
      if (!fs.existsSync(srcFile)) return;
      if (s) {
        const dest = matchName(s) + path.extname(f.orig);
        fs.copyFileSync(srcFile, path.join(finalDir, dest));
      } else {
        pending.push(f.orig);
        fs.copyFileSync(srcFile, path.join(finalDir, '_待确认', f.orig));
      }
    });
    if (pending.length) {/* _待确认 目录已提前创建 */}

    /* 评分规则文本 */
    const total = batch.questions.reduce((a, q) => a + Number(q.points || 0), 0);
    const rules = [
      `作业：${batch.name}`,
      `题目与分值（满分 ${total}）：`,
      require('../lib/rubric').describe(batch.questions),
      batch.extra ? `补充要求：${batch.extra}` : '',
    ].filter(Boolean).join('\n');
    fs.writeFileSync(path.join(finalDir, '标准答案和评分规则.txt'), rules);

    const missing = roster.filter(s => !(batch.files || []).some(f => f.sid === s.id));
    fs.writeFileSync(path.join(finalDir, '_未交名单.txt'),
      `未交（${missing.length} 人）：\n` + missing.map(s => `${s.id} ${s.name}`).join('\n'));

    const promptJson = buildPrompt(batch, finalDir, true);
    const promptXlsx = buildPrompt(batch, finalDir, false);
    fs.writeFileSync(path.join(finalDir, '提示词-平台调用.txt'), promptJson);
    fs.writeFileSync(path.join(finalDir, '提示词-手动调用.txt'), promptXlsx);

    batch.status = 'ready';
    batch.dir = path.relative(ROOT, finalDir);
    homework.saveBatch(batch);
    return J(res, 200, { ok: true, dir: batch.dir, prompt: promptXlsx, promptJson, missing: missing.map(s => s.name), pending });
  }

  /* 平台调用：跑 codebuddy */
  const runm = p.match(/^\/api\/gb\/batches\/([\w-]+)\/run$/);
  if (runm && m === 'POST') {
    const batch = getBatches().find(x => x.id === runm[1]);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    if (batch.status === 'running') return J(res, 400, { error: '正在批改中' });
    if (batch.status !== 'ready' || !batch.dir) return J(res,400,{error:'评分标准或作业已变化，请重新准备批改目录'});
    if (!(batch.questions||[]).length || batch.questions.some(q=>!String(q.rubric||'').trim())) return J(res,400,{error:'请先填写并保存每道题的评分标准'});
    const wb = getWb();
    if (!wb.enabled || !wb.path || !fs.existsSync(wb.path))
      return J(res, 400, { error: 'WorkBuddy 未连接，请到「设置 → WorkBuddy」重新检测，或改用手动调用' });
    const finalDir = path.join(batchDir(batch.id), 'final');
    if (!fs.existsSync(finalDir)) return J(res, 400, { error: '先执行「准备批改目录」' });

    batch.status = 'running';
    batch.runLog = [{ t: Date.now(), msg: '启动 WorkBuddy…' }];
    homework.saveBatch(batch);
    runCodebuddy(batch, finalDir, wb);   // 异步跑，前端轮询
    return J(res, 200, { ok: true });
  }

  function runCodebuddy(batch, finalDir, wb) {
    const log = m2 => { batch.runLog.push({ t: Date.now(), msg: m2 }); if (batch.runLog.length > 200) batch.runLog.shift(); homework.saveBatch(batch); };
    const prompt = fs.readFileSync(path.join(finalDir, '提示词-平台调用.txt'), 'utf8');
    const isScript = /\.(mjs|cjs|js)$/i.test(wb.path) || looksLikeScript(wb.path);
    const args = (isScript ? [wb.path] : []).concat([
      '-p', prompt,
      '--permission-mode', 'dontAsk',
      '--add-dir', finalDir,
      '--output-format', 'text',
    ]);
    if (wb.model && wb.model !== 'default') args.push('--model', wb.model);
    if (wb.noHistory) args.push('--no-session-persistence');
    if (wb.background) args.push('--tools', 'Read,Write,Glob,Grep,Bash');

    const timeoutAll = Math.max(120000, (batch.files.filter(f => f.status === 'matched').length + 4) * (wb.timeoutMs || 60000));
    const child = spawn(isScript ? process.execPath : wb.path, args, { cwd: finalDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let fullOut = '';   /* 全量输出：CLI 没写出文件时从 stdout 里兜底提取 JSON */
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, timeoutAll);

    child.stdout.on('data', b => {
      const s = b.toString();
      out += s; fullOut += s;
      if (fullOut.length > 400000) fullOut = fullOut.slice(-400000);
      const lines = out.split('\n'); out = lines.pop();
      lines.filter(l => l.trim()).forEach(l => log(l.trim().slice(0, 120)));
    });
    child.stderr.on('data', () => {});
    child.on('error', e => {
      clearTimeout(timer);
      batch.status = 'ready';
      log('启动失败：' + e.message);
      homework.saveBatch(batch);
    });
    child.on('close', code => {
      clearTimeout(timer);
      const jsonFile = path.join(finalDir, '批改结果.json');
      let arr = null, from = '';
      if (fs.existsSync(jsonFile)) {
        try { arr = JSON.parse(fs.readFileSync(jsonFile, 'utf8')); from = '文件'; } catch (e) { log('批改结果.json 解析失败：' + e.message); }
      }
      if (!Array.isArray(arr)) arr = extractJsonArray(fullOut), from = '输出';
      if (Array.isArray(arr) && arr.length) {
        applyResults(batch, arr, 'run');
        batch.status = 'done';
        log(`批改完成（退出码 ${code}），从${from}解析 ${Object.keys(batch.results).length} 份`);
      } else {
        batch.status = 'ready';
        log(`WorkBuddy 退出（码 ${code}）但没有可解析的批改结果。可改用手动调用：粘贴 提示词-手动调用.txt，批完导入 Excel。`);
      }
      homework.saveBatch(batch);
    });
  }

  /* 从 CLI 的 stdout 文本里提取批改结果 JSON 数组（兜底：模型没写文件却把 JSON 打在回复里） */
  function extractJsonArray(text) {
    if (!text) return null;
    const tryParse = s => { try { const v = JSON.parse(s); return Array.isArray(v) && v.length && v.some(x => x && (x['姓名'] || x.name || x['得分'] != null || x.score != null)) ? v : null; } catch { return null; } };
    const blocks = [...text.matchAll(/```json([\s\S]*?)```/g)];
    for (const b of blocks) { const v = tryParse(b[1].trim()); if (v) return v; }
    const start = text.indexOf('['), end = text.lastIndexOf(']');
    if (start >= 0 && end > start) { const v = tryParse(text.slice(start, end + 1)); if (v) return v; }
    return null;
  }

  /* 把 [{姓名,得分,题目,总评,异常}] 写进批次 results */
  function applyResults(batch, arr, source) {
    const roster = getStudents(batch.courseId);
    const latest = store.read('gradebatches', []).find(b => b.id === batch.id);
    batch.results = Object.assign({}, batch.results || {}, latest && latest.results || {});
    (Array.isArray(arr) ? arr : []).forEach(r => {
      const nm = String(r['姓名'] || r.name || '').trim();
      const stu = roster.find(s => s.name === nm) || roster.find(s => nm.includes(s.name || '★'));
      const abnormal = r['异常'] || r.abnormal || (r['得分'] == null && r.score == null ? '无法评定' : '');
      const key = stu ? stu.id : 'unknown:' + nm;
      if ((batch.results[key] || {}).modified) return;
      const items = Array.isArray(r['题目'] || r.items)
        ? (r['题目'] || r.items).map((q, i) => ({
            score: Number(q['得分'] || q.score) || 0,
            max: Number(q['满分'] || q.max) || Number((batch.questions[i] || {}).points) || 0,
            note: String(q['说明'] || q.note || '').slice(0, 300),
          }))
        : [];
      batch.results[key] = {
        name: nm || (stu && stu.name) || '?',
        sid: stu ? stu.id : null,
        total: abnormal ? null : (Number(r['得分'] || r.score) || 0),
        items, comment: String(r['总评'] || r.comment || '').slice(0, 500),
        abnormal: abnormal ? String(abnormal).slice(0, 300) : '',
        source, modified: false,
      };
    });
  }

  /* 进度轮询 */
  const stm = p.match(/^\/api\/gb\/batches\/([\w-]+)\/state$/);
  if (stm && m === 'GET') {
    const batch = getBatches().find(x => x.id === stm[1]);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    return J(res, 200, {
      id: batch.id, name: batch.name, status: batch.status, files: batch.files, results: batch.results,
      runLog: (batch.runLog || []).slice(-40), dir: batch.dir || null,
      questions: batch.questions, pass: batch.pass, courseId: batch.courseId,
      hwId:batch.hwId || null, due:batch.due || '', scale:batch.scale, extra:batch.extra,
      prompt: batch.dir ? safePrompt(batch) : null,
    });
  }

  /* 打开批改目录（资源管理器） */
  if (p === '/api/gb/open' && m === 'POST') {
    const b = await readBody(req).catch(() => ({}));
    const batch = getBatches().find(x => x.id === b.id);
    const dir = batch ? path.join(batchDir(batch.id), 'final') : GB_DIR;
    if (!fs.existsSync(dir)) return J(res, 400, { error: '目录还没生成，先在第②步点「准备批改目录」' });
    if (process.platform === 'win32') require('child_process').exec(`explorer "${dir}"`, () => {});
    else if (process.platform === 'darwin') require('child_process').exec(`open "${dir}"`);
    else require('child_process').exec(`xdg-open "${dir}"`);
    return J(res, 200, { ok: true, path: dir });
  }
  function safePrompt(batch) {
    try { return fs.readFileSync(path.join(batchDir(batch.id), 'final', '提示词-手动调用.txt'), 'utf8'); }
    catch { return null; }
  }

  /* 导入 Excel（手动调用回传） */
  const imm = p.match(/^\/api\/gb\/batches\/([\w-]+)\/import$/);
  if (imm && m === 'POST') {
    const b = await readBody(req, 40 * 1e6);
    const batch = getBatches().find(x => x.id === imm[1]);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    if (batch.status === 'running') return J(res,409,{error:'批改运行中，不能导入成绩'});
    let buf;
    try { buf = Buffer.from(String(b.fileBase64 || '').replace(/^data:[^,]*,/, ''), 'base64'); } catch {}
    if (!buf || !buf.length) return J(res, 400, { error: '文件内容为空' });
    let rows = [];
    try {
      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.load(buf);
      const ws = wb2.worksheets[0];
      if (!ws) return J(res, 400, { error: '文件里没有工作表' });
      ws.eachRow({ includeEmpty: false }, row => {
        const v = row.values.slice(1).map(x => (x == null ? '' : String(x.result !== undefined ? x.result : x).trim()));
        if (v.some(x => x)) rows.push(v);
      });
    } catch (e) { return J(res, 400, { error: '解析失败：' + e.message }); }
    if (rows.length < 2) return J(res, 400, { error: '表格内容太少，至少要有表头和一行成绩' });
    /* 找列：姓名 / 得分（不强制要作业情况） */
    const head = rows[0].map(x => x.replace(/\s/g, ''));
    let iName = head.findIndex(x => /姓名|名字|name/i.test(x));
    let iScore = head.findIndex(x => /得分|成绩|分数|score/i.test(x));
    let iCase = head.findIndex(x => /作业情况|情况|评语|comment/i.test(x));
    if (iName < 0) iName = 0;
    if (iScore < 0) iScore = 1;
    const roster = getStudents(batch.courseId);
    const arr = [];
    const unknown = [];
    rows.slice(1).forEach(v => {
      const nm = String(v[iName] || '').trim();
      if (!nm) return;
      const raw = String(v[iScore] || '').trim();
      const stu = roster.find(s => s.name === nm) || roster.find(s => nm.includes(s.name || '★'));
      const isAb = /异常/.test(raw) || /异常/.test(String(v[iCase] || ''));
      const sc = /^\d{1,3}(\.\d+)?$/.test(raw) ? Number(raw) : null;
      arr.push({
        '姓名': nm, '得分': isAb ? null : sc,
        '题目': [], '总评': String(v[iCase] || '').slice(0, 500),
        '异常': isAb ? (String(v[iCase] || '异常').slice(0, 200)) : (sc == null ? '得分列无法识别' : ''),
      });
      if (!stu) unknown.push(nm);
    });
    applyResults(batch, arr, 'import');
    batch.status = 'done';
    homework.saveBatch(batch);
    return J(res, 200, { ok: true, count: arr.length, unknown });
  }

  /* 人工改分 */
  if (p === '/api/gb/score' && m === 'POST') {
    const b = await readBody(req);
    const batch = getBatches().find(x => x.id === b.batchId);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    const r = (batch.results || {})[b.sid];
    if (!r) return J(res, 404, { error: '没有这个学生的批改记录' });
    if(batch.status === 'running') return J(res,409,{error:'批改运行中，不能改分'});
    const rawMax=(batch.questions||[]).reduce((n,q)=>n+Number(q.points||0),0)||100;
    if(b.total === null || b.total === '' || !Number.isFinite(Number(b.total)) || Number(b.total)<0 || Number(b.total)>rawMax) return J(res,400,{error:'分数超出范围'});
    r.total = Number(b.total);
    r.abnormal = '';
    r.modified = true;
    r.modifyReason = String(b.reason || '').slice(0, 200);
    homework.syncReview(batch,b.sid);
    homework.saveBatch(batch);
    return J(res, 200, { ok: true });
  }

  /* 归档：写进 homework.json，学情分析直接吃 */
  if (p === '/api/gb/batches/archive' && m === 'POST') {
    const b = await readBody(req);
    const batch = getBatches().find(x => x.id === b.batchId);
    if (!batch) return J(res, 404, { error: '批次不存在' });
    try { return J(res,200,homework.archive(batch)); }
    catch(e) { if(!e.status) throw e; return J(res,e.status,{error:e.message}); }
  }

  /* 导出成绩表 xlsx */
  const exm = p.match(/^\/api\/gb\/batches\/([\w-]+)\/export$/);
  if (exm && m === 'GET') {
    const batch = getBatches().find(x => x.id === exm[1]);
    if (!batch) { res.writeHead(404); return res.end('批次不存在'); }
    const roster = getStudents(batch.courseId);
    const wb2 = new ExcelJS.Workbook();
    const ws = wb2.addWorksheet('作业批改');
    ws.addRow([`${batch.name}　批改结果`]);
    ws.addRow([]);
    const head = ['学号', '姓名', '得分', '等级', '作业情况', '来源'];
    const hr = ws.addRow(head);
    hr.font = { bold: true };
    const byName = {};
    Object.values(batch.results || {}).forEach(r => { if (r.sid) byName[r.sid] = r; });
    const total = batch.questions.reduce((a, q) => a + Number(q.points || 0), 0);
    roster.forEach(s => {
      const r = byName[s.id];
      if (!r) return ws.addRow([s.id, s.name, '', '', '未交', '']);
      const lv = r.abnormal ? '异常' : (r.total >= 90 ? '优秀' : r.total >= batch.pass ? '及格' : '不及格');
      const detail = r.abnormal ? r.abnormal
        : r.items.length
          ? r.items.map((q, i) => `题${i + 1} ${q.score}/${q.max}`).join('；') + (r.comment ? ' —— ' + r.comment : '')
          : r.comment;
      const row = ws.addRow([s.id, s.name, r.abnormal ? null : r.total, lv, detail, r.source === 'run' ? '平台调用' : r.modified ? '人工复核' : '导入']);
      if (lv === '优秀') row.getCell(3).font = { color: { argb: 'FF0F6E56' } };
      if (lv === '不及格') row.getCell(3).font = { color: { argb: 'FFA32D2D' } };
      row.getCell(1).numFmt = '@';
    });
    ws.addRow([]);
    ws.addRow([`题目分值：${batch.questions.map((q, i) => `题${i + 1}=${q.points}`).join(' / ')}　满分 ${total}　及格线 ${batch.pass}`]);
    ws.columns.forEach(c => { c.width = [12, 10, 8, 8, 70, 10][c.number - 1] || 12; });
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(batch.name + '-批改结果.xlsx')}`,
    });
    return res.end(Buffer.from(await wb2.xlsx.writeBuffer()));
  }

  return false;   // 未命中，交给主路由
};
