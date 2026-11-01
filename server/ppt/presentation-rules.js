'use strict';
const coverRules=`第1页必须是简洁封面，只展示本课标题、可选的一句短副标题、已填写的授课人姓名及授课日期；未填写的姓名/日期省略，绝不能沿用模板的老师姓名和日期，也不能编造。不展示学习目标、知识点列表、目录、授课对象、课时时长或正文说明。学习目标留在大纲的objective供教师审阅，确需对学生展示时放到后续内容页，不为此额外增加总页数。任何投影片都不得印“本页N分钟”、建议用时、总课时、制作状态、教师提示等教学管理信息；时长仅用于大纲规划和教师讲稿，投影片页脚仅可保留简短课程名和页码。`;
function filename(title){let name=String(title||'课件').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').slice(0,100)||'课件';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='课件-'+name;return name+'.pptx';}
function identity(task){return `授课人：${task.presenter||'未填写，封面省略'}\n授课日期：${task.lessonDate||'未填写，封面省略'}`;}
module.exports={coverRules,filename,identity};
