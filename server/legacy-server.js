'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');

/* ---------------- 配置 ---------------- */
const PORT = Number(process.env.PORT || 3000);
const ARGS = process.argv.slice(2);
const NO_GEO = ARGS.includes('--no-geo') || process.env.GEO === 'off';
const NO_HTTPS = ARGS.includes('--no-https') || process.env.HTTPS === 'off';
const SECRET = process.env.SECRET
  ? Buffer.from(process.env.SECRET)
  : crypto.randomBytes(32);                 // 生产务必用环境变量固定，否则重启后旧码全失效
const SLICE_MS = 15_000;                    // 二维码轮换周期
const TOKEN_GRACE_SLICES = 1;               // 令牌有效期 = 当前片 + 前一片（15~30s）
const WINDOW_MS = 90_000;                   // 正常签到窗口
const LATE_GRACE_MS = 10 * 60_000;          // 窗口关闭后仍可补签的上限
const TICKET_TTL_MS = 120_000;              // 扫码后答题时限
const CODE_SLOT_MS = 30_000;                // 降级短码的轮换周期

/* ---------------- 定位（弱信号，不做判定） ---------------- */
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const CERT_DIR = path.join(__dirname, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'key.pem');
const HAS_CERT = !NO_HTTPS
  && fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);

const GEO = {
  enabled: !NO_GEO,
  lat: Number(process.env.GEO_LAT || 31.230400),   // 教学楼坐标（示例值，部署时换成本校）
  lng: Number(process.env.GEO_LNG || 121.473700),
  radius: Number(process.env.GEO_RADIUS || 300),   // 围栏半径（米），按「一栋楼」而不是「一间教室」设
  trustAcc: Number(process.env.GEO_TRUST_ACC || 200), // 精度优于此值才当可信读数
  hardAcc: Number(process.env.GEO_HARD_ACC || 600)    // 精度差于此值（≈围栏直径）视为读数无效
};

/* ---------------- 课程 ---------------- */

const COURSE = { name: '高等数学（上）', meta: '第 12 周 · 周三 3–4 节 · 教三 201' };
const QUESTION = {
  text: 'f(x) = |x| 在 x = 0 处……',
  options: ['连续且可导', '连续但不可导', '不连续', '可导但不连续'],
  correct: 1
};

const NAMES = [
  '陈亦然', '林　嘉', '周晓东', '吴　敏', '李　沐', '孙浩然', '郑雨欣', '黄子睿', '马思远', '何静怡',
  '徐嘉禾', '杨博文', '张一诺', '王梓萱', '刘予安', '赵一凡', '陈思远', '沈亦舟', '韩子墨', '冯可欣',
  '曹嘉宁', '邓皓宇', '范书瑶', '高梓涵', '郭嘉懿', '洪宇航', '胡佳琪', '蒋逸凡', '赖思彤', '李明轩',
  '李雨桐', '梁宸睿', '廖静姝', '刘博涵', '卢靖雯', '罗天佑', '吕欣怡', '倪嘉豪', '潘诗雨', '彭子健',
  '钱亦辰', '秦若曦', '任思远', '邵佳宁', '沈嘉树', '宋雨薇', '苏子墨'
];

const ROSTER = NAMES.map((name, i) => ({ id: String(2023010101 + i), name }));
const HISTORY = new Map([['2023010101', 2], ['2023010102', 2]]); // 连续缺勤次数

/* ---------------- 状态 ---------------- */
let session = null;
let tickets = new Map();

function startSession() {
  const now = Date.now();
  session = {
    id: crypto.randomBytes(4).toString('hex'),
    startedAt: now,
    endsAt: now + WINDOW_MS,
    records: new Map()
  };
  tickets = new Map();
  return session;
}

/* ---------------- 令牌 ---------------- */
const sliceOf = (ts = Date.now()) => Math.floor(ts / SLICE_MS);

function tokenFor(sessionId, slice) {
  return crypto.createHmac('sha256', SECRET)
    .update(`${sessionId}:${slice}`)
    .digest('base64url')
    .slice(0, 12);
}

function verifyToken(sessionId, token) {
  if (typeof token !== 'string' || token.length !== 12) return false;
  const s = sliceOf();
  for (let i = 0; i <= TOKEN_GRACE_SLICES; i++) {
    const expect = Buffer.from(tokenFor(sessionId, s - i));
    const got = Buffer.from(token);
    if (expect.length === got.length && crypto.timingSafeEqual(expect, got)) return true;
  }
  return false;
}

/* ---------------- 降级短码（给扫不出来的人） ---------------- */
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

