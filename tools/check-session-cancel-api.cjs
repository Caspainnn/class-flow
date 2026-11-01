'use strict';
// Exercises real HTTP and isolated persistence: missing guards must not erase attendance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inclass-cancel-'));
  let child;
  try {
    const reservation = net.createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const courseId = 'cancel-test';
    const student = { id: 'fake-001', name: 'Test Student', courseId };
    const history = { id: 'archived-test', courseId, question: { text: 'History', options: ['A', 'B'], correct: 0 }, startedAt: 1, endsAt: 2, closed: true, records: [] };
    for (const [name, value] of Object.entries({ courses: [{ id: courseId, name: 'Test Course', createdAt: 1 }], students: [student], sessions: [history] })) {
      fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(value));
    }
    child = spawn(process.execPath, [path.resolve(__dirname, '../server/server.js')], {
      env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port) }, windowsHide: true, stdio: 'pipe'
    });
    let logs = '';
    child.stdout.on('data', b => { logs += b; });
    child.stderr.on('data', b => { logs += b; });
    const request = async (url, body) => {
      const r = await fetch(`http://127.0.0.1:${port}${url}`, body === undefined ? {} : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      return { status: r.status, body: await r.json() };
    };
    // Hold the request body open while another request changes the active session.
    const slowPost = async (url, body) => {
      const raw = JSON.stringify(body);
      let req;
      const response = new Promise((resolve, reject) => {
        req = http.request({ host: '127.0.0.1', port, path: url, method: 'POST', headers: {
          'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw)
        } }, res => {
          let data = '';
          res.on('data', b => { data += b; });
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.write(raw.slice(0, -1));
      });
      await delay(50);
      return () => { req.end(raw.slice(-1)); return response; };
    };
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { await request('/api/ping'); ready = true; break; } catch { await delay(100); }
    }
    assert(ready, 'isolated server ready: ' + logs);
    const question = { text: 'Cancellation test', options: ['A', 'B'], correct: 0 };
    const start = () => request('/api/session/start', { courseId, question });
    const cancel = sessionId => request('/api/session/cancel', { sessionId });
    const state = async () => (await request('/api/session/state')).body;
    const saved = () => JSON.parse(fs.readFileSync(path.join(dir, 'sessions.json'), 'utf8'));
    const first = (await start()).body.sessionId;
    assert.equal((await request('/api/session/cancel', {})).status, 400, 'sessionId is mandatory');
    assert.equal((await request('/api/session/cancel', null)).status, 400, 'null body is invalid');
    assert.equal((await cancel('wrong-id')).status, 409, 'stale ID cannot cancel current session');
    assert.equal((await state()).id, first);
    const ticket = (await request('/api/claim', { code: (await state()).code })).body.ticket;
    const submitBody = { ticket, studentId: student.id, studentName: student.name, answer: 0 };
    const finishOldSubmit = await slowPost('/api/submit', submitBody);
    assert.deepEqual((await cancel(first)), { status: 200, body: { ok: true, sessionId: first } });
    assert.equal((await state()).active, false);
    assert.deepEqual(saved(), [history], 'only current empty session removed, archived history retained');
    assert.equal((await request('/api/submit', submitBody)).status, 400, 'ticket invalid after cancellation');
    const second = (await start()).body.sessionId;
    assert.equal((await finishOldSubmit()).status, 400, 'in-flight old submit cannot enter new session');
    assert.equal((await request('/api/submit', submitBody)).status, 400, 'old ticket remains invalid in new session');
    assert.equal((await cancel(first)).status, 409);
    assert.equal((await cancel(history.id)).status, 409, 'archived session cannot be cancelled');
    assert.equal((await state()).id, second);
    assert.equal((await start()).status, 409, 'duplicate start cannot overwrite current session');
    const finishCancel = await slowPost('/api/session/cancel', { sessionId: second });
    const claim = (await request('/api/claim', { code: (await state()).code })).body;
    assert.equal((await request('/api/submit', { ...submitBody, ticket: claim.ticket })).status, 200);
    assert.equal((await finishCancel()).status, 409, 'submission during cancel body read protects records');
    assert.equal((await state()).present, 1);
    assert.equal((await cancel(second)).status, 409, 'recorded session cannot be cancelled');
    await request('/api/session/end', {});
    assert.equal((await cancel(second)).status, 409, 'closed session cannot be cancelled');
    const finishStart = await slowPost('/api/session/start', { courseId, question });
    const third = (await start()).body.sessionId;
    assert.equal((await finishStart()).status, 409, 'in-flight duplicate start cannot overwrite session');
    const finishStaleCancel = await slowPost('/api/session/cancel', { sessionId: third });
    await request('/api/session/end', {});
    const fourth = (await start()).body.sessionId;
    assert.equal((await finishStaleCancel()).status, 409, 'in-flight cancel cannot remove replacement session');
    assert.equal((await state()).id, fourth);
    assert.equal((await cancel(fourth)).status, 200);
    assert.equal(saved().find(s => s.id === second).records.length, 1);
    assert.deepEqual(saved().find(s => s.id === history.id), history);
    console.log('PASS: empty cancellation, required/current IDs, history and attendance protection, ticket invalidation, duplicate starts and in-flight request races');
  } finally {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()), 'cleanup confined to temporary root');
    assert(path.basename(resolved).startsWith('inclass-cancel-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
