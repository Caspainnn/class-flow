'use strict';
/**
 * 课程工作区 · 课程导学 接口自测
 *
 * 隔离：服务进程使用 mkdtemp 临时 DATA_DIR，只写入合成课程与名单，
 * 不读取 data/ 下的真实教学数据，也不触碰现有工作树的其他修改。
 */
const tempPath = require('./temp-path.cjs');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(tempPath('.tmp-course-guide-'));
let port = 0;
let origin = '';
let child = null;
const save = (name, value) => fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(value));

save('courses', [
  { id: 'kb00000000000000000001', name: '隔离课程甲', term: '测试学期', createdAt: 1 },
  { id: 'kb00000000000000000002', name: '隔离课程乙', term: '测试学期', createdAt: 2 }
]);
save('students', [
  { id: '2026000001', name: '示例同学甲', courseId: 'kb00000000000000000001' },
  { id: '2026000002', name: '示例同学乙', courseId: 'kb00000000000000000001' }
]);
save('settings', {});
save('sessions', []);
save('homework', []);
save('gradebatches', []);
save('questionnaires', { surveys: [] });

/* 用系统分配的临时端口，避免上一次测试的进程尚未退出时连到旧实例。 */
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
let log = '';

const call = async (url, init) => {
  const response = await fetch(origin + url, init);
  const type = response.headers.get('content-type') || '';
  return { status: response.status, url: response.url, type, body: type.includes('json') ? await response.json() : await response.text(), headers: response.headers };
};
const put = (url, value) => call(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
/* 分两段发送请求体，中途可执行删除，用来验证 readBody 后的课程有效性复查。 */
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
const guideURL = id => '/api/courses/' + encodeURIComponent(id) + '/guide';
const readFile = name => fs.readFileSync(path.join(dir, name + '.json'), 'utf8');

/* 纯函数层：旧数据容错、id 兜底、未知栏目忽略 */
const lib = require(path.join(root, 'server/lib/course-guide.js'));
assert.deepEqual(lib.KEYS, ['skill', 'literacy', 'knowledge', 'ideology']);
assert.deepEqual(lib.categories().map(x => x.label), ['技能', '素养', '知识', '思政']);
const legacy = lib.normalize({ intro: ' 旧简介 ', map: { skill: ['只有名称'], literacy: 'broken', literacyNote: ['忽略'] } }, 'read');
assert.equal(legacy.intro, '旧简介');
assert.deepEqual(legacy.map.skill.map(x => x.name), ['只有名称']);
assert.ok(legacy.map.skill[0].id.startsWith('g'));
assert.deepEqual(legacy.map.literacy, []);
assert.deepEqual(legacy.map.knowledge, []);
assert.ok(!('literacyNote' in legacy.map));
assert.deepEqual(lib.normalize({ map: { skill: [{ name: '  重复清理  ', note: '说明' }, { name: '重复清理' }] } }, 'read').map.skill.length, 1);
assert.throws(() => lib.normalize({ map: { ideology: [{ name: '' }] } }), /还没有填写名称/);
assert.throws(() => lib.normalize({ intro: 'x'.repeat(lib.LIMITS.intro + 1) }), /最多 2000 字/);
assert.throws(() => lib.normalize({ map: { skill: Array.from({ length: lib.LIMITS.items + 1 }, (_, i) => ({ name: 'E' + i })) } }), /最多 40 条/);
assert.throws(() => lib.normalize({ map: { knowledge: [{ name: 'K1' }, { name: 'K1' }] } }), /重复/);
const keptId = lib.normalize({ map: { skill: [{ id: 'gclient01', name: 'A' }] } }).map.skill[0].id;
assert.equal(keptId, 'gclient01');

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

    /* 1. 老课程没有导学记录：返回空结构而不是报错 */
    const empty = await call(guideURL('kb00000000000000000001'));
    assert.equal(empty.status, 200);
    assert.equal(empty.body.intro, '');
    assert.deepEqual(Object.keys(empty.body.map).sort(), ['ideology', 'knowledge', 'literacy', 'skill']);
    assert.ok(Object.values(empty.body.map).every(list => Array.isArray(list) && list.length === 0));
    assert.equal(empty.body.updatedAt, 0);

    /* 2. 保存：写入四栏、裁剪空白、生成条目 id */
    const coursesBefore = readFile('courses');
    const payload = {
      intro: '  本课程用合成案例讲解数据处理。 \n第二行说明。 ',
      map: {
        skill: [{ name: ' 能独立完成数据清洗 ', note: ' 含缺失值处理 ' }],
        literacy: [{ name: '团队协作' }],
        knowledge: [{ name: '概率论基础', note: '' }],
        ideology: [{ name: '科学精神' }, { name: '数据伦理' }]
      }
    };
    const saved = await put(guideURL('kb00000000000000000001'), payload);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.intro, '本课程用合成案例讲解数据处理。 \n第二行说明。');
    assert.equal(saved.body.map.skill[0].name, '能独立完成数据清洗');
    assert.equal(saved.body.map.skill[0].note, '含缺失值处理');
    assert.ok(saved.body.map.skill[0].id);
    assert.ok(saved.body.updatedAt > 0);
    const again = await call(guideURL('kb00000000000000000001'));
    assert.deepEqual(again.body.map.ideology.map(x => x.name), ['科学精神', '数据伦理']);
    assert.equal(again.body.intro, saved.body.intro);

    /* 3. 导学独立存文件，课程基础信息与名单未被改写 */
    assert.equal(readFile('courses'), coursesBefore);
    assert.ok(fs.existsSync(path.join(dir, 'courseguides.json')));
    assert.ok(!readFile('courses').includes('courseguides'));

    /* 4. 服务端校验：长度、条数、重名、空名、未知课程、非 PUT */
    const cases = [
      [{ intro: 'x'.repeat(lib.LIMITS.intro + 1) }, /课程简介最多 2000 字/],
      [{ map: { skill: [{ name: 'x'.repeat(lib.LIMITS.name + 1) }] } }, /名称最多 60 字/],
      [{ map: { skill: [{ name: 'A', note: 'y'.repeat(lib.LIMITS.note + 1) }] } }, /说明最多 160 字/],
      [{ map: { skill: Array.from({ length: lib.LIMITS.items + 1 }, (_, i) => ({ name: 'S' + i })) } }, /最多 40 条/],
      [{ map: { knowledge: [{ name: '同一名称' }, { name: '同一名称' }] } }, /重复/],
      [{ map: { ideology: [{ name: '', note: '只填了说明' }] } }, /还没有填写名称/]
    ];
    for (const [body, expectation] of cases) {
      const bad = await put(guideURL('kb00000000000000000001'), body);
      assert.equal(bad.status, 400, JSON.stringify(body));
      assert.match(bad.body.error, expectation);
    }
    assert.equal((await call(guideURL('kb-not-exist'))).status, 404);
    assert.equal((await call(guideURL('kb00000000000000000001'), { method: 'POST' })).status, 405);
    const survived = await call(guideURL('kb00000000000000000001'));
    assert.equal(survived.body.map.skill[0].name, '能独立完成数据清洗', '校验失败不得破坏已保存内容');

    /* 4.5 读取请求体期间课程被删除：落盘前复查，返回 404 且不留下导学记录 */
    const disposable = await call('/api/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '并发删除测试课程', term: '测试学期' })
    });
    assert.equal(disposable.status, 200, JSON.stringify(disposable.body));
    const tempId = disposable.body.id;
    const raced = await putSlow(guideURL(tempId), { intro: '课程删除后仍然到达的正文', map: { skill: [{ name: '不该写入' }] } }, async () => {
      const removed = await call('/api/courses/' + encodeURIComponent(tempId), {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true })
      });
      assert.equal(removed.status, 200, JSON.stringify(removed.body));
    });
    assert.equal(raced.status, 404, JSON.stringify(raced.body));
    assert.match(raced.body.error, /课程不存在/);
    assert.ok(!readFile('courseguides').includes(tempId), '课程删除后不得留下导学记录');
    assert.ok(!readFile('courseguides').includes('不该写入'));

    /* 5. 兼容旧数据：只存字符串、栏目结构损坏、缺少栏目 */
    save('courseguides', [
      { courseId: 'kb00000000000000000002', intro: '旧版简介', map: { skill: ['旧条目一', '旧条目二'], knowledge: 'not-an-array' } },
      { courseId: 'kb-not-exist', intro: '被删课程的残留记录', map: {} }
    ]);
    const old = await call(guideURL('kb00000000000000000002'));
    assert.equal(old.status, 200);
    assert.equal(old.body.intro, '旧版简介');
    assert.deepEqual(old.body.map.skill.map(x => x.name), ['旧条目一', '旧条目二']);
    assert.deepEqual(old.body.map.knowledge, []);
    assert.deepEqual(old.body.map.literacy, []);
    const older = await put(guideURL('kb00000000000000000002'), { intro: '新简介', map: { skill: ['字符串条目'] } });
    assert.equal(older.status, 200);
    assert.deepEqual(older.body.map.skill.map(x => ({ name: x.name, note: x.note })), [{ name: '字符串条目', note: '' }]);
    assert.equal(readFile('courseguides').includes('被删课程的残留记录'), true, '保存单门课程不应连带删除其他记录');

    /* 6. 页面路由：外壳 + 独立页；/course 回到列表 */
    const shellPage = await call('/course/kb00000000000000000001');
    assert.equal(shellPage.status, 200);
    assert.match(shellPage.body, /workspaceFrame/);
    const bare = await call('/course/kb00000000000000000001', { headers: { 'Sec-Fetch-Dest': 'iframe' } });
    assert.equal(bare.status, 200);
    assert.match(bare.body, /id="cgRoot"/);
    assert.match(bare.body, /能力图谱/);
    for (const label of ['技能', '素养', '知识', '思政']) assert.ok(bare.body.includes(`label:'${label}'`), label);
    assert.match(bare.body, /data-action="save"/);
    assert.match(bare.body, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    const redirect = await call('/course', { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/courses');
    assert.equal((await call('/course/kb00000000000000000001/')).status, 200, '带尾斜杠也能打开');
    assert.equal((await call('/api/courses')).body.items.length, 2, '课程列表接口保持不变');

    /* 7. 外壳路由允许课程工作区，页面内程序化跳转可用 */
    const shell = await call('/workspace.js');
    assert.ok(shell.body.includes('[\\w-]+\\/?$'), '外壳路由接受 /course/:id');
    assert.ok(shell.body.includes(".test(p))return 'course'"), '侧栏高亮跟随课程工作区');
    assert.match(shell.body, /workspaceNavigate/);
    const coursesPage = await call('/courses', { headers: { 'Sec-Fetch-Dest': 'iframe' } });
    assert.match(coursesPage.body, /\/course\//);
    assert.match(coursesPage.body, /完成并返回课程列表/);
    assert.ok(!coursesPage.body.includes('完成并进入课程工作区'), '建课完成仍走原路径，回到课程列表');
    assert.match(coursesPage.body, /href="\$\{workspaceHref\(c\.id\)\}"/, '课程卡片进入工作区');
    assert.match(coursesPage.body, /href="#edit\/\$\{c\.id\}"/, '名单与信息保留为次级入口');
    assert.match(coursesPage.body, /async function finish\(\)\{if\(locked\)return;await loadCourses\(\);location\.hash='list'/, '建课完成回列表');
    assert.ok(!coursesPage.body.includes('go(workspaceHref'), '建课完成不再程序化跳进工作区');
    const shellCourses = await call('/courses');
    assert.equal(shellCourses.status, 200);
    assert.match(shellCourses.body, /workspaceFrame/, '顶层 /courses 仍是工作区壳层');

    /* 8. 旧 /admin?pane=course 书签：壳层拦截前先 302，iframe 内同样兼容 */
    const legacyCourse = await call('/admin?pane=course', { redirect: 'manual' });
    assert.equal(legacyCourse.status, 302);
    assert.equal(legacyCourse.headers.get('location'), '/courses');
    const legacyWithId = await call('/admin?pane=course&courseId=kb00000000000000000001', { redirect: 'manual' });
    assert.equal(legacyWithId.status, 302);
    assert.equal(legacyWithId.headers.get('location'), '/courses#edit/kb00000000000000000001');
    const legacyIframe = await call('/admin?pane=course&courseId=kb00000000000000000001', { redirect: 'manual', headers: { 'Sec-Fetch-Dest': 'iframe' } });
    assert.equal(legacyIframe.status, 302, 'iframe 内请求也重定向，而不是返回壳层');
    assert.equal(legacyIframe.headers.get('location'), '/courses#edit/kb00000000000000000001');
    const legacyTarget = await call('/courses#edit/kb00000000000000000001', { headers: { 'Sec-Fetch-Dest': 'iframe' } });
    assert.equal(legacyTarget.status, 200);
    assert.match(legacyTarget.body, /id="view"/, '重定向目标在 iframe 内加载课程管理页');

    console.log('PASS 课程导学：隔离数据源、按课程保存、四栏结构、服务端校验、旧数据兼容、课程工作区路由');
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
