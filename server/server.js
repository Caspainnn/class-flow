'use strict';

const http = require('http');
const fs = require('fs');
const ExcelJS = require('exceljs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const QRCode = require('qrcode');
const store = require('./lib/store');

store.seed();

/* ---------------- 配置 ---------------- */
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
let SETTINGS = store.read('settings', {});

const SECRET_FILE = path.join(store.DATA_DIR, '.secret');
function loadSecret() {
  try { return fs.readFileSync(SECRET_FILE); } catch {
    const s = crypto.randomBytes(32);
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRET_FILE, s);
    return s;
  }
}
const SECRET = loadSecret();

const reload = () => { SETTINGS = store.read('settings', {}); };
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

const refreshMs = () => num(SETTINGS.codeRefreshMs, 3000);
const graceSlices = () => Math.max(0, Math.floor(Number(SETTINGS.tokenGrace) || 0));
const windowMs = () => num(SETTINGS.windowMs, 90000);
const lateGraceMs = () => num(SETTINGS.lateGraceMs, 600000);
const ticketTtlMs = () => num(SETTINGS.ticketTtlMs, 120000);
const CODE_SLOT_MS = 30000;

/* ---------------- 运行态 ---------------- */
let activeSessionId = null;
let tickets = new Map();
// 设备指纹：同一台手机（同一浏览器）只允许签一个人
const DEVICE_COOKIE = 'ic_dev';

function deviceOf(req) {
  const raw = req.headers.cookie || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + DEVICE_COOKIE + '=([\\w-]+)'));
  return m ? m[1] : null;
}

/* ---------------- 工具 ---------------- */
const readBody = (req, maxLen = 1e6) => new Promise(resolve => {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > maxLen) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
});

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function sendFile(res, name) {
  const p = path.join(PUBLIC_DIR, name);
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const round1 = x => Math.round(x * 10) / 10;
const letter = i => (i >= 0 && i < 26 ? String.fromCharCode(65 + i) : '');

/* ---------------- 令牌 ---------------- */
const sliceOf = (ts = Date.now()) => Math.floor(ts / refreshMs());

function tokenFor(sessionId, slice) {
  return crypto.createHmac('sha256', SECRET).update(`${sessionId}:${slice}`).digest('base64url').slice(0, 12);
}

function verifyToken(sessionId, token) {
  if (typeof token !== 'string' || token.length !== 12) return false;
  const s = sliceOf();
  for (let i = 0; i <= graceSlices(); i++) {
    const expect = Buffer.from(tokenFor(sessionId, s - i));
    const got = Buffer.from(token);
    if (expect.length === got.length && crypto.timingSafeEqual(expect, got)) return true;
  }
  return false;
}

function codeFor(sessionId, ts = Date.now()) {
  const slot = Math.floor(ts / CODE_SLOT_MS);
  const h = crypto.createHmac('sha256', SECRET).update(`${sessionId}:c${slot}`).digest();
  return String(h.readUInt32BE(0) % 10000).padStart(4, '0');
}

function verifyCode(sessionId, code) {
  const c = String(code == null ? '' : code).replace(/\D/g, '');
  if (c.length !== 4) return false;
  const slot = Math.floor(Date.now() / CODE_SLOT_MS);
  for (let i = 0; i <= 1; i++) {
    if (codeFor(sessionId, (slot - i) * CODE_SLOT_MS) === c) return true;
  }
  return false;
}

/* ---------------- 数据访问 ---------------- */
const getCourses = () => store.read('courses', []);
const getStudents = courseId => {
  const all = store.read('students', []);
  return courseId ? all.filter(s => s.courseId === courseId) : all;
};
const getSessions = () => store.read('sessions', []);
const findCourse = id => getCourses().find(c => c.id === id) || null;

function saveSession(s) {
  const list = getSessions();
  const i = list.findIndex(x => x.id === s.id);
  if (i >= 0) list[i] = s; else list.push(s);
  store.write('sessions', list);
}

function currentSession() {
  if (!activeSessionId) return null;
  return getSessions().find(s => s.id === activeSessionId) || null;
}

function normQuestion(raw) {
  const q = raw || {};
  const text = String(q.text == null ? '' : q.text).trim();
  const options = (Array.isArray(q.options) ? q.options : [])
    .map(x => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, 6);
  let correct = Number(q.correct);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) correct = 0;
  if (!text) return { error: '题干还没填' };
  if (options.length < 2) return { error: '至少要有两个选项' };
  return { text, options, correct };
}

