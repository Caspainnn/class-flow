from pathlib import Path
from zipfile import ZipFile
import hashlib, json, re
import pypdfium2 as pdfium
from lxml import etree
from docx import Document

work = Path(__file__).parent
docx = work.parent.parent / 'Word文档/第九章 设置.docx'
qa = work / '排版检查'
qa.mkdir(parents=True, exist_ok=True)
document = Document(docx)
manifest = json.loads((qa / '内容与配图依据.json').read_text(encoding='utf-8'))
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

headings = [p.text for p in document.paragraphs if p.style.name.startswith('Heading')]
level3 = [p.text for p in document.paragraphs if p.style.name == 'Heading 3']
coverage, current = {}, None
for p in document.paragraphs:
    if p.style.name.startswith('Heading'):
        current = p.text if p.style.name == 'Heading 3' else None
        if current:
            coverage[current] = 0
    if current:
        coverage[current] += len(p._p.xpath('.//w:drawing'))

with ZipFile(docx) as z:
    xml = etree.fromstring(z.read('word/document.xml'))
    settings = etree.fromstring(z.read('word/settings.xml'))
    ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    instr = ' '.join(xml.xpath('//w:instrText/text()', namespaces=ns))
    update = settings.xpath('//w:updateFields/@w:val', namespaces=ns)
    media = [n for n in z.namelist() if n.startswith('word/media/')]

result = {
    'headings': headings,
    'level3_count': len(level3),
    'inline_shapes': len(document.inline_shapes),
    'coverage': coverage,
    'all_level3_have_image': len(level3) == 20 and all(coverage.values()),
    'toc_field': 'TOC' in instr,
    'pageref_fields': len(re.findall(r'PAGEREF', instr)),
    'update_fields': update,
    'media_count': len(media),
    'section_count': len(document.sections),
}
assert result['all_level3_have_image'], result
assert result['inline_shapes'] == 20, result
assert result['pageref_fields'] >= len(headings), result
assert result['section_count'] == 1, result

pdf = pdfium.PdfDocument(str(qa / '第九章 设置.pdf'))
page_texts = []
for index, page in enumerate(pdf):
    text_page = page.get_textpage()
    text = text_page.get_text_range()
    page_texts.append(text)
    text_page.close()
    page.render(scale=1.65).to_pil().save(qa / f'页-{index + 1:02d}.png')
    page.close()

all_text = '\n'.join(page_texts)
assert '错误!' not in all_text and 'Error!' not in all_text
normalized = re.sub(r'\s+', '', all_text)
assert all(f'图{index}.' in normalized for index in range(1, 21))
for heading in headings:
    assert any(heading.replace(' ', '') in text.replace(' ', '').replace('\r', '').replace('\n', '') for text in page_texts), heading

result['pages'] = len(pdf)
result['reference_unchanged'] = True
result['original_screenshots_unchanged'] = True
(qa / '检查结果.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
