from pathlib import Path
from copy import deepcopy
import json
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(r'E:\MyProjects\Inclass')
OUT = Path(__file__).parent
QA = OUT / '排版检查'
OUT.mkdir(exist_ok=True)
QA.mkdir(exist_ok=True)
ASSETS = OUT / '图片'
ASSETS.mkdir(exist_ok=True)
TEMPLATE = next(Path(r'D:\xwechat_files\wxid_evw4cgougnpg22_2893\temp\RWTemp\2026-10\d0bce1b450f603c78f2dbd2a97985e3f').glob('*.docx'))
REFERENCE = OUT.parent / '参考模板' / '排版参考.docx'
REFERENCE.parent.mkdir(exist_ok=True)
if not REFERENCE.exists():
    shutil.copy2(TEMPLATE, REFERENCE)


def figure(source, crop, filename, boxes):
    im = Image.open(source).convert('RGB').crop(crop)
    pad = 28
    canvas = Image.new('RGB', (im.width + pad * 2, im.height + pad * 2), 'white')
    canvas.paste(im, (pad, pad))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', 17)
    for number, box in enumerate(boxes, 1):
        x1, y1, x2, y2 = box
        box = (x1 - crop[0] + pad, y1 - crop[1] + pad,
               x2 - crop[0] + pad, y2 - crop[1] + pad)
        draw.rectangle(box, outline='#d5252c', width=2)
        cx, cy = box[0] - 12, box[1] - 12
        draw.ellipse((cx - 11, cy - 11, cx + 11, cy + 11), fill='#d5252c')
        draw.text((cx, cy - 1), str(number), fill='white', font=font, anchor='mm')
    dest = ASSETS / filename
    canvas.save(dest)
    return dest


FIG1 = figure(
    ROOT / 'docs/ui-course-2026-10-26/verification/course-list-desktop.png',
    (225, 14, 1265, 506), '第三章-图1-课程列表.png',
    [(1144, 34, 1250, 79), (243, 103, 773, 151), (243, 170, 909, 454)],
)
FIG2 = figure(
    ROOT / 'docs/ui-course-2026-10-26/verification/course-management-mobile.png',
    (18, 343, 374, 830), '第三章-图2-课程名单.png',
    [(38, 422, 199, 455), (38, 469, 354, 605), (37, 645, 354, 819)],
)

doc = Document(REFERENCE)
body = doc._element.body
section_properties = deepcopy(body.find(qn('w:sectPr')))
for element in list(body):
    body.remove(element)
body.append(section_properties)
section = doc.sections[0]
section.page_width = Cm(21)
section.page_height = Cm(29.7)
section.top_margin = section.bottom_margin = Cm(2.54)
section.left_margin = section.right_margin = Cm(3.175)
section.header_distance = Cm(1.50)
section.footer_distance = Cm(1.75)


def set_font(run, name='仿宋', size=12, bold=False):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    rf = run._element.get_or_add_rPr().get_or_add_rFonts()
    for key in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
        rf.set(qn('w:' + key), name)
    for key in ['asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme']:
        rf.attrib.pop(qn('w:' + key), None)


normal = doc.styles['Normal']
normal.font.name = '仿宋'
normal.font.size = Pt(12)
normal.paragraph_format.line_spacing = 1.5
normal.paragraph_format.space_before = Pt(0)
normal.paragraph_format.space_after = Pt(0)
normal.paragraph_format.first_line_indent = Pt(0)
normal.paragraph_format.widow_control = True

for name, size in [('Heading 1', 16), ('Heading 2', 15), ('Heading 3', 12)]:
    s = doc.styles[name]
    s.font.name = '黑体'
    s.font.size = Pt(size)
    s.font.bold = False
    s.paragraph_format.keep_with_next = True
    s.paragraph_format.keep_together = True
    s.paragraph_format.line_spacing = 1.5
    s.paragraph_format.space_before = Pt(13 if name != 'Heading 3' else 7)
    s.paragraph_format.space_after = Pt(10 if name != 'Heading 3' else 4)

md = []
bookmark_id = 1