function startSession(courseId, rawQuestion) {
  const course = findCourse(courseId);
  if (!course) return { error: '请先选一门课程' };
  const roster = getStudents(course.id);
  if (!roster.length) return { error: '「' + course.name + '」还没有名单，先去后台导入名单' };
  const q = normQuestion(rawQuestion);
  if (q.error) return { error: q.error };

  const now = Date.now();
  const s = {
    id: store.uid(6),
    courseId: course.id,
    question: { text: q.text, options: q.options, correct: q.correct },
    startedAt: now,
    endsAt: now + windowMs(),
    closed: false,
    records: []
  };
  saveSession(s);
  activeSessionId = s.id;
  tickets = new Map();

  // 最近出过的题（最多 10 条），只是方便复用，不算题库
  const courses = getCourses();
  const c = courses.find(x => x.id === course.id);
  if (c) {
    const recent = (c.recentQuestions || []).filter(x => x.text !== q.text);
    recent.unshift({ text: q.text, options: q.options, correct: q.correct, at: now });
    c.recentQuestions = recent.slice(0, 10);
    store.write('courses', courses);
  }
  return s;
}

function sessionState(s) {
  const now = Date.now();
  const roster = getStudents(s.courseId);
  const signed = new Set(s.records.map(r => r.studentId));
  const absent = roster.filter(x => !signed.has(x.id))
    .map(x => ({ id: x.id, name: x.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const dist = s.question.options.map((_, i) => s.records.filter(r => r.answer === i).length);
  const answered = s.records.filter(r => r.answer >= 0);
  const course = findCourse(s.courseId);
  return {
    id: s.id,
    courseId: s.courseId,
    course: course ? course.name : '',
    question: { text: s.question.text, options: s.question.options, correct: s.question.correct },
    startedAt: s.startedAt,
    open: now < s.endsAt,
    remainMs: Math.max(0, s.endsAt - now),
    windowMs: windowMs(),
    total: roster.length,
    present: s.records.length,
    late: s.records.filter(r => r.status === 'late').length,
    absent,
    dist,
    correct: answered.filter(r => r.correct).length,
    answered: answered.length,
    signed: s.records.slice().sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0))
      .map(r => ({ id: r.studentId, name: r.name, status: r.status })),
    code: codeFor(s.id),
    codeRemainMs: CODE_SLOT_MS - (now % CODE_SLOT_MS),
    slice: sliceOf(now),
    tokenRemainMs: refreshMs() - (now % refreshMs()),
    refreshMs: refreshMs(),
    tokenValidMs: refreshMs() * (graceSlices() + 1)
  };
}

/* ---------------- 统计 ---------------- */
function statOfSession(s) {
  const roster = getStudents(s.courseId);
  const ids = new Set(roster.map(x => x.id));
  const recs = s.records.filter(r => ids.has(r.studentId));
  const total = roster.length;
  const present = recs.length;
  const answered = recs.filter(r => r.answer >= 0);
  return {
    id: s.id,
    courseId: s.courseId,
    startedAt: s.startedAt,
    question: s.question.text,
    total,
    present,
    late: recs.filter(r => r.status === 'late').length,
    absent: Math.max(0, total - present),
    rate: total ? round1(present / total * 100) : 0,
    correctRate: answered.length ? round1(answered.filter(r => r.correct).length / answered.length * 100) : null,
    dist: s.question.options.map((_, i) => recs.filter(r => r.answer === i).length)
  };
}

function courseStats(courseId) {
  const course = findCourse(courseId);
  if (!course) return null;
  const roster = getStudents(courseId);
  const sessions = getSessions().filter(s => s.courseId === courseId).sort((a, b) => a.startedAt - b.startedAt);

  const perStudent = roster.map(stu => {
    let attended = 0, late = 0, answered = 0, correct = 0;
    sessions.forEach(s => {
      const r = s.records.find(x => x.studentId === stu.id);
      if (!r) return;
      attended++;
      if (r.status === 'late') late++;
      if (r.answer >= 0) { answered++; if (r.correct) correct++; }
    });
    return {
      id: stu.id,
      name: stu.name,
      total: sessions.length,
      attended,
      late,
      absent: sessions.length - attended,
      rate: sessions.length ? round1(attended / sessions.length * 100) : 0,
      correctRate: answered ? round1(correct / answered * 100) : null
    };
  }).sort((a, b) => a.rate - b.rate || b.absent - a.absent || a.id.localeCompare(b.id));

  const list = sessions.map(statOfSession).reverse();   // 显示时新的一次在前
  const seats = list.reduce((a, x) => a + x.total, 0);
  const came = list.reduce((a, x) => a + x.present, 0);

  return {
    course: { id: course.id, name: course.name, term: course.term || '' },
    roster: roster.length,
    sessions: list,
    overall: {
      count: list.length,
      rate: seats ? round1(came / seats * 100) : 0
    },
    perStudent
  };
}

/* 把时间戳转成本地时间，避免 Excel 里显示 UTC（差 8 小时） */
function localDate(ts) {
  const d = new Date(ts);
  const off = -d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() + off);
}

