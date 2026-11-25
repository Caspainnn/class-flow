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
OUTPUT = MANUAL / 'Word文档/第九章 设置.docx'
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

    target = ASSETS / ('第九章-' + name + '-图例.png')
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


h('第九章 设置', 1, True)
p('本章介绍平台设置区域中 WorkBuddy、系统参数、学情预警规则以及数据与备份的配置方法。设置会影响后续签到、预警计算、作业批改和数据恢复，修改前应先核对当前页面和参数含义；涉及整体恢复时，应完成备份检查并确认影响范围。')

h('9.1 使用前准备')
p('第1步：确认平台在教师电脑本机运行，并已获得相应设置页面的访问权限。WorkBuddy 连接和程序路径属于当前电脑的本机配置。')
p('第2步：修改系统参数或预警规则前，记录原有数值，并确认是否有正在进行的签到、问卷回收、课件生成或作业批改任务。')
p('第3步：数据恢复会整体替换教学数据并重启平台。操作前应核对备份来源、检查结果和恢复后的数量；本章示例只展示流程，不执行真实恢复。')

h('9.2 配置 WorkBuddy', page=True)
h('9.2.1 查看连接状态', 3)
p('进入“设置 > WorkBuddy”。图中①查看连接状态、版本、账号状态和延迟，②核对检测到的程序位置。', True)
fig('01', '查看 WorkBuddy 连接状态')
p('显示“已连接”时，平台可在后台调用当前电脑上的 WorkBuddy。程序位置仅用于本机连接，不随教学数据备份迁移；升级 WorkBuddy 后若连接失效，应重新检测。')

h('9.2.2 重新检测或手动指定路径', 3, True)
p('图中①点击“重新检测”自动查找程序；自动检测无结果时，②打开手动输入区，粘贴 codebuddy 的完整路径并点击“检测并连接”。', True)
fig('02', '重新检测或手动指定 WorkBuddy 路径')
p('检测最多约需30秒。若反复提示超时，可先完全退出 WorkBuddy 桌面版再检测，或关闭系统代理后重试；仍不可用时，在作业批改页面改用“手动调用与导入”。')

h('9.2.3 断开 WorkBuddy 连接', 3, True)
p('图中①核对页面已显示“未连接”，②需要主动清除当前连接时点击“断开连接”。', True)
fig('03', '断开 WorkBuddy 连接')
p('断开后，依赖平台自动调用 WorkBuddy 的功能暂时不可用，但已保存的教学数据和批改结果不会删除。需要继续使用时，可重新检测或手动指定路径。')

h('9.2.4 设置作业批改参数', 3, True)
p('切换到“批改作业”。图中①选择批改模型，②设置单份文件超时秒数，③选择后台运行、对话历史和原始返回保留方式，④保存。', True)
fig('04', '设置 WorkBuddy 作业批改参数')
p('default 跟随 WorkBuddy 当前设置；deep-model 更适合需要充分推理的作业；fast-model 适合处理速度优先的任务。保存后参数用于后续平台自动批改，页面短暂显示“已保存”。')

h('9.3 配置系统参数', page=True)
h('9.3.1 设置签到参数', 3)
p('进入“设置 > 系统设置”。图中①设置二维码刷新间隔，②设置令牌宽限片数，③设置签到窗口，④设置迟到补签宽限，⑤设置答题凭证有效期，⑥保存。', True)
fig('05', '设置签到和答题参数')
p('二维码刷新间隔使用毫秒，签到窗口和答题凭证使用秒，迟到补签宽限使用分钟。端口为只读项，需要在外部修改 PORT 并重启平台。保存的签到参数从下一场签到开始生效。')

