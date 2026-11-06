'use strict';
// Isolated native compilation and shortcut checks; never opens the browser or teaching data.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const project=path.resolve(__dirname,'..'),root=fs.mkdtempSync(path.join(project,'.tmp-desktop-shortcut-'));
const tools=path.join(root,'tools'),desktop=path.join(root,'desktop'),data=path.join(root,'测试 data');
fs.mkdirSync(tools);fs.mkdirSync(desktop);
for(const file of ['launcher.cs','build-launcher.ps1','setup-desktop.ps1'])fs.copyFileSync(path.join(__dirname,file),path.join(tools,file));
fs.copyFileSync(path.join(project,'icon.ico'),path.join(root,'icon.ico'));
const exe=path.join(root,'一堂课.exe'),link=path.join(desktop,'一堂课.lnk');
const ps=(file,...args)=>run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,...args]);
function run(command,args,env=process.env){return new Promise((resolve,reject)=>{
 const child=spawn(command,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
 const timer=setTimeout(()=>{child.kill();reject(Error('Timed out: '+command));},30000);
 child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('exit',code=>{clearTimeout(timer);resolve({code,output});});
});}
function ok(result){assert.equal(result.code,0,result.output);}
const normalize=p=>path.resolve(p).replace(/[\\/]+$/,'').replaceAll('\\','/').toLowerCase();
let expectedData=data,requests=0;
const server=http.createServer((req,res)=>{
 requests++;assert.equal(req.url,'/api/desktop/status');
 const identity=crypto.createHash('sha256').update(normalize(root)+'|'+normalize(expectedData)).digest('hex');
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'inclass',identity,busy:[]}));
});
(async()=>{
 ok(await ps(path.join(tools,'build-launcher.ps1')));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=String(server.address().port);
 const setup=({dataDirectory=data,publicOrigin='https://class.example.test'}={})=>ps(path.join(tools,'setup-desktop.ps1'),'-ShortcutDirectory',desktop,'-Port',port,'-DataDirectory',dataDirectory,'-HostAddress','127.0.0.1','-PublicOrigin',publicOrigin);
 ok(await setup());
 // Read the actual saved .lnk, then execute its target/arguments with --check only.
 const probe=path.join(root,'probe.ps1'),report=path.join(root,'link.json');
 fs.writeFileSync(probe,'\ufeff'+String.raw`param([string]$Link,[string]$Report,[string]$Mode='read')
$ErrorActionPreference='Stop'
$shell=New-Object -ComObject WScript.Shell
$item=$shell.CreateShortcut($Link)
if($Mode -eq 'legacy'){$item.TargetPath=Join-Path $PSHOME 'powershell.exe';$item.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'tools\open-desktop.ps1')+'"';$item.Save();exit}
if($Mode -eq 'foreign'){$item.TargetPath=Join-Path $env:WINDIR 'notepad.exe';$item.Arguments='';$item.Save();exit}
@{target=$item.TargetPath;arguments=$item.Arguments;workingDirectory=$item.WorkingDirectory} | ConvertTo-Json | Set-Content -LiteralPath $Report -Encoding UTF8
if($Mode -eq 'check'){$p=Start-Process -FilePath $item.TargetPath -ArgumentList ($item.Arguments+' --check') -WorkingDirectory $item.WorkingDirectory -WindowStyle Hidden -PassThru -Wait;exit $p.ExitCode}
`);
 const inspect=async mode=>{ok(await ps(probe,'-Link',link,'-Report',report,'-Mode',mode));return JSON.parse(fs.readFileSync(report,'utf8').replace(/^\uFEFF/,''));};
 let saved=await inspect('check');assert.equal(saved.target,exe);assert.equal(saved.workingDirectory,root);
 assert.doesNotMatch(saved.arguments,/powershell|ExecutionPolicy|WindowStyle|\.ps1/i);
 assert.ok(saved.arguments.includes('--host "127.0.0.1"'));assert.ok(saved.arguments.includes('--public-origin "https://class.example.test"'));
 assert.equal(requests,1);assert.ok(fs.existsSync(path.join(root,'launcher-check.json')));
 ok(await setup());await inspect('check'); // repeated installation
 await inspect('legacy');ok(await setup());await inspect('check'); // legacy migration
 // Environment fallback remains supported; explicit arguments override conflicting inherited settings.
 const env={...process.env,PORT:port,DATA_DIR:data};ok(await run(exe,['--check'],env));
 ok(await run(exe,['--check','--port',port,'--data-dir',data],{...env,PORT:'1',DATA_DIR:path.join(root,'wrong')}));
 const before=requests;
 for(const args of [['--port','0'],['--port','65536'],['--port'],['--data-dir',''],['--public-origin','file:///C:/'],['--unknown']])assert.equal((await run(exe,['--check',...args],env)).code,1,JSON.stringify(args));
 assert.equal(requests,before,'invalid configuration must not contact a service');
 // Drive roots and trailing separators must survive native Windows command-line quoting.
 expectedData=path.parse(root).root;ok(await setup({dataDirectory:expectedData,publicOrigin:''}));saved=await inspect('check');assert.ok(saved.arguments.endsWith('--public-origin ""'));
 await inspect('foreign');assert.notEqual((await setup()).code,0);saved=await inspect('read');assert.equal(path.basename(saved.target).toLowerCase(),'notepad.exe');
 console.log('PASS: native EXE shortcut, actual saved arguments, custom port/data, legacy migration, repeat setup, environment fallback/override, invalid arguments, root paths, empty origin, foreign shortcut protection.');
 console.log('Isolated evidence: '+root);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