/* ---------------- 定位判定 ---------------- */
const R = 6371000;
function haversine(lat1, lng1, lat2, lng2) {
  const rad = d => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// 只产出「读数 + 存疑分」，绝不判定谁没来
function judgeGeo(raw) {
  if (!GEO.enabled) return { state: 'off', score: 0, label: '未启用' };
  if (!raw || typeof raw !== 'object') return { state: 'none', score: 0, label: '未授权定位' };

  const lat = Number(raw.lat), lng = Number(raw.lng);
  const acc = Number(raw.acc);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { state: 'none', score: 0, label: '没拿到坐标' };
  }
  const dist = Math.round(haversine(lat, lng, GEO.lat, GEO.lng));
  const accuracy = Number.isFinite(acc) ? Math.round(acc) : null;

  const base = { lat: +lat.toFixed(6), lng: +lng.toFixed(6), acc: accuracy, dist };

  if (accuracy !== null && accuracy > GEO.hardAcc) {
    return { ...base, state: 'coarse', score: 10, label: '定位过粗' };
  }
  if (dist > GEO.radius) {
    return { ...base, state: 'outside', score: 30, label: `围栏外 ${dist}m` };
  }
  if (accuracy !== null && accuracy > GEO.trustAcc) {
    return { ...base, state: 'fuzzy', score: 10, label: `精度 ±${accuracy}m` };
  }
  return { ...base, state: 'inside', score: 0, label: `范围内 ${dist}m` };
}

function geoSummary(recs) {
  const located = recs.filter(r => r.geo && r.geo.lat != null);
  const flagged = located.filter(r => r.geo.state === 'outside' || r.geo.state === 'coarse');
  const accs = located.map(r => r.geo.acc).filter(a => a != null).sort((a, b) => a - b);
  return {
    enabled: GEO.enabled,
    center: [GEO.lat, GEO.lng],
    radius: GEO.radius,
    located: located.length,
    missing: recs.length - located.length,
    inside: located.filter(r => r.geo.state === 'inside').length,
    flagged: flagged.length,
    medianAcc: accs.length ? accs[Math.floor(accs.length / 2)] : null,
    suspect: flagged.map(r => ({ name: r.name, label: r.geo.label, dist: r.geo.dist, acc: r.geo.acc }))
      .sort((a, b) => (b.dist || 0) - (a.dist || 0))
  };
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
// 浏览器只允许在安全上下文下调用定位，所以有证书时二维码指向 HTTPS
const DEFAULT_ORIGIN = HAS_CERT
  ? `https://${LOCAL_IP}:${HTTPS_PORT}`
  : `http://${LOCAL_IP}:${PORT}`;
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || DEFAULT_ORIGIN;

/* ---------------- 小工具 ---------------- */
const readBody = req => new Promise(resolve => {
  let raw = '';
  req.on('data', c => { raw += c; });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
});

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function html(res, file) {
  fs.readFile(path.join(__dirname, 'public', file), (err, buf) => {
    if (err) { res.writeHead(500); return res.end('missing ' + file); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buf);
  });
}

function snapshot() {
  const now = Date.now();
  const recs = session ? [...session.records.values()] : [];
  const signedIds = new Set(recs.map(r => r.studentId));
  const absent = ROSTER.filter(s => !signedIds.has(s.id)).map(s => ({
    id: s.id, name: s.name, note: HISTORY.has(s.id) ? `连续缺勤 ${HISTORY.get(s.id)} 次` : ''
  }));
  const dist = [0, 0, 0, 0];
  recs.forEach(r => { if (r.answer >= 0) dist[r.answer]++; });

  return {
    ok: true,
    course: COURSE,
    question: QUESTION,
    sessionId: session ? session.id : null,
    started: !!session,
    open: !!session && now < session.endsAt,
    remainMs: session ? Math.max(0, session.endsAt - now) : 0,
    slice: sliceOf(now),
    tokenRemainMs: SLICE_MS - (now % SLICE_MS),
    code: session ? codeFor(session.id) : '',
    codeRemainMs: CODE_SLOT_MS - (now % CODE_SLOT_MS),
    total: ROSTER.length,
    present: recs.length,
    late: recs.filter(r => r.status === 'late').length,
    absent,
    answered: recs.filter(r => r.answer >= 0).length,
    dist,
    geo: geoSummary(recs),
    origin: PUBLIC_ORIGIN
  };
}

/* ---------------- 路由 ---------------- */
const handler = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const method = req.method;

  if (p === '/' || p === '/teacher') return html(res, 'teacher.html');
  if (p === '/debug') return html(res, 'debug.html');
  if (p.startsWith('/s/')) return html(res, 'student.html');
  if (p === '/join') return html(res, 'student.html');
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }

  if (p === '/qr.svg') {
    if (!session) { res.writeHead(404); return res.end('no session'); }
    const token = tokenFor(session.id, sliceOf());
    const target = `${PUBLIC_ORIGIN}/s/${session.id}?t=${token}`;
    try {
      const svg = await QRCode.toString(target, {
        type: 'svg', margin: 1, width: 420,
        errorCorrectionLevel: 'M', color: { dark: '#15171a', light: '#ffffff' }
      });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      res.end(svg);
    } catch (e) {
      res.writeHead(500); res.end('qr error');
    }
    return;
  }

  if (p === '/api/start' && method === 'POST') {
    startSession();
    return json(res, 200, snapshot());
  }

  if (p === '/api/state') {
    return json(res, 200, snapshot());
  }

  /* ---- 调试用：改围栏中心 / 看原始记录 ---- */
  if (p === '/api/geo-center' && method === 'POST') {
    const body = await readBody(req);
    const lat = Number(body.lat), lng = Number(body.lng);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
      return json(res, 400, { error: '坐标不合法' });
    }
    GEO.lat = lat;
    GEO.lng = lng;
    const r = Number(body.radius);
    if (Number.isFinite(r) && r > 0) GEO.radius = Math.round(r);
    return json(res, 200, { ok: true, center: [GEO.lat, GEO.lng], radius: GEO.radius });
  }

  if (p === '/api/records') {
    const recs = session ? [...session.records.values()] : [];
    return json(res, 200, {
      records: recs.map(r => ({
        name: r.name,
        studentId: r.studentId,
        status: r.status,
        method: r.method,
        answer: r.answer,
        claimedAt: r.claimedAt,
        geo: r.geo
      }))
    });
  }

  if (p === '/api/claim' && method === 'POST') {
    const body = await readBody(req);
    if (!session) return json(res, 400, { error: '课堂还没开始' });

    const byToken = body.token ? verifyToken(session.id, body.token) : false;
    const byCode = body.code ? verifyCode(session.id, body.code) : false;

    if (!byToken && !byCode) {
      return json(res, 400, {
        error: body.code
          ? '课堂码不对，看投影上最新的数字'
          : '二维码已刷新，请重新扫一下投影上的码'
      });
    }
    const now = Date.now();
    if (now > session.endsAt + LATE_GRACE_MS) {
      return json(res, 400, { error: '本次签到已关闭' });
    }
    const ticket = crypto.randomBytes(16).toString('hex');
    const late = now > session.endsAt;
    tickets.set(ticket, {
      claimedAt: now, exp: now + TICKET_TTL_MS, used: false, late,
      method: byToken ? 'qr' : 'code'
    });
    return json(res, 200, {
      ok: true, ticket, late,
      expiresIn: TICKET_TTL_MS,
      question: QUESTION,
      geo: GEO.enabled
    });
  }

  if (p === '/api/submit' && method === 'POST') {
    const body = await readBody(req);
    if (!session) return json(res, 400, { error: '课堂还没开始' });

    const t = tickets.get(body.ticket);
    if (!t || t.used) return json(res, 400, { error: '签到凭证已失效，请重新扫码' });
    if (Date.now() > t.exp) return json(res, 400, { error: '答题超时，请重新扫码' });

    const stu = ROSTER.find(s => s.id === String(body.studentId || '').trim());
    if (!stu) return json(res, 400, { error: '学号不在名单里，请核对后重试' });
    if (session.records.has(stu.id)) return json(res, 400, { error: '这个学号已经签过到了' });

    t.used = true;
    const answer = Number.isInteger(body.answer) ? body.answer : -1;
    const geo = judgeGeo(body.geo);
    session.records.set(stu.id, {
      studentId: stu.id,
      name: stu.name,
      status: t.late ? 'late' : 'present',
      method: t.method || 'qr',
      claimedAt: t.claimedAt,
      submittedAt: Date.now(),
      answer,
      geo
    });

    return json(res, 200, {
      ok: true,
      name: stu.name,
      status: t.late ? 'late' : 'present',
      correct: answer === QUESTION.correct,
      present: session.records.size,
      geo: { state: geo.state, label: geo.label, dist: geo.dist, acc: geo.acc }
    });
  }

  json(res, 404, { error: 'not found' });
};

