from pathlib import Path
from copy import deepcopy
import hashlib, json, shutil
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(r'E:\MyProjects\Inclass')
WORK=Path(__file__).parent
MANUAL=WORK.parent.parent
REFERENCE=MANUAL/'工作文件/参考模板/排版参考.docx'
OUTPUT=MANUAL/'Word文档/第五章 教案制作.docx'
QA=WORK/'排版检查'
ASSETS=WORK/'图片'


figures=[]
def figure(source,crop,name,boxes,centres=None):
    original=ROOT/source
    shutil.copy2(original,WORK/'原始截图'/original.name)
    im=Image.open(original).convert('RGB').crop(crop)
    pad=36
    canvas=Image.new('RGB',(im.width+pad*2,im.height+pad*2),'white')
    canvas.paste(im,(pad,pad))
    draw=ImageDraw.Draw(canvas)
    label_font=ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf',20)
    for n,(x1,y1,x2,y2) in enumerate(boxes,1):
        box=(x1-crop[0]+pad,y1-crop[1]+pad,x2-crop[0]+pad,y2-crop[1]+pad)
        draw.rectangle(box,outline='#d5252c',width=3)
        cx,cy=(box[0]-15,box[1]-15) if centres is None else (centres[n-1][0]-crop[0]+pad,centres[n-1][1]-crop[1]+pad)
        draw.ellipse((cx-13,cy-13,cx+13,cy+13),fill='#d5252c')
        draw.text((cx,cy-1),str(n),font=label_font,fill='white',anchor='mm')
    target=ASSETS/('第五章-'+name+'.png')
    canvas.save(target)
    figures.append({'source':source,'source_sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'crop':crop,'output':target.name,'boxes':boxes})
    return target

LIST=figure('docs/lesson-plan/detail-review/library-card-refresh.png',
    (230,14,1265,431),'图1-教案列表',[(1171,28,1262,73),(448,360,545,391)])
BASIC=figure('docs/lesson-plan/detail-review/teacher-basic-requirements.png',
    (243,381,1235,688),'图2-填写要求',[(250,388,728,458),(746,483,1225,554)],[(236,383),(734,476)])
PROGRESS=figure('docs/lesson-plan/progress-review/live-progress.png',
    (248,150,1223,404),'图3-生成进度',[(600,162,883,222),(278,256,755,397)])
STOP=figure('docs/lesson-plan/progress-review/live-progress.png',
    (674,573,805,630),'图4-停止生成',[(681,579,795,622)])
READ=figure('docs/lesson-plan/detail-review/process-heading.png',
    (233,86,1243,606),'图5-按章阅读',[(242,381,444,434),(508,105,1213,441)],[(227,376),(492,91)])
EDIT=figure('docs/lesson-plan/detail-review/floating-section-actions.png',
    (505,357,1263,705),'图6-保存本节',[(530,441,1189,544),(1210,596,1258,646),(1210,650,1258,701)],[(516,427),(1196,584),(1196,665)])
PENDING=figure('docs/lesson-plan/detail-review/pending-fields.png',
    (676,475,1216,628),'图7-补充核对内容',[(940,591,1038,623)])
TIME=figure('docs/lesson-plan/detail-review/process-heading.png',
    (508,103,1216,442),'图8-教学环节与课时',[(532,207,834,271),(1127,206,1193,241)],[(519,193),(1114,192)])
TABLE=figure('docs/lesson-plan/detail-review/board-row-menu.png',
    (494,100,1224,448),'图9-调整表格',[(533,110,1211,133),(510,201,534,375),(511,382,845,432)],[(519,96),(493,218),(497,396)])
REFLECTION=figure('docs/lesson-plan/detail-review/reflection-grid-menu.png',
    (508,174,1218,471),'图10-课后反思',[(986,203,1209,468)])
VERSION=figure('docs/lesson-plan/detail-review/version-name-dialog.png',
    (516,231,977,489),'图11-保存版本',[(539,356,954,407),(862,422,952,466)],[(524,343),(849,422)])
DOWNLOAD=figure('docs/lesson-plan/detail-review/chapter-save-and-version.png',
    (235,293,1244,449),'图12-下载与历史',[(1114,320,1227,365),(315,388,580,434)],[(1100,306),(300,378)])
doc=Document(REFERENCE)
body=doc._element.body
sect=deepcopy(body.find(qn('w:sectPr')))
for child in list(body): body.remove(child)
body.append(sect)
section=doc.sections[0]
section.page_width=Cm(21);section.page_height=Cm(29.7)
section.top_margin=section.bottom_margin=Cm(2.54)
section.left_margin=section.right_margin=Cm(3.175)
section.header_distance=Cm(1.5);section.footer_distance=Cm(1.75)

def font(run,name='仿宋',size=12,bold=False):
    run.font.name=name;run.font.size=Pt(size);run.font.bold=bold
    run.font.color.rgb=RGBColor(0,0,0)
    rf=run._element.get_or_add_rPr().get_or_add_rFonts()
    for k in ['ascii','hAnsi','eastAsia','cs']: rf.set(qn('w:'+k),name)
    for k in ['asciiTheme','hAnsiTheme','eastAsiaTheme','cstheme']: rf.attrib.pop(qn('w:'+k),None)

normal=doc.styles['Normal']
if 'Title' not in doc.styles:
    title_style=doc.styles.add_style('Title',WD_STYLE_TYPE.PARAGRAPH)
    title_style.base_style=normal
normal.font.name='仿宋';normal.font.size=Pt(12);normal.font.color.rgb=RGBColor(0,0,0)
pf=normal.paragraph_format
pf.line_spacing=1.5;pf.space_before=Pt(0);pf.space_after=Pt(0)
pf.first_line_indent=Pt(0);pf.widow_control=True
for style,size in [('Heading 1',16),('Heading 2',15),('Heading 3',12),('Title',16)]:
    s=doc.styles[style]
    s.font.name='黑体';s.font.size=Pt(size);s.font.bold=False;s.font.color.rgb=RGBColor(0,0,0)
    pf=s.paragraph_format
    pf.keep_with_next=True;pf.keep_together=True;pf.line_spacing=1.5
    pf.space_before=Pt(13 if style!='Heading 3' else 7)
    pf.space_after=Pt(10 if style!='Heading 3' else 4)

entries=[]
sources=[]
def h(text,level=2,page=False):
    p=doc.add_paragraph(style='Title' if level==1 else f'Heading {level}')
    p.paragraph_format.page_break_before=page
    if level==1:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    font(p.add_run(text),'黑体',{1:16,2:15,3:12}[level])
    index=len(entries)+1;name=f'plan_manual_{index}'
    start=OxmlElement('w:bookmarkStart');start.set(qn('w:id'),str(index));start.set(qn('w:name'),name)
    end=OxmlElement('w:bookmarkEnd');end.set(qn('w:id'),str(index))
    p._p.insert(0,start);p._p.append(end)
    entries.append((text,level,name));sources.append('#'*level+' '+text)
    return p
def p(text,keep=False):
    q=doc.add_paragraph();q.paragraph_format.keep_with_next=keep
    font(q.add_run(text));sources.append(text);return q
def pic(path,caption,width=14.63):
    q=doc.add_paragraph();q.alignment=WD_ALIGN_PARAGRAPH.CENTER
    q.paragraph_format.line_spacing=1;q.paragraph_format.space_before=Pt(6)
    q.paragraph_format.keep_with_next=True
    q.add_run().add_picture(str(path),width=Cm(width))._inline.docPr.set('descr',caption)
    q=doc.add_paragraph();q.alignment=WD_ALIGN_PARAGRAPH.CENTER
    q.paragraph_format.space_after=Pt(8);q.paragraph_format.keep_with_next=False
    font(q.add_run(caption));sources.append(caption)


directory=doc.add_paragraph()
directory.alignment=WD_ALIGN_PARAGRAPH.CENTER
directory.paragraph_format.space_before=Pt(13);directory.paragraph_format.space_after=Pt(24)
font(directory.add_run('目录'),'黑体',16)

h('第五章 教案制作',1,True)
p('本章介绍如何在“一堂课”中填写教学要求、选择模板、生成和编辑教案，以及保存、下载与恢复Word版本。用于课堂前，应核对内容与课时。')
h('5.1 概述')
p('在左侧导航中点击“教案制作”，进入本机教案列表。卡片显示名称、状态、总课时、历史版本数量和更新时间，可新建教案或继续已有任务。',True)
pic(LIST,'图1. 教案列表与新建入口')
p('图中①为“新建教案”；②为已有教案的“查看与编辑”入口。生成中的任务显示“查看进展”，草稿、失败或已停止任务可点击“继续制作”。')
p('制作流程为“填写要求—选择模板—生成教案—编辑与下载”。点击“教案列表”返回列表，使用内容底部左侧的“上一步”返回前一步；有未保存输入时，按提示处理。')
p('“保存本节”保存章节编辑稿；页面上方的“保存版本”生成整份新版Word。仅保存章节后，下载入口仍指向旧Word，定稿时需完成版本保存。')
p('要求、资料和教案历史保存在本机。生成时，材料会交给已连接的WorkBuddy处理并使用模型额度，请勿上传学生隐私资料。直接编辑和保存Word版本不重新调用模型。')

h('5.2 填写教案要求',page=True)
p('第1步：点击“新建教案”，填写“课程基本信息”。带星号的“课程名称”“章节与主题”“授课对象”“本次总课时（分钟）”“教材与范围”“授课教师”和“授课地点”均需填写。浅灰色文字是填写示例，应自行输入实际内容。',True)
pic(BASIC,'图2. 课程基本信息填写区域局部')
p('图中①填写课程名称；②填写5—240之间的整数分钟数，例如两节各45分钟填90。授课对象建议包含年级、专业和已有基础；没有指定教材时，填写“无指定教材”。')
p('第2步：按需选择“关联课程”，填写“课型”和“衔接内容”。关联课程不能代替课程名称填写；衔接内容会与课时一起显示在Word标题下方。')
p('第3步：在“教学内容”中填写知识范围、重难点、活动或讲稿，也可上传资料，两者至少提供一种。“补充要求”可填写教学方法、实践条件和篇幅偏好。')
p('第4步：在“参考资料”区域点击或拖入文件。支持DOCX、PPTX、PDF、TXT、MD、PNG、JPG和JPEG；文件不能为空，每份不超过20MB，每个任务最多12份。上传后检查文件列表，移除误传文件；点击文件可查看或下载。')
p('Word和PPTX会提取文字供模型阅读，原文件的图片与版式不作复刻。扫描PDF和图片依赖模型识别，生成后应核对文字、公式、图表和数据。')
p('第5步：暂未填完可点击“保存草稿”，稍后继续；填写完成后点击“保存并选择模板”。有校验提示时，补齐相应内容后再继续。')

h('5.3 选择教案模板',page=True)
p('在“选择教学设计模板”页面，从“本机模板库”选择本次模板，查看下方的章节和表格结构摘要。默认内置“通用九章教学设计（按提供模板整理）”，适合直接开始制作。')
p('内置模板依次包含课程基本信息、教学目标、教学重点与难点、学情分析、教学准备、教学过程、板书设计、作业与思考题、教学反思（课后填写）。最后一章的实际记录留待授课后填写。')
p('第1步：使用自有模板时，展开“上传其他教案模板”，点击或拖入一份非空DOCX文件，大小不超过20MB。上传的模板会保存在本机模板库，后续教案可再次选择。')
p('第2步：检查原模板。章节应使用“一、章节名”这样的标题，或Word的一级标题样式；模板中须有一张教学过程表，包含“时间”或“时长”列。暂不支持合并单元格和嵌套表格，应先在Word中整理后上传。')
p('第3步：上传失败时，按页面提示检查文件格式、章节识别、教学过程表和表格结构，修正后重新上传。自有模板可点击“下载原模板”核对原文件；内置模板不提供原文件下载入口。')
p('平台保留可识别的章节、普通表格和教师填写区域，并重新排版。原版图片、页眉页脚和全部视觉细节不会原样复刻，下载成品后仍需在Word中检查。')
p('第4步：确认当前选中的模板后，点击“使用此模板，准备生成”。上传后自动选中模板，并不等于已开始生成教案。')
p('若已有教案，返回修改要求、参考资料或模板后，原历史Word仍可查看和下载，但属于旧要求。应按当前要求重新生成，再继续编辑和保存新版，避免把旧内容误当作新成品。')

h('5.4 生成教案',page=True)
h('5.4.1 开始生成与查看进展',3)
p('第1步：核对要求，点击“开始生成教案”；已有版本点击“按当前要求重新生成”。连接未就绪时，先点击“连接WorkBuddy”。')
p('第2步：生成中查看进展，等待文件生成并检查完成。',True)
pic(PROGRESS,'图3. 查看教案生成进展局部')
p('图中①为用时与状态，②为活动与记录；每轮最长两小时。')
p('第3步：可返回列表，稍后点击“查看进展”。保持本机和服务运行；完成后进入“编辑与下载”，按5.5节核对。')
h('5.4.2 停止生成与失败重试',3)
p('点击图中①“停止本轮生成”，弹窗选择“确认停止生成”结束，或选择“继续生成”保留任务。',True)
pic(STOP,'图4. 停止本轮生成入口局部',3.5)
p('停止后保留要求、资料及历史版本；未交付内容不收录，重新生成会再次使用模型额度。')
p('失败后按错误提示处理，再点击生成按钮重试，或“查看已有版本”。服务重启导致的中断需重新生成，历史版本保留。')

h('5.5 查看与编辑教案',page=True)
h('5.5.1 按目录查看章节',3)
p('生成完成后，默认进入最新版的阅读状态。点击左侧“教案目录”切换章节，右侧集中显示所选章节。屏幕较窄时，可使用“当前章节”下拉框切换。',True)
pic(READ,'图5. 通过教案目录逐章阅读')
p('图中①为当前选中的章节；②为该章正文。内置模板的教学过程按环节展示，便于分别检查主要内容、教师活动、学生活动和设计意图。')
p('应依次核对课程基本信息、目标与重难点、学情依据、教学准备、课堂活动、作业和反思安排。重点检查教材范围、知识表述、公式、数据和例题，以及活动是否适合本班基础和实际设备条件。')
p('目录旁红色数字表示该章尚有待补充或待核对事项，处理方法见5.5.3节。阅读历史版本时，页面显示“历史版本只读”；需要继续修改，应切回当前编辑稿或按5.6.2节恢复。')

h('5.5.2 编辑与保存本节',3,True)
p('第1步：选中需要修改的章节，点击章节右侧悬浮的“编辑本节”图标。鼠标停留在图标上可查看操作名称，进入编辑后直接修改对应输入框。',True)
pic(EDIT,'图6. 章节编辑区与悬浮操作按钮局部')
p('图中①为本节可编辑内容；②为勾号“保存本节”；③为叉号按钮，未修改时表示“取消编辑”，有未保存修改时表示“放弃修改”。')
p('第2步：完成本节修改后，点击“保存本节”。该操作只保存当前章节编辑稿，不新增历史Word版本。可以依次修改多章，每章保存后再切换；已保存的编辑稿可在重新进入任务后继续使用。')
p('第3步：不保留本节尚未保存的改动时，点击“放弃修改”，按提示返回此前内容。已保存的其他章节不受影响。切换章节、返回或离开页面出现未保存提示时，应先判断是否需要保存当前输入。')
p('第4步：全部章节确认后，再按5.6.1节点击“保存版本”，生成整份新版Word。若提示教案已在其他页面更新，应先保留当前输入，再重新载入最新内容，避免直接刷新丢失修改。')

h('5.5.3 补充与核对标记内容',3)
p('当资料不足或需要教师确认时，正文会出现红色待办标记，例如“【待教师补充：具体事项】”“【待教师核对：具体事项】”；已有教案也可能显示“待教师填写”等字样。',True)
pic(PENDING,'图7. 正文中需要教师补充的内容局部',12)
p('图中①提示班级人数、年级与真实学情尚未提供。应依据实际情况填写，不能把占位文字直接作为已核实的信息用于课堂。')
p('第1步：根据目录红色数字，逐章查找标记。核实班级基础、教材版本、设备、资源和评价要求，确认模型给出的学情假设是否成立。')
p('第2步：进入本节编辑，将标记替换为真实内容，删除已完成的占位说明，点击“保存本节”，再检查剩余标记。处理完毕后保存完整版本，核对下载的Word中是否还有遗漏。')

h('5.5.4 调整教学过程与课时',3,True)
p('教学过程包含“环节、时间、主要内容、教师活动、学生活动、设计意图”。阅读状态下，每个环节以卡片呈现，标题旁显示该环节时长。',True)
pic(TIME,'图8. 教学环节名称与时长局部')
p('图中①为教学环节名称；②为该环节安排的分钟数。核对时既要看时间，也要看该时段能否完成相应内容、练习和反馈。')
p('第1步：进入“教学过程”编辑，修改相应环节、时间和活动内容。时间应为正数，可按输入要求填写“8”“8分钟”等形式；各环节时长合计应等于制作要求中的本次总课时。')
p('第2步：增加练习、讨论或调整讲授内容时，同时重新分配时间。例如总课时90分钟，所有课堂环节合计应为90分钟。课前设备检查等准备事项，应按实际发生时间安排，避免重复计入课堂。')
p('第3步：点击“保存本节”可先暂存尚未配平的编辑稿；点击“保存版本”时，平台会检查各环节时间是否为正数、总时长是否匹配。不通过时，回到本节修正、保存，再生成Word。')
p('第4步：复核各环节活动与教学目标、作业和评价方式是否一致。只改总课时而未调整活动，或只改变时间数字而未检查教学容量，都可能造成实际授课安排不合理。')

h('5.5.5 调整表格行列',3,True)
p('进入本节编辑后，支持调整的表格会显示行列操作柄。点击左侧行柄打开行菜单；点击顶部列柄打开列菜单。',True)
pic(TABLE,'图9. 板书设计表格的行列操作局部')
p('图中①为顶部列操作柄；②为当前行的操作柄；③为行菜单，可选择“上方插入行”“下方插入行”或“删除此行”。')
p('第1步：在目标行或列的操作柄打开菜单，选择插入位置，填写新增单元格。列菜单可选择“左侧插入列”“右侧插入列”“删除此列”。点击外部区域或按Esc可关闭菜单。')
p('第2步：删除含有内容的行列时，先核对位置和内容，再在确认窗口点击“确认删除”；保留时点击“取消删除”。尚未保存的误操作，可通过本节的“放弃修改”恢复。')
p('第3步：调整完成后点击“保存本节”，检查内容顺序、表头含义和教学过程总时长，最后保存完整版本。')
p('并非所有表格均可任意改动。课程基本信息采用固定项目；固定结构的列会限制操作。板书设计支持增减行列及修改表头，最多60行、10列，且至少保留一行一列；其他表格以实际出现的菜单为准。')

h('5.5.6 课后填写教学反思',3)
p('内置模板的“教学反思（课后填写）”区分“观察点”“预设风险与改进线索”和“实际记录”。生成时，“实际记录”留空，供教师课后填写真实课堂表现。',True)
pic(REFLECTION,'图10. 教学反思的实际记录区域局部')
p('图中①为待课后填写的“实际记录”列。旁边的预设风险用于课前准备，不能代替已发生的课堂事实。')
p('授课后进入本节编辑，记录实际用时、学生典型困难、目标达成证据和下一次改进方向。可按需增添观察行；填写后点击“保存本节”，再保存一个便于识别的版本，例如“课后反思版”。')

h('5.6 保存与使用Word版本',page=True)
h('5.6.1 保存并命名完整版本',3)
p('第1步：完成各章核对，确认本节已保存，再点击页面上方的“保存版本”。当前章节仍有未保存改动时，按窗口提示先保存本节，再保存完整版本。',True)
pic(VERSION,'图11. 为整份Word版本命名',11)
p('图中①填写“版本名称”；②点击“保存版本”生成整份新版Word。名称必填，长度为1—80个字符，可使用“试讲版”“教研组定稿”等易于识别的名称；点击“取消”可返回继续编辑。')
p('第2步：等待保存完成，确认页面中的版本号和名称已更新。保存版本会检查教案结构和教学过程课时，并根据已保存的章节稿生成整份Word；未发生内容或排版变化时，按钮不可用，不会重复生成相同版本。')
p('第3步：如保存失败，按提示修正时间或内容后重试。章节编辑稿会保留，先检查原因即可，无需仅因Word生成失败就重新调用模型制作全部教案。')
p('“保存本节”成功后，页面可能仍显示“下载Word v2”等旧版本入口，直到完整版本保存成功才更新。需要带走最新修改时，应先确认新版已生成，再下载。')

h('5.6.2 下载与恢复历史版本',3,True)
p('第1步：点击页面上方“下载Word vN”，其中N为当前所查看版本号。文件名会包含教案标题、版本名称和版本号，下载后检查是否为本次需要的版本。',True)
pic(DOWNLOAD,'图12. Word下载与历史版本入口局部')
p('图中①下载所查看版本的Word；②在“历史版本”中选择当前编辑稿或某一历史版本。截图为示例，实际名称与版本号以当前任务为准。')
p('第2步：用Word打开文件，检查标题、正文、表格跨页、课时和待补充标记，确认没有文字截断、内容遗漏或错用旧版，再用于备课、打印或分享。直接在本机Word中修改的内容，不会自动同步回平台章节编辑稿。')
p('第3步：需要查看旧稿时，在“历史版本”下拉框选择目标版本。历史稿只读，可逐章查看并下载该版原文件；切回“当前编辑稿”或“最新版本”可继续当前工作。')
p('第4步：需要以旧稿继续编辑时，先将有保留价值的当前编辑稿保存为完整版本，再选择目标历史稿。该历史稿与当前教学要求一致时，可点击“恢复为新版本”。恢复会以旧稿内容追加一个新版本，原历史版本仍保留，当前编辑稿会随之更新。')
p('第5步：恢复完成后，检查新版本号和内容，再继续编辑。教学要求或模板已经变更时，旧稿不能直接恢复到当前要求，可先下载留存、参考其中内容，再按新要求生成教案。')
# Populate directory with real PAGEREF fields, refreshed through Word during QA.
def field(paragraph,instruction):
    for tag,value in [('begin',None),(None,instruction),('separate',None),(None,'2'),('end',None)]:
        run=OxmlElement('w:r')
        if tag:
            elem=OxmlElement('w:fldChar');elem.set(qn('w:fldCharType'),tag)
        elif value==instruction:
            elem=OxmlElement('w:instrText');elem.set(qn('xml:space'),'preserve');elem.text=value
        else:
            elem=OxmlElement('w:t');elem.text=value
        run.append(elem);paragraph._p.append(run)

anchor=directory
for text,level,bookmark in entries:
    q=doc.add_paragraph()
    q.paragraph_format.left_indent=Cm((level-1)*.45)
    q.paragraph_format.space_after=Pt(3)
    q.paragraph_format.tab_stops.add_tab_stop(Cm(14.63),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
    font(q.add_run(text+'\t'))
    field(q,f' PAGEREF {bookmark} \\h ')
    anchor._p.addnext(q._p);anchor=q


properties=doc.core_properties
properties.title='第五章 教案制作';properties.subject='一堂课操作手册'
properties.author='';properties.last_modified_by='';properties.comments='';properties.keywords='教案制作,操作手册'
settings=doc.settings._element
update=settings.find(qn('w:updateFields'))
if update is None:update=OxmlElement('w:updateFields');settings.append(update)
update.set(qn('w:val'),'true')
used=set(doc._element.xpath('//@r:embed | //@r:id | //@r:link'))
for rid,rel in list(doc.part.rels.items()):
    if rel.reltype.endswith(('/image','/hyperlink')) and rid not in used:doc.part.drop_rel(rid)
doc.save(OUTPUT)
(WORK/'正文.txt').write_text('\n\n'.join(sources),encoding='utf-8')
manifest={'output':str(OUTPUT),'reference':str(REFERENCE),'reference_sha256':hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),'figures':figures,'headings':entries,'sources':['README.md','server/lesson-plan/public/plan.html','server/lesson-plan/public/plan.js','server/lesson-plan/service.js','server/lesson-plan/routes.js','server/lesson-plan/document.js'],'verification':'Current formal implementation reviewed. Matching crops from genuine retained screenshots only. Obsolete controls excluded. No model calls or teaching data writes. Browser capture unavailable in Work settings.'}
(QA/'内容与配图依据.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
check=Document(OUTPUT)
assert len(check.inline_shapes)==12 and len(check.sections)==1
assert len(check._element.xpath('//w:instrText'))==len(entries)
current=None;coverage={}
for para in check.paragraphs:
    if para.style.name.startswith('Heading'):
        current=para.text if para.style.name=='Heading 3' else None
        if current:coverage[current]=0
    if current:coverage[current]+=len(para._p.xpath('.//w:drawing'))
assert len(coverage)==10 and all(coverage.values()),coverage
print(OUTPUT)
print(json.dumps({'figures':len(check.inline_shapes),'heading_3_coverage':coverage,'characters':sum(len(q.text) for q in check.paragraphs)},ensure_ascii=False))