def heading(text, level=2, new_page=False):
    global bookmark_id
    p = doc.add_paragraph(style=f'Heading {level}')
    p.paragraph_format.page_break_before = new_page
    if level == 1:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p.add_run(text), '黑体', {1: 16, 2: 15, 3: 12}[level])
    bookmark = f'course_manual_{bookmark_id}'
    begin = OxmlElement('w:bookmarkStart')
    begin.set(qn('w:id'), str(bookmark_id))
    begin.set(qn('w:name'), bookmark)
    end = OxmlElement('w:bookmarkEnd')
    end.set(qn('w:id'), str(bookmark_id))
    p._p.insert(0, begin)
    p._p.append(end)
    bookmark_id += 1
    md.append('#' * level + ' ' + text + '\n')
    return bookmark


def para(text, before=0, after=0, keep=False):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.keep_with_next = keep
    set_font(p.add_run(text))
    md.append(text + '\n')
    return p


def add_picture(path, caption, width):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.line_spacing = 1
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.keep_with_next = True
    r = p.add_run()
    pic = r.add_picture(str(path), width=Cm(width))
    pic._inline.docPr.set('descr', caption)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    set_font(p.add_run(caption))
    md.append(f'![{caption}](图片/{path.name})\n\n{caption}\n')


def field(p, instruction, cached=''):
    r = OxmlElement('w:r')
    start = OxmlElement('w:fldChar')
    start.set(qn('w:fldCharType'), 'begin')
    r.append(start)
    p._p.append(r)
    r = OxmlElement('w:r')
    text = OxmlElement('w:instrText')
    text.set(qn('xml:space'), 'preserve')
    text.text = instruction
    r.append(text)
    p._p.append(r)
    r = OxmlElement('w:r')
    middle = OxmlElement('w:fldChar')
    middle.set(qn('w:fldCharType'), 'separate')
    r.append(middle)
    p._p.append(r)
    set_font(p.add_run(cached))
    r = OxmlElement('w:r')
    end = OxmlElement('w:fldChar')
    end.set(qn('w:fldCharType'), 'end')
    r.append(end)
    p._p.append(r)


