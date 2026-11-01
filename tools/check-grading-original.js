'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const route=require('../server/grade/grade');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-original-'));
const files=[{orig:'100001示例.md',sid:'100001'},{orig:'100001示例.docx',sid:'100001'},{orig:'missing.pdf',sid:'100002'},{orig:'../outside.txt',sid:'100003'}];
const base=path.join(dir,'批改','demo');fs.mkdirSync(base,{recursive:true});
fs.writeFileSync(path.join(base,files[0].orig),'学生作答：<script>alert(1)</script>');fs.writeFileSync(path.join(base,files[1].orig),'fake docx bytes');
async function get(index,batch='demo',query=''){
 const res={writeHead(status,headers){this.status=status;this.headers=headers},end(body){this.body=body}};
 await route({},res,{url:new URL(`http://localhost/api/gb/batches/${batch}/files/${index}/original${query}`),m:'GET',store:{DATA_DIR:dir,read:(key,fallback)=>key==='gradebatches'?[{id:'demo',files},{id:'deleted',deletedAt:1,files}]:fallback},json:(res,status,body)=>{res.status=status;res.body=body}});
 return res;
}
(async()=>{try{
 let r=await get(0);assert.equal(r.status,200);assert.equal(r.headers['Content-Type'],'text/plain; charset=utf-8');assert.match(r.headers['Content-Disposition'],/^inline/);assert.match(r.body.toString(),/学生作答/);assert.equal(r.headers['X-Content-Type-Options'],'nosniff');
 r=await get(1);assert.equal(r.status,200);assert.match(r.headers['Content-Disposition'],/^attachment/);
 r=await get(0,'demo','?preview=1');assert.equal(r.status,200);assert.match(r.body.text,/学生作答/);
 r=await get(0,'demo','?download=1');assert.match(r.headers['Content-Disposition'],/^attachment/);
 assert.equal((await get(2)).status,404);assert.equal((await get(3)).status,400);assert.equal((await get(9)).status,404);assert.equal((await get(0,'deleted')).status,404);
 const html=fs.readFileSync('server/grade/public/grading.html','utf8');const script=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[1];new vm.Script(script);
 const helper=script.match(/function reviewFiles\(sid\) \{[^\n]+/)[0];
 const ctx=vm.createContext({reviewState:{files}});vm.runInContext(helper,ctx);
 assert.equal(vm.runInContext("reviewFiles('100001').length",ctx),2);
 assert.equal(vm.runInContext("reviewFiles('nobody').length",ctx),0);
 console.log('PASS: original bytes, safe inline text, Word download, missing/deleted/path guards, per-student multiple original links');
}finally{if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
