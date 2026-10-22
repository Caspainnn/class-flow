'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

const uid = (n = 6) => crypto.randomBytes(8).toString('hex').slice(0, n);

function fileOf(name) { return path.join(DATA_DIR, name + '.json'); }

function read(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileOf(name), 'utf8'));
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function write(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = fileOf(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, fileOf(name));
  return data;
}

/* ---------------- 默认数据 ---------------- */

const NAMES = [
  '陈亦然', '林　嘉', '周晓东', '吴　敏', '李　沐', '孙浩然', '郑雨欣', '黄子睿', '马思远', '何静怡',
  '徐嘉禾', '杨博文', '张一诺', '王梓萱', '刘予安', '赵一凡', '陈思远', '沈亦舟', '韩子墨', '冯可欣',
  '曹嘉宁', '邓皓宇', '范书瑶', '高梓涵', '郭嘉懿', '洪宇航', '胡佳琪', '蒋逸凡', '赖思彤', '李明轩',
  '李雨桐', '梁宸睿', '廖静姝', '刘博涵', '卢靖雯', '罗天佑', '吕欣怡', '倪嘉豪', '潘诗雨', '彭子健',
  '钱亦辰', '秦若曦', '任思远', '邵佳宁', '沈嘉树', '宋雨薇', '苏子墨'
];

function seed() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(fileOf('settings'))) {
    write('settings', {
      codeRefreshMs: 3000,
      tokenGrace: 3,
      windowMs: 90000,
      lateGraceMs: 600000,
      ticketTtlMs: 120000,
      activeCourseId: 'c1'
    });
  }

  if (!fs.existsSync(fileOf('courses'))) {
    write('courses', [{ id: 'c1', name: '高等数学（上）', term: '2026 秋', createdAt: Date.now() }]);
  }

  if (!fs.existsSync(fileOf('students'))) {
    const list = NAMES.map((name, i) => ({
      id: String(2023010101 + i),
      name,
      courseId: 'c1'
    }));
    list[0] = { id: '2026110998', name: '杨佳林', courseId: 'c1' };
    write('students', list);
  }

  if (!fs.existsSync(fileOf('sessions'))) write('sessions', []);

  migrate();
}

/* v2 → v3 就地把旧字段补成新模型，不删任何旧文件（lessons.json / banks.json 留着不管） */
function migrate() {
  const settings = read('settings', {});
  const fallbackCourse = settings.activeCourseId || 'c1';
  let touched = false;

  if (settings.pick !== undefined || !settings.activeCourseId) {
    delete settings.pick;
    settings.activeCourseId = fallbackCourse;
    write('settings', settings);
  }

  const students = read('students', []);
  students.forEach(s => {
    if (!s.courseId) { s.courseId = fallbackCourse; touched = true; }
    if (s.classId) { delete s.classId; touched = true; }
  });
  if (touched) write('students', students);

  const courses = read('courses', []);
  let ct = false;
  courses.forEach(c => {
    if (!c.createdAt) { c.createdAt = Date.now(); ct = true; }
    if (c.classId) { delete c.classId; ct = true; }
  });
  if (ct) write('courses', courses);

  const sessions = read('sessions', []);
  let st = false;
  sessions.forEach(s => {
    if (!s.courseId) {
      const lesson = read('lessons', []).find(l => l.id === s.lessonId);
      s.courseId = (lesson && lesson.courseId) || fallbackCourse;
      st = true;
    }
  });
  if (st) write('sessions', sessions);
}

module.exports = { DATA_DIR, uid, read, write, seed, fileOf };