# A short chapter directory mirrors the supplied reference's opening directory.
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(13)
p.paragraph_format.space_after = Pt(24)
set_font(p.add_run('目录'), '黑体', 16)
toc_paragraphs = []
for text, depth, page in [
    ('第三章 课程管理', 0, 2),
    ('3.1 概述', 1, 2),
    ('3.2 新建课程', 1, 3),
    ('3.2.1 填写基本信息', 2, 3),
    ('3.2.2 录入学生名单', 2, 3),
    ('3.2.3 确认完成', 2, 3),
    ('3.3 学生名单维护', 1, 4),
    ('3.4 课程信息与概要', 1, 5),
    ('3.4.1 修改课程信息', 2, 5),
    ('3.4.2 查看课程概要', 2, 5),
    ('3.5 删除课程', 1, 6),
    ('3.5.1 删除操作', 2, 6),
    ('3.5.2 删除限制与影响', 2, 6),
]:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(depth * .45)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(5)
    tabs = p.paragraph_format.tab_stops
    from docx.enum.text import WD_TAB_ALIGNMENT, WD_TAB_LEADER
    tabs.add_tab_stop(Cm(14.63), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    set_font(p.add_run(text + '\t'))
    toc_paragraphs.append((p, page))

targets = []
targets.append(heading('第三章 课程管理', 1, True))
para('本章主要介绍如何在“一堂课”中创建课程、录入和维护学生名单、修改课程信息、查看课程概要以及删除课程，为后续签到、作业管理和学情分析做好准备。')
targets.append(heading('3.1 概述'))
para('课程管理用于集中维护课程名称、学期、课程备注和学生名单。教师在左侧导航中点击“课程管理”，即可查看课程列表，如图1所示。')
add_picture(FIG1, '图1. 课程列表与常用入口', 14.63)
para('① 点击“＋ 新建课程”，按“基本信息→名单录入→确认完成”的顺序创建课程。')
para('② 输入课程名称进行搜索，或选择学期筛选课程；同时使用时，列表显示同时满足两个条件的课程。')
para('③ 查看课程卡片中的课程名称、学期、名单人数和签到记录次数，点击“管理课程”或“继续完善”进入维护页面。')
para('课程有学生名单时显示“已就绪”；尚无名单时显示“待录入名单”。“已就绪”表示已录入名单，不代表课件、教案等其他准备工作全部完成。', before=5)

targets.append(heading('3.2 新建课程', new_page=True))
para('在课程列表右上角点击“＋ 新建课程”，按以下步骤完成课程准备。')
targets.append(heading('3.2.1 填写基本信息', 3))
para('第1步：填写必填的“课程名称”和“学期”，分别最多80个、40个字符，例如“高等数学（上）”“2026 秋”。可在课程名称中注明班级，便于查找。')
para('第2步：按需填写“课程备注”，例如教学对象或其他说明，最多300个字符，也可留空。')
para('第3步：点击“下一步：名单录入”。系统保存基本信息后进入下一步；缺少必填项时，按提示补齐后继续。')
para('注意：进入名单录入后，课程基本信息已经保存。此时返回列表会保留课程；需要撤销时，按3.5节删除课程。')
targets.append(heading('3.2.2 录入学生名单', 3))
para('第1步：选择“上传表格”，点击上传区域或将文件拖入。支持.xlsx、.csv，每次一份，最大20MB；前两列依次为学号、姓名。Excel读取第一张工作表，.xls须先另存为.xlsx。')
para('第2步：也可选择“粘贴名单”，每行一人，学号与姓名以逗号、空格或Tab分隔，点击“预览并加入名单”。学号须为4位及以上数字，姓名不能为空。')
para('第3步：核对“当前名单”。有效学生会直接加入，重复学号或格式错误会单独提示；修正被跳过的内容后重新录入。维护方法见3.3节。')
para('第4步：点击“下一步：确认课程”；暂不录入可点“稍后录入名单”。粘贴框中有未处理内容时，须先处理再继续。')
targets.append(heading('3.2.3 确认完成', 3))
para('第1步：核对课程名称、学期、备注和名单人数。需调整时，点击对应区域的“修改”，或使用内容底部左侧的“上一步”返回。')
para('第2步：点击“完成并返回课程列表”。已录入名单时，卡片显示“已就绪”；未录入时显示“待录入名单”，可稍后补充。')

targets.append(heading('3.3 学生名单维护', new_page=True))
para('在课程卡片中点击“管理课程”或“继续完善”，进入课程维护页。“课程名单”区域支持追加名单和移除学生。图2为该区域在窄屏下的显示，操作与电脑端相同。')
add_picture(FIG2, '图2. 课程名单的录入与核对', 8.2)
para('① 选择“上传表格”或“粘贴名单”。两种方式均向当前课程追加有效学生，不会用新名单整体替换原名单。')
para('② 点击或拖拽上传表格；使用粘贴方式时，输入内容后点击“预览并加入名单”。核对新增人数、跳过行数和当前总人数，按提示修正重复或错误数据。')
para('③ 在学生名单中核对学号、姓名，确认需要移除后点击该行的“移除”。移除会直接生效，已有历史记录保留；名单变化仍可能影响按当前名单计算的历史统计，请谨慎操作。')
para('注意：上传、加入名单和移除学生均会直接保存，不需要再点击右侧的“保存信息”。同一课程不能重复导入相同学号；重复导入不会自动覆盖姓名。', before=5)

targets.append(heading('3.4 课程信息与概要', new_page=True))
para('课程维护页将课程概要、学生名单、基本信息和删除入口集中展示，无需像新建课程时逐步切换。')
heading('3.4.1 修改课程信息', 3)
para('第1步：在课程卡片中点击“管理课程”或“继续完善”，进入需要修改的课程。')
para('第2步：在右侧“基本信息”区域修改课程名称、学期或课程备注。课程名称和学期不能为空，长度限制与新建课程时相同。')
para('第3步：点击“保存信息”。看到“课程信息已保存”的提示后，核对页面标题、学期和备注是否正确。仅输入文字而未保存，不会完成课程基本信息的修改。')
para('修改课程名称、学期和备注后，学生名单及已有记录仍关联到原课程。同一门课换了授课班级或进入新学期、需要独立保存教学记录时，建议新建课程。')
heading('3.4.2 查看课程概要', 3)
para('页面顶部显示当前课程的四项概要信息：')
para('（1）课程名单：当前课程名单中的学生人数。追加或移除学生后，该人数会随之更新。')
para('（2）签到记录：该课程已有的签到记录次数，不是到课学生人数；查看具体出勤情况时，应进入签到相关页面。')
para('（3）课程作业：该课程关联的作业数量；当前统计同时包含未绑定具体作业的独立批改批次，不表示已经完成批改或提交的学生人数。')
para('（4）准备状态：已有学生名单时为“已就绪”，没有名单时为“待录入名单”。该状态用于提示名单准备情况。')
para('查看或修改完成后，点击页面右上角“返回课程列表”，即可选择其他课程。若刚修改过基本信息，请先点击“保存信息”。', before=5)

targets.append(heading('3.5 删除课程', new_page=True))
para('课程不再需要使用时，可在课程维护页删除。操作前应核对课程名称、学期、名单人数和关联记录；重要教学资料建议先通过“数据与备份”保留完整备份。')
heading('3.5.1 删除操作', 3)
para('第1步：在课程列表中找到目标课程，点击“管理课程”或“继续完善”。核对页面顶部的课程名称和学期，确认没有选错课程。')
para('第2步：在课程维护页右下方找到“删除课程”区域，点击红框“删除课程”按钮，展开确认区域。')
para('第3步：阅读确认区域中的课程名称、学生人数、签到记录次数及删除后的影响。不再删除时，点击“取消”。')
para('第4步：确需删除时，点击“确认删除课程”。操作成功后返回课程列表，并显示“课程已删除，原始数据已保留”；核对该课程已从列表中移除。')
heading('3.5.2 删除限制与影响', 3)
para('（1）该课程正在进行签到，或有正在运行的作业批改时，系统会阻止删除，并提示先结束相应任务。按正常流程完成或结束任务后，再返回核对并操作。')
para('（2）删除后，该课程及其关联作业、批改记录会从相关日常业务入口隐藏；原始名单、签到记录和文件会保留。原始数据保留不代表可以在页面中直接恢复课程。')
para('（3）删除前请完成必要备份。当前课程管理页面没有提供恢复按钮；不要通过再次创建同名课程来替代恢复，新的同名课程不会自动继承原课程记录。')
para('（4）“返回课程列表”和“取消”仅用于返回或取消当前确认，不会回退此前已经保存的课程信息或名单变更。', before=5)

# The directory uses real bookmarks and PAGEREF fields, keeping it editable.
# Include the lower-level headings that were intentionally listed above.
all_headings = []
for p in doc.paragraphs:
    if p.style.name.startswith('Heading'):
        starts = p._p.findall(qn('w:bookmarkStart'))
        if starts:
            all_headings.append((p.text, starts[0].get(qn('w:name'))))
lookup = dict(all_headings)
for p, page in toc_paragraphs:
    label = p.text.rstrip('\t')
    field(p, f' PAGEREF {lookup[label]} \\h ', str(page))

props = doc.core_properties
props.title = '第三章 课程管理'
props.subject = '一堂课操作手册'
props.author = ''
props.last_modified_by = ''
props.comments = ''
props.keywords = '课程管理,操作手册'

settings = doc.settings._element
update = settings.find(qn('w:updateFields'))
if update is None:
    update = OxmlElement('w:updateFields')
    settings.append(update)
update.set(qn('w:val'), 'true')

# Remove reference-document media and links that the new body no longer uses.
used_rel_ids = set(doc._element.xpath('//@r:embed | //@r:id | //@r:link'))
for rel_id, rel in list(doc.part.rels.items()):
    if rel.reltype.endswith(('/image', '/hyperlink')) and rel_id not in used_rel_ids:
        doc.part.drop_rel(rel_id)

FILE = OUT.parent.parent / 'Word文档' / '第三章 课程管理.docx'
doc.save(FILE)
(OUT / '第三章 课程管理.md').write_text('\n'.join(md), encoding='utf-8')
manifest = {
    'output': str(FILE),
    'template': str(REFERENCE),
    'image_sources': [
        'docs/ui-course-2026-10-26/verification/course-list-desktop.png',
        'docs/ui-course-2026-10-26/verification/course-management-mobile.png',
    ],
    'image_handling': 'Cropped genuine stored formal-page screenshots; red outlined areas and white digits on red circles; fictional sample data only.',
    'verification': 'Current course HTML and server behavior reviewed; course management in-memory check passed. Live screenshot capture stopped because browser URL could not be confirmed. No production data used.',
    'paragraphs': len(doc.paragraphs),
    'figures': len(doc.inline_shapes),
}
(QA / 'source-and-checks.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
check = Document(FILE)
assert len(check.inline_shapes) == 2
assert len([p for p in check.paragraphs if p.style.name == 'Heading 2']) == 5
assert [p.text for p in check.paragraphs if p.style.name == 'Heading 1'] == ['第三章 课程管理']
assert '确认删除课程' in '\n'.join(p.text for p in check.paragraphs)
assert len(check.sections) == 1
print(json.dumps(manifest, ensure_ascii=False))
