'use strict';
/**
 * 课程工作区 · ima 知识库标签 页面逻辑自测（无浏览器）
 *
 * 用最小 DOM 替身驱动 server/public/course.html 的内联脚本，
 * 接口全部为内存假数据；不连接服务、不读写真实教学数据或真实凭据。
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
      focus() { this.focused = true; }, scrollIntoView() {},
      showModal() { this.open = true; }, close() { this.open = false; },
      setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
      addEventListener(type, handler) { this.handlers[type] = handler; }
    });
  }
  return nodes.get(id);
};

const course = { id: 'kb1', name: '隔离课程甲', term: '测试学期', count: 2, sessions: 0, assignments: 0, ready: true };
const guide = { intro: '', map: { skill: [], literacy: [], knowledge: [], ideology: [] }, updatedAt: 0 };
const requests = [];
const fetchStub = async url => {
  requests.push(String(url));
  const data = url === '/api/courses' ? { items: [course] } : guide;
  return { ok: true, status: 200, json: async () => data };
};

const handlers = {};
const context = vm.createContext({
  document: { getElementById: el, title: '', body: { classList: { add() {}, toggle() {} } } },
  window: { addEventListener(type, handler) { handlers[type] = handler; }, history: { replaceState() {} } },
  location: { pathname: '/course/kb1', href: 'http://127.0.0.1:3000/course/kb1', hash: '' },
  fetch: fetchStub,
  setTimeout: () => 0,
  clearTimeout() {},
  console
});

const run = expression => vm.runInContext(expression, context);
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const view = () => el('cgRoot').innerHTML;
(async () => {
  vm.runInContext(code, context);
  await settle();
  assert.equal(run('tab'), 'guide');
  assert.match(view(), /data-tab="ima"/);

  context.location.hash = '#ima';
  handlers.hashchange();
  await settle();
  assert.equal(run('tab'), 'ima');
  assert.match(view(), /<iframe[^>]+src="https:\/\/ima\.qq\.com\/"/);
  assert.doesNotMatch(view(), /href="\/ima"|type="password"/);
  assert.deepEqual(requests, ['/api/courses', '/api/courses/kb1/guide']);

  await run('load()');
  assert.equal(run('tab'), 'ima');
  assert.match(view(), /<iframe[^>]+src="https:\/\/ima\.qq\.com\/"/);
  console.log('PASS embedded ima without local binding');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