function stamp(ts) {
  const d = localDate(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- 名单解析 ---------------- */
const ID_RE = /^\d{4,}$/;

function splitLine(line) {
  let cells = line.split(/[,，、;；\t]+/).map(x => x.trim()).filter(Boolean);
  if (cells.length < 2) {
    const parts = line.trim().split(/\s+/);
    cells = [parts[0] || '', parts.slice(1).join('')].filter(Boolean);
  }
  return cells;
}

/* 从「学号 姓名」二维数组里取名单，跳过表头、去重、校验学号格式 */
function pickRoster(rows, existing) {
  const seen = new Set(existing.map(x => x.id));
  const added = [];
  const bad = [];
  rows.forEach(cells => {
    const id = String(cells[0] == null ? '' : cells[0]).trim();
    const name = String(cells[1] == null ? '' : cells[1]).trim().replace(/\s+/g, '');
    if (!id && !name) return;
    if (!ID_RE.test(id) || !name) { bad.push((id + ' ' + name).trim() || '(空行)'); return; }
    if (seen.has(id)) return;
    seen.add(id);
    added.push({ id, name });
  });
  return { added, bad };
}

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('').trim();
    if (v.text != null) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
  }
  return String(v).trim();
}

/* ---------------- 网络 ---------------- */
function lanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return '127.0.0.1';
}
const LOCAL_IP = lanIP();
const ORIGIN = process.env.PUBLIC_ORIGIN || `http://${LOCAL_IP}:${PORT}`;

const isLocal = req => {
  const ip = req.socket.remoteAddress || '';
  return ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.');
};

const PUBLIC_ROUTES = [
  /^\/s\//, /^\/join\/?$/, /^\/api\/claim$/, /^\/api\/submit$/,
  /^\/qr\.svg$/, /^\/favicon\.ico$/, /^\/api\/ping$/
];

