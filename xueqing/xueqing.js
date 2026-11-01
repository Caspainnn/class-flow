const answers = require('../server/lib/answers');
'use strict';

/* 学情分析模块 · 挂载在主服务下
 * 数据复用 data/ 里的 students / sessions / courses；
 * 作业数据独立存在 data/homework.json；
 * 预警规则存在 settings.json 的 xqRules 字段。
 */

const fs = require('fs');
const path = require('path');
const homeworkService = require('../server/lib/homework');

const DEFAULT_RULES = {
  absenceRun: 2,     // 连续缺勤几次预警
  corLastN: 5,       // 答题窗口：最近几次课
  corMinAns: 3,      // 窗口内至少答题几次才判
  corRate: 20,       // 窗口内答对率低于该百分比预警
  hwMiss: 2,         // 作业未交几次预警
  hwLow: 2,          // 作业低分几次预警
  hwLowScore: 60     // 低分线
};

module.exports = async function xueqing(req, res, ctx) {
  const { url, m, json, readBody, store, getCourses, getStudents,
    getSessions, findCourse, stamp, localDate, letter, ExcelJS, round1 } = ctx;
  const p = url.pathname;

  /* ---- 页面 ---- */
  if (p === '/xueqing' && m === 'GET') {
    try {
      const buf = fs.readFileSync(path.join(__dirname, 'public', 'analysis.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(buf);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('学情分析页面文件缺失');
    }
  }

  const getRules = () => Object.assign({}, DEFAULT_RULES, (store.read('settings', {}) || {}).xqRules || {});
  /* json() 本身没有返回值；这里包一层保证「已处理」返回 true，避免穿透回主路由 */
  const J = (...a) => { json(...a); return true; };
  const homework = homeworkService(ctx);
  const getHomeworkAll = () => homework.analysisHomework();
  const hwOf = courseId => getHomeworkAll()
    .filter(h => h.courseId === courseId && h.published !== false && !h.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt);

  /* ---- 预警规则 ---- */
  if (p === '/api/xq/rules' && m === 'PUT') {
    const b = await readBody(req);
    const s = store.read('settings', {});
    const r = Object.assign({}, DEFAULT_RULES, s.xqRules || {});
    ['absenceRun', 'corLastN', 'corMinAns', 'corRate', 'hwMiss', 'hwLow', 'hwLowScore'].forEach(k => {
      const v = Number(b[k]);
      if (Number.isFinite(v) && v >= 0) r[k] = v;
    });
    if (r.corRate > 100) r.corRate = 100;
    if (r.hwLowScore > 100) r.hwLowScore = 100;
    s.xqRules = r;
    store.write('settings', s);
    return J(res, 200, r);
  }

  /* ---- 作业：新增 ---- */
  if (m === 'POST' && ['/api/xq/homework','/api/xq/homework/delete','/api/xq/homework/scores'].includes(p)) {
    const b=await readBody(req), service=homeworkService(ctx);
    try {
      if(p === '/api/xq/homework') return J(res,200,service.create({...b,mode:'manual'}));
      if(p.endsWith('/delete')) return J(res,200,{...service.remove(b.id,true),removed:1});
      return J(res,200,service.inputScores(b.id,b.text));
    } catch(e) { if(!e.status) throw e; return J(res,e.status,{error:e.message}); }
  }

  if (p === '/api/xq/detail' && m === 'GET') {
    const courseId = url.searchParams.get('courseId');
    const studentId = url.searchParams.get('studentId');
    if (!findCourse(courseId)) return J(res, 404, { error: '课程不存在' });
    const sessions = getSessions().filter(s => s.courseId === courseId).sort((a, b) => a.startedAt - b.startedAt);
    const rows = [];
    sessions.forEach((s, si) => {
      const r = (s.records || []).find(x => x.studentId === studentId);
      if (!r || !answers.answered(r.answer)) return;
      rows.push({
        label: `第${si + 1}次 · ${stamp(s.startedAt).slice(5, 10)}`,
        q: s.question.text,
        pick: answers.format(r.answer, s.question.options),
        correctText: answers.format(s.question.correct, s.question.options),
        ok: !!r.correct
      });
    });
    return J(res, 200, { rows });
  }

  /* ---- 汇总数据 ---- */
  if (p === '/api/xq/data' && m === 'GET') {
    const courseId = url.searchParams.get('courseId');
    const d = buildData(courseId);
    if (!d) return J(res, 404, { error: '课程不存在' });
    return J(res, 200, d);
  }

  /* ---- 导出 ---- */
  if (p === '/api/xq/export.xlsx' && m === 'GET') {
    const courseId = url.searchParams.get('courseId');
    const d = buildData(courseId);
    if (!d) return J(res, 404, { error: '课程不存在' });
    const buf = await exportXlsx(d);
    const fname = `学情分析-${d.course.name}-${stamp(Date.now()).slice(0, 10)}.xlsx`;
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="xueqing.xlsx"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      'Content-Length': buf.length
    });
    return res.end(Buffer.from(buf));
  }

  return false; // 不是本模块的路由，交回主服务

  /* ================= 数据计算 ================= */
  function buildData(courseId) {
    const course = findCourse(courseId);
    if (!course) return null;
    const R = getRules();
    const roster = getStudents(courseId).slice().sort((a, b) => a.id.localeCompare(b.id));
    const sessions = getSessions().filter(s => s.courseId === courseId).sort((a, b) => a.startedAt - b.startedAt);
    const hwList = hwOf(courseId);

    /* 每次课的统计（一门课一次点名 = 一道题） */
    const sess = sessions.map((s, si) => {
      const recs = s.records || [];
      const answered = recs.filter(r => answers.answered(r.answer));
      return {
        id: s.id, sn: si + 1,
        label: stamp(s.startedAt).slice(5, 10),
        startedAt: s.startedAt,
        q: { text: s.question.text, options: s.question.options, correct: s.question.correct },
        total: roster.length,
        present: recs.length,
        late: recs.filter(r => r.status === 'late').length,
        answered: answered.length,
        rate: roster.length ? round1(recs.length / roster.length * 100) : 0,
        ansRate: roster.length ? round1(answered.length / roster.length * 100) : 0,
        corRate: answered.length ? round1(answered.filter(r => r.correct).length / answered.length * 100) : null,
        dist: s.question.options.map((_, i) => recs.filter(r => answers.includes(r.answer, i)).length)
      };
    });

    /* 每个学生 */
    const students = roster.map(stu => {
      const dots = sessions.map(s => (s.records || []).some(r => r.studentId === stu.id) ? 1 : 0);
      let answered = 0, correct = 0;
      sessions.forEach(s => {
        const r = (s.records || []).find(x => x.studentId === stu.id);
        if (r && answers.answered(r.answer)) { answered++; if (r.correct) correct++; }
      });
      const hw = hwList.map(h => {
        const e = (h.scores || {})[stu.id];
        return e ? { score: e.score, st: e.st } : { score: null, st: 'no' };
      });
      const done = hw.filter(e => e.st !== 'no');
      const misses = hw.length - done.length;
      const lows = done.filter(e => e.score < R.hwLowScore).length;

      const lastN = sessions.slice(-R.corLastN);
      let ansN = 0, corN = 0;
      lastN.forEach(s => {
        const r = (s.records || []).find(x => x.studentId === stu.id);
        if (r && answers.answered(r.answer)) { ansN++; if (r.correct) corN++; }
      });
      const corRateN = ansN ? Math.round(corN / ansN * 100) : null;

      let run = 0, maxRun = 0;
      dots.forEach(dd => { run = dd ? 0 : run + 1; if (run > maxRun) maxRun = run; });

      const warns = [];
      if (maxRun >= R.absenceRun) warns.push(`连续缺勤 ${maxRun} 次`);
      if (ansN >= R.corMinAns && corRateN < R.corRate) warns.push(`近${R.corLastN}次答题正确率 ${corRateN}%`);
      if (misses >= R.hwMiss) warns.push(`作业未交 ${misses} 次`);
      if (lows >= R.hwLow) warns.push(`作业低于${R.hwLowScore}分 ${lows} 次`);

      return {
        id: stu.id, name: stu.name, dots,
        attended: dots.filter(x => x).length,
        total: sessions.length,
        answered, correct,
        correctRate: answered ? round1(correct / answered * 100) : null,
        hw, hwDone: done.length, hwMiss: misses, hwLow: lows,
        hwAvg: done.length ? round1(done.reduce((a, e) => a + e.score, 0) / done.length) : null,
        ansN, corRateN, warns
      };
    });

    /* 作业汇总 */
    const homework = hwList.map(h => {
      const entries = Object.entries(h.scores || {});
      const done = entries.filter(([, e]) => e && e.st !== 'no');
      const segs = [0, 0, 0, 0];
      done.forEach(([, e]) => { segs[e.score >= 85 ? 0 : e.score >= 70 ? 1 : e.score >= 60 ? 2 : 3]++; });
      const missing = roster.filter(stu => !(h.scores || {})[stu.id]).map(x => x.name);
      return {
        id: h.id, name: h.name, due: h.due || '', createdAt: h.createdAt,
        sub: done.length, total: roster.length,
        avg: done.length ? round1(done.reduce((a, [, e]) => a + e.score, 0) / done.length) : null,
        segs, missing
      };
    });

    /* 总览 */
    const seat = sess.reduce((a, x) => a + x.total, 0);
    const came = sess.reduce((a, x) => a + x.present, 0);
    const ansT = sess.reduce((a, x) => a + x.answered, 0);
    const corSess = sess.filter(x => x.corRate != null);
    let hwSum = 0, hwN = 0;
    hwList.forEach(h => Object.values(h.scores || {}).forEach(e => {
      if (e && e.st !== 'no') { hwSum += e.score; hwN++; }
    }));
    const hwSub = homework.reduce((a, h) => a + h.sub, 0);
    const hwTot = homework.reduce((a, h) => a + h.total, 0);

    return {
      course: { id: course.id, name: course.name, term: course.term || '' },
      rules: R,
      labels: sess.map(x => x.label),
      sess, students, homework,
      overall: {
        count: sess.length,
        roster: roster.length,
        att: seat ? round1(came / seat * 100) : 0,
        ansRate: seat ? round1(ansT / seat * 100) : 0,
        corRate: corSess.length ? round1(corSess.reduce((a, x) => a + x.corRate, 0) / corSess.length) : null,
        hwRate: hwTot ? round1(hwSub / hwTot * 100) : 0,
        hwAvg: hwN ? round1(hwSum / hwN) : null,
        hwCount: homework.length,
        warns: students.filter(x => x.warns.length).length
      },
      now: Date.now()
    };
  }

  /* ================= 导出 ================= */
  async function exportXlsx(d) {
    const wb = new ExcelJS.Workbook();
    wb.creator = '学情分析';
    wb.created = new Date();

    const headStyle = (ws, row, n) => {
      const h = ws.getRow(row);
      h.values = n;
      h.eachCell(c => {
        c.font = { bold: true, size: 10.5 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3F5' } };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFD8DBE0' } } };
        c.alignment = { vertical: 'middle' };
      });
      h.height = 22;
    };
    const titleStyle = (ws, text, n) => {
      ws.mergeCells(1, 1, 1, n);
      ws.getRow(1).getCell(1).value = text;
      ws.getRow(1).getCell(1).font = { bold: true, size: 13 };
      ws.getRow(1).height = 26;
    };

    const CN = d.course.name;

    /* ① 预警名单 */
    const warns = d.students.filter(s => s.warns.length);
    let ws = wb.addWorksheet('预警名单', { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.columns = [{ width: 15 }, { width: 11 }, { width: 40 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];
    titleStyle(ws, `${CN}　预警名单（${stamp(Date.now())}）`, 7);
    headStyle(ws, 2, ['学号', '姓名', '预警原因', '出勤', '答对率', '作业提交', '作业均分']);
    warns.forEach(s => {
      const r = ws.addRow([s.id, s.name, s.warns.join('；'),
        `${s.attended}/${s.total}`,
        s.correctRate == null ? '' : s.correctRate + '%',
        `${s.hwDone}/${s.hw.length}`,
        s.hwAvg == null ? '' : s.hwAvg]);
      r.getCell(1).numFmt = '@';
    });
    if (!warns.length) ws.addRow(['（无）', '', '当前规则下没有触发预警的学生']);

    /* ② 学生汇总 */
    ws = wb.addWorksheet('学生汇总', { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.columns = [{ width: 15 }, { width: 11 }, { width: 12 }, { width: 10 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 10 }];
    titleStyle(ws, `${CN}　学生汇总（共 ${d.overall.count} 次课 · ${d.overall.hwCount} 次作业）`, 9);
    headStyle(ws, 2, ['学号', '姓名', '出勤(次)', '出勤率', '迟到', '答题次数', '答对率', '作业提交', '作业均分']);
    d.students.forEach(s => {
      const r = ws.addRow([s.id, s.name, s.attended + '/' + s.total,
        s.total ? Math.round(s.attended / s.total * 100) + '%' : '',
        '', s.answered,
        s.correctRate == null ? '' : s.correctRate + '%',
        `${s.hwDone}/${s.hw.length}`,
        s.hwAvg == null ? '' : s.hwAvg]);
      r.getCell(1).numFmt = '@';
    });

    /* ③ 出勤明细 */
    ws = wb.addWorksheet('出勤明细', { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.columns = [{ width: 22 }, { width: 15 }, { width: 11 }, { width: 10 }, { width: 20 }];
    titleStyle(ws, `${CN}　出勤明细`, 5);
    headStyle(ws, 2, ['课次', '学号', '姓名', '状态', '签到时间']);
    d.sess.forEach(x => {
      const byId = new Map();
      getSessions().find(s => s.id === x.id).records.forEach(r => byId.set(r.studentId, r));
      d.students.forEach(stu => {
        const rec = byId.get(stu.id);
        const r = ws.addRow([`第${x.sn}次 · ${x.label}`, stu.id, stu.name,
          rec ? (rec.status === 'late' ? '迟到' : '到课') : '缺勤',
          rec ? localDate(rec.submittedAt || rec.claimedAt) : '']);
        r.getCell(2).numFmt = '@';
        if (rec) r.getCell(5).numFmt = 'yyyy-mm-dd hh:mm:ss';
        if (!rec) r.getCell(4).font = { size: 10.5, color: { argb: 'FFA03030' } };
        else if (rec.status === 'late') r.getCell(4).font = { size: 10.5, color: { argb: 'FFBA7517' } };
      });
    });

    /* ④ 答题明细 */
    ws = wb.addWorksheet('答题明细', { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.columns = [{ width: 22 }, { width: 15 }, { width: 11 }, { width: 44 }, { width: 24 }, { width: 24 }, { width: 9 }];
    titleStyle(ws, `${CN}　答题明细`, 7);
    headStyle(ws, 2, ['课次', '学号', '姓名', '题目', '提交答案', '正确答案', '是否正确']);
    d.sess.forEach(x => {
      const src = getSessions().find(s => s.id === x.id);
      const byId = new Map((src.records || []).map(r => [r.studentId, r]));
      const correctText = answers.format(x.q.correct, x.q.options);
      d.students.forEach(stu => {
        const rec = byId.get(stu.id);
        const r = ws.addRow([`第${x.sn}次 · ${x.label}`, stu.id, stu.name, x.q.text,
          rec && answers.answered(rec.answer) ? answers.format(rec.answer, x.q.options) : '',
          correctText,
          rec && answers.answered(rec.answer) ? (rec.correct ? '对' : '错') : '']);
        r.getCell(2).numFmt = '@';
        if (rec && rec.correct) r.getCell(7).font = { size: 10.5, color: { argb: 'FF1D9E75' } };
      });
    });

    /* ⑤ 作业明细 */
    ws = wb.addWorksheet('作业明细', { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.columns = [{ width: 24 }, { width: 12 }, { width: 15 }, { width: 11 }, { width: 10 }, { width: 10 }];
    titleStyle(ws, `${CN}　作业明细（共 ${d.homework.length} 次）`, 6);
    headStyle(ws, 2, ['作业', '截止', '学号', '姓名', '提交情况', '得分']);
    if (!d.homework.length) ws.addRow(['（还没有作业，在「作业管理」里新建）']);
    d.homework.forEach(h => {
      const src = getHomeworkAll().find(x => x.id === h.id) || { scores: {} };
      d.students.forEach(stu => {
        const e = (src.scores || {})[stu.id];
        const r = ws.addRow([h.name, h.due, stu.id, stu.name,
          e ? (e.st === 'late' ? '补交' : '按时交') : '未交',
          e ? e.score : '']);
        r.getCell(3).numFmt = '@';
        if (!e) r.getCell(5).font = { size: 10.5, color: { argb: 'FFA03030' } };
      });
    });

    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 6 } };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
};