h('9.3.2 查看参数生效说明', 3, True)
p('图中①查看系统根据二维码刷新间隔和宽限片数计算出的实际有效时间，以及签到窗口和迟到范围；②确认后保存设置。', True)
fig('06', '查看系统参数的实际生效说明')
p('修改输入值时，说明会同步更新。实际二维码有效时间等于刷新间隔乘以“宽限片数加1”；应根据课堂网络和入场节奏设置，避免有效期过短或补签范围过宽。')

h('9.3.3 查看数据目录', 3, True)
p('图中①查看当前教学数据所在的本机目录，②点击“进入数据与备份”管理完整备份。', True)
fig('07', '查看教学数据目录和备份入口')
p('教学数据目录包含名单、课堂记录、作业附件、课件和模板。不要手工删除或移动其中的文件；需要留存、迁移或恢复时，应使用“数据与备份”页面。')

h('9.4 配置学情预警规则', page=True)
h('9.4.1 设置出勤预警', 3)
p('在“学情预警规则”中，图中①设置学生连续缺勤达到多少次时触发出勤预警。', True)
fig('08', '设置连续缺勤预警阈值')
p('该值按连续缺勤次数计算。预警用于提示教师复核签到记录和学生情况，不等同于最终认定；修改后应结合课程节奏确认阈值是否合适。')

h('9.4.2 设置答题预警', 3, True)
p('图中①设置统计最近几次课，②设置窗口内至少答题次数，③设置答对率低于多少时触发预警。', True)
fig('09', '设置答题预警窗口和答对率')
p('只有窗口内答题次数达到最低要求，系统才判断答对率。答对率按百分比填写，保存时会由系统规范化并限制在0至100范围内。')

h('9.4.3 设置作业预警', 3, True)
p('图中①设置作业未交次数阈值，②设置低分次数阈值，③设置低分线。', True)
fig('10', '设置作业未交和低分预警')
p('学生达到未交次数或低分次数条件时会进入相应预警。低分线按百分制填写并限制在0至100范围内；对非100分作业，应结合系统折算后的成绩理解预警结果。')

h('9.4.4 保存并核对预警规则', 3, True)
p('完成三类规则后，图中①点击“保存预警规则”，②确认页面显示保存成功。', True)
fig('11', '保存学情预警规则')
p('规则保存后会立即用于后续预警计算。进入学情分析查看命中结果时，应核对原始出勤、答题和作业记录；预警只用于发现需要关注的情况。')

h('9.5 管理数据与备份', page=True)
h('9.5.1 查看数据和备份状态', 3)
p('进入“设置 > 数据与备份”。图中①查看最近成功备份、当前教学数据和备份条件，②查看各类数据占用和保存位置。', True)
fig('12', '查看教学数据和备份概况')
p('只有未检测到进行中的签到、回收、生成或批改任务时，才可开始备份。页面显示课程、学生、课堂、作业、课件、教案和问卷等统计，路径信息只保存在本机。')

h('9.5.2 创建完整备份', 3, True)
p('图中①核对完整备份包含的教学范围，②阅读导出范围说明，③确认容量限制后点击“创建完整备份”。', True)
fig('13', '核对范围并创建完整备份')
p('完整备份包含教学数据、原始附件、历史版本、教学设置和软删除历史；不包含CLI登录态、机器连接配置、签到密钥和可重建预览缓存。展开数据上限1GB、单文件上限128MB、ZIP上限256MB，文件总数上限15000个。备份ZIP未加密，应妥善保管。')

h('9.5.3 查看和下载备份记录', 3, True)
p('在“备份记录”中点击“查看”。图中①核对备份时间、容量和各类教学内容数量，②返回记录列表；需要留存时可使用记录中的“下载”。', True)
fig('14', '查看备份记录的内容统计', 8.5)
p('记录显示创建时校验通过的内容，选择恢复时系统仍会重新检查完整性、兼容性、空间和当前数据。应根据创建时间和统计数量选择目标备份，不只依据文件名判断。')

