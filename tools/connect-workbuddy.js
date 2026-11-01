#!/usr/bin/env node
/**
 * connect-workbuddy.js —— 探测本地 WorkBuddy，试通后写入连接配置
 *
 * 用法：
 *   node tools/connect-workbuddy.js                 自动查找并检测
 *   node tools/connect-workbuddy.js --path <路径>    指定 codebuddy 路径
 *   node tools/connect-workbuddy.js --list          只列出所有候选，不检测
 *   node tools/connect-workbuddy.js --off           断开连接（清掉配置）
 *   node tools/connect-workbuddy.js --timeout 30000 改单次试跑超时
 *
 * 退出码：0 已连接（或已断开）；1 没找到 / 没连通
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

/* 试跑用的提示词：越短越好，只用来验证「能不能跑通」 */
const PROBE_PROMPT = '只回复两个字母：OK';
const DEFAULT_TIMEOUT = 20000;

const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const has = (k) => argv.includes(k);

const C = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/* ---------------- 找候选 ---------------- */

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const cur = readSettings();
  const next = { ...cur, ...patch };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
}

/* WorkBuddy 安装目录下，codebuddy 的几种可能位置（同级的后备名字也要试） */
const REL = [
  ['resources', 'app.asar.unpacked', 'cli', 'bin', 'codebuddy'],
  ['resources', 'app.asar.unpacked', 'cli', 'bin', 'codebuddy.exe'],
  ['resources', 'app.asar.unpacked', 'cli', 'dist', 'codebuddy-lite-wb.mjs'],
  ['resources', 'app.asar.unpacked', 'cli', 'dist', 'codebuddy-headless.js'],
];

function expandUnder(base) {
  const out = [];
  if (!base) return out;
  for (const seg of REL) out.push(path.join(base, ...seg));
  return out;
}

/** 在某个盘符下找 WorkBuddy 目录，只看两层，避免全盘扫描 */
function scanDrive(drive) {
  const found = [];
  const roots = [drive + path.sep];
  for (const r of roots) {
    let top = [];
    try { top = fs.readdirSync(r, { withFileTypes: true }); } catch { continue; }
    for (const d of top) {
      if (!d.isDirectory()) continue;
      if (/^workbuddy/i.test(d.name)) {
        found.push(...expandUnder(path.join(r, d.name)));
      }
      /* 有些老师装在 D:\软件\WorkBuddy 这种地方，多探一层 */
      if (/^(software|软件|Program Files|Program Files \(x86\)|apps|tools|绿色软件)$/i.test(d.name)) {
        let sub = [];
        try { sub = fs.readdirSync(path.join(r, d.name), { withFileTypes: true }); } catch { continue; }
        for (const s of sub) {
          if (s.isDirectory() && /^workbuddy/i.test(s.name)) {
            found.push(...expandUnder(path.join(r, d.name, s.name)));
          }
        }
      }
    }
  }
  return found;
}

function candidates() {
  const list = [];
  const push = (p, from) => {
    if (!p) return;
    const norm = path.resolve(p);
    if (list.some((x) => x.path.toLowerCase() === norm.toLowerCase())) return;
    list.push({ path: norm, from });
  };

  /* 1. 上次连上的 */
  const saved = readSettings().workbuddy;
  if (saved && saved.path) push(saved.path, '上次连接');

  /* 2. 环境变量 */
  if (process.env.CODEBUDDY_CODE_PATH) push(process.env.CODEBUDDY_CODE_PATH, '环境变量');

  /* 3. 常见安装位置 */
  const homes = [
    [process.env.LOCALAPPDATA, '当前用户安装'],
    [process.env.ProgramFiles, '全局安装'],
    [process.env['ProgramFiles(x86)'], '全局安装'],
    [process.env.APPDATA && path.join(process.env.APPDATA, '..', 'Local', 'Programs'), '当前用户安装'],
  ];
  for (const [base, from] of homes) {
    if (!base) continue;
    for (const p of expandUnder(path.join(base, 'WorkBuddy'))) push(p, from);
    for (const p of expandUnder(path.join(base, 'Programs', 'WorkBuddy'))) push(p, from);
  }

  /* 4. 盘符扫描（仅 Windows） */
  if (process.platform === 'win32') {
    for (const ch of 'CDEFG') {
      if (!fs.existsSync(ch + ':' + path.sep)) continue;
      for (const p of scanDrive(ch + ':')) push(p, `扫描 ${ch}: 盘`);
    }
  }

  return list;
}

/* ---------------- 试跑 ---------------- */

/** 无扩展名的文件：看前两字节是不是 #! ，是就说明得用 node 跑 */
function looksLikeScript(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return buf[0] === 0x23 && buf[1] === 0x21;
  } catch {
    return false;
  }
}