function listenHttp() {
  http.createServer(handler).listen(PORT, '0.0.0.0', () => {
    console.log(`  HTTP   http://${LOCAL_IP}:${PORT}/  （仅备用，浏览器会禁止此源下的定位）`);
  });
}

if (HAS_CERT) {
  const opts = { cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) };
  https.createServer(opts, handler).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  课中签到  已启动');
    console.log(`  讲台（老师端）  ${PUBLIC_ORIGIN}/`);
    console.log(`  学生入口        ${PUBLIC_ORIGIN}/join  （输 4 位课堂码）`);
    console.log('');
    console.log('  证书是自签的，浏览器会警告一次，点「继续前往」即可');
    console.log('  窗口 ' + WINDOW_MS / 1000 + 's ｜ 码 ' + SLICE_MS / 1000 + 's 轮换 ｜ 围栏 ' + GEO.radius + 'm');
    console.log('');
  });
  listenHttp();
} else {
  http.createServer(handler).listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  课中签到  已启动（HTTP · 纯动态码模式）');
    console.log(`  讲台  http://${LOCAL_IP}:${PORT}/`);
    console.log('  ' + (GEO.enabled ? '! 没有证书，定位会被浏览器禁用' : '定位已关闭（GEO=off），不采集位置'));
    console.log('');
  });
}
