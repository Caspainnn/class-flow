from pathlib import Path
from copy import deepcopy
import hashlib, json
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
OUTPUT=MANUAL/'Word文档/第六章 签到管理.docx'
QA=WORK/'排版检查';ASSETS=WORK/'图片'
for directory_path in [QA,ASSETS,OUTPUT.parent]:directory_path.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest()=='cd9cdcbe6070fd845319183250c1fe2fc1bb1c35a029aa42ffc7fd7e4d3cc7a7'

capture=json.loads((WORK/'截图坐标.json').read_text(encoding='utf-8'))
figures=[];images={}
# Use the previously approved chapter's paragraph, heading and picture patterns.
legacy=(WORK.parent/'第五章/生成第五章.py').read_text(encoding='utf-8')
exec(legacy[legacy.index('doc=Document(REFERENCE)'):legacy.index("h('第五章 教案制作'")])

# Crop only genuine screenshots. Rectangles are in the original image coordinates.
crops={'01-选课':(0,0,888,346),'03-多选':(0,50,848,355)}
for item in capture['items']:
    name=item['name'];original=WORK/'原始截图'/(name+'.png')
    im=Image.open(original).convert('RGB')
    crop=crops.get(name,(0,0,im.width,im.height));im=im.crop(crop)
    # Pixelate identifiers inside controls while retaining their borders and labels.
    for rect in item['redact']:
        x1,y1,x2,y2=rect
        if name in ['01-选课','02-单选','03-多选','17-导出']:
            x1+=10;x2-=28;y1+=9;y2-=9
        elif name=='07-提交' and y1>100:
            x1+=10;x2-=10;y1+=11;y2-=11
        r=(max(0,round(x1-crop[0])),max(0,round(y1-crop[1])),min(im.width,round(x2-crop[0])),min(im.height,round(y2-crop[1])))
        if r[2]>r[0] and r[3]>r[1]:
            part=im.crop(r);part=part.resize((max(1,part.width//14),max(1,part.height//10))).resize(part.size,Image.Resampling.NEAREST);im.paste(part,r)
    pad=40;canvas=Image.new('RGB',(im.width+pad*2,im.height+pad*2),'white');canvas.paste(im,(pad,pad))
    draw=ImageDraw.Draw(canvas);number_font=ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf',19)
    boxes=[]
    for number,rect in enumerate(item['boxes'],1):
        x1,y1,x2,y2=rect
        if y2<=crop[1] or y1>=crop[3]:continue
        x1-=3;y1-=3;x2+=3;y2+=3
        box=(round(x1-crop[0]+pad),round(y1-crop[1]+pad),round(x2-crop[0]+pad),round(y2-crop[1]+pad))
        draw.rectangle(box,outline='#d5252c',width=3)
        cx,cy=box[0]-15,box[1]-15
        # Keep a badge outside the screenshot when the adjacent row contains text.
        if name in ['07-提交','08-成功','09-取消','10-实时','11-归档','13-总览']:cx=box[0]-16;cy=box[1]+1
        if name=='10-实时' and number in [2,3,4]:cx=box[0]-9;cy=box[1]-17
        draw.ellipse((cx-12,cy-12,cx+12,cy+12),fill='#d5252c')
        draw.text((cx,cy-1),str(number),font=number_font,fill='white',anchor='mm')
        boxes.append([x1,y1,x2,y2])
    target=ASSETS/('第六章-'+name+'-图例.png');canvas.save(target);images[name[:2]]=target
    figures.append({'source':str(original),'sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'image':str(target),'crop':crop,'boxes':boxes,'redact':item['redact']})

figure_no=0
def fig(key,caption,width=14.63):
    global figure_no
    figure_no+=1;pic(images[key],f'图{figure_no}. {caption}',width)

h('第六章 签到管理',1,True)
p('本章介绍教师发起随堂题目、组织学生扫码或输入课堂码签到、查看到课情况，以及结束归档、查询和导出签到记录的方法。学生完成答题并提交成功后才计入签到，扫码打开页面本身不代表已签到。')
h('6.1 使用前准备')
p('第1步：在“课程管理”中建立课程并导入学生名单，核对学号、姓名和人数。没有名单的课程不能开始签到；学生填写的身份必须与本课程名单相符。')
p('第2步：保持教师电脑和平台服务运行，确认学生手机能访问教师电脑的课堂服务地址。教师电脑上的127.0.0.1仅供本机访问，不能直接作为学生手机的访问地址。应先用课堂实际网络验证可达性。')
p('第3步：在左侧导航点击“签到管理”，进入“发起签到”。按图中①选择本次课程；②切换到“签到记录”可查看历史数据。',True)
fig('01','签到管理入口与课程选择')
p('操作流程为“选题—扫码签到—结束归档”。同一平台同时只能进行一次签到；如已有进行中的签到，应先检查并处理。截图中的课程及学生信息已脱敏，示例人数和统计值用于说明操作。')

h('6.2 发起签到',page=True)
h('6.2.1 编写单选题',3)
p('第1步：核对课程和名单人数，在图中①“题型”选择“单选题”；在③“题目”输入题干，填写至少两个非空选项。建议按A、B、C、D顺序连续填写，减少空项引起的字母变化。',True)
fig('02','单选题填写与开始入口')
p('第2步：在②“正确答案”选择一个已填写的选项。④为A选项输入框，其他选项按同样方式填写。答案选择与题干、选项内容应一致。')
p('第3步：核对后点击⑤“开始签到”。出现题目未填、选项不足或正确答案未对应已填写选项等提示时，按提示修正后再次开始。系统不提供完全空白的纯扫码签到，至少仍需题干及两个选项。')

h('6.2.2 编写多选题',3,True)
p('第1步：在①“题型”选择“多选题”，填写题目与选项。②“正确答案”变为可勾选多个答案的复选框，至少设置两个正确答案。',True)
fig('03','多选题与正确答案设置')
p('第2步：检查所有勾选项均有内容，再点击“开始签到”。示例正确答案为A、C；学生需选择与正确答案完全一致的组合才算答对，漏选、错选均不算答对，但提交成功仍计入到课。')
h('6.2.3 复用最近题目',3)
p('选择课程后，在“最近出过的题”中查看该课程最近展示的题目。点击图中①题目行或右侧“复用”，将题干、选项、题型和答案带入上方编辑区。',True)
fig('04','复用最近出过的题')
p('复用后仍需核对课程、题目及正确答案，可修改后再点击“开始签到”。复用不会立即启动签到，也不会复制此前学生的提交记录。页面最多展示最近5道题，切换课程后应重新确认题目来源。')

h('6.3 学生进入与提交',page=True)
h('6.3.1 展示二维码与课堂码',3)
p('教师点击“开始签到”后，将“扫码签到”页面投到大屏。图中①为动态二维码，②为4位课堂码，③显示剩余时间及刷新提示。二维码和课堂码会变化，应使用投影当前显示的内容。',True)
fig('05','展示动态二维码与课堂码')
p('学生使用自己的手机扫描当前二维码；二维码不便识别时，可打开教师提供的学生签到入口，在①输入4位课堂码，再点击②“下一步”。网络打不开时先检查课堂网络连通性；提示码已刷新时，以投影最新内容为准。',True)
fig('06','学生输入课堂码',7.2)

h('6.3.2 填写身份并提交答案',3,True)
p('第1步：进入题目页，按①选择答案。单选题选一项，多选题可选多项，题干前会显示“多选题”。在②输入本人学号和姓名，学号按页面要求填写至少6位数字，姓名应与课程名单一致。',True)
fig('07','学生答题与身份填写',8)
p('第2步：核对身份与所选答案，在④凭证倒计时结束前点击③“提交并签到”。按钮不可用时，检查答案、学号及姓名是否填写完整。')
p('设备记住身份时，页面直接显示已有身份；信息不是本人时点击“不是本人”重新填写。不得使用其他学生的学号姓名提交。提交失败时先查看页面提示，再核对内容。')

h('6.3.3 确认结果与处理异常',3,True)
p('提交后看到图中①“签到成功”，才表示该次答案与签到已提交。成功页显示本人的结果，教师端人数会随之更新；学生端不在此处公布答案对错。',True)
fig('08','学生签到成功结果',8)
p('提示“学号不在本课程名单里”或“学号与姓名不匹配”时，核对当前课程及姓名学号，并由教师检查名单。提示“这个学号已经签过到了”时，先让教师核实已有记录，不要反复更换身份提交。')
p('提示二维码、课堂码或答题凭证失效时，按页面指引使用最新入口。若仍提示本设备已经领取或签过，应交由教师核实，不能把反复扫码当作必然有效的补救办法。')
p('默认正常签到窗口为90秒，之后有10分钟补签宽限；实际时长以本机设置为准。迟到状态按领取签到凭证时是否超过正常窗口判定。教师提前结束归档后，学生不能继续向该次签到提交。')

h('6.4 实时查看与结束归档',page=True)
h('6.4.1 查看实时人数与未到名单',3)
p('在签到进行中查看①已到、②迟到、③未到、④已答题，以及⑤未到名单。页面自动刷新，学生提交后可稍候核对人数变化。',True)
fig('10','实时人数与未到名单')
p('“已到”包含迟到学生，不应再将迟到人数与已到相加；“已答题”表示已提交答案的人数，答错也计入签到。“未到名单”随当前课程名单和已提交记录更新，可据此提醒尚未完成提交的学生。')
p('正常窗口结束后，页面可能显示仍在补签宽限内；是否还能提交以学生端实际校验为准。准备截止时点击⑥“结束本次并归档”，不要仅凭倒计时变为零判断已经归档。')
h('6.4.2 取消无人提交的签到',3)
p('误选课程或题目时，仅在无人提交的情况下可点击红框按钮“取消本次签到”，或使用内容底部左侧的“上一步”，打开确认窗口。',True)
fig('09','取消本次签到确认窗口',11)
p('图中①说明正在取消本次签到；②为决策按钮。点击“继续签到”保留当前签到；点击“确认取消并返回选题”使当前二维码和课堂码失效，移除空签到记录并返回编辑。该空记录不计入次数或统计，已填题目保留供修改。')
p('一旦已有学生提交，取消按钮及返回选题的“上一步”不可用，应结束并归档。确认窗口打开后若恰好有学生提交，取消也会被阻止，应按提示处理。')

h('6.4.3 结束签到与查看归档结果',3,True)
p('确认本轮截止后，点击“结束本次并归档”，立即停止接受本次提交并进入结果页。操作前应确认学生已完成需要保留的提交。',True)
fig('11','归档后的答案分布与统计')
p('图中①显示正确答案；②显示各选项被选择的人数；③显示已签到与应到人数、已答题人数和正确率。正确率按答对人数除以已答题人数计算，不等同于出勤率。多选题每人可选多项，各选项人数合计可能大于答题人数。')
p('可点击“查看签到记录”进入汇总查询；点击④“再出一道题”返回选题，开始新一轮前重新核对题目。新一轮产生独立记录，上一轮归档结果继续保留。')
h('6.4.4 回看已归档的签到情况',3)
p('归档结果页的内容底部左侧“上一步”用于回看该轮扫码签到情况。图中①显示“已归档”，二维码隐藏；②“返回归档结果”可回到答案分布页。',True)
fig('12','已归档签到的只读回看')
p('回看不会重新开启签到，也不会恢复已失效的课堂码。结束、取消等运行中按钮不再显示。需组织下一轮时，返回归档结果，点击“再出一道题”重新发起。')

h('6.5 查询签到记录与导出',page=True)
h('6.5.1 查看课程总览与出勤趋势',3)
p('点击“签到记录”，选择需要查询的课程。总览中①为平均出勤率，②为签到次数，③为当前名单人数，④为平均答对率。切换课程后应等待数据更新，避免混用不同课程的统计。',True)
fig('13','课程签到总览')
p('平均出勤率反映各次到课与应到的整体比例；平均答对率为各次有效答对率的平均值。没有有效答题数据时显示“—”，不应当作零分。',True)
fig('14','按时间排列的出勤率趋势')
p('趋势图中①按签到时间从早到晚展示出勤率；柱上为百分比，下方为到课人数与应到人数，低于70%显示黄色。课程名单变更会影响历史统计口径，应先核对名单再用于正式汇总。')

h('6.5.2 查看历次签到明细',3,True)
p('在“历次签到”查看图中①记录表。列表按新到旧排列，每行包含时间、题目、到课、迟到、出勤率、答对率及“导出”入口。根据时间和题目定位本轮，避免只按相同题干区分记录。',True)
fig('15','历次签到记录与逐次导出')
p('“到课”以已到人数／应到人数显示，迟到已包含在到课人数中；出勤率与答对率分别反映到课和答题表现。需要核对学生级细节时，点击目标行右侧“导出”，查看该次每名学生的状态和答案。')
p('签到进行中也可能出现在记录中，人数与结果仍会变化。用于成绩核对、留存或汇报的最终明细，应先结束归档，再重新查询并导出。')
h('6.5.3 查看每人累计情况',3)
p('在“每人累计”查看图中①统计表，按学号、姓名核对学生，查看出勤次数／总次数、缺勤、迟到、出勤率和答对率。表格优先列出出勤率较低的学生，便于发现需要核实的情况。',True)
fig('16','每名学生的累计出勤与答题表现')
p('低于60%的出勤率以红色提示；缺勤次数和较低出勤率可用于跟进，但需结合课程名单、已归档记录及实际课堂情况判断。“答对率”为该生已答题记录中的答对比例，显示“—”代表无有效答题数据。')
p('名单增加、移除或身份调整后，历史汇总也可能变化。正式记录归档前，应先核实名单；页面未提供任意修改已提交签到状态的操作，不要将名单维护当作修订考勤的方式。')

h('6.5.4 导出并核对记录文件',3,True)
p('第1步：在图中①选择课程，确认课程及统计范围，再点击②“导出本课全部记录”；只需某一轮时，使用“历次签到”中该行的“导出”。没有签到记录时，全部导出按钮不可用。',True)
fig('17','按课程导出全部签到记录')
p('第2步：等待浏览器完成XLSX文件下载，打开文件核对课程、时间、记录批次和学生人数。浏览器未开始下载时，检查下载提示及保存位置；课程全部导出文件使用“点名批次”区分不同轮次。')
p('第3步：逐项核对学号、姓名、题目、提交答案、正确答案、是否正确、状态和签到时间。未签到学生也应结合状态列检查；多选答案按选项组合显示，不宜只凭其中一个字母判定对错。')
p('第4步：需要最终结果时，先确认该次签到已经结束归档，再导出留存。导出内容含学生身份和课堂表现，应按实际教学管理范围保存与共享。导出的文件是下载时的数据副本，后续名单或记录变化不会自动同步到已下载文件。')

exec(legacy[legacy.index('# Populate directory'):legacy.index('properties=doc.core_properties')])
properties=doc.core_properties
properties.title='第六章 签到管理';properties.subject='操作手册';properties.author='';properties.last_modified_by='';properties.comments='';properties.keywords='签到管理,操作手册'
settings=doc.settings._element
update=settings.find(qn('w:updateFields'))
if update is None:update=OxmlElement('w:updateFields');settings.append(update)
update.set(qn('w:val'),'true')
used=set(doc._element.xpath('//@r:embed | //@r:id | //@r:link'))
for rid,rel in list(doc.part.rels.items()):
    if rel.reltype.endswith(('/image','/hyperlink')) and rid not in used:doc.part.drop_rel(rid)
doc.save(OUTPUT)
(WORK/'正文.txt').write_text('\n\n'.join(sources),encoding='utf-8')
check=Document(OUTPUT);coverage={};current=None
for para in check.paragraphs:
    if para.style.name.startswith('Heading'):
        current=para.text if para.style.name=='Heading 3' else None
        if current:coverage[current]=0
    if current:coverage[current]+=len(para._p.xpath('.//w:drawing'))
assert len(check.inline_shapes)==17 and len(coverage)==14 and all(coverage.values()),coverage
manifest={'output':str(OUTPUT),'reference':str(REFERENCE),'reference_sha256':hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),'figures':figures,'headings':entries,'coverage':coverage,'source_files':['server/public/session.html','server/public/student.html','server/server.js'],'isolated_fixture':capture['dataDirectory']}
(QA/'内容与配图依据.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'output':str(OUTPUT),'figures':figure_no,'level3':len(coverage),'characters':sum(len(p.text) for p in check.paragraphs)},ensure_ascii=False))
