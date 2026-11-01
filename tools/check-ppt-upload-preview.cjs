'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {createPreview}=require('./ppt-template-preview-server.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-prototype-preview-')),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSioAAAAASUVORK5CYII=','base64');let unavailable=false;
const handler=createPreview({root,render:async({profile,runDir})=>{if(unavailable)throw Error('Office unavailable');const out=path.join(runDir,'template-reference');fs.mkdirSync(out);return profile.layoutGroups.map((g,i)=>{const file=String(i+1).padStart(3,'0')+'.png';fs.writeFileSync(path.join(out,file),png);return {...g,file:'template-reference/'+file};});}});
const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const call=async(url,body,extra={})=>{const response=await fetch(origin+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
 const file={name:'Original.pptx',templateName:'Original template',base64:fs.readFileSync('tools/fixtures/ppt-service.pptx').toString('base64')};
 assert.equal((await call('/prototype-preview',file,{Origin:'https://outside.example'})).status,403);
 assert.equal((await call('/prototype-preview',{name:'a.pptx',base64:'YmFk'})).status,400);
 const created=await call('/prototype-preview',file);assert.equal(created.status,201);assert.equal(created.data.original,1,'must use actual slide count, not hardcoded 20');assert.equal(created.data.layouts.length,1);assert.equal(created.data.sourceSlides.length,1);assert.equal(created.data.layouts[0].preview,created.data.sourceSlides[0]);
 const id=created.data.id.slice('uploaded-'.length);assert.equal((await call('/prototype-preview/'+id)).data.file,'Original.pptx');
 const actual=await fetch(origin+created.data.sourceSlides[0]);assert.equal(actual.status,200);assert.deepEqual(Buffer.from(await actual.arrayBuffer()),png);
 assert.equal((await call('/prototype-preview/'+id+'/999.png')).status,404);assert.equal((await call('/prototype-preview/'+id+'/template.pptx')).status,404);assert.ok(!fs.existsSync(path.join(root,id,'template.pptx')),'temporary source copy is removed after render');
 unavailable=true;const failed=await call('/prototype-preview',file);assert.equal(failed.status,503);assert.match(failed.data.error,/无法生成真实PPT预览/);assert.equal(fs.readdirSync(root).filter(n=>/^[a-f0-9]{24}$/.test(n)).length,1,'failed preview directories must be cleaned');unavailable=false;assert.equal((await call('/prototype-preview',file)).status,201);
 console.log('PASS: actual PPT parsing, rendered original-page mapping, preview reload, source privacy, cross-site denial and render failure without dummy layouts');
}finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
