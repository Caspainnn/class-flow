'use strict';
// Synthetic CLI for isolated browser tests only. Never calls a model.
const fs=require('node:fs'),path=require('node:path');
if(!process.env.DATA_DIR||!path.basename(process.env.DATA_DIR).startsWith('inclass-workflow-ui-'))process.exit(2);
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
emit({type:'system',subtype:'init'});
setTimeout(()=>emit({type:'assistant',message:{content:[{type:'tool_use',name:'Read',input:{}}]}}),500);
setTimeout(()=>{fs.mkdirSync('project/svg_output',{recursive:true});fs.writeFileSync('project/svg_output/01.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');emit({type:'assistant',message:{content:[{type:'tool_use',name:'Write',input:{}}]}});},2000);
setTimeout(()=>{emit({type:'result',result:'Synthetic task ended without a delivery.'});process.exit(0);},180000);