/* ---------------- 路由 ---------------- */
const handler = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const m = req.method;

  if (!isLocal(req) && !PUBLIC_ROUTES.some(r => r.test(p))) {
    if (p.startsWith('/api/')) return json(res, 403, { error: '这个页面只能在老师电脑上打开' });
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;color:#333">'
      + '<h3>这个页面只能在老师的电脑上打开</h3><p>学生请扫投影上的二维码，或打开 /join。</p></body>');
  }

  /* ---- 页面 ---- */
  if (p === '/') return sendFile(res, 'home.html');
  if (p === '/compose') return sendFile(res, 'compose.html');
  if (p === '/live') return sendFile(res, 'live.html');
  if (p === '/admin') return sendFile(res, 'admin.html');
  if (p === '/join') return sendFile(res, 'student.html');
  if (p.startsWith('/s/')) return sendFile(res, 'student.html');
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }

  if (p === '/qr.svg') {
    const s = currentSession();
    if (!s) { res.writeHead(404); return res.end('no session'); }
    const token = tokenFor(s.id, sliceOf());
    try {
      const svg = await QRCode.toString(`${ORIGIN}/s/${s.id}?t=${token}`, {
        type: 'svg', margin: 1, width: 420, errorCorrectionLevel: 'M',
        color: { dark: '#15171a', light: '#ffffff' }
      });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      res.end(svg);
    } catch { res.writeHead(500); res.end('qr error'); }
    return;
  }

  /* ---- 学生 ---- */
  if (p === '/api/claim' && m === 'POST') {
    const b = await readBody(req);
    const s = currentSession();
    if (!s) return json(res, 400, { error: '课堂还没开始' });
    const byToken = b.token ? verifyToken(s.id, b.token) : false;
    const byCode = b.code ? verifyCode(s.id, b.code) : false;
    if (!byToken && !byCode) {
      return json(res, 400, {
        error: b.code ? '课堂码不对，看投影上最新的数字' : '二维码已刷新，请重新扫一下投影上的码'
      });
    }
    const now = Date.now();
    if (now > s.endsAt + lateGraceMs()) return json(res, 400, { error: '本次签到已关闭' });

    // 一台设备一个会话只能领一张票：挡「同一部手机反复扫码帮别人签」
    let dev = deviceOf(req);
    if (!dev) {
      dev = crypto.randomBytes(9).toString('hex');
      res.setHeader('Set-Cookie',
        `${DEVICE_COOKIE}=${dev}; Path=/; Max-Age=31536000; SameSite=Lax`);
    }
    if ([...tickets.values()].some(t => t.device === dev)) {
      return json(res, 400, { error: '这台手机本次已经签过了，一个人只能签一个学号' });
    }

    const ticket = crypto.randomBytes(16).toString('hex');
    tickets.set(ticket, { claimedAt: now, exp: now + ticketTtlMs(), used: false, late: now > s.endsAt, device: dev });
    const course = findCourse(s.courseId);
    return json(res, 200, {
      ok: true, ticket, late: now > s.endsAt,
      expiresIn: ticketTtlMs(),
      title: course ? course.name : '',
      question: { text: s.question.text, options: s.question.options }
    });
  }

  if (p === '/api/submit' && m === 'POST') {
    const b = await readBody(req);
    const s = currentSession();
    if (!s) return json(res, 400, { error: '课堂还没开始' });
    const t = tickets.get(b.ticket);
    if (!t || t.used) return json(res, 400, { error: '签到凭证已失效，请重新扫码' });
    if (Date.now() > t.exp) return json(res, 400, { error: '答题超时，请重新扫码' });
    // 兜底：票根绑定的设备必须与提交设备一致（防「一票多用」和换机提交）
    if (t.device && deviceOf(req) && t.device !== deviceOf(req)) {
      return json(res, 400, { error: '这张签到凭证不属于这台手机，请重新扫码' });
    }
    const sid = String(b.studentId || '').trim();
    const sname = String(b.studentName || '').trim().replace(/\s/g, '');
    const roster = getStudents(s.courseId);
    const stu = roster.find(x => x.id === sid);
    if (!stu) return json(res, 400, { error: '学号不在本课程名单里，请核对后重试' });
    if (sname.replace(/\s/g, '') !== String(stu.name).replace(/\s/g, '')) {
      return json(res, 400, { error: '学号与姓名不匹配，请核对后重试' });
    }
    if (s.records.some(r => r.studentId === stu.id)) return json(res, 400, { error: '这个学号已经签过到了' });

    t.used = true;
    const answer = Number.isInteger(b.answer) ? b.answer : -1;
    s.records.push({
      studentId: stu.id,
      name: stu.name,
      status: t.late ? 'late' : 'present',
      claimedAt: t.claimedAt,
      submittedAt: Date.now(),
      answer,
      correct: answer === s.question.correct
    });
    saveSession(s);
    // 不告诉学生答对没答对：课上不揭晓，避免互相看分数、也避免打击
    return json(res, 200, {
      ok: true, name: stu.name, status: t.late ? 'late' : 'present',
      present: s.records.length, total: roster.length
    });
  }

  if (p === '/api/ping') return json(res, 200, { ok: true });

  /* ---- 老师端：全量 ---- */
  if (p === '/api/all') {
    reload();
    return json(res, 200, {
      courses: getCourses(),
      students: getStudents(),
      sessions: getSessions().length,
      settings: SETTINGS,
      origin: ORIGIN,
      dataPath: store.DATA_DIR,
      active: activeSessionId
    });
  }

  if (p === '/api/data-info') {
    let files = [];
    try {
      files = fs.readdirSync(store.DATA_DIR).filter(f => !f.startsWith('.')).map(f => {
        const st = fs.statSync(path.join(store.DATA_DIR, f));
        return { name: f, size: st.size, mtime: st.mtimeMs, legacy: f === 'banks.json' || f === 'lessons.json' };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {}
    return json(res, 200, { path: store.DATA_DIR, files });
  }

  if (p === '/api/open-folder' && m === 'POST') {
    exec(`explorer "${store.DATA_DIR}"`, () => {});
    return json(res, 200, { ok: true, path: store.DATA_DIR });
  }

  /* ---- 课程 ---- */
  if (p === '/api/courses' && m === 'POST') {
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    if (!name) return json(res, 400, { error: '课程名不能为空' });
    const courses = getCourses();
    const course = {
      id: 'c' + store.uid(5),
      name,
      term: String(b.term || '').trim(),
      createdAt: Date.now(),
      recentQuestions: []
    };
    courses.push(course);
    store.write('courses', courses);
    return json(res, 200, course);
  }

  let mm = p.match(/^\/api\/courses\/([\w-]+)$/);
  if (mm && m === 'PUT') {
    const b = await readBody(req);
    const courses = getCourses();
    const c = courses.find(x => x.id === mm[1]);
    if (!c) return json(res, 404, { error: '课程不存在' });
    if (b.name != null) {
      const name = String(b.name).trim();
      if (!name) return json(res, 400, { error: '课程名不能为空' });
      c.name = name;
    }
    if (b.term != null) c.term = String(b.term).trim();
    store.write('courses', courses);
    return json(res, 200, c);
  }
  if (mm && m === 'DELETE') {
    const id = mm[1];
    if (!findCourse(id)) return json(res, 404, { error: '课程不存在' });
    store.write('courses', getCourses().filter(x => x.id !== id));
    store.write('students', store.read('students', []).filter(x => x.courseId !== id));
    store.write('sessions', getSessions().filter(x => x.courseId !== id));
    if (activeSessionId && !currentSession()) activeSessionId = null;
    const settings = store.read('settings', {});
    if (settings.activeCourseId === id) {
      const rest = getCourses();
      settings.activeCourseId = rest.length ? rest[0].id : null;
      store.write('settings', settings);
    }
    return json(res, 200, { ok: true });
  }

  /* ---- 会话 ---- */
  if (p === '/api/session/start' && m === 'POST') {
    const b = await readBody(req);
    const s = startSession(b.courseId, b.question);
    if (s.error) return json(res, 400, s);
    return json(res, 200, { ok: true, sessionId: s.id });
  }

  if (p === '/api/session/state') {
    const s = currentSession();
    if (!s) return json(res, 200, { ok: true, active: false });
    return json(res, 200, { ok: true, active: true, ...sessionState(s) });
  }

  if (p === '/api/session/end' && m === 'POST') {
    const s = currentSession();
    if (s) { s.closed = true; s.endsAt = Date.now(); saveSession(s); }
    activeSessionId = null;
    return json(res, 200, { ok: true });
  }

  if (p === '/api/sessions' && m === 'GET') {
    const courseId = url.searchParams.get('courseId');
    const list = getSessions()
      .filter(s => !courseId || s.courseId === courseId)
      .map(statOfSession)
      .sort((a, b) => b.startedAt - a.startedAt);
    return json(res, 200, { sessions: list });
  }

  if (p === '/api/stats/course') {
    const courseId = url.searchParams.get('courseId');
    const st = courseStats(courseId);
    if (!st) return json(res, 404, { error: '课程不存在' });
    return json(res, 200, st);
  }

  /* ---- 名单 ---- */
  if (p === '/api/students' && m === 'GET') {
    const courseId = url.searchParams.get('courseId');
    return json(res, 200, { students: getStudents(courseId) });
  }

  if (p === '/api/students' && m === 'POST') {
    const b = await readBody(req);
    const courseId = String(b.courseId || '').trim();
    if (!findCourse(courseId)) return json(res, 400, { error: '先选一门课程' });
    const id = String(b.id || '').trim();
    const name = String(b.name || '').trim().replace(/\s+/g, '');
    if (!id || !name) return json(res, 400, { error: '学号和姓名都要填' });
    if (!ID_RE.test(id)) return json(res, 400, { error: '学号要是 4 位以上数字' });
    const list = store.read('students', []);
    if (list.some(x => x.courseId === courseId && x.id === id)) return json(res, 400, { error: '这个学号已经在这门课的名单里了' });
    list.push({ id, name, courseId });
    store.write('students', list);
    return json(res, 200, { ok: true, total: getStudents(courseId).length });
  }

  if (p === '/api/students/import' && m === 'POST') {
    const b = await readBody(req);
    const courseId = String(b.courseId || '').trim();
    if (!findCourse(courseId)) return json(res, 400, { error: '先选一门课程' });
    const rows = String(b.text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(splitLine);
    const { added, bad } = pickRoster(rows, getStudents(courseId));
    const list = store.read('students', []);
    added.forEach(x => list.push({ id: x.id, name: x.name, courseId }));
    store.write('students', list);
    return json(res, 200, { ok: added.length, skipped: bad.length, total: getStudents(courseId).length, bad: bad.slice(0, 10) });
  }

  if (p === '/api/students/upload' && m === 'POST') {
    const b = await readBody(req, 40 * 1e6);
    const courseId = String(b.courseId || '').trim();
    if (!findCourse(courseId)) return json(res, 400, { error: '先选一门课程' });
    const fileName = String(b.fileName || '').toLowerCase();
    let buf;
    try {
      buf = Buffer.from(String(b.fileBase64 || '').replace(/^data:[^,]*,/, ''), 'base64');
    } catch { return json(res, 400, { error: '文件读取失败' }); }
    if (!buf.length) return json(res, 400, { error: '文件是空的' });

    let rows = [];
    try {
      if (/\.(csv|txt)$/.test(fileName)) {
        const text = buf.toString('utf8').replace(/^\ufeff/, '');
        rows = text.split(/\r?\n/).map(l => splitLine(l)).filter(c => c.length);
      } else if (/\.(xlsx|xlsm)$/.test(fileName)) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.worksheets[0];
        if (!ws) return json(res, 400, { error: '这个文件里没有工作表' });
        ws.eachRow({ includeEmpty: false }, row => {
          const vals = row.values.slice(1).map(cellText);
          if (vals.some(v => v)) rows.push(vals);
        });
      } else {
        return json(res, 400, { error: '只支持 .xlsx 或 .csv 文件' });
      }
    } catch (e) {
      return json(res, 400, { error: '解析失败：' + e.message + '（老式 .xls 请先另存为 .xlsx）' });
    }

    const { added, bad } = pickRoster(rows, getStudents(courseId));
    const list = store.read('students', []);
    added.forEach(x => list.push({ id: x.id, name: x.name, courseId }));
    store.write('students', list);
    return json(res, 200, {
      ok: added.length, skipped: bad.length,
      total: getStudents(courseId).length,
      bad: bad.slice(0, 10),
      rows: rows.length
    });
  }

  if (p === '/api/students/clear' && m === 'POST') {
    const b = await readBody(req);
    const courseId = String(b.courseId || '').trim();
    if (!findCourse(courseId)) return json(res, 400, { error: '先选一门课程' });
    store.write('students', store.read('students', []).filter(x => x.courseId !== courseId));
    return json(res, 200, { ok: true });
  }

  mm = p.match(/^\/api\/students\/([\w-]+)$/);
  if (mm && m === 'DELETE') {
    const courseId = url.searchParams.get('courseId');
    const id = mm[1];
    store.write('students', store.read('students', []).filter(x =>
      !(x.id === id && (!courseId || x.courseId === courseId))));
    return json(res, 200, { ok: true });
  }

  /* ---- 设置 ---- */
  if (p === '/api/settings' && m === 'PUT') {
    const b = await readBody(req);
    const s = store.read('settings', {});
    ['codeRefreshMs', 'tokenGrace', 'windowMs', 'lateGraceMs', 'ticketTtlMs', 'activeCourseId'].forEach(k => {
      if (b[k] != null && b[k] !== '') s[k] = typeof b[k] === 'string' && k === 'activeCourseId' ? b[k] : Number(b[k]);
    });
    if (s.codeRefreshMs < 1000) s.codeRefreshMs = 1000;
    if (s.tokenGrace < 0) s.tokenGrace = 0;
    store.write('settings', s);
    reload();
    return json(res, 200, SETTINGS);
  }

  /* ---- 导出：Excel 工作簿（.xlsx） ---- */
  if (p === '/api/export.xlsx') {
    const sessionId = url.searchParams.get('sessionId');
    const courseId = url.searchParams.get('courseId');
    const all = getSessions();
    let list, course, multi;

    if (courseId) {
      course = findCourse(courseId);
      if (!course) return json(res, 404, { error: '课程不存在' });
      list = all.filter(s => s.courseId === courseId).sort((a, b) => a.startedAt - b.startedAt);
      multi = true;
    } else {
      const s = sessionId
        ? all.find(x => x.id === sessionId)
        : all.slice().sort((a, b) => b.startedAt - a.startedAt)[0];
      if (!s) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('还没有签到记录'); }
      list = [s];
      course = findCourse(s.courseId);
      multi = false;
    }
    if (!list.length) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('这门课还没有签到记录'); }

    const roster = getStudents(list[0].courseId);
    const cols = multi
      ? ['点名批次', '学号', '姓名', '题目', '提交答案', '正确答案', '是否正确', '状态', '签到时间']
      : ['学号', '姓名', '题目', '提交答案', '正确答案', '是否正确', '状态', '签到时间'];
    const N = cols.length;
    const cSid = multi ? 2 : 1, cTime = N;

    const wb = new ExcelJS.Workbook();
    wb.creator = '课中签到';
    wb.created = new Date();
    const sheetName = multi ? String((course && course.name) || '签到明细').slice(0, 24) : '签到明细';
    const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 3 }] });

    const WIDTH = { '点名批次': 24, '学号': 15, '姓名': 11, '题目': 46, '提交答案': 24, '正确答案': 24, '是否正确': 9, '状态': 8, '签到时间': 19 };
    ws.columns = cols.map(c => ({ width: WIDTH[c] || 14 }));

    const head0 = multi
      ? `${(course && course.name) || ''}　全部签到明细`
      : `${(course && course.name) || ''}　${stamp(list[0].startedAt)}`;
    ws.mergeCells(1, 1, 1, N);
    ws.getRow(1).getCell(1).value = head0;
    ws.getRow(1).getCell(1).font = { bold: true, size: 13 };
    ws.getRow(1).height = 26;

    const sub = multi
      ? `共 ${list.length} 次点名　名单 ${roster.length} 人　导出 ${stamp(Date.now())}`
      : `到课 ${list[0].records.length}/${roster.length}　迟到 ${list[0].records.filter(r => r.status === 'late').length}　`
        + `缺勤 ${Math.max(0, roster.length - list[0].records.length)}　本题：${list[0].question.text}`;
    ws.mergeCells(2, 1, 2, N);
    ws.getRow(2).getCell(1).value = sub;
    ws.getRow(2).getCell(1).font = { size: 10, color: { argb: 'FF666B73' } };
    ws.getRow(2).height = 20;

    const head = ws.getRow(3);
    head.values = cols;
    head.eachCell(c => {
      c.font = { bold: true, size: 10.5 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3F5' } };
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFD8DBE0' } } };
    });
    head.height = 22;

    let rowIdx = 4;
    list.forEach((s, si) => {
      const byId = new Map(s.records.map(r => [r.studentId, r]));
      const correctText = `${letter(s.question.correct)}. ${s.question.options[s.question.correct] || ''}`;
      const batch = `第 ${si + 1} 次 · ${stamp(s.startedAt)}`;

      roster.forEach(stu => {
        const r = byId.get(stu.id);
        const row = ws.getRow(rowIdx++);
        const base = [
          stu.id,
          String(stu.name).replace(/\s/g, ''),
          s.question.text,
          r && r.answer >= 0 ? `${letter(r.answer)}. ${s.question.options[r.answer] || ''}` : '',
          correctText,
          r ? (r.correct ? '对' : '错') : '',
          r ? (r.status === 'late' ? '迟到' : '到课') : '缺勤',
          r ? localDate(r.submittedAt || r.claimedAt) : ''
        ];
        row.values = multi ? [batch, ...base] : base;
        row.getCell(cSid).numFmt = '@';            // 学号保持文本，不会被 Excel 转成数字
        row.getCell(cTime).numFmt = 'yyyy-mm-dd hh:mm:ss';
        row.eachCell(c => {
          c.font = { size: 10.5 };
          c.border = { bottom: { style: 'hair', color: { argb: 'FFEDEFF2' } } };
          c.alignment = Object.assign({ vertical: 'middle' }, c.alignment || {});
        });
        const cStatus = row.getCell(N - 1);
        const cOk = row.getCell(N - 2);
        cStatus.alignment = { horizontal: 'center', vertical: 'middle' };
        cOk.alignment = { horizontal: 'center', vertical: 'middle' };
        if (!r) {
          cStatus.font = { size: 10.5, color: { argb: 'FFA03030' } };
          row.getCell(cSid + 1).font = { size: 10.5, color: { argb: 'FF9AA0A8' } };
        }
        if (r && r.status === 'late') cStatus.font = { size: 10.5, color: { argb: 'FFBA7517' } };
        if (r && r.correct) cOk.font = { size: 10.5, color: { argb: 'FF1D9E75' } };
        row.height = 19;
      });
    });

    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: N } };

    const buf = await wb.xlsx.writeBuffer();
    const fname = multi
      ? `attendance-${(course && course.name) || 'course'}-all.xlsx`
      : `attendance-${stamp(list[0].startedAt).slice(0, 10)}.xlsx`;
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance.xlsx"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      'Content-Length': buf.length
    });
    return res.end(Buffer.from(buf));
  }

  /* ---- 退出 ---- */
  if (p === '/api/quit' && m === 'POST') {
    json(res, 200, { ok: true });
    setTimeout(() => process.exit(0), 200);
    return;
  }

  json(res, 404, { error: 'not found' });
};

/* ---------------- 启动 ---------------- */
/* 重启后接着上次没结束的那场（老师电脑崩了不用重开一场） */
(function resumeActive() {
  const now = Date.now();
  const last = getSessions()
    .filter(s => !s.closed && now < s.endsAt + lateGraceMs())
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (last) activeSessionId = last.id;
})();

http.createServer(handler).listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  课中签到 v3  已启动');
  console.log(`  老师端  http://127.0.0.1:${PORT}/`);
  console.log(`  学生端  http://${LOCAL_IP}:${PORT}/join  （同一 Wi-Fi）`);
  console.log(`  数据目录  ${store.DATA_DIR}`);
  console.log(`  码 ${refreshMs() / 1000}s 刷新 · 有效 ${(refreshMs() * (graceSlices() + 1)) / 1000}s · 窗口 ${windowMs() / 1000}s`);
  if (activeSessionId) console.log(`  接着上次未结束的签到：${activeSessionId}`);
  console.log('');
});
