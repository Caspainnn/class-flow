from pathlib import Path
from zipfile import ZipFile
import json, re
from lxml import etree
from docx import Document

work = Path(__file__).parent
docx = work.parent.parent / 'Word文档/第八章 作业管理.docx'
qa = work / '排版检查'
qa.mkdir(parents=True, exist_ok=True)
document = Document(docx)

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
    'all_level3_have_image': len(level3) == 18 and all(coverage.values()),
    'toc_field': 'TOC' in instr,
    'pageref_fields': len(re.findall(r'PAGEREF', instr)),
    'update_fields': update,
    'media_count': len(media),
    'section_count': len(document.sections),
}
assert result['all_level3_have_image'], result
assert result['inline_shapes'] == 18, result
assert result['pageref_fields'] >= len(headings), result
# Word removes w:updateFields after refreshing the cached PAGEREF values.
assert result['section_count'] == 1, result
(qa / '检查结果.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
