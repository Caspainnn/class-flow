'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{spawnSync}=require('node:child_process');
const {probe}=require('../server/lib/workbuddy-probe');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-cli-probe-'));
(async()=>{
 const previous=process.env.CODEBUDDY_TEST_MARKER;process.env.CODEBUDDY_TEST_MARKER='synthetic-only';
 try{
  for(const [response,code,success] of [[JSON.stringify({type:'result',result:'OK',is_error:false}),0,true],['The prompt says OK',0,false],[JSON.stringify({type:'result',result:'OK',is_error:true}),0,false],[JSON.stringify({type:'result',result:'OK'}),1,false]]){
   const result=await probe(__filename,1000,{model:'test-model',launch:(cmd,args,options)=>{assert.equal(cmd,process.execPath);assert.equal(args[args.indexOf('--port')+1],'0');assert.equal(args[args.indexOf('--tools')+1],'');assert.equal(args[args.indexOf('--model')+1],'test-model');assert.equal(options.env.CODEBUDDY_TEST_MARKER,undefined);assert.equal(options.env.NODE_OPTIONS,undefined);assert.equal(options.windowsHide,true);const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();setImmediate(()=>{child.stdout.emit('data',response);child.emit('close',code);});return child;}});
   assert.equal(result.ok,success);
  }
 }finally{if(previous===undefined)delete process.env.CODEBUDDY_TEST_MARKER;else process.env.CODEBUDDY_TEST_MARKER=previous;}
 const settings=path.join(root,'settings.json'),fixture=path.join(root,'fake-cli.cjs'),calls=path.join(root,'calls.txt');
 fs.writeFileSync(fixture,"const fs=require('node:fs');fs.appendFileSync(process.env.PROBE_FIXTURE_CALLS,'1');console.log(JSON.stringify({type:'result',result:'OK',is_error:false}));");
 const original={codeRefreshMs:1234,ppt:{name:'preserved'},workbuddy:{model:'chosen',timeoutMs:90000,keepRaw:true,background:false}};fs.writeFileSync(settings,JSON.stringify(original));
 const invoke=(args=[])=>spawnSync(process.execPath,[path.join(__dirname,'connect-workbuddy.js'),'--path',fixture,...args],{env:{...process.env,DATA_DIR:root,PROBE_FIXTURE_CALLS:calls},encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(invoke(['--list']).status,0);assert.equal(fs.existsSync(calls),false);assert.deepEqual(JSON.parse(fs.readFileSync(settings)),original);
 let result=invoke();assert.equal(result.status,0,result.stderr);let saved=JSON.parse(fs.readFileSync(settings));assert.equal(saved.workbuddy.enabled,true);assert.equal(saved.workbuddy.model,'chosen');assert.equal(saved.workbuddy.keepRaw,true);assert.equal(saved.workbuddy.background,false);assert.equal(saved.workbuddy.timeoutMs,90000);assert.deepEqual(saved.ppt,original.ppt);assert.equal(saved.codeRefreshMs,1234);assert.equal(fs.readFileSync(calls,'utf8'),'1');
 fs.writeFileSync(fixture,"console.log('prompt included OK but no model reply');");result=invoke();assert.equal(result.status,1);saved=JSON.parse(fs.readFileSync(settings));assert.equal(saved.workbuddy.enabled,false);assert.equal(saved.workbuddy.model,'chosen');
 fs.writeFileSync(settings,'{broken');result=invoke();assert.equal(result.status,1);assert.equal(fs.readFileSync(settings,'utf8'),'{broken');
 // The settings-page route also uses the same probe and only the explicitly supplied path.
 const code=fs.readFileSync(path.join(__dirname,'../server/grade/grade.js'),'utf8');assert.match(code,/require\('\.\.\/lib\/workbuddy-probe'\)/);assert.match(code,/if \(extraPath\) return list/);
 console.log('PASS: one explicit CLI probe, dynamic port, sanitized environment, exact model reply, custom DATA_DIR, merged preferences, read-only list, corrupt-config preservation; fake CLI only');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
