from pathlib import Path
import hashlib, json, re
import pypdfium2 as pdfium
from docx import Document

WORK = Path(__file__).parent
QA = WORK / '排版检查'
manifest = json.loads((QA / '内容与配图依据.json').read_text(encoding='utf-8'))
doc = Document(manifest['output'])

assert hashlib.sha256(Path(manifest['reference']).read_bytes()).hexdigest() == manifest['reference_sha256']
for item in manifest['figures']:
    assert hashlib.sha256(Path(item['source']).read_bytes()).hexdigest() == item['sha256']
    for index, first in enumerate(item['boxes']):
        for second in item['boxes'][index + 1:]:
            separated = (
                max(first[0], second[0]) >= min(first[2], second[2])
                or max(first[1], second[1]) >= min(first[3], second[3])
            )
            assert separated, item['source']

assert len(doc.sections) == 1
assert len(doc.inline_shapes) == 11

pdf = pdfium.PdfDocument(str(QA / '第七章内部预览.pdf'))
page_texts = []
for index, page in enumerate(pdf):
    text_page = page.get_textpage()
    text = text_page.get_text_range()
    page_texts.append(text)
    text_page.close()
    page.render(scale=1.8).to_pil().save(QA / f'page-{index + 1:02d}.png')
    page.close()

all_text = '\n'.join(page_texts)
assert '错误!' not in all_text and 'Error!' not in all_text
normalized = re.sub(r'\s+', '', all_text)
assert all(f'图{index}.' in normalized for index in range(1, 12))

for heading, level, bookmark in manifest['headings']:
    positions = [
        index + 1
        for index, text in enumerate(page_texts)
        if heading.replace(' ', '') in text.replace(' ', '').replace('\r', '').replace('\n', '')
    ]
    assert positions, heading

for index, text in enumerate(page_texts):
    compact = text.replace('\r', '').replace('\n', ' | ')
    print(f'{index + 1:02d}: {compact[:210]}')

report = {
    'pages': len(pdf),
    'figures': len(doc.inline_shapes),
    'level3_coverage': manifest['coverage'],
    'reference_unchanged': True,
    'original_screenshots_unchanged': True,
    'page_geometry': {
        'width': doc.sections[0].page_width,
        'height': doc.sections[0].page_height,
    },
}
(QA / '检查结果.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
