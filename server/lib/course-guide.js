'use strict';
/**
 * 课程导学：课程简介 + 能力图谱（技能 / 素养 / 知识 / 思政）。
 *
 * 存储：data/courseguides.json，一条课程一份，按 courseId 覆盖保存。
 * 独立于 courses.json，避免与课程基本信息、名单的写入互相覆盖。
 * 兼容旧数据：课程没有导学记录、记录缺栏或条目只存了字符串，都按空结构读出。
 */
const crypto = require('crypto');

const FILE = 'courseguides';
const CATEGORIES = [
  { key: 'skill', label: '技能' },
  { key: 'literacy', label: '素养' },
  { key: 'knowledge', label: '知识' },
  { key: 'ideology', label: '思政' }
];
const KEYS = CATEGORIES.map(x => x.key);
const LABEL = Object.fromEntries(CATEGORIES.map(x => [x.key, x.label]));
const LIMITS = { intro: 2000, name: 60, note: 160, items: 40, id: 32 };

const text = value => String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
const flat = value => text(value).replace(/\s*\n\s*/g, ' ');

const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

function emptyMap() {
  return Object.fromEntries(KEYS.map(key => [key, []]));
}

function entryId(raw) {
  const value = text(raw);
  if (/^[\w-]{1,32}$/.test(value) && value.length <= LIMITS.id) return value;
  return 'g' + crypto.randomBytes(5).toString('hex');
}

/* mode='save' 严格校验并给出可修正的提示；mode='read' 容错清洗，坏数据不让页面打不开。 */
function normalize(input, mode = 'save') {
  const body = input && typeof input === 'object' ? input : {};
  const strict = mode === 'save';
  const intro = text(body.intro);
  if (intro.length > LIMITS.intro) fail(`课程简介最多 ${LIMITS.intro} 字，当前 ${intro.length} 字。`);
  const source = body.map && typeof body.map === 'object' ? body.map : {};
  const map = emptyMap();
  for (const key of KEYS) {
    const label = LABEL[key];
    const raw = source[key];
    if (raw == null) continue;
    if (!Array.isArray(raw)) {
      if (strict) fail(`「${label}」条目格式不正确，请刷新页面后重试。`);
      continue;
    }
    if (raw.length > LIMITS.items) {
      if (strict) fail(`「${label}」最多 ${LIMITS.items} 条，请先合并或删减。`);
      continue;
    }
    const seen = new Set();
    raw.forEach((item, index) => {
      const entry = typeof item === 'string' ? { name: item } : (item && typeof item === 'object' ? item : {});
      const name = flat(entry.name);
      const note = flat(entry.note);
      if (!name) {
        if (strict) fail(`「${label}」第 ${index + 1} 条还没有填写名称。`);
        return;
      }
      if (name.length > LIMITS.name) {
        if (strict) fail(`「${label}」第 ${index + 1} 条名称最多 ${LIMITS.name} 字，当前 ${name.length} 字。`);
        return;
      }
      if (note.length > LIMITS.note) {
        if (strict) fail(`「${label}」第 ${index + 1} 条说明最多 ${LIMITS.note} 字，当前 ${note.length} 字。`);
        return;
      }
      if (seen.has(name)) {
        if (strict) fail(`「${label}」里「${name}」重复了，请合并或改名。`);
        return;
      }
      seen.add(name);
      map[key].push({ id: entryId(entry.id), name, note });
    });
  }
  return { intro, map };
}

function categories() {
  return CATEGORIES.map(x => ({ key: x.key, label: x.label }));
}

function blank(courseId) {
  return { courseId, intro: '', map: emptyMap(), updatedAt: 0 };
}

function read(store, courseId) {
  const rows = store.read(FILE, []);
  const record = Array.isArray(rows) ? rows.find(row => row && row.courseId === courseId) : null;
  if (!record) return blank(courseId);
  const safe = normalize(record, 'read');
  return {
    courseId,
    intro: safe.intro,
    map: safe.map,
    updatedAt: Number(record.updatedAt) || 0
  };
}

function save(store, courseId, body) {
  const data = normalize(body, 'save');
  const rows = store.read(FILE, []);
  const kept = (Array.isArray(rows) ? rows : []).filter(row => row && row.courseId !== courseId);
  const record = { courseId, intro: data.intro, map: data.map, updatedAt: Date.now() };
  store.write(FILE, [...kept, record]);
  return record;
}

function summary(guide) {
  const counts = Object.fromEntries(KEYS.map(key => [key, (guide.map[key] || []).length]));
  return {
    total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    counts,
    filled: Boolean(guide.intro || Object.values(counts).some(n => n > 0))
  };
}

module.exports = { KEYS, CATEGORIES, LABEL, LIMITS, FILE, normalize, read, save, blank, categories, summary, emptyMap };
