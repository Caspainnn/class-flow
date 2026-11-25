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
OUTPUT = WORK / '第一章 工作台.docx'
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

    if name.startswith('01'):
        im = im.crop((0, 0, im.width, min(im.height, int(item['boxes'][0][3]) + 56)))
    if name.startswith('05'):
        im = im.crop((0, 0, im.width, min(im.height, int(max(box[3] for box in item['boxes'])) + 100)))
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
        if x1 < 45 or (name.startswith('07') and number == 3):
            cx, cy = box[0] - 25, box[1] + 14
        else:
            cx, cy = box[0] + 14, box[1] - 19
        draw.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill='#d5252c')
        draw.text((cx, cy - 1), str(number), font=number_font, fill='white', anchor='mm')

    target = ASSETS / ('第一章-' + name + '-图例.png')
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


h('第一章 工作台', 1, True)
p('工作台是一堂课的教师端首页。打开平台后，可先查看课程和课堂概况，再从待处理事项、课程列表或常用功能进入对应页面。本章截图使用示例数据。')

h('1.1 打开工作台')
h('1.1.1 从侧栏进入', 3)
p('打开教师端，在左侧导航点击图中①“工作台”。在其他功能页面操作后，也可通过该入口返回首页。', True)
fig('01', '从侧栏打开工作台', 7)
p('如果首页提示连不上本地服务，按页面提示双击桌面“一堂课”重新打开。')

h('1.2 查看教学概况', page=True)
h('1.2.1 读懂顶部统计', 3)
p('图中①显示课程总数，②显示全部课程名单人数合计，③显示近7天未删除的课次，④显示各课程待关注学生数的汇总。', True)
fig('02', '查看工作台顶部统计')
p('同一学生出现在多门课程名单时，人数按课程名单累计。点击“待关注学生”可打开数据看板。部分课程学情暂不可用时，该项显示“—”。')

h('1.3 处理教学待办', page=True)
h('1.3.1 从待办进入处理页面', 3)
p('图中①点击“回到签到”继续处理进行中的签到；②点击“去维护”打开对应作业，核对尚未录分的人数；③点击“看课程”打开数据看板。', True)
fig('03', '查看并处理待处理事项')
p('工作台展示部分作业提醒。要核对全部作业，请进入“作业管理”。')

h('1.4 查看课堂与课程', page=True)
h('1.4.1 查看和导出最近一次点名', 3)
p('核对“最近一次点名”标题旁的时间与课程。图中①点击“导出这次”获取本次记录的 Excel 文件；②查看到课、迟到、缺勤和答对率；③查看本次课堂题目。', True)
fig('04', '查看最近一次点名和导出入口')
p('暂无答题统计时，答对率显示“—”。需要查询其他课次时，进入“签到管理”的记录管理。')

h('1.4.2 从我的课程进入签到管理', 3, True)
p('在“我的课程”找到要上课的课程。图中①核对名单人数、学期和最近一次出勤信息；②点击该行“发起”，进入带有所选课程的签到管理入口。', True)
fig('05', '从课程列表进入签到管理', 11)
p('进入签到页面后，核对课程并完成发起流程。课程行显示“进行中”时，可从待办中的“回到签到”进入当前签到。')

h('1.5 使用快捷入口', page=True)
h('1.5.1 打开常用功能', 3)
p('在页面下方找到“常用功能”。图中①打开签到管理，②打开数据看板，③进入学情分析的预警名单，④打开课程管理。', True)
fig('06', '从常用功能打开业务页面')
p('同一区域也提供个体画像、练习分析、作业管理、PPT管理和问卷管理入口。')

h('1.6 首次使用', page=True)
h('1.6.1 从空工作台开始建课', 3)
p('首次打开时，图中①待处理事项和②最近一次点名可能为空。图中③点击“课程管理”创建第一门课程，随后按第三章维护学生名单。', True)
fig('07', '首次打开工作台时的空状态')
p('创建课程后返回工作台核对课程列表。签到、作业和学情信息会随对应业务记录逐步显示。')


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
properties.title = '第一章 工作台'
properties.subject = '操作手册'
properties.author = ''
properties.last_modified_by = ''
properties.comments = ''
properties.keywords = '工作台,操作手册'

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

assert len(check.inline_shapes) == 7
assert len(coverage) == 7 and all(coverage.values()), coverage




