'use strict';
/**
 * 课程工作区 · 导学页面逻辑自测（无浏览器）
 *
 * 用最小 DOM 替身驱动 server/public/course.html 的内联脚本，
 * 数据全部来自内存假接口，不连接服务、不读写任何真实数据。
 */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('server/public/course.html', 'utf8');
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

const nodes = new Map();
const el = id => {
  if (!nodes.has(id)) {
    nodes.set(id, {
      id, value: '', textContent: '', innerHTML: '', hidden: false, open: false, dataset: {}, handlers: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      focus() { this.focused = true; }, scrollIntoView() {}, showModal() { this.open = true; }, close() { this.open = false; },
      addEventListener(type, handler) { this.handlers[type] = handler; }
    });
  }
  return nodes.get(id);
};

let guideStore = { intro: '', map: { skill: [], literacy: [], knowledge: [], ideology: [] }, updatedAt: 0 };
const course = { id: 'kb1', name: '隔离课程甲', term: '测试学期', count: 2, sessions: 0, assignments: 0, ready: true };
let putMode = 'ok';
const puts = [];

const fetchStub = async (url, init = {}) => {
  const target = String(url);
  if (target === '/api/courses') return { ok: true, status: 200, json: async () => ({ items: [course] }) };
  if (target === '/api/courses/kb1/guide') {
    if (!init.method) return { ok: true, status: 200, json: async () => structuredClone(guideStore) };
    const body = JSON.parse(init.body);
    puts.push(body);
    if (putMode === 'fail') return { ok: false, status: 500, json: async () => ({ error: '保存失败，请稍后重试。' }) };
    guideStore = { ...body, updatedAt: 1763000000000 };
    return { ok: true, status: 200, json: async () => structuredClone(guideStore) };
  }
  return { ok: false, status: 404, json: async () => ({ error: '课程不存在，可能已被删除。' }) };
};

const context = vm.createContext({
  document: { getElementById: el, title: '', body: { classList: { add() {}, toggle() {} } } },
  window: { addEventListener() {} },
  location: { pathname: '/course/kb1', href: 'http://127.0.0.1:3000/course/kb1' },
  fetch: fetchStub,
  setTimeout: () => 0,
  clearTimeout() {},
  console
});

const run = expression => vm.runInContext(expression, context);
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const click = payload => el('cgRoot').handlers.click({ target: { closest: () => (payload ? { dataset: payload } : null) } });
const type = (dataset, value) => el('cgRoot').handlers.input({ target: { dataset, value, closest: () => null } });
const count = (haystack, needle) => haystack.split(needle).length - 1;

