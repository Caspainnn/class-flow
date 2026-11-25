'use strict';
/**
 * 课程工作区 · 教学任务台 接口自测
 *
 * 隔离：mkdtemp 临时 DATA_DIR + 系统分配端口，只写入合成课程与日程/待办。
 * 不读取 data/ 下的真实教学数据，也不改动工作树中的其他文件。
 */
const tempPath = require('./temp-path.cjs');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(tempPath('.tmp-teaching-board-'));
let port = 0;
let origin = '';
let child = null;
let log = '';
const save = (name, value) => fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(value));

save('courses', [
  { id: 'tb00000000000000000001', name: '隔离课程甲', term: '测试学期', createdAt: 1 },
  { id: 'tb00000000000000000002', name: '隔离课程乙', term: '测试学期', createdAt: 2 }
]);
save('students', []);
save('settings', {});
save('sessions', []);
save('homework', []);
save('gradebatches', []);
save('questionnaires', { surveys: [] });

const freePort = () => new Promise((resolve, reject) => {
  const server = require('node:net').createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
function startServer() {
  child = spawn(process.execPath, [path.join(root, 'server/server.js')], {
    cwd: root,
    env: { ...process.env, DATA_DIR: dir, PORT: String(port), HOST: '127.0.0.1' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
}

const call = async (url, init) => {
  const response = await fetch(origin + url, init);
  const type = response.headers.get('content-type') || '';
  return { status: response.status, type, body: type.includes('json') ? await response.json() : await response.text(), headers: response.headers };
};
const put = (url, value) => call(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const putSlow = (url, value, midway) => new Promise((resolve, reject) => {
  const body = JSON.stringify(value);
  const request = http.request({
    host: '127.0.0.1', port, path: url, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, response => {
    let text = '';
    response.on('data', chunk => { text += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
  });
  request.on('error', reject);
  request.write(body.slice(0, 12));
  setTimeout(async () => {
    try { await midway(); } catch (error) { reject(error); return; }
    request.end(body.slice(12));
  }, 120);
});
const boardURL = id => '/api/courses/' + encodeURIComponent(id) + '/board';
const readFile = name => fs.readFileSync(path.join(dir, name + '.json'), 'utf8');

const lib = require(path.join(root, 'server/lib/course-board.js'));
const legacyClean = lib.normalize({
  schedule: [
    { date: '2026-11-12', title: ' 期中复习 ', note: ' 带计算器 ' },
    { date: '2026-11-10', title: '第三章' },
    { date: '2026-02-30', title: '不存在的日期' }
  ],
  todos: [{ id: 't-client-1', text: ' 准备课件 ', done: 1 }, { text: '   ' }]
}, 'read');
assert.deepEqual(legacyClean.schedule.map(item => ({ date: item.date, title: item.title, note: item.note })), [
  { date: '2026-11-10', title: '第三章', note: '' },
  { date: '2026-11-12', title: '期中复习', note: '带计算器' }
]);
assert.ok(legacyClean.schedule.every(item => item.id));
assert.deepEqual(legacyClean.todos, [{ id: 't-client-1', text: '准备课件', done: true }]);
assert.throws(() => lib.normalize({ schedule: [{ date: '2026-02-30', title: 'x' }] }), /日期不正确/);
assert.throws(() => lib.normalize({ todos: [{ text: '' }] }), /不能为空/);

(async () => {
  try {
    port = await freePort();
    origin = 'http://127.0.0.1:' + port;
    startServer();
    let ready = false;
    for (let i = 0; i < 160; i++) {
      try { if ((await fetch(origin + '/api/ping')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, log);

    /* 1. 没有记录：返回空日程与空待办 */
    const empty = await call(boardURL('tb00000000000000000001'));
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.schedule, []);
    assert.deepEqual(empty.body.todos, []);
    assert.equal(empty.body.updatedAt, 0);
    assert.equal(empty.body.limits.todo, lib.LIMITS.todo);

    /* 2. 保存：日期排序、空白裁剪、条目标识保留、完成状态布尔化 */
    const coursesBefore = readFile('courses');
    const payload = {
      schedule: [
        { date: '2026-11-12', title: ' 期中复习 ', note: ' 带计算器 ' },
        { date: '2026-11-10', title: '第三章 极限', note: '' }
      ],
      todos: [
        { id: 't-client-1', text: ' 准备第三周课件 ', done: false },
        { text: '核对实验分组', done: true }
      ]
    };
    const saved = await put(boardURL('tb00000000000000000001'), payload);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.schedule.map(item => item.date), ['2026-11-10', '2026-11-12']);
    assert.equal(saved.body.schedule[1].title, '期中复习');
    assert.equal(saved.body.schedule[1].note, '带计算器');
    assert.ok(saved.body.schedule[0].id);
    assert.equal(saved.body.todos[0].id, 't-client-1');
    assert.deepEqual(saved.body.todos.map(item => ({ text: item.text, done: item.done })), [
      { text: '准备第三周课件', done: false },
      { text: '核对实验分组', done: true }
    ]);
    assert.ok(saved.body.updatedAt > 0);
    const again = await call(boardURL('tb00000000000000000001'));
    assert.deepEqual(again.body.todos, saved.body.todos, '待办顺序稳定');

    /* 3. 按课程隔离：另一个课程仍为空，课程基础信息与名单文件不被改写 */
    assert.equal(readFile('courses'), coursesBefore);
    assert.deepEqual((await call(boardURL('tb00000000000000000002'))).body.schedule, []);
    assert.ok(fs.existsSync(path.join(dir, 'courseboards.json')));
    assert.ok(!readFile('courses').includes('courseboards'));

    /* 4. 服务端校验：日期、标题、备注、待办、条数、格式 */
    const invalid = [
      [{ schedule: [{ date: '2026-02-30', title: '不存在的日期' }] }, /日期不正确/],
      [{ schedule: [{ date: '2026/11/10', title: '斜杠日期' }] }, /日期不正确/],
      [{ schedule: [{ date: '2026-11-10', title: '   ' }] }, /需要填写标题/],
      [{ schedule: [{ date: '2026-11-10', title: 'x'.repeat(lib.LIMITS.title + 1) }] }, /标题最多 80 字/],
      [{ schedule: [{ date: '2026-11-10', title: 'A', note: 'y'.repeat(lib.LIMITS.note + 1) }] }, /备注最多 300 字/],
      [{ schedule: Array.from({ length: lib.LIMITS.schedule + 1 }, (_, i) => ({ date: '2026-11-10', title: 'S' + i })) }, /日程最多 300 条/],
      [{ todos: [{ text: '   ' }] }, /不能为空/],
      [{ todos: [{ text: 'z'.repeat(lib.LIMITS.todo + 1) }] }, /待办最多 120 字/],
      [{ todos: Array.from({ length: lib.LIMITS.todos + 1 }, (_, i) => ({ text: 'T' + i })) }, /待办最多 100 条/],
      [{ schedule: 'not-an-array' }, /日程格式不正确/],
      [{ todos: { text: '对象不是数组' } }, /待办格式不正确/]
    ];
    for (const [body, expectation] of invalid) {
      const bad = await put(boardURL('tb00000000000000000001'), body);
      assert.equal(bad.status, 400, JSON.stringify(body));
      assert.match(bad.body.error, expectation);
    }
    const survived = await call(boardURL('tb00000000000000000001'));
    assert.equal(survived.body.schedule.length, 2, '校验失败不得破坏已保存日程');
    assert.equal(survived.body.todos.length, 2, '校验失败不得破坏已保存待办');

    /* 5. 旧数据与损坏栏目：读时跳过，不报错；保存单门课不影响其他记录 */
    save('courseboards', [
      {
        courseId: 'tb00000000000000000002',
        schedule: [{ date: '2026-10-01', title: '旧日程', note: '旧备注' }, { title: '缺日期' }, 'not-an-item'],
        todos: [{ text: '旧待办' }, { text: '' }]
      },
      { courseId: 'tb-deleted', schedule: [{ date: '2026-10-02', title: '已删课程的残留' }] }
    ]);
    const legacy = await call(boardURL('tb00000000000000000002'));
    assert.equal(legacy.status, 200);
    assert.deepEqual(legacy.body.schedule.map(item => item.title), ['旧日程']);
    assert.deepEqual(legacy.body.todos.map(item => item.text), ['旧待办']);
    const legacySave = await put(boardURL('tb00000000000000000002'), { schedule: legacy.body.schedule, todos: legacy.body.todos });
    assert.equal(legacySave.status, 200);
    assert.ok(readFile('courseboards').includes('已删课程的残留'), '保存单门课程不应删除其他课程记录');

    /* 6. 读取请求体期间课程被删除：写盘前复查，404 且不落记录 */
    const disposable = await call('/api/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '并发删除测试课程', term: '测试学期' })
    });
    assert.equal(disposable.status, 200, JSON.stringify(disposable.body));
    const tempId = disposable.body.id;
    const raced = await putSlow(boardURL(tempId), { schedule: [{ date: '2026-11-10', title: '不该写入' }], todos: [{ text: '不该写入' }] }, async () => {
      const removed = await call('/api/courses/' + encodeURIComponent(tempId), {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true })
      });
      assert.equal(removed.status, 200, JSON.stringify(removed.body));
    });
    assert.equal(raced.status, 404, JSON.stringify(raced.body));
    assert.match(raced.body.error, /课程不存在/);
    assert.ok(!readFile('courseboards').includes(tempId), '课程删除后不得留下任务台记录');

    /* 7. 状态码：未知课程、不支持的方法 */
    assert.equal((await call(boardURL('tb-not-exist'))).status, 404);
    assert.equal((await put(boardURL('tb-not-exist'), {})).status, 404);
    assert.equal((await call(boardURL('tb00000000000000000001'), { method: 'POST' })).status, 405);

    /* 8. 页面：教学任务台可用，日程与待办结构随页面下发；iframe 内独立加载 */
    const shell = await call('/course/tb00000000000000000001');
    assert.equal(shell.status, 200);
    assert.match(shell.body, /workspaceFrame/);
    const page = await call('/course/tb00000000000000000001', { headers: { 'Sec-Fetch-Dest': 'iframe' } });
    assert.equal(page.status, 200);
    assert.match(page.body, /function tasksView/);
    assert.match(page.body, /教学任务台/);
    assert.match(page.body, /课程待办/);
    assert.match(page.body, /不向学生发布任务/);
    assert.match(page.body, /data-tab="\$\{key\}"/);
    assert.ok(!page.body.includes('教学任务台<span class="cg-soon"'), '任务台不再是占位标签');

    console.log('PASS 教学任务台：按课程隔离、日程排序、待办状态、服务端校验、旧数据容错、并发删除、页面路由');
  } finally {
    if (child) {
      child.kill();
      await new Promise(resolve => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
