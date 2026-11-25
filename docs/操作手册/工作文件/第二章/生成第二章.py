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
OUTPUT = MANUAL / 'Word文档/第二章 数据看板.docx'
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

    target = ASSETS / ('第二章-' + name + '-图例.png')
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


h('第二章 数据看板', 1, True)
p('数据看板集中展示教学统计。在教师端侧栏点击“数据看板”，也可从工作台的“常用功能”进入。本章截图使用示例数据。')

h('2.1 选择统计范围')
h('2.1.1 筛选课程 学期和活动日期', 3)
p('图中①选择课程，②选择学期，③选择活动日期。选择“自定义”后，在④填写开始和结束日期，开始日期须早于或等于结束日期。', True)
fig('01','设置看板统计范围')
p('筛选变化后看板自动重新读取。点击页面右上角“刷新数据”可手动更新，并核对旁边的日期范围和更新时间。读取失败时可点击“重试”；如页面保留上次数据，以其更新时间为准。')

h('2.2 查看关键指标', page=True)
h('2.2.1 阅读概览指标卡', 3)
p('图中①查看课程数与当前名单人次，②查看到课人次占应到人次的比例，③查看正确作答占有效作答的比例，④查看已录分进度，⑤查看问卷答卷数，⑥查看当前学情关注人次。', True)
fig('02','查看看板指标卡')
p('点击指标卡可定位对应区域。活动指标随日期范围更新，当前名单与学情关注按所选课程的当前数据统计。比例没有可计算的分母时显示“—”。')

h('2.3 查看课堂和待办', page=True)
h('2.3.1 查看课堂参与趋势', 3)
p('图中①查看到课、迟到、缺勤和作答参与概况，②辨认三条趋势线，③查看各日变化。将鼠标停在数据点上可查看当日数值。', True)
fig('03','查看课堂参与统计与趋势')
p('趋势按日汇总人次后计算，迟到已计入到课。历史课堂按当前名单统计，空签到不计入比例。')

h('2.3.2 打开需要处理的事项', 3, True)
p('“需要处理”显示当前待办总数和前五项。示例中①打开作业待录分事项，②打开学情关注事项。点击相应条目进入业务页面处理。', True)
fig('04','查看当前待办及处理入口', 9)

h('2.4 查看作业和问卷', page=True)
h('2.4.1 查看作业录分和批改情况', 3)
p('图中①查看未录分、明确未交、待匹配和异常数量；②查看每份作业的录分进度和均分，点击该行“明细”进入对应作业。', True)
fig('05','查看作业与批改进度')
p('未录分表示当前缺少成绩。核对提交情况时，以“明确未交”和作业明细为准。')

h('2.4.2 查看问卷回收情况', 3, True)
p('图中①查看实名回收率、实名未提交人次和匿名答卷份数；②核对各问卷的方式、累计回收及期间答卷，点击“分析”查看对应问卷。', True)
fig('06','查看问卷回收及分析入口')
p('期间答卷按提交时间统计。实名总回收率按发布时的名单计算，匿名问卷显示答卷份数。')

h('2.5 查看课程和备课资源', page=True)
h('2.5.1 查看各课程教学概况', 3)
p('图中①点击“关注名单”进入学情预警名单；②按课程横向查看当前名单、所选期间签到与答卷、出勤率、答对率及当前关注人次。', True)
fig('07','查看课程教学概况')
p('同一学生在多门课命中关注规则时，按各课程分别计入人次。所选范围暂无活动时，可调整筛选范围，或点击“查看全部教学数据”。')

h('2.5.2 查看备课产物和模板', 3, True)
p('图中①查看期间有产物的 PPT、教案任务数和当前模板库存，点击模板入口可进入模板页面；②点击产物所在行的“查看”打开对应业务页面。', True)
fig('08','查看备课产物与模板库存', 11)
p('模板库存按当前全局数量显示。看板列出最多四条备课产物，完整记录可到对应管理页面查询。')


exec(legacy[legacy.index('# Populate directory'):legacy.index('properties=doc.core_properties')])

# Keep the long chapter directory on one page.
toc_node = directory._p.getnext()
for _ in entries:
    toc_paragraph = Paragraph(toc_node, doc._body)
    toc_paragraph.paragraph_format.space_before = Pt(0)
    toc_paragraph.paragraph_format.space_after = Pt(0)
    toc_paragraph.paragraph_format.line_spacing = 1.0
    for run in toc_paragraph.runs:
        run.font.size = Pt(10.0)
    toc_node = toc_node.getnext()

properties = doc.core_properties
properties.title = '第二章 数据看板'
properties.subject = '操作手册'
properties.author = ''
properties.last_modified_by = ''
properties.comments = ''
properties.keywords = '数据看板,操作手册'

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

assert len(check.inline_shapes) == 8
assert len(coverage) == 8 and all(coverage.values()), coverage


