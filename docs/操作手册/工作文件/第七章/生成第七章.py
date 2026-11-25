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

ROOT = Path(r'E:\MyProjects\Inclass')
WORK = Path(__file__).parent
MANUAL = WORK.parent.parent
REFERENCE = MANUAL / '工作文件/参考模板/排版参考.docx'
OUTPUT = MANUAL / 'Word文档/第七章 学情管理.docx'
QA = WORK / '排版检查'
ASSETS = WORK / '图片'
for directory_path in [QA, ASSETS, OUTPUT.parent]:
    directory_path.mkdir(parents=True, exist_ok=True)

REFERENCE_SHA256 = 'cd9cdcbe6070fd845319183250c1fe2fc1bb1c35a029aa42ffc7fd7e4d3cc7a7'
assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == REFERENCE_SHA256

capture = json.loads((WORK / '截图坐标.json').read_text(encoding='utf-8'))
figures = []
images = {}

# Reuse the approved chapter typography, heading, picture and TOC patterns.
legacy = (WORK.parent / '第五章/生成第五章.py').read_text(encoding='utf-8')
exec(legacy[legacy.index('doc=Document(REFERENCE)'):legacy.index("h('第五章 教案制作'")])


def pixelate(im, rect, block_x=14, block_y=9):
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
        x1, y1, x2, y2 = rect
        if name in {'01-入口课程', '02-导出'} and x1 > 430:
            rect = (x1 + 12, y1 + 9, x2 - 28, y2 - 9)
        elif name in {'01-入口课程', '03-预警'}:
            rect = (x1 + 1, y1 + 5, x2 - 1, y2 - 5)
        elif name == '04-画像选择':
            rect = (x1, y1 + 2, x2, y2 - 2)
        elif name == '05-画像概览':
            rect = (x1, y1, x2, y2)
        elif name == '11-作业展开':
            rect = (x1 + 6, y1 + 2, x2 - 6, y2 - 2)
        pixelate(im, rect)

    pad = 50
    canvas = Image.new('RGB', (im.width + pad * 2, im.height + pad * 2), 'white')
    canvas.paste(im, (pad, pad))
    draw = ImageDraw.Draw(canvas)
    number_font = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', 19)
    boxes = []

    raw_boxes = [list(rect) for rect in item['boxes']]
    padded_boxes = [[x1 - 3, y1 - 3, x2 + 3, y2 + 3] for x1, y1, x2, y2 in raw_boxes]
    for first_index, first in enumerate(raw_boxes):
        for second_index in range(first_index + 1, len(raw_boxes)):
            second = raw_boxes[second_index]
            horizontal_overlap = max(first[0], second[0]) < min(first[2], second[2])
            vertical_overlap = max(first[1], second[1]) < min(first[3], second[3])
            if horizontal_overlap and first[3] <= second[1] and second[1] - first[3] < 6:
                midpoint = (first[3] + second[1]) / 2
                padded_boxes[first_index][3] = midpoint - 1
                padded_boxes[second_index][1] = midpoint + 1
            elif horizontal_overlap and second[3] <= first[1] and first[1] - second[3] < 6:
                midpoint = (second[3] + first[1]) / 2
                padded_boxes[second_index][3] = midpoint - 1
                padded_boxes[first_index][1] = midpoint + 1
            elif vertical_overlap and first[2] <= second[0] and second[0] - first[2] < 6:
                midpoint = (first[2] + second[0]) / 2
                padded_boxes[first_index][2] = midpoint - 1
                padded_boxes[second_index][0] = midpoint + 1
            elif vertical_overlap and second[2] <= first[0] and first[0] - second[2] < 6:
                midpoint = (second[2] + first[0]) / 2
                padded_boxes[second_index][2] = midpoint - 1
                padded_boxes[first_index][0] = midpoint + 1

    for number, rect in enumerate(padded_boxes, 1):
        x1, y1, x2, y2 = rect
        box = (round(x1 + pad), round(y1 + pad), round(x2 + pad), round(y2 + pad))
        draw.rectangle(box, outline='#d5252c', width=3)

        if name == '03-预警' and number == 2:
            cx, cy = box[2] + 18, box[1] + 13
        elif x1 <= 125:
            cx, cy = box[0] - 34, box[1] + 14
        else:
            cx, cy = box[0] + 14, box[1] - 18
        draw.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill='#d5252c')
        draw.text((cx, cy - 1), str(number), font=number_font, fill='white', anchor='mm')
        boxes.append([x1, y1, x2, y2])

    target = ASSETS / ('第七章-' + name + '-图例.png')
    canvas.save(target)
    images[name[:2]] = target
    figures.append({
        'source': str(original),
        'sha256': hashlib.sha256(original.read_bytes()).hexdigest(),
        'image': str(target),
        'boxes': boxes,
        'redact': item['redact'],
    })


