'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const [template, outline, output] = process.argv.slice(2).map(file => path.resolve(file));
if (!template || !outline || !output || fs.existsSync(output)) {
  throw Error('Usage: node run.cjs template.pptx outline.md new-output.pptx');
}
const root = path.resolve(__dirname, '../..');
const settings = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR || path.join(root, 'data'), 'settings.json'), 'utf8'));
const config = settings.workbuddy;
if (!config?.enabled || !config.path) throw Error('WorkBuddy CLI is not configured.');
const cli = path.resolve(root, config.path);
const python = process.env.PPT_PYTHON || settings.ppt?.pythonPath || path.join(root, '.local-ppt-python/Scripts/python.exe');
const cwd = fs.mkdtempSync(path.join(root, '.tmp-workbuddy-template-'));
fs.copyFileSync(path.join(__dirname, 'SKILL.md'), path.join(cwd, 'SKILL.md'));
fs.copyFileSync(outline, path.join(cwd, 'outline.md'));
console.log('Run directory:', cwd);

const prompt = 'Read SKILL.md and outline.md. Use the outline and its slot list to write fills.json, then stop. The caller will apply the fills to PowerPoint.';
const args = ['-p', prompt, '--permission-mode', 'dontAsk', '--add-dir', cwd, '--tools', 'Read,Write', '--allowedTools', 'Read', 'Write', '--max-turns', '8', '--no-session-persistence', '--port', '0'];
const model = settings.ppt?.model && settings.ppt.model !== 'default' ? settings.ppt.model : config.model;
if (model && model !== 'default') args.push('--model', model);
const isScript = /\.(?:c?js|mjs)$/i.test(cli) || fs.readFileSync(cli).subarray(0, 2).toString() === '#!';
const modelRun = spawnSync(isScript ? process.execPath : cli, isScript ? [cli, ...args] : args, {cwd, timeout: 120000, windowsHide: true, stdio: 'inherit'});
const fills = path.join(cwd, 'fills.json');
if (modelRun.error || modelRun.status !== 0 || !fs.existsSync(fills)) {
  throw modelRun.error || Error('WorkBuddy did not deliver fills.json.');
}
const fillRun = spawnSync(python, [path.join(__dirname, 'fill.py'), template, fills, output], {windowsHide: true, stdio: 'inherit'});
if (fillRun.error || fillRun.status !== 0) throw fillRun.error || Error('PowerPoint slot filling failed.');
console.log(output);