(async () => {
  vm.runInContext(code, context);
  await settle();

  /* 1. 加载后是查看态：四栏横排、各栏列表、空态 */
  assert.equal(run('editing'), false);
  assert.equal(run('course.name'), '隔离课程甲');
  let view = el('cgRoot').innerHTML;
  assert.equal(count(view, 'class="cg-col"'), 4);
  assert.equal(count(view, 'class="cg-col-empty"'), 4);
  assert.ok(view.includes('还没有填写课程简介'));
  assert.ok(view.includes('id="courseInfoForm"'));
  assert.ok(view.includes('href="#roster"'));
  let rosterClickPrevented=false;
  el('cgRoot').handlers.click({
    target:{closest:()=>({dataset:{tab:'roster'}})},
    preventDefault(){rosterClickPrevented=true}
  });
  assert.equal(rosterClickPrevented,false);
  context.location.hash='#roster';
  run("setTab(tabFromHash())");
  assert.match(el('cgRoot').innerHTML, /\/courses\?view=roster#edit\/kb1/);
  run("setTab('guide')");
  assert.ok(view.includes('教学任务台'));
  assert.ok(view.includes('ima 知识库') && !view.includes('cg-soon'), 'ima 已可用，不再显示规划中');
  assert.ok(!/教学任务台<span class="cg-soon"/.test(view), '教学任务台不再是占位');
  assert.equal(context.document.title, '隔离课程甲 · 课程导学 · 一堂课');

  /* 2. 编辑：进入草稿态，四栏都可添加 */
  click({ action: 'edit' });
  assert.equal(run('editing'), true);
  view = el('cgRoot').innerHTML;
  assert.equal(count(view, 'data-action="add"'), 4);
  assert.equal(count(view, 'data-action="save"'), 2, '顶部与底部各一个保存入口');
  assert.equal(el('cgIntro').focused, true);

  click({ action: 'add', cat: 'skill' });
  click({ action: 'add', cat: 'ideology' });
  assert.equal(run('draft.map.skill.length'), 1);
  assert.equal(run('isDirty()'), false, '仅添加空行不算改动');
  const skillId = run('draft.map.skill[0].id');
  const ideaId = run('draft.map.ideology[0].id');

  /* 3. 输入：简介字数统计、条目字段写回草稿 */
  type({ field: 'intro' }, '本课程用合成案例讲解数据处理。');
  assert.equal(el('cgIntroCount').textContent, '15 / 2000');
  type({ field: 'name', cat: 'skill', id: skillId }, '能独立完成数据清洗');
  type({ field: 'note', cat: 'skill', id: skillId }, '含缺失值处理');
  type({ field: 'name', cat: 'ideology', id: ideaId }, '科学精神');
  assert.equal(run(`draft.map.skill[0].name`), '能独立完成数据清洗');

  /* 4. 同一栏重名与空名在行内拦截，不发请求 */
  click({ action: 'add', cat: 'ideology' });
  const ideaId2 = run('draft.map.ideology[1].id');
  type({ field: 'name', cat: 'ideology', id: ideaId2 }, '科学精神');
  click({ action: 'save' });
  await settle();
  assert.equal(puts.length, 0);
  assert.match(run('alertText'), /「思政」里「科学精神」重复/);
  assert.ok(el('cgRoot').innerHTML.includes('cg-row invalid'));
  type({ field: 'name', cat: 'ideology', id: ideaId2 }, '数据伦理');

  click({ action: 'add', cat: 'knowledge' });
  const knowId = run('draft.map.knowledge[0].id');
  type({ field: 'note', cat: 'knowledge', id: knowId }, '只有说明');
  click({ action: 'save' });
  await settle();
  assert.equal(puts.length, 0);
  assert.match(run('alertText'), /只有说明，还没有填写名称/);
  click({ action: 'remove', cat: 'knowledge', id: knowId });
  assert.equal(run('draft.map.knowledge.length'), 0);
  click({ action: 'add', cat: 'literacy' });   // 留空的整行保存时应被丢弃

  /* 5. 保存失败：留在编辑态、保留草稿、提示持续显示，可直接重试 */
  putMode = 'fail';
  click({ action: 'save' });
  await settle();
  assert.equal(puts.length, 1);
  assert.equal(run('editing'), true);
  assert.ok(el('cgRoot').innerHTML.includes('保存失败，请稍后重试。'));
  assert.doesNotMatch(el('cgRoot').innerHTML, /id="cgAlert" role="alert" hidden/);
  assert.equal(run('draft.map.skill[0].name'), '能独立完成数据清洗');

  putMode = 'ok';
  click({ action: 'save' });
  await settle();
  assert.equal(puts.length, 2);
  const sent = puts[1];
  assert.equal(sent.intro, '本课程用合成案例讲解数据处理。');
  assert.deepEqual(sent.map.skill[0].note, '含缺失值处理');
  assert.deepEqual(sent.map.skill[0].id, skillId);
  assert.deepEqual(sent.map.literacy, []);
  assert.equal(run('editing'), false);
  assert.equal(run('isDirty()'), false);
  assert.equal(el('cgToast').textContent, '课程导学已保存');

  /* 6. 保存后查看态展示条目与简介，更新时间可读 */
  view = el('cgRoot').innerHTML;
  assert.ok(view.includes('能独立完成数据清洗'));
  assert.ok(view.includes('含缺失值处理'));
  assert.ok(view.includes('科学精神'));
  assert.ok(view.includes('本课程用合成案例讲解数据处理。'));
  assert.match(view, /更新于 \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  assert.equal(count(view, 'class="cg-col"'), 4);
  assert.equal(count(view, 'class="cg-col-empty"'), 2, '只有空栏显示空态');

  /* 7. 取消编辑：无改动直接退出，有改动先确认 */
  click({ action: 'edit' });
  click({ action: 'cancel' });
  assert.equal(run('editing'), false);

  click({ action: 'edit' });
  type({ field: 'intro' }, '改动后的简介');
  click({ action: 'cancel' });
  assert.equal(el('cgDialog').open, true);
  assert.ok(el('cgDialog').innerHTML.includes('放弃未保存的导学修改？'));
  assert.ok(el('cgDialog').innerHTML.includes('btn danger'), '确认放弃使用危险按钮');
  assert.equal(run('editing'), true);
  el('cgDialogConfirm').onclick();
  assert.equal(run('editing'), false);
  assert.equal(run('guide.intro'), '本课程用合成案例讲解数据处理。');
  assert.equal(puts.length, 2, '放弃修改不写接口');

  /* 8. 未保存时阻止离开：返回 false 并给出确认，未改动时放行 */
  assert.equal(context.window.appCanNavigate('/courses'), true);
  click({ action: 'edit' });
  type({ field: 'intro' }, '再次改动');
  assert.equal(context.window.appCanNavigate('/courses'), false);
  assert.ok(el('cgDialog').innerHTML.includes('放弃修改并离开'));
  el('cgDialogConfirm').onclick();
  assert.equal(context.location.href, '/courses');

  /* 9. 整条空行保存时丢弃，不写入接口 */
  click({ action: 'edit' });
  click({ action: 'add', cat: 'literacy' });
  click({ action: 'save' });
  await settle();
  assert.equal(puts.length, 3);
  assert.deepEqual(puts[2].map.literacy, []);
  assert.equal(puts[2].intro, '本课程用合成案例讲解数据处理。');

  console.log('PASS 课程导学页面：查看四栏、编辑草稿、行内校验、失败保留、取消确认、离开拦截、空行丢弃');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
