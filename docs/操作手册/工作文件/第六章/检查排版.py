from pathlib import Path
import json,hashlib,re
import pypdfium2 as pdfium
from docx import Document
from PIL import Image,ImageDraw
WORK=Path(__file__).parent;QA=WORK/'排版检查'
manifest=json.loads((QA/'内容与配图依据.json').read_text(encoding='utf-8'))
doc=Document(manifest['output'])
assert hashlib.sha256(Path(manifest['reference']).read_bytes()).hexdigest()==manifest['reference_sha256']
for item in manifest['figures']:
    assert hashlib.sha256(Path(item['source']).read_bytes()).hexdigest()==item['sha256']
    for a_i,a in enumerate(item['boxes']):
        for b in item['boxes'][a_i+1:]:
            assert max(a[0],b[0])>=min(a[2],b[2]) or max(a[1],b[1])>=min(a[3],b[3]),item['source']
assert len(doc.sections)==1 and len(doc.inline_shapes)==17
pdf=pdfium.PdfDocument(str(QA/'第六章内部预览.pdf'))
page_texts=[]
for i,page in enumerate(pdf):
    text_page=page.get_textpage();text=text_page.get_text_range();page_texts.append(text);text_page.close()
    page.render(scale=1.55).to_pil().save(QA/f'page-{i+1:02d}.png')
    page.close()
text='\n'.join(page_texts)
assert '错误!' not in text and 'Error!' not in text
normalized=re.sub(r'\s+','',text)
assert all(f'图{i}.' in normalized for i in range(1,18))
for heading,level,bookmark in manifest['headings']:
    positions=[i+1 for i,t in enumerate(page_texts) if heading.replace(' ','') in t.replace(' ','').replace('\r','').replace('\n','')]
    assert positions,heading
for i,t in enumerate(page_texts):
    print(f'{i+1:02d}: '+t.replace('\r','').replace('\n',' | ')[:190])
report={'pages':len(pdf),'figures':len(doc.inline_shapes),'level3_coverage':manifest['coverage'],'reference_unchanged':True,'original_screenshots_unchanged':True,'page_geometry':{'width':doc.sections[0].page_width,'height':doc.sections[0].page_height}}
(QA/'检查结果.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
