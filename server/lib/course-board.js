'use strict';
/**
 * 教学任务台：按周查看的教学日程 + 独立的课程待办。
 *
 * 存储：data/courseboards.json，一门课程一条。
 * 这里只保存教师自己的安排，不发布任务、不记录学生完成情况，也不与学生端联动。
 * 兼容旧数据：缺字段、栏目损坏、日期或名称不完整的条目按“读时跳过”处理。
 */
const crypto = require('crypto');

const FILE = 'courseboards';
const LIMITS = { schedule: 300, todos: 100, title: 80, note: 300, todo: 120, id: 40 };
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const text = value => String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
const flat = value => text(value).replace(/\s*\n\s*/g, ' ');
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

function makeId(prefix) {
  return prefix + crypto.randomBytes(5).toString('hex');
}

function entryId(raw, prefix, used) {
  const value = text(raw);
  if (/^[\w-]{1,40}$/.test(value) && !used.has(value)) return value;
  let id;
  do { id = makeId(prefix); } while (used.has(id));
  return id;
}

/* YYYY-MM-DD 且必须是真实存在的日期；read 模式返回空字符串表示跳过。 */
function day(value, strict) {
  const raw = text(value);
  const match = DATE.exec(raw);
  if (!match) {
    if (strict) fail('日程日期不正确，请选择有效日期。');
    return '';
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, date));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== date) {
    if (strict) fail('日程日期不正确，请选择有效日期。');
    return '';
  }
  return raw;
}

function normalize(input, mode = 'save') {
  const body = input && typeof input === 'object' ? input : {};
  const strict = mode === 'save';

  const rawSchedule = body.schedule == null ? [] : body.schedule;
  if (!Array.isArray(rawSchedule)) {
    if (strict) fail('日程格式不正确，请刷新页面后重试。');
  }
  const scheduleSource = Array.isArray(rawSchedule) ? rawSchedule : [];
  if (strict && scheduleSource.length > LIMITS.schedule) fail(`日程最多 ${LIMITS.schedule} 条，请先删除不再需要的安排。`);

  const schedule = [];
  const scheduleIds = new Set();
  for (const item of scheduleSource) {
    if (schedule.length >= LIMITS.schedule) break;
    if (!item || typeof item !== 'object') {
      if (strict) fail('日程格式不正确，请刷新页面后重试。');
      continue;
    }
    const date = day(item.date, strict);
    if (!date) continue;
    const title = flat(item.title);
    if (!title) {
      if (strict) fail('日程需要填写标题。');
      continue;
    }
    if (title.length > LIMITS.title) {
      if (strict) fail(`日程标题最多 ${LIMITS.title} 字，当前 ${title.length} 字。`);
      continue;
    }
    const note = flat(item.note);
    if (note.length > LIMITS.note) {
      if (strict) fail(`日程备注最多 ${LIMITS.note} 字，当前 ${note.length} 字。`);
      continue;
    }
    const id = entryId(item.id, 's', scheduleIds);
    scheduleIds.add(id);
    schedule.push({ id, date, title, note });
  }
  schedule.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const rawTodos = body.todos == null ? [] : body.todos;
  if (!Array.isArray(rawTodos)) {
    if (strict) fail('待办格式不正确，请刷新页面后重试。');
  }
  const todoSource = Array.isArray(rawTodos) ? rawTodos : [];
  if (strict && todoSource.length > LIMITS.todos) fail(`待办最多 ${LIMITS.todos} 条，请先完成或删除一些。`);

  const todos = [];
  const todoIds = new Set();
  for (const item of todoSource) {
    if (todos.length >= LIMITS.todos) break;
    if (!item || typeof item !== 'object') {
      if (strict) fail('待办格式不正确，请刷新页面后重试。');
      continue;
    }
    const content = flat(item.text);
    if (!content) {
      if (strict) fail('待办内容不能为空。');
      continue;
    }
    if (content.length > LIMITS.todo) {
      if (strict) fail(`待办最多 ${LIMITS.todo} 字，当前 ${content.length} 字。`);
      continue;
    }
    const id = entryId(item.id, 't', todoIds);
    todoIds.add(id);
    todos.push({ id, text: content, done: Boolean(item.done) });
  }

  return { schedule, todos };
}

function blank(courseId) {
  return { courseId, schedule: [], todos: [], updatedAt: 0 };
}

function read(store, courseId) {
  const rows = store.read(FILE, []);
  const record = Array.isArray(rows) ? rows.find(row => row && row.courseId === courseId) : null;
  if (!record) return blank(courseId);
  const safe = normalize(record, 'read');
  return {
    courseId,
    schedule: safe.schedule,
    todos: safe.todos,
    updatedAt: Number(record.updatedAt) || 0
  };
}

function save(store, courseId, body) {
  const data = normalize(body, 'save');
  const rows = store.read(FILE, []);
  const kept = (Array.isArray(rows) ? rows : []).filter(row => row && row.courseId !== courseId);
  const record = { courseId, schedule: data.schedule, todos: data.todos, updatedAt: Date.now() };
  store.write(FILE, [...kept, record]);
  return record;
}

function summary(board) {
  const total = board.todos.length;
  const done = board.todos.filter(item => item.done).length;
  return { schedule: board.schedule.length, todos: total, done, open: total - done };
}

module.exports = { FILE, LIMITS, normalize, read, save, blank, summary };
