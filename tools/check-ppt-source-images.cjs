'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {inline}=require('../server/ppt/source-images'),{validateHtml}=require('../server/ppt/html-deck');
const runDir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-source-images-'));fs.mkdirSync(path.join(runDir,'source-reference'));fs.mkdirSync(path.join(runDir,'pages/004'),{recursive:true});
const file='source-reference/media-5.png',pages=[{detailsFile:'source-reference/page-11.json'}],htmlFile=path.join(runDir,'pages/004/slide.html');fs.writeFileSync(path.join(runDir,file),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB','base64'));fs.writeFileSync(path.join(runDir,pages[0].detailsFile),JSON.stringify({media:[{file}]}));
const html=src=>'<html><body><p>Original text &amp; spacing</p><img alt="diagram" src="'+src+'"></body></html>';
const realpath=fs.realpathSync;fs.realpathSync=(file,...args)=>{assert.ok(String(file).startsWith(runDir),'Must not resolve untrusted paths outside the run directory');return realpath(file,...args);};
try{
 for(const src of ['../../source-reference/media-5.png','source-reference/media-5.png','../../source-reference/media-%35.png']){const result=inline(html(src),{runDir,htmlFile,pages});assert.match(result,/src="data:image\/png;base64,/);assert.ok(result.includes('<p>Original text &amp; spacing</p>'));validateHtml(Buffer.from(result));}
 for(const src of ['https://outside.example/img.png','../../input.json','../../source-reference/media-9.png','../../../../secret.png','//untrusted-host/share/image.png','%2f%2funtrusted-host/share/image.png']){const result=inline(html(src),{runDir,htmlFile,pages});assert.equal(result,html(src));assert.throws(()=>validateHtml(Buffer.from(result)));}
 assert.throws(()=>validateHtml(Buffer.from(inline(html('../../source-reference/media-5.png'),{runDir,htmlFile,pages:[]}))));
 const ready=html('data:image/png;base64,aGVsbG8=');assert.equal(inline(ready,{runDir,htmlFile,pages}),ready);
 const code=fs.readFileSync('server/ppt/public/ppt.js','utf8'),vm=require('node:vm'),ctx=vm.createContext({});vm.runInContext(code.slice(code.indexOf('function teacherMessage('),code.indexOf('function frame(')),ctx);assert.equal(vm.runInContext('teacherMessage("HTML课件须为独立页面")',ctx),'课件须为独立页面');
 console.log('PASS: mapped original images inline, unchanged text preserved, unknown/local/external resources blocked, existing data images unchanged and teacher wording deduplicated');
}finally{fs.realpathSync=realpath;fs.rmSync(runDir,{recursive:true,force:true});}
