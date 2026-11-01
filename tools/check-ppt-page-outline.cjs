'use strict';
const assert=require('node:assert/strict'),{validate}=require('../server/ppt/outline');
const task={minutes:20,pageCount:2},value={objective:'Learn',pages:[{title:'First',minutes:5,description:'Introduction diagram'},{title:'Second',minutes:15,description:'Worked example and answer'}]};
const saved=validate(value,task);assert.equal(saved.pageBased,true);assert.equal(saved.sections.length,2);assert.equal(saved.sections[1].description,value.pages[1].description);
assert.throws(()=>validate(value,{...task,pageCount:3}),/3/);assert.throws(()=>validate({...value,pages:[{...value.pages[0],description:''},value.pages[1]]},task),/内容/);
assert.throws(()=>validate({...value,pages:[{...value.pages[0],layoutId:'unknown'},value.pages[1]]},task),/布局/);
assert.equal(validate({...value,pages:[{...value.pages[0],layoutId:'cover'},value.pages[1]]},{...task,template:{profile:{layoutGroups:[{id:'cover'}]}}}).sections[0].layoutId,'cover');
assert.equal(validate({sections:[{title:'Legacy',minutes:20}]},task).pageBased,undefined,'history retains old section schema');
console.log('PASS: exact per-page outline, page contents, total duration, confirmed template layout validation and legacy preservation');
