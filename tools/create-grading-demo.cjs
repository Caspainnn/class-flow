'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const ExcelJS = require('../server/node_modules/exceljs');
const rubric = require('../server/lib/rubric');
const root = path.resolve(__dirname,'../docs/自动批改测试包');
const questions = [
  {text:'求 f(x)=x³−3x 的导函数，并计算 f′(2)。请写出导函数、代入过程和最终结果。',points:30,rubric:'三个独立得分点，每项10分：①导函数 f′(x)=3x²−3；②代入 x=2 的过程 3×2²−3（或12−3）；③最终结果 f′(2)=9。仅按明确写出的内容给分，不推断未写出的步骤；未作答或对应内容错误得0分。'},
  {text:'计算定积分 ∫₀¹(2x+1)dx，写出原函数、上下限代入过程和结果。',points:30,rubric:'三个独立得分点，每项10分：①原函数 x²+x；②上下限代入过程 (1²+1)−(0²+0) 或 [x²+x]₀¹；③最终结果2。仅按明确写出的内容给分，不推断未写出的步骤；未作答或对应内容错误得0分。'},
  {text:'求 g(x)=x²−4x+3 的极值，写出导函数、驻点、二阶导数及极值结论。',points:40,rubric:'四个独立得分点，每项10分：①g′(x)=2x−4；②令g′(x)=0，得到驻点x=2；③g″(x)=2>0，判定为极小值；④在x=2取得极小值g(2)=−1（必须明确为极小值，极大值结论不给此项分）。仅按明确写出的内容给分；未作答或对应内容错误得0分。'}
];
const students = [
  ['2026900001','陈一禾',[30,30,40],['f′(x)=3x²−3。代入x=2：3×2²−3=12−3=9，所以f′(2)=9。','原函数为x²+x。定积分=(1²+1)−(0²+0)=2。','g′(x)=2x−4。令2x−4=0，得x=2。g″(x)=2>0，因此为极小值；g(2)=4−8+3=−1，即在x=2取得极小值−1。']],
  ['2026900002','林知远',[30,30,20],['f′(x)=3x²−3。f′(2)=3×2²−3=12−3=9。','原函数为x²+x。代入上下限：(1²+1)−(0²+0)=2。','g′(x)=2x−4。令2x−4=0，得x=2。g″(x)=−2<0，因此在x=2取得极大值−1。']],
  ['2026900003','周映川',[30,30,0],['f′(x)=3x²−3。代入x=2，有3×2²−3=12−3=9。','原函数x²+x；(1²+1)−(0²+0)=2。','未作答。']],
  ['2026900004','许清和',[30,0,0],['f′(x)=3x²−3。代入x=2：3×2²−3=12−3=9。','未作答。','未作答。']],
  ['2026900005','沈星野',[0,0,0],['f′(x)=3x−3。代入x=2：3×2−3，结果为3。','原函数为2x²+x。代入上下限：(2×1²+1)−(2×0²+0)=3。','g′(x)=x−4。令x−4=0，得x=4。g″(x)=−1，所以在x=4取得极大值3。']]
];
(async()=>{
  await fs.mkdir(path.join(root,'03-学生作业'),{recursive:true});
  const roster=new ExcelJS.Workbook(),ws=roster.addWorksheet('学生名单');
  ws.columns=[{header:'学号',key:'id',width:20},{header:'姓名',key:'name',width:16}];
  for(const [id,name] of students)ws.addRow({id,name});
  ws.getColumn(1).numFmt='@';ws.getRow(1).font={bold:true};
  await roster.xlsx.writeFile(path.join(root,'01-测试名单.xlsx'));
  const bytes=await rubric.template(ExcelJS,questions);
  await fs.writeFile(path.join(root,'02-评分标准.xlsx'),bytes);
  for(const [id,name,,responses] of students){
    const body=`# 微积分基础测试作业\n\n学号：${id}\n姓名：${name}\n\n`+questions.map((q,i)=>`## 第${i+1}题\n\n题目：${q.text}\n\n作答：${responses[i]}\n`).join('\n');
    await fs.writeFile(path.join(root,'03-学生作业',`${id}${name}.md`),body,'utf8');
  }
  const expected='学号,姓名,第1题,第2题,第3题,总分\n'+students.map(([id,name,scores])=>[id,name,...scores,scores.reduce((a,b)=>a+b,0)].join(',')).join('\n')+'\n';
  await fs.writeFile(path.join(root,'04-教师核对答案.csv'),'\uFEFF'+expected,'utf8');
  const parsed=await rubric.parse(ExcelJS,bytes,100);
  if(parsed.length!==3 || students.length!==5)throw Error('Invalid fixture');
  const files=await fs.readdir(path.join(root,'03-学生作业'));
  if(files.length!==5)throw Error('Expected exactly five submissions');
  console.log('Created and checked:',root,'\n5 submissions; rubric 3 questions / 100 points; expected totals 100,80,60,30,0.');
})().catch(e=>{console.error(e);process.exitCode=1});