figure_no = 0


def fig(key, caption, width=14.63):
    global figure_no
    figure_no += 1
    pic(images[key], f'图{figure_no}. {caption}', width)


h('第七章 学情管理', 1, True)
p('本章介绍教师在“学情分析”页面查看课程预警、学生个体画像、课堂题目和作业统计，以及导出完整学情数据的方法。页面信息用于发现需要核实的情况，预警和系统建议不能替代教师结合名单、签到、作业与课堂实际作出的判断。')

h('7.1 使用前准备')
p('第1步：确认已在“课程管理”中建立课程并维护学生名单。学号、姓名或人数不准确，会影响出勤、答题、作业和预警统计。')
p('第2步：确认需要分析的签到已结束归档，作业成绩和提交状态已在“作业管理”中维护。进行中的签到或尚未录入的作业数据可能继续变化。')
p('第3步：具有本功能访问权限的用户可查看学情数据。预警阈值由“设置—预警规则”配置；调整规则后，命中名单可能随之变化。正式跟进学生前，应核对规则、统计范围和原始记录。')

h('7.2 进入学情分析与导出', page=True)
h('7.2.1 选择课程并切换分析模块', 3)
p('在左侧导航点击“学情分析”。图中①进入“预警名单”，②进入“个体画像”，③进入“练习分析”；④选择需要查看的课程。切换课程后，等待页面数据更新，再查看或导出结果。', True)
fig('01', '学情分析入口、模块与课程选择', 13.0)
p('页面标题显示“学情分析”，本章将这些查看、核对和导出操作统称为“学情管理”。课程名称下方会提示数据来自课堂签到与作业；不同课程的数据彼此独立，应先确认当前课程。')

h('7.2.2 导出完整学情数据', 3, True)
p('图中①核对当前课程，②点击“导出全部数据 .xlsx”。浏览器开始下载后，打开文件检查课程、学生人数和记录时间范围。', True)
fig('02', '按课程导出全部学情数据')
p('导出文件包含“预警名单”“学生汇总”“出勤明细”“答题明细”和“作业明细”工作表，可用于进一步核对和留存。文件是点击下载时的数据快照，后续名单、签到或作业发生变化时，已下载文件不会自动更新，应重新导出。')
p('导出内容包含学生身份和学习表现，应按实际教学管理范围保存、共享和销毁。浏览器未下载时，检查下载提示、保存位置和当前课程是否有效。')

h('7.3 查看预警名单', page=True)
h('7.3.1 识别规则命中学生', 3)
p('进入“预警名单”后，图中①显示命中规则的学生及出勤、答对率和作业概况；②显示当前命中人数。列表会随课程数据和预警规则自动计算。', True)
fig('03', '预警名单与命中规则')
p('可能出现的规则包括连续缺勤、近期答题正确率偏低、作业未交达到设定次数，以及多次作业低于设定分数。近期正确率规则只有在学生达到最低答题数量后才参与判断，具体阈值以“设置—预警规则”为准。')
p('命中结果表示数据满足规则，不等同于已经查明原因。跟进前应核对学生名单、相关签到记录、答题次数、作业截止时间和成绩状态，排除名单变化、补交、数据尚未录入等情况，再结合课堂实际采取措施。')

h('7.4 查看个体画像', page=True)
h('7.4.1 搜索并选择学生', 3)
p('切换到“个体画像”。图中①可输入姓名或学号筛选，②显示当前课程学生列表。点击学生行后，右侧更新该生的汇总指标、轨迹和历史明细。', True)
fig('04', '搜索并选择学生', 5.2)
p('列表中的红色数字表示该生当前命中的预警项数量，仅用于定位需要核实的情况。搜索无结果时，检查课程选择、关键字和课程名单；不要仅凭列表顺序判断学生身份。')

h('7.4.2 查看汇总指标与轨迹', 3, True)
p('图中①显示当前学生；②依次显示出勤次数／总次数、答题次数、答题正确率、作业提交数和作业均分；③为出勤轨迹，④为作业轨迹，⑤为页面提示。', True)
fig('05', '学生汇总指标、出勤轨迹与作业轨迹', 14.2)
p('出勤轨迹每次签到一格，绿色表示到课，红色表示缺勤。作业轨迹每次作业一格，绿色表示已交，黄色表示补交或迟交，红色表示未交；格内数字为该次成绩。轨迹用于快速发现变化，需结合下方明细确认具体日期和记录。')
p('答题正确率按该生已提交答案计算，作业均分按已有成绩计算。缺少有效数据时，页面可能显示“—”或较少的轨迹格，不应直接解释为零分或完整学期结论。')

