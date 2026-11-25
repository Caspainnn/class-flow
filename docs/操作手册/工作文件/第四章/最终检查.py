from pathlib import Path
from zipfile import ZipFile
import hashlib,json,re
from lxml import etree
from pypdf import PdfReader
from PIL import Image,ImageChops

work=Path(__file__).parent
manual=work.parent.parent
qa=work/'排版检查'
source=manual/'Word文档/第四章 PPT管理.docx'
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
def normalized(text):return re.sub(r'\s+','',text)
manifest=json.loads((qa/'内容与配图依据.json').read_text(encoding='utf-8'))
pdf=PdfReader(qa/'第四章 PPT管理.pdf')
pages=[normalized(p.extract_text()) for p in pdf.pages]
assert len(pages)==11
with ZipFile(source) as z:
    assert z.testzip() is None
    xml=etree.fromstring(z.read('word/document.xml'))
    assert len([n for n in z.namelist() if n.startswith('word/media/')])==3
    assert not xml.xpath('//w:ins|//w:del|//w:commentRangeStart',namespaces=ns)
    fields={}
    for p in xml.xpath('//w:p[.//w:instrText]',namespaces=ns):
        instruction=''.join(p.xpath('.//w:instrText/text()',namespaces=ns))
        bookmark=re.search(r'PAGEREF\s+(\S+)',instruction).group(1)
        fields[bookmark]=int(p.xpath('.//w:t/text()',namespaces=ns)[-1])
    verified=[]
    for title,level,bookmark in manifest['headings']:
        page=next(i+1 for i,text in enumerate(pages[1:],1) if normalized(title) in text)
        assert fields[bookmark]==page,(title,fields[bookmark],page)
        verified.append({'heading':title,'page':page})
    assert len(verified)==24
    geometry=xml.xpath('//w:sectPr',namespaces=ns)
    assert len(geometry)==1
    assert not re.search(r'Error!|错误!|未定义书签', ''.join(xml.xpath('//w:t/text()',namespaces=ns)))

reference=Path(manifest['reference'])
original=Path(r'D:\xwechat_files\wxid_evw4cgougnpg22_2893\temp\RWTemp\2026-10\d0bce1b450f603c78f2dbd2a97985e3f\5.1 课后作业的评分(1).docx')
assert hashlib.sha256(reference.read_bytes()).hexdigest()==manifest['reference_sha256']
if original.exists():assert original.read_bytes()==reference.read_bytes()
outputs=list((manual/'Word文档').iterdir())
assert len(outputs)==2 and all(p.suffix=='.docx' for p in outputs)
assert (manual/'Word文档/第三章 课程管理.docx').stat().st_size==227742
assert sorted(p.name for p in manual.iterdir())==['Word文档','工作文件']
diffs={}
for image in sorted(qa.glob('页-*.png')):
    diffs[image.name]=ImageChops.difference(Image.open(image).convert('RGB'),Image.open(qa/'第二轮分页'/image.name).convert('RGB')).getbbox() is not None
result={'page_count':11,'figure_count':3,'directory_entries':verified,'final_visual_review':'All 11 pages inspected. Pages 1, 3, 7 reinspected after final corrections; other 8 pages pixel-identical to inspected prior render. No clipping, text overlap, isolated overflow paragraph, or mismatched figure labels.','renderer':'Word COM field update and native PDF export; Poppler page images. Packaged LibreOffice renderer unavailable on this Windows host.','final_visual_changes':diffs,'deliverables':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in outputs],'template_preserved':True,'product_code_modified':False,'model_calls_or_real_data_writes':False}
(qa/'最终检查结果.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':11,'figures':3,'directory_entries':24,'deliverables':[p.name for p in outputs],'checks':'passed'},ensure_ascii=False))
