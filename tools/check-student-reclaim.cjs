'use strict';
// 手机端重复扫码的规则：真签过 → 明确告知已签到；只领过票没提交 → 允许继续，不卡死。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inclass-reclaim-'));
  let child;
  try {
    const reservation = net.createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(r => reservation.close(r));

    const courseId = 'reclaim-test';
    const students = [
      { id: '2026000001', name: '张三', courseId },
      { id: '2026000002', name: '李四', courseId }
    ];
    fs.writeFileSync(path.join(dir, 'courses.json'), JSON.stringify([{ id: courseId, name: '回签测试课', createdAt: 1 }]));
    fs.writeFileSync(path.join(dir, 'students.json'), JSON.stringify(students));
    fs.writeFileSync(path.join(dir, 'sessions.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ ticketTtlMs: 1500 }));

    child = spawn(process.execPath, [path.resolve(__dirname, '../server/server.js')], {
      env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port) }, windowsHide: true, stdio: 'pipe'
    });
    let logs = '';
    child.stdout.on('data', b => { logs += b; });
    child.stderr.on('data', b => { logs += b; });

    const call = async (url, body, cookie) => {
      const headers = { 'Content-Type': 'application/json' };
      if (cookie) headers.Cookie = cookie;
      const r = await fetch(`http://127.0.0.1:${port}${url}`, body === undefined ? { headers }
        : { method: 'POST', headers, body: JSON.stringify(body) });
      const set = r.headers.get('set-cookie') || '';
      const dev = (set.match(/ic_dev=([\w-]+)/) || [])[1];
      return { status: r.status, body: await r.json(), dev };
    };
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { await call('/api/ping'); ready = true; break; } catch { await delay(100); }
    }
    assert(ready, 'isolated server ready: ' + logs);

    const start = await call('/api/session/start', { courseId, question: { text: '重复扫码', options: ['甲', '乙'], correct: 0 } });
    assert.equal(start.status, 200, 'session started: ' + JSON.stringify(start.body));
    const state = (await call('/api/session/state')).body;
    const code = state.code;

    // 第一次扫码：拿到票和设备指纹
    const first = await call('/api/claim', { code });
    assert.equal(first.status, 200);
    assert(first.dev, 'server sets device cookie');
    const devA = `ic_dev=${first.dev}`;

    // 没提交就重新扫码（页面被关掉/刷新）：应重新发票，而不是说他已签到
    const again = await call('/api/claim', { code }, devA);
    assert.equal(again.status, 200, 'claim again before submit must not be blocked');
    assert.notEqual(again.body.ticket, first.body.ticket, 'stale ticket replaced');
    const staleSubmit = await call('/api/submit', { ticket: first.body.ticket, studentId: students[0].id, studentName: students[0].name, answer: 0 }, devA);
    assert.equal(staleSubmit.status, 400, 'replaced ticket no longer works');

    // 用新票正常提交
    const submit = await call('/api/submit', { ticket: again.body.ticket, studentId: students[0].id, studentName: students[0].name, answer: 0 }, devA);
    assert.equal(submit.status, 200, 'submit with reissued ticket: ' + JSON.stringify(submit.body));

    // 签过之后再扫：明确告知已签到，并带上本人信息，前端据此显示结果页
    const signed = await call('/api/claim', { code }, devA);
    assert.equal(signed.status, 400);
    assert.equal(signed.body.signed, true, 'already-signed claim flagged');
    assert.equal(signed.body.studentId, students[0].id);
    assert.equal(signed.body.name, students[0].name);
    assert.equal(signed.body.position, 1);
    assert.equal(signed.body.total, 2);

    // 换一台手机（另一个设备指纹）不受影响
    const other = await call('/api/claim', { code });
    assert.equal(other.status, 200, 'another phone can still claim');

    // 票过期后再扫：仍然可以继续，不会永久卡在「已经签过」
    const expired = await call('/api/claim', { code }, 'ic_dev=device-expire');
    assert.equal(expired.status, 200);
    await delay(1800);
    const afterExpire = await call('/api/claim', { code }, 'ic_dev=device-expire');
    assert.equal(afterExpire.status, 200, 'expired unused ticket must not block re-claim');
    assert.equal(afterExpire.body.ticket !== expired.body.ticket, true);

    console.log('PASS: 重新扫码可继续、旧票作废、签过明确告知、其他手机不受影响、票过期不卡死');
  } finally {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