h('7.4.3 查看历次答题明细', 3, True)
p('在“历次答题明细”中查看图中①表格。每行列出课次、题目、学生所选、正确答案和判定，可根据课次定位错误或未掌握的知识点。', True)
fig('06', '学生历次答题明细', 14.2)
p('“错误”表示本次提交与正确答案不一致；多选题需核对完整选项组合。查看时同时关注答题次数和题目内容，避免用少量记录概括长期表现。需要确认课堂到课状态时，再与签到记录和出勤轨迹交叉核对。')

h('7.4.4 查看历次作业明细', 3, True)
p('在“历次作业明细”中查看图中①表格。每行显示作业名称、截止日期、提交情况和得分，可据此定位按时提交、补交及成绩变化。', True)
fig('07', '学生历次作业明细', 14.2)
p('本页只展示统计结果。需要录入、修订成绩或处理提交状态时，应前往“作业管理”核对相应作业；修改后返回学情分析重新查看。作业未交或低分也应结合截止时间、补交安排和评分规则判断。')

h('7.5 分析课堂题目与作业', page=True)
h('7.5.1 选择课堂题目', 3)
p('切换到“练习分析”。图中①选择课次，②显示该课次的课堂题目及正确率。页面优先呈现正确率较低的题目，便于先查看薄弱知识点。', True)
fig('08', '选择课次并查看课堂题目', 14.2)
p('点击题目行可展开选项分布。课次按签到记录生成；切换课次后应核对日期和题干，避免把相同或相近题目混为一次记录。正确率只反映已提交答案的结果，还应结合到课人数和提交人数判断覆盖范围。')

h('7.5.2 展开选项分布', 3, True)
p('点击课堂题目后，图中①保留题目及正确率，②展开各选项的选择人数、正确选项标记、提交人数和系统提示。', True)
fig('09', '课堂题目的选项分布与提示', 14.2)
p('通过选项分布可判断错误是否集中在某一干扰项。正确率较低且错误选项集中时，页面会提示该知识点需要重点讲解；该提示是基于当前数据的教学建议，教师仍需结合题目难度、样本数量和课堂情况决定是否重讲。')
p('多选题中一名学生可选择多个选项，各选项人数之和可能大于提交人数。分析时应同时核对正确答案组合和错误选项，不宜只看单个柱形长度。')

h('7.5.3 查看作业统计', 3, True)
p('向下查看“作业分析”。图中①列出作业名称、截止日期、提交人数、平均分和得分分布；点击作业名称可展开详细统计。“管理这份作业”可跳转到作业管理。', True)
fig('10', '作业提交、平均分与得分分布', 14.2)
p('得分分布用不同颜色展示优秀、良好、及格和不及格人数，可快速比较不同作业的整体表现。本区域为只读统计，新增作业、录入成绩、批改或调整提交状态应在“作业管理”中完成。')

h('7.5.4 展开得分分布与未交名单', 3, True)
p('点击目标作业名称，图中①为该作业汇总行，②展开各分数段人数和未交名单。再次点击作业名称可收起详情。', True)
fig('11', '作业得分分布与未交名单', 14.2)
p('展开后分别查看优秀、良好、及格和不及格人数，并核对未交学生。名单用于定位需要确认的记录；联系学生或形成结论前，应检查课程名单、作业截止时间、补交安排和作业管理中的最新状态。')
p('需要留存完整分析时，可返回页面顶部重新导出全部学情数据。导出前确认签到已归档、作业数据已维护完成，并记录导出时间，便于区分不同时间点的数据快照。')

exec(legacy[legacy.index('# Populate directory'):legacy.index('properties=doc.core_properties')])

properties = doc.core_properties
properties.title = '第七章 学情管理'
properties.subject = '操作手册'
properties.author = ''
properties.last_modified_by = ''
properties.comments = ''
properties.keywords = '学情管理,学情分析,预警名单,个体画像,练习分析,操作手册'

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
coverage = {}
current = None
for para in check.paragraphs:
    if para.style.name.startswith('Heading'):
        current = para.text if para.style.name == 'Heading 3' else None
        if current:
            coverage[current] = 0
    if current:
        coverage[current] += len(para._p.xpath('.//w:drawing'))

assert len(check.inline_shapes) == 11
assert len(coverage) == 11 and all(coverage.values()), coverage

manifest = {
    'output': str(OUTPUT),
    'reference': str(REFERENCE),
    'reference_sha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
    'figures': figures,
    'headings': entries,
    'coverage': coverage,
    'source_files': [
        'xueqing/public/analysis.html',
        'xueqing/xueqing.js',
        'server/lib/homework.js',
        'server/public/shell.js',
    ],
    'isolated_fixture': capture['dataDirectory'],
}
(QA / '内容与配图依据.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({
    'output': str(OUTPUT),
    'figures': figure_no,
    'level3': len(coverage),
    'characters': sum(len(paragraph.text) for paragraph in check.paragraphs),
}, ensure_ascii=False))
