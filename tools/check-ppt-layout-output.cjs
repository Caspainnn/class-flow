'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createTemplates}=require('../server/ppt/templates'),{inspectPpt}=require('../server/ppt/service'),ZIP=require('../server/node_modules/jszip');
const source=process.argv[2]||path.join(__dirname,'fixtures/ppt-service.pptx'),output=process.argv[3];
const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-layout-output-'));
(async()=>{const bytes=fs.readFileSync(source),original=await inspectPpt(bytes),library=createTemplates(root,inspectPpt),item=await library.add({name:'Isolated-template.pptx',base64:bytes.toString('base64')}),ids=item.analysis.smart.selectedIds,confirmed=await library.confirm(item.id,{mode:'smart',layouts:ids.map((id,i)=>({id,name:'布局 '+(i+1)}))}),result=fs.readFileSync(library.file(item.id)),actual=await inspectPpt(result),zip=await ZIP.loadAsync(result),app=zip.file('docProps/app.xml')?await zip.file('docProps/app.xml').async('string'):'';
 assert.equal(actual.length,ids.length);assert.equal(confirmed.profile.slideCount,ids.length);assert.deepEqual(confirmed.profile.layoutGroups.map(g=>g.name),ids.map((_,i)=>'布局 '+(i+1)));if(app.includes('<Slides>'))assert.match(app,new RegExp('<Slides>'+ids.length+'</Slides>'));assert.ok(fs.readFileSync(source).equals(bytes));
 if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,result);}
 console.log(JSON.stringify({sourcePages:original.length,strictCandidates:item.analysis.layoutGroups.length,recommendedLayouts:ids.length,actualOutputPages:actual.length,outputSHA256:crypto.createHash('sha256').update(result).digest('hex'),sourceUnchanged:true}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
