'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Exercise the actual adapter's batching and persistence hooks without a browser or API.
const source=fs.readFileSync('tools/ui/element-upload-entry.js','utf8').replace(/^import .*;\r?\n/gm,'');
let vnode,removed=0,selection=[];
const context=vm.createContext({window:{},setTimeout,clearTimeout,ElUpload:'upload',ElConfigProvider:'provider',zhCn:{},ref:value=>({value}),h:(component,props,children)=>({component,props,children}),createApp:component=>({mount(){vnode=component.setup()();},unmount(){}})});
vm.runInContext(source,context);
(async()=>{
 const unmount=context.window.InclassUpload.mount({}, {files:[],getFiles:()=>[],onSelect:async files=>selection.push(files),onRemove:async()=>removed++});
 const props=vnode.children.default().props;assert.equal(props.drag,true);assert.equal(props.multiple,true);assert.equal(props.autoUpload,false);assert.equal(props.limit,12);
 props.onChange({status:'ready',raw:{name:'one.txt'}});props.onChange({status:'ready',raw:{name:'two.txt'}});
 await new Promise(r=>setTimeout(r,20));assert.equal(selection.length,1);assert.equal(selection[0].length,2);
 assert.equal(await props.beforeRemove({id:'persisted-file'}),false);assert.equal(removed,1);
 props.onChange({status:'ready',raw:{name:'cancelled-before-flush.txt'}});unmount();await new Promise(r=>setTimeout(r,20));assert.equal(selection.length,1);
 const stop=context.window.InclassUpload.mount({}, {files:[],getFiles:()=>[],accept:'.pptx',multiple:false,limit:1,label:'Template',types:'PPTX only',onSelect:async()=>{},onError:()=>{}});const template=vnode.children.default().props;assert.equal(template.accept,'.pptx');assert.equal(template.multiple,false);assert.equal(template.limit,1);stop();
 console.log('PASS: real ElUpload drag/click configuration, multi-file batching, persisted removal, unmount cancellation');
})().catch(e=>{console.error(e);process.exitCode=1;});
