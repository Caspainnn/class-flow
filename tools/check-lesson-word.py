"""Independent DOCX package check using only Python's standard library (no Word visual claim)."""
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

p=Path(sys.argv[1]) if len(sys.argv)>1 else Path('docs/lesson-plan/review/虚构10分钟教案.docx')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(p) as z:
    for name in ('[Content_Types].xml','_rels/.rels','word/document.xml'):
        ET.fromstring(z.read(name))
    document=ET.fromstring(z.read('word/document.xml'))
tables=document.findall('.//w:tbl',ns)
assert len(tables)==5
texts=[''.join(x.itertext()) for x in document.findall('./w:body/w:p',ns)]
assert len([x for x in texts if x and x[0] in '一二三四五六七八九' and '、' in x])==9
for row in tables[-1].findall('w:tr',ns)[1:]:
    assert not ''.join(row.findall('w:tc',ns)[2].itertext())
assert any('4+3' in ''.join(c.itertext()) and '7' in ''.join(c.itertext()) for c in tables[2].findall('.//w:tc',ns))
assert not any('input.json' in x for x in texts)
assert document.findall('.//w:t',ns)
print('Independent Python DOCX parse: valid XML, 5 native tables, 9 sections, concrete exit question, blank actual reflection PASS')
