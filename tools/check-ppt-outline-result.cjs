'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {read}=require('../server/ppt/outline-result'),{diagnoseLog,diagnoseFile}=require('../server/ppt/diagnostics');
const runDir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-outline-result-')),task={minutes:20},outline={pages:[{title:'Fixture',minutes:20,description:'Fixture content'}]};
try{
 assert.throws(()=>read({runDir,task}),e=>e.code==='outline_missing'&&!e.message.includes('JSON'));
 fs.writeFileSync(path.join(runDir,'outline.json'),'');assert.throws(()=>read({runDir,task}),e=>e.code==='outline_missing');
 fs.writeFileSync(path.join(runDir,'outline.json'),'{"pages":[');assert.throws(()=>read({runDir,task}),e=>e.code==='outline_invalid_json');
 fs.writeFileSync(path.join(runDir,'outline.json'),'\uFEFF'+JSON.stringify(outline));assert.equal(read({runDir,task}).sections.length,1);
 fs.unlinkSync(path.join(runDir,'outline.json'));assert.equal(read({runDir,task,finalText:'```json\n'+JSON.stringify(outline)+'\n```'}).sections.length,1);
 const failure=JSON.stringify({type:'result',is_error:true,errors:['Max turns (30) exceeded']});assert.equal(diagnoseLog(failure).code,'tool_turn_limit');
 const log=path.join(runDir,'tool-output.txt');fs.writeFileSync(log,'x'.repeat(600000)+'\n'+failure+'\n');assert.equal(diagnoseFile(log).code,'tool_turn_limit');
 console.log('PASS: missing/empty/truncated outline has actionable error, valid BOM/fallback JSON works, max-turn failure survives large logs');
}finally{fs.rmSync(runDir,{recursive:true,force:true});}