h('9.5.4 选择恢复来源', 3, True)
p('点击“选择备份文件”。图中①查看当前恢复步骤，②点击或拖入本平台生成的ZIP备份，③需要放弃时从内容底部左侧返回备份首页。', True)
fig('15', '选择或拖入待恢复的备份包')
p('上传只在本机平台处理。仅支持非空且不超过256MB的ZIP备份；普通数据表不能用于整体恢复。也可在已有备份记录中点击“恢复”，直接进入检查步骤。')

h('9.5.5 检查备份内容', 3, True)
p('图中①核对备份文件和检查状态，②查看包格式、路径、文件大小、哈希、数据结构、附件引用和磁盘空间检查，③核对内容数量，④进入下一步或从底部左侧返回。', True)
fig('16', '检查备份完整性和教学内容')
p('本步骤只检查并暂存备份，不修改当前教学数据。任何一项检查失败时都不能继续恢复，应更换备份或处理磁盘空间后重新检查。')

h('9.5.6 确认恢复范围', 3, True)
p('图中①阅读整体替换和重启说明，②对比当前数据与恢复后数据，③勾选确认已知晓影响，④可重新检查或点击“恢复这份备份”；“上一步”位于内容底部左侧。', True)
fig('17', '对比并确认整体恢复范围')
p('恢复不是合并操作，会以备份内容整体替换当前教学数据。开始前系统先创建安全备份；旧课堂码将失效，回收中的问卷转为结束，后台生成任务不会自动重跑，本机工具登录和连接设置会保留。')

h('9.5.7 确认恢复并重启', 3, True)
p('点击“恢复这份备份”后，图中①再次核对将被整体替换的备份，②点击红框危险按钮“确认恢复并重启”；不继续时点击“暂不恢复”。', True)
fig('18', '最终确认恢复并重启平台')
p('这是会覆盖当前教学内容的高风险操作。只有确认备份来源、检查结果、数量对比和影响说明均无误时才可提交。恢复失败时平台会回滚到原数据，并保留原目录和安全备份。')

h('9.5.8 查看恢复进度', 3, True)
p('提交后，图中①查看平台正在恢复和重启的说明，②观察当前阶段和进度。', True)
fig('19', '查看数据恢复和重启进度')
p('恢复由独立进程完成，重启期间连接可能短暂中断，页面会继续查询任务状态。不要关闭电脑、重复启动平台或再次提交恢复。')

h('9.5.9 查看恢复结果', 3, True)
p('恢复结束后，图中①确认结果为“恢复完成”，②查看安全备份和原目录保留说明，③返回备份首页或查看当前数据。', True)
fig('20', '确认数据恢复完成')
p('完成后应核对课程、学生名单、课堂记录、作业附件、课件和问卷等教学资料，并检查本机 WorkBuddy 等工具连接。后台生成任务不会自动续跑，需要按实际情况重新启动。')

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
properties.title = '第九章 设置'
properties.subject = '操作手册'
properties.author = ''
properties.last_modified_by = ''
properties.comments = ''
properties.keywords = 'WorkBuddy,系统设置,预警规则,数据备份,数据恢复,操作手册'

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

assert len(check.inline_shapes) == 20
assert len(coverage) == 20 and all(coverage.values()), coverage

manifest = {
    'output': str(OUTPUT),
    'reference': str(REFERENCE),
    'reference_sha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
    'figures': figures,
    'headings': entries,
    'coverage': coverage,
    'source_files': [
        'server/grade/public/wbset.html',
        'server/public/admin.html',
        'server/backup/public/index.html',
        'server/backup/public/app.js',
        'server/backup/service.js',
        'server/backup/archive.js',
        'docs/data-backup/正式交付与验收.md',
    ],
    'isolated_fixture': capture['dataDirectory'],
}
(QA / '内容与配图依据.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'output': str(OUTPUT), 'figures': figure_no, 'level3': len(coverage), 'characters': sum(len(x.text) for x in check.paragraphs)}, ensure_ascii=False))
