from pathlib import Path
from copy import deepcopy
import hashlib, json
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.enum.style import WD_STYLE_TYPE
from docx.text.paragraph import Paragraph
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(r'E:\MyProjects\Inclass')
WORK = Path(__file__).parent
MANUAL = WORK.parent.parent
REFERENCE = MANUAL / '工作文件/参考模板/排版参考.docx'
OUTPUT = MANUAL / 'Word文档/第八章 作业管理.docx'
QA = WORK / '排版检查'
ASSETS = WORK / '图片'
for directory_path in [QA, ASSETS, OUTPUT.parent]:
    directory_path.mkdir(parents=True, exist_ok=True)

REFERENCE_SHA256 = 'cd9cdcbe6070fd845319183250c1fe2fc1bb1c35a029aa42ffc7fd7e4d3cc7a7'
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == REFERENCE_SHA256

capture = json.loads((WORK / '截图坐标.json').read_text(encoding='utf-8'))
figures, images = [], {}

# Reuse the established template-derived typography, TOC, heading and figure helpers.
legacy = (WORK.parent / '第五章/生成第五章.py').read_text(encoding='utf-8')
exec(legacy[legacy.index('doc=Document(REFERENCE)'):legacy.index("h('第五章 教案制作'")])


def pixelate(im, rect, block_x=12, block_y=8):
    x1, y1, x2, y2 = rect
    x1, y1 = max(0, round(x1)), max(0, round(y1))
    x2, y2 = min(im.width, round(x2)), min(im.height, round(y2))
    if x2 <= x1 or y2 <= y1:
        return
    part = im.crop((x1, y1, x2, y2))
    small = part.resize((max(1, part.width // block_x), max(1, part.height // block_y)))
    im.paste(small.resize(part.size, Image.Resampling.NEAREST), (x1, y1, x2, y2))


for item in capture['items']:
    name = item['name']
    original = WORK / '原始截图' / (name + '.png')
    im = Image.open(original).convert('RGB')
    for rect in item['redact']:
        pixelate(im, rect)

    pad = 52
    canvas = Image.new('RGB', (im.width + pad * 2, im.height + pad * 2), 'white')
    canvas.paste(im, (pad, pad))
    draw = ImageDraw.Draw(canvas)
    number_font = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', 19)
    raw_boxes = [list(rect) for rect in item['boxes']]
    padded_boxes = [[x1 - 3, y1 - 3, x2 + 3, y2 + 3] for x1, y1, x2, y2 in raw_boxes]

    # Split padding at very close edges so independent red boxes never overlap.
    for i, first in enumerate(raw_boxes):
        for j in range(i + 1, len(raw_boxes)):
            second = raw_boxes[j]
            h_overlap = max(first[0], second[0]) < min(first[2], second[2])
            v_overlap = max(first[1], second[1]) < min(first[3], second[3])
            if h_overlap and first[3] <= second[1] and second[1] - first[3] < 8:
                mid = (first[3] + second[1]) / 2
                padded_boxes[i][3], padded_boxes[j][1] = mid - 1, mid + 1
            elif v_overlap and first[2] <= second[0] and second[0] - first[2] < 8:
                mid = (first[2] + second[0]) / 2
                padded_boxes[i][2], padded_boxes[j][0] = mid - 1, mid + 1

    for number, rect in enumerate(padded_boxes, 1):
        x1, y1, x2, y2 = rect
        box = (round(x1 + pad), round(y1 + pad), round(x2 + pad), round(y2 + pad))
        draw.rectangle(box, outline='#d5252c', width=3)
        if x1 < 45:
            cx, cy = box[0] - 25, box[1] + 14
        else:
            cx, cy = box[0] + 14, box[1] - 19
        draw.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill='#d5252c')
        draw.text((cx, cy - 1), str(number), font=number_font, fill='white', anchor='mm')

    target = ASSETS / ('第八章-' + name + '-图例.png')
    canvas.save(target)
    images[name[:2]] = target
    figures.append({
        'source': str(original),
        'sha256': hashlib.sha256(original.read_bytes()).hexdigest(),
        'image': str(target),
        'boxes': padded_boxes,
        'redact': item['redact'],
    })


figure_no = 0


def fig(key, caption, width=14.63):
    global figure_no
    figure_no += 1
    pic(images[key], f'图{figure_no}. {caption}', width)


h('第八章 作业管理', 1, True)
p('本章介绍在“作业管理”和“自动批改”页面建立作业、维护成绩、收取学生文件、执行批改、复核结果并归档到学情分析的方法。作业名称、截止日期、课程名单、提交原件和评分标准共同决定后续统计是否准确，操作前应先核对当前课程和作业。')

h('8.1 使用前准备')
p('第1步：确认已在“课程管理”中建立课程并维护学生名单。文件自动匹配、未交人数和成绩归档都以当前课程名单为依据。')
p('第2步：准备作业名称和截止日期。若使用自动批改，还需准备各题题目、分值和可执行的评分标准；各题分值合计通常为100分。')
p('第3步：根据业务需要选择“直接录入成绩”或“收取并批改作业”。上传学生文件时只使用本课程材料，并按教学管理范围保存、下载和共享。')

h('8.2 管理作业列表', page=True)
h('8.2.1 筛选并查看作业', 3)
p('进入“作业管理”。图中①选择“全部课程”或一门课程，②查看作业名称、状态、已录人数和操作入口。文件批改作业可继续批改，已有成绩的作业可进入分析。', True)
fig('01', '按课程筛选并查看作业列表')
p('状态用于说明当前处理阶段，例如待处理、已录分、收作业中、待批改、待复核或已归档。先通过课程和作业名称确认目标，再进入详情或批改页，避免维护到另一门课程。')

h('8.2.2 新建作业', 3, True)
p('点击“新建作业”。图中①选择课程，②填写作业名称，③按需设置截止日期，④点击“创建作业”。', True)
fig('02', '填写作业基本信息并创建', 8.0)
p('课程和作业名称为必填项，截止日期可留空。创建操作只建立作业基本信息，成功后进入详情页，再选择收取批改或直接录分。没有课程时，应先在课程管理中添加课程。')

h('8.3 维护作业与成绩', page=True)
h('8.3.1 修改基本信息', 3)
p('进入作业详情。图中①为只读课程，②可修改作业名称，③可修改或清除截止日期，④保存信息。', True)
fig('03', '维护作业名称和截止日期')
p('作业所属课程不能在详情页更换。修改名称或截止日期后先保存，再进入自动批改；未保存的基本信息不会带入批改流程。')

h('8.3.2 选择作业处理方式', 3, True)
p('在“作业处理”区域，图中①进入收取文件和自动批改流程，②跳转到成绩维护区域直接录入成绩。', True)
fig('04', '选择收取批改或直接录分', 8.0)
p('同一份作业可先录入部分人工成绩，再启用自动批改。已有的人工分数和补交状态会保留，自动批改结果不会默认覆盖这些记录。')

h('8.3.3 批量录入成绩', 3, True)
p('在“批量录入成绩”中，图中①查看填写规则，②每行输入“学号 分数”；补交在行末加“补”，未交写“学号 未交”，③保存成绩。', True)
fig('05', '按学号批量录入成绩', 10.0)
p('分数范围为0至100。删除输入框中的一行不会清除已经保存的成绩，需要明确写“未交”。无法识别的学号或分数会保留在输入框并显示错误提示，修正后再次保存。')

h('8.3.4 删除作业', 3, True)
p('点击“删除作业”后，图中①显示删除影响，②确认删除，③取消并返回详情。', True)
fig('06', '确认或取消删除作业')
p('确认后，作业及关联批改批次会从管理和学情分析中移除；原始上传文件仍保留。删除会影响后续查看和统计，应先核对作业名称、课程和是否需要导出留存。')

h('8.4 配置自动批改', page=True)
h('8.4.1 选择课程与作业', 3)
p('进入“自动批改”。图中①选择课程，②选择该课程的作业，③查看当前状态，④可返回作业详情。', True)
fig('07', '选择课程和待批改作业')
p('必须先选择课程，作业下拉框才会显示对应记录。页面按“题目与标准、收取作业、自动批改、成绩复核”四步组织；切换作业前应先保存当前评分标准和复核修改。')

h('8.4.2 直接录入题目与评分标准', 3, True)
p('在“题目与标准”中，图中①设置作业名称、及格线、评分尺度和补充要求，②选择直接录入，③逐题填写题目、分值和评分标准，④保存后进入收取作业。', True)
fig('08', '直接配置题目和评分标准')
p('每道题都需填写题目、正数分值和评分标准，总分需与当前作业满分一致。评分标准应写明得分点或扣分条件，使批改结果能够逐题核对。已有批改结果后，题目结构和分值将受到限制。')

h('8.4.3 使用模板导入评分标准', 3, True)
p('图中①切换“模板上传”，②下载并上传填写好的模板，③核对解析预览，④确认无误后保存。', True)
fig('09', '上传模板并预览评分标准')
p('模板仅支持一份不超过5MB的xlsx文件。上传后页面先解析并展示题目数量、总分和逐题标准；发现内容不正确时，重新上传或切回直接录入，不要在未核对时进入收作业。')

h('8.5 收取并匹配作业', page=True)
h('8.5.1 上传学生作业', 3)
p('进入“收取作业”。图中①可点击或拖入多个文件，②查看已上传文件列表。', True)
fig('10', '批量上传学生作业文件')
p('支持docx、doc、pdf、txt、md和zip。文件名同时包含学号和姓名时可自动匹配；可一次选择多份文件，未交学生无需创建占位文件。')

h('8.5.2 核对和修正文件匹配', 3, True)
p('图中①逐份核对文件名、匹配学生和状态，②查看名单人数、已匹配、待确认和未交数量。待确认文件可在下拉框中手动指定学生。', True)
fig('11', '核对自动匹配并处理待确认文件')
p('同一学生的身份应以课程名单为准。手动指定后再次检查学号和姓名，避免把文件关联给其他学生；需要重新按文件名识别时，可使用“重新自动匹配”。')

h('8.5.3 准备批改目录', 3, True)
p('确认文件和名单后，图中①再次核对匹配汇总，②点击“准备批改目录”。', True)
fig('12', '确认匹配后准备批改目录')
p('准备目录前必须至少上传一份文件，并保存完整的逐题评分标准。系统会将已匹配文件按“学号+姓名”整理，待确认文件放入单独目录，同时生成未交名单和批改提示词。')

h('8.6 执行自动批改', page=True)
h('8.6.1 使用平台自动调用', 3)
p('在“自动批改工作台”中，图中①选择平台自动调用，②查看连接状态、模型和超时设置，③开始批改并观察进度与日志。', True)
fig('13', '由平台调用本机 WorkBuddy 批改')
p('平台会使用设置中已连接的本机WorkBuddy处理已匹配文件，结果回到当前作业。运行期间不要修改题目、文件匹配或成绩；出现异常时先查看日志，再核对文件是否可读和评分标准是否完整。')

h('8.6.2 使用手动调用与导入', 3, True)
p('图中①选择“手动调用与导入”，②复制提示词并在WorkBuddy中运行，可按需打开批改目录，③批改完成后上传生成的xlsx结果。', True)
fig('14', '手动调用 WorkBuddy 并导入结果')
p('当平台未连接WorkBuddy或需要人工控制处理过程时使用此方式。导入表格至少应包含姓名、得分和作业情况；导入后仍需进入成绩复核，检查学生匹配、异常记录和分数。')

h('8.7 复核和归档成绩', page=True)
h('8.7.1 查看成绩总览', 3)
p('进入“成绩复核”。图中①查看平均分、最高分、最低分、优秀率、不及格率和异常数，②核对每名学生的提交状态、得分、等级和摘要。', True)
fig('15', '查看班级成绩总览')
p('总览用于快速定位低分、未交和异常记录。统计只反映当前批改结果；归档前应确保学生名单、提交状态和评分结果一致，并对需要确认的记录进入详细复核。')

h('8.7.2 对照原件详细复核', 3, True)
p('点击“详细复核”。图中①选择学生，②查看或下载该生提交原件，③调整复核总分、填写改分原因并保存，可继续下一位。', True)
fig('16', '对照提交原件复核成绩')
p('修改总分不会改变下方模型逐题评分记录，因此应填写明确的改分原因。存在未保存修改时，页面会阻止切换学生或离开复核区域；确认后可保存评分或保存并进入下一位。')

h('8.7.3 查看小题评分依据', 3, True)
p('在详细复核中点击“查看小题评分与依据”。图中①按题查看得分、满分、给分依据和评分标准，②关闭后返回当前学生复核。', True)
fig('17', '查看逐题得分和给分依据', 8.2)
p('逐题明细用于核对总分来源和判断评分依据是否符合标准。若总分需要调整，可关闭弹窗后在复核区修改；原始逐题记录仍用于保留批改依据。')

h('8.7.4 导出并归档成绩', 3, True)
p('完成复核后，图中①导出xlsx成绩表用于核对或留存，②点击“归档到学情分析”，并在2.6秒内再次点击完成确认。', True)
fig('18', '导出成绩并归档到学情分析')
p('归档会更新同一份作业在学情分析中的成绩，不会覆盖已人工维护的成绩和补交状态。历史非100分作业在分析时按百分制折算；归档前应完成必要导出，并确认异常记录和未交状态已经处理。')

exec(legacy[legacy.index('# Populate directory'):legacy.index('properties=doc.core_properties')])

# The chapter has many third-level headings; keep the complete directory on one page.
toc_node = directory._p.getnext()
for _ in entries:
    toc_paragraph = Paragraph(toc_node, doc._body)
    toc_paragraph.paragraph_format.space_before = Pt(0)
    toc_paragraph.paragraph_format.space_after = Pt(0)
    toc_paragraph.paragraph_format.line_spacing = 1.0
    for run in toc_paragraph.runs:
        run.font.size = Pt(10.5)
    toc_node = toc_node.getnext()

properties = doc.core_properties
properties.title = '第八章 作业管理'
properties.subject = '操作手册'
properties.author = ''
properties.last_modified_by = ''
properties.comments = ''
properties.keywords = '作业管理,成绩录入,自动批改,成绩复核,操作手册'

settings = doc.settings._element
update = settings.find(qn('w:updateFields'))
if update is None:
    update = OxmlElement('w:updateFields')
    settings.append(update)
update.set(qn('w:val'), 'true')

used = set(doc._element.xpath('//@r:embed | //@r:id | //@r:link'))
for rid, rel in list(doc.part.rels.items()):
    if rel.reltype.endswith(('/image', '/hyperlink')) and rid not in used:
        doc.part.drop_rel(rid)

doc.save(OUTPUT)
(WORK / '正文.txt').write_text('\n\n'.join(sources), encoding='utf-8')

check = Document(OUTPUT)
coverage, current = {}, None
for para in check.paragraphs:
    if para.style.name.startswith('Heading'):
        current = para.text if para.style.name == 'Heading 3' else None
        if current:
            coverage[current] = 0
    if current:
        coverage[current] += len(para._p.xpath('.//w:drawing'))

assert len(check.inline_shapes) == 18
assert len(coverage) == 18 and all(coverage.values()), coverage

manifest = {
    'output': str(OUTPUT),
    'reference': str(REFERENCE),
    'reference_sha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
    'figures': figures,
    'headings': entries,
    'coverage': coverage,
    'source_files': [
        'server/grade/public/homework.html',
        'server/grade/public/grading.html',
        'server/grade/grade.js',
        'server/lib/homework.js',
        'server/public/shell.js',
    ],
    'isolated_fixture': capture['dataDirectory'],
}
(QA / '内容与配图依据.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'output': str(OUTPUT), 'figures': figure_no, 'level3': len(coverage), 'characters': sum(len(x.text) for x in check.paragraphs)}, ensure_ascii=False))
