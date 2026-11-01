'use strict';
// Deliberately isolated fake data for UI review. Never points at the real data directory.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inclass-workflow-ui-'));
const write=(name,value)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value));
write('courses',[{id:'ui-course',name:'流程检查（虚构课程）',term:'2026秋',recentQuestions:[]}]);
write('students',[{id:'ui-001',name:'示例甲',courseId:'ui-course'},{id:'ui-002',name:'示例乙',courseId:'ui-course'}]);
write('settings',{windowMs:90000,workbuddy:{enabled:false}});
write('sessions',[]);
write('homework',[{id:'ui-hw',name:'步骤导航示例作业',courseId:'ui-course',type:'files',status:'draft',max:100,scores:{},batchId:'ui-batch',createdAt:Date.now()}]);
write('gradebatches',[{id:'ui-batch',name:'步骤导航示例作业',courseId:'ui-course',hwId:'ui-hw',status:'collect',questions:[{text:'示例题目',points:100,rubric:'示例评分标准'}],files:[],results:{},createdAt:Date.now()}]);
process.env.DATA_DIR=dir;process.env.HOST='127.0.0.1';process.env.PORT='3012';
console.log('Isolated UI fixture:',dir);
require('../server/server.js');