function probe(file, timeoutMs) {
  return new Promise((resolve) => {
    /* Windows 上 bin/codebuddy 是带 shebang 的文本脚本（不是 exe），
       不能直接 spawn，必须交给 node 跑。.mjs/.js 同理。 */
    const isScript = /\.(mjs|cjs|js)$/i.test(file) || looksLikeScript(file);
    const cmd = isScript ? process.execPath : file;
    const args = isScript ? [file] : [];
    args.push(
      '-p', PROBE_PROMPT,
      '--output-format', 'text',
      '--tools', '',
      '--permission-mode', 'dontAsk',
      '--no-session-persistence'
    );

    const t0 = Date.now();
    let out = '';
    let err = '';
    let settled = false;

    let child;
    try {
      child = spawn(cmd, args, {
        cwd: os.tmpdir(),
        windowsHide: true,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      return resolve({ ok: false, ms: 0, why: '启动失败：' + e.message });
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      resolve({ ok: false, ms: Date.now() - t0, why: `超时（${Math.round(timeoutMs / 1000)} 秒无结果）` });
    }, timeoutMs);

    child.stdout.on('data', (b) => { out += b.toString('utf8'); });
    child.stderr.on('data', (b) => { err += b.toString('utf8'); });

    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, ms: Date.now() - t0, why: '无法执行：' + e.message });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const ms = Date.now() - t0;
      const text = (out + '\n' + err).trim();
      /* 判据：正常退出 + 输出里有 OK。有些版本会把提示回显，所以看包含关系 */
      if (code === 0 && /\bOK\b/i.test(out)) {
        resolve({ ok: true, ms, why: null });
      } else if (code === 0) {
        resolve({ ok: false, ms, why: '命令退出正常但没有响应内容（可能没登录）' });
      } else {
        const first = text.split('\n').filter((l) => l && !/^\s+at\s/.test(l))[0] || `退出码 ${code}`;
        resolve({ ok: false, ms, why: first.slice(0, 160) });
      }
    });
  });
}

/* ---------------- 主流程 ---------------- */

async function main() {
  /* --off 断开 */
  if (has('--off')) {
    const cur = readSettings();
    cur.workbuddy = {
      enabled: false,
      path: (cur.workbuddy && cur.workbuddy.path) || null,
      verifiedAt: null,
      lastError: '手动断开',
    };
    writeSettings(cur);
    console.log(C.warn('已断开 WorkBuddy 连接。作业批改将使用「手动批」方式。'));
    return 0;
  }

  const timeoutMs = Number(arg('--timeout')) || DEFAULT_TIMEOUT;

  /* --path 指定 */
  let list;
  const manual = arg('--path');
  if (manual) {
    if (!fs.existsSync(manual)) {
      console.error(C.warn(`路径不存在：${manual}`));
      console.error(C.dim('  提示：用 dir /s /b codebuddy 搜一下真实位置。'));
      return 1;
    }
    list = [{ path: path.resolve(manual), from: '手动指定' }];
  } else {
    list = candidates();
  }

  /* --list 只看候选 */
  if (has('--list')) {
    if (!list.length) {
      console.log(C.warn('没有找到任何候选路径。'));
    } else {
      console.log(C.bold('候选路径：'));
      list.forEach((x, i) => console.log(`  ${i + 1}. ${x.path}  ${C.dim('（' + x.from + '）')}`));
    }
    return 0;
  }

  if (!list.length) {
    console.log(C.warn('未找到 WorkBuddy 命令。'));
    console.log('');
    console.log('可以这样做：');
    console.log('  1. 确认 WorkBuddy 桌面版已安装并登录；');
    console.log('  2. 手动指定路径（把 <WorkBuddy 目录> 换成实际安装目录）：');
    console.log(C.dim('     node tools\\connect-workbuddy.js --path "<WorkBuddy 目录>\\resources\\app.asar.unpacked\\cli\\bin\\codebuddy"'));
    console.log('  3. 找不到也没关系，作业批改可以用「手动批」，功能不受影响。');
    writeSettings({
      workbuddy: { enabled: false, path: null, verifiedAt: null, lastError: '未找到 codebuddy' },
    });
    return 1;
  }

  console.log(C.bold(`共 ${list.length} 个候选，逐个试用（每个最多 ${Math.round(timeoutMs / 1000)} 秒）…`));
  console.log('');

  for (const item of list) {
    const exists = fs.existsSync(item.path);
    if (!exists) {
      console.log(C.dim(`  ✗ ${item.path}`) + C.dim('  文件不存在'));
      continue;
    }
    process.stdout.write(`  … ${item.path}\n`);
    const r = await probe(item.path, timeoutMs);
    if (r.ok) {
      const version = detectVersion(item.path);
      writeSettings({
        workbuddy: {
          enabled: true,
          path: item.path,
          version: version || null,
          model: 'default',
          timeoutMs: 60000,
          verifiedAt: new Date().toISOString(),
          lastError: null,
        },
      });
      console.log(C.ok(`  ✓ 连通（${r.ms}ms）`));
      console.log('');
      console.log(C.ok('WorkBuddy 已连接。'));
      console.log(`  路径：${item.path}`);
      if (version) console.log(`  版本：${version}`);
      console.log('');
      console.log('下一步：重启服务（关掉 node 窗口再 node server.js），');
      console.log('打开 http://127.0.0.1:3000/ ，左侧栏底部应显示绿点「本地 WorkBuddy 已连接」。');
      return 0;
    }
    console.log(C.warn(`  ✗ 不可用：${r.why}`));
  }

  writeSettings({
    workbuddy: { enabled: false, path: null, verifiedAt: null, lastError: '全部候选均未连通' },
  });
  console.log('');
  console.log(C.warn('没有可用的 WorkBuddy 命令。'));
  console.log('  1. 确认 WorkBuddy 桌面版正开着并且已登录；');
  console.log('  2. 如果报的是代理相关错误，关掉系统代理再试；');
  console.log('  3. 仍然不行就改用手动批 —— 作业批改功能完整可用，只是要你自己在 WorkBuddy 里批一次。');
  return 1;
}

function detectVersion(file) {
  try {
    /* 顺着路径往上找 package.json 里的 version，快且不额外起进程 */
    let d = path.dirname(file);
    for (let i = 0; i < 6; i++) {
      const p = path.join(d, 'package.json');
      if (fs.existsSync(p)) {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (j.version) return j.version;
      }
      const parent = path.dirname(d);
      if (parent === d) break;
      d = parent;
    }
  } catch {}
  return null;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(C.warn('出错：' + e.message));
    process.exit(1);
  });
