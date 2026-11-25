'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createService}=require('../server/ppt/service');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-ppt-optional-minutes-'));
try{
 const service=createService({root,getSettings:()=>({}),getCourses:()=>[]});
 const task=service.create({title:'未指定课时测试',audience:'教师',minutes:null,content:'课程内容'});
 assert.equal(task.minutes,null);
 const outline={pageBased:true,pages:[
  {title:'封面',minutes:3,description:'课程主题'},
  {title:'核心内容',minutes:null,description:'关键知识点'}
 ]};
 const saved=service.outline(task.id,outline);
 assert.equal(saved.status,'outline');
 assert.deepEqual(saved.outline.sections.map(s=>s.minutes),[null,null]);
 const fixed=service.create({title:'指定课时测试',audience:'教师',minutes:10,content:'课程内容'});
 assert.throws(()=>service.outline(fixed.id,{pageBased:true,pages:[
  {title:'封面',minutes:4,description:'课程主题'},
  {title:'内容',minutes:5,description:'关键知识点'}
 ]}),/时间之和应等于课时/);
 const balanced=service.outline(fixed.id,{pageBased:true,pages:[
  {title:'封面',minutes:4,description:'课程主题'},
  {title:'内容',minutes:6,description:'关键知识点'}
 ]});
 assert.equal(balanced.status,'outline');
 const js=fs.readFileSync(path.join(__dirname,'../server/ppt/public/ppt.js'),'utf8');
 assert.match(js,/选填，留空则不分配逐页时间/);
 assert.match(js,/minutesValue===''\?null:Number\(minutesValue\)/);
 console.log('PASS: empty course minutes skip page-time validation; specified minutes still require an exact total');
}finally{fs.rmSync(root,{recursive:true,force:true});}
