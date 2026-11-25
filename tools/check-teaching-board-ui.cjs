'use strict';
/**
 * 课程工作区 · 教学任务台 页面逻辑自测（无浏览器）
 *
 * 用最小 DOM 替身驱动 server/public/course.html 的内联脚本，
 * 日程与待办来自内存假接口，不连接服务、不读写真实数据。
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

const course = { id: 'kb1', name: '隔离课程甲', term: '测试学期', count: 3, sessions: 1, assignments: 0, ready: true };
const guide = { intro: '合成课程简介。', map: { skill: [], literacy: [], knowledge: [], ideology: [] }, updatedAt: 0 };
let boardStore = { schedule: [], todos: [], updatedAt: 0 };
let putMode = 'ok';
const puts = [];

const respond = (ok, status, body) => ({ ok, status, json: async () => structuredClone(body) });
const sortSchedule = list => [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
let idSeq = 0;
const fetchStub = async (url, init = {}) => {
  const target = String(url);
  if (target === '/api/courses') return respond(true, 200, { items: [course] });
  if (target === '/api/courses/kb1/guide') return respond(true, 200, guide);
  if (target === '/api/courses/kb1/board') {
    if (!init.method) return respond(true, 200, boardStore);
    const body = JSON.parse(init.body);
    puts.push(body);
    if (putMode === 'fail') return respond(false, 500, { error: '保存失败，请稍后重试。' });
    boardStore = {
      schedule: sortSchedule(body.schedule.map(item => ({ id: item.id || 's' + (++idSeq), date: item.date, title: item.title.trim(), note: (item.note || '').trim() }))),
      todos: body.todos.map(item => ({ id: item.id || 't' + (++idSeq), text: item.text.trim(), done: Boolean(item.done) })),
      updatedAt: 1763000000000
    };
    return respond(true, 200, boardStore);
  }
  return respond(false, 404, { error: '课程不存在，可能已被删除。' });
};

const listeners = {};
const location = { pathname: '/course/kb1', href: 'http://127.0.0.1:3000/course/kb1', hash: '' };
const context = vm.createContext({
  document: { getElementById: el, title: '', body: { classList: { add() {}, toggle() {} } } },
  window: {
    addEventListener(type, handler) { listeners[type] = handler; },
    history: { replaceState(state, title, url) { if (url) location.hash = url; } }
  },
  location,
  fetch: fetchStub,
  setTimeout: () => 0,
  clearTimeout() {},
  console
});

const run = expression => vm.runInContext(expression, context);
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const click = (payload, extra = {}) => el('cgRoot').handlers.click({
  target: { closest: () => ({ dataset: payload }) },
  preventDefault() { extra.prevented = true; }
});
const typeById = (id, value) => el('cgRoot').handlers.input({ target: { id, value } });
const typeGuide = (dataset, value) => el('cgRoot').handlers.input({ target: { dataset, value, closest: () => null } });
const view = () => el('cgRoot').innerHTML;

(async () => {
  vm.runInContext(code, context);
  await settle();

  /* 1. 默认仍是导学；任务台不再占位，标签可切换 */
  assert.equal(run('tab'), 'guide');
  assert.ok(view().includes('教学任务台'));
  assert.ok(!view().includes('教学任务台<span class="cg-soon"'));
  assert.ok(view().includes('ima 知识库') && !view().includes('cg-soon'), 'ima 已可用，不再显示规划中');

  location.hash = '#tasks';
  listeners.hashchange();
  await settle();
  assert.equal(run('tab'), 'tasks');
  assert.equal(run('document.title'), '隔离课程甲 · 教学任务台 · 一堂课');
  assert.ok(view().includes('教学日程') && view().includes('课程待办'));
  assert.ok(view().includes('本周'));
  assert.ok(view().includes('本周还没有安排'));
  assert.ok(view().includes('还没有待办'));
  assert.ok(view().includes('不向学生发布任务'));
  assert.ok(!view().includes('data-action="schedule-save"'));

  /* 2. 周切换：上一周/下一周/回到本周，范围标签跟着变 */
  const thisWeek = run('weekStartOf(todayKey())');
  const currentLabel = run(`weekRangeLabel('${thisWeek}')`);
  assert.ok(view().includes(currentLabel), currentLabel);
  click({ action: 'week-next' });
  assert.ok(view().includes(run(`weekRangeLabel('${run(`shiftDay('${thisWeek}',7)`)}')`)));
  assert.ok(!view().includes('tb-week-tag'));
  click({ action: 'week-prev' });
  click({ action: 'week-prev' });
  assert.ok(view().includes(run(`weekRangeLabel('${run(`shiftDay('${thisWeek}',-7)`)}')`)));
  click({ action: 'week-now' });
  assert.ok(view().includes(currentLabel));
  assert.ok(view().includes('tb-week-tag'));

  /* 3. 新增日程：行内校验不发请求，成功后出现日程表行 */
  const dayA = run(`shiftDay('${thisWeek}',1)`);
  const dayB = run(`shiftDay('${thisWeek}',3)`);
  click({ action: 'schedule-add' });
  assert.ok(view().includes('id="tbDate"'), '打开新增日程表单');
  assert.equal(run('scheduleEdit.date'), run('todayKey()'), '本周内默认今天');
  typeById('tbDate', '');
  click({ action: 'schedule-save' });
  await settle();
  assert.equal(puts.length, 0);
  assert.match(view(), /请选择日程日期/);
  typeById('tbDate', dayA);
  click({ action: 'schedule-save' });
  await settle();
  assert.equal(puts.length, 0);
  assert.match(view(), /请填写日程标题/);
  typeById('tbTitle', '第三章 极限');
  typeById('tbNote', '带例题册');
  click({ action: 'schedule-save' });
  await settle();
  assert.equal(puts.length, 1);
  assert.deepEqual(puts[0].schedule.map(item => ({ date: item.date, title: item.title, note: item.note })), [{ date: dayA, title: '第三章 极限', note: '带例题册' }]);
  assert.equal(run('scheduleEdit'), null);
  assert.ok(view().includes('第三章 极限'));
  assert.ok(view().includes('带例题册'));
  assert.ok(view().includes('1 项安排'));
  assert.equal(el('cgToast').textContent, '日程已添加');

  /* 4. 编辑与删除日程：删除需确认，确认后才写接口 */
  click({ action: 'schedule-add' });
  typeById('tbDate', dayB);
  typeById('tbTitle', '课堂练习');
  click({ action: 'schedule-save' });
  await settle();
  assert.equal(puts.length, 2);
  const scheduleId = run('board.schedule[1].id');
  click({ action: 'schedule-edit', id: scheduleId });
  assert.ok(view().includes('保存修改'));
  assert.ok(view().includes('value="课堂练习"'));
  typeById('tbTitle', '课堂练习（改）');
  click({ action: 'schedule-save' });
  await settle();
  assert.equal(puts.length, 3);
  assert.ok(view().includes('课堂练习（改）'));
  click({ action: 'schedule-remove', id: scheduleId });
  assert.equal(el('cgDialog').open, true);
  assert.ok(el('cgDialog').innerHTML.includes('删除这条日程？'));
  assert.ok(el('cgDialog').innerHTML.includes('btn danger'));
  assert.equal(puts.length, 3, '确认前不删除');
  el('cgDialogConfirm').onclick();
  await settle();
  assert.equal(puts.length, 4);
  assert.ok(!view().includes('课堂练习（改）'));
  assert.equal(el('cgToast').textContent, '日程已删除');

  /* 5. 待办：添加、空内容拦截、完成与撤销完成 */
  typeById('tbTodoInput', '准备第三周课件');
  click({ action: 'todo-add' });
  await settle();
  assert.equal(puts.length, 5);
  assert.ok(view().includes('准备第三周课件'));
  assert.ok(view().includes('1 项待完成 · 共 1 项'));
  const todoId = run('board.todos[0].id');
  typeById('tbTodoInput', '   ');
  click({ action: 'todo-add' });
  await settle();
  assert.equal(puts.length, 5);
  assert.match(view(), /请填写待办内容/);
  click({ action: 'todo-toggle', id: todoId });
  await settle();
  assert.equal(puts.length, 6);
  assert.equal(puts[5].todos[0].done, true);
  assert.ok(view().includes('tb-todo done'));
  assert.ok(view().includes('全部完成 · 共 1 项'));
  assert.equal(el('cgToast').textContent, '已标记完成');
  click({ action: 'todo-toggle', id: todoId });
  await settle();
  assert.equal(puts.length, 7);
  assert.equal(puts[6].todos[0].done, false);
  assert.equal(el('cgToast').textContent, '已恢复为待办');

  /* 6. 待办编辑与删除；保存失败保留输入与错误提示 */
  click({ action: 'todo-edit', id: todoId });
  assert.ok(view().includes('id="tbTodoEdit"'));
  typeById('tbTodoEdit', '准备第三周课件（含实验）');
  putMode = 'fail';
  click({ action: 'todo-save' });
  await settle();
  assert.equal(puts.length, 8);
  assert.match(view(), /保存失败，请稍后重试。/);
  assert.ok(view().includes('准备第三周课件（含实验）'), '失败后保留已填内容');
  assert.equal(run('todoEdit.id'), todoId);
  putMode = 'ok';
  click({ action: 'todo-save' });
  await settle();
  assert.equal(puts.length, 9);
  assert.equal(run('todoEdit'), null);
  assert.ok(view().includes('准备第三周课件（含实验）'));
  click({ action: 'todo-remove', id: todoId });
  assert.ok(el('cgDialog').innerHTML.includes('删除这条待办？'));
  el('cgDialogConfirm').onclick();
  await settle();
  assert.equal(puts.length, 10);
  assert.ok(view().includes('还没有待办'));

  /* 7. 日程保存失败：留在表单、保留输入、可持续重试 */
  click({ action: 'schedule-add' });
  typeById('tbDate', dayA);
  typeById('tbTitle', '失败仍保留');
  putMode = 'fail';
  click({ action: 'schedule-save' });
  await settle();
  assert.equal(puts.length, 11);
  assert.match(view(), /保存失败，请稍后重试。/);
  assert.equal(run('scheduleEdit.title'), '失败仍保留');
  assert.ok(view().includes('value="失败仍保留"'));
  putMode = 'ok';
  click({ action: 'schedule-cancel' });
  assert.equal(run('scheduleEdit'), null);

  /* 8. 导学有未保存修改时切换任务台：先确认，确认后才切换 */
  location.hash = '#guide';
  listeners.hashchange();
  await settle();
  assert.equal(run('tab'), 'guide');
  click({ action: 'edit' });
  typeGuide({ field: 'intro' }, '尚未保存的改动');
  const extra = { prevented: false };
  click({ tab: 'tasks' }, extra);
  assert.equal(extra.prevented, true);
  assert.equal(run('tab'), 'guide');
  assert.equal(el('cgDialog').open, true);
  assert.ok(el('cgDialog').innerHTML.includes('离开导学编辑？'));
  el('cgDialogConfirm').onclick();
  await settle();
  assert.equal(run('tab'), 'tasks');
  assert.equal(run('editing'), false);

  /* 9. 保存中不允许离开页面 */
  run('boardBusy=true');
  assert.equal(context.window.appCanNavigate('/courses'), false);
  assert.match(el('cgToast').textContent, /正在保存/);
  run('boardBusy=false');
  assert.equal(context.window.appCanNavigate('/courses'), true);

  console.log('PASS 教学任务台页面：标签切换、周切换、日程增改删、待办增改删与完成、校验与失败保留、未保存切换确认');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
