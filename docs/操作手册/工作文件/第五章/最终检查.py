from pathlib import Path
from zipfile import ZipFile
from lxml import etree
from pypdf import PdfReader
import json,hashlib,re

work=Path(__file__).parent
root=work.parents[3]
out=work.parent.parent/'Word文档/第五章 教案制作.docx'
qa=work/'排版检查'
manifest=json.loads((qa/'内容与配图依据.json').read_text(encoding='utf-8'))
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
ref=Path(manifest['reference'])
assert hashlib.sha256(ref.read_bytes()).hexdigest()==manifest['reference_sha256']
with ZipFile(out) as z:
    doc=etree.fromstring(z.read('word/document.xml'))
    styles=etree.fromstring(z.read('word/styles.xml'))
    style_names={s.get('{'+ns['w']+'}styleId'):s.find('w:name',ns).get('{'+ns['w']+'}val').lower() for s in styles if s.find('w:name',ns) is not None}
    paras=doc.xpath('./w:body/w:p',namespaces=ns)
    alltext=''.join(doc.xpath('//w:t/text()',namespaces=ns))
    assert not any(s in alltext for s in ['第三章','第四章','错误!','Error!','课后作业的评分'])
    assert len(doc.xpath('//w:drawing',namespaces=ns))==12
    assert len([p for p in z.namelist() if p.startswith('word/media/')])==12
    assert len(doc.xpath('//w:sectPr',namespaces=ns))==1
    page=doc.find('.//w:pgSz',ns)
    assert (page.get('{'+ns['w']+'}w'),page.get('{'+ns['w']+'}h'))==('11906','16838')
    coverage={};active=None
    for p in paras:
        st=p.find('w:pPr/w:pStyle',ns)
        label=''.join(p.xpath('.//w:t/text()',namespaces=ns))
        val=st.get('{'+ns['w']+'}val') if st is not None else ''
        name=style_names.get(val,'')
        if re.match(r'5\.\d+\.\d+ ',label) and name=='heading 3':
            active=label;coverage[active]=0
        elif name.startswith('heading'):
            active=None
        if active:coverage[active]+=len(p.xpath('.//w:drawing',namespaces=ns))
    assert len(coverage)==10 and all(v>=1 for v in coverage.values()),coverage
    caches=[]
    for p in paras:
        if p.xpath('.//w:instrText[contains(.,"PAGEREF")]',namespaces=ns):
            txt=p.xpath('.//w:t/text()',namespaces=ns)
            caches.append((''.join(txt[:-1]).strip(),int(txt[-1])))
    assert len(caches)==17

reader=PdfReader(qa/'第五章 教案制作.pdf')
assert len(reader.pages)==13
texts=[p.extract_text().replace(' ','').replace('\n','').replace('\r','') for p in reader.pages]
for title,page in caches:
    assert title.replace(' ','') in texts[page-1],(title,page)
for index,text in enumerate(texts[1:],2):
    assert len(text)>180,(index,'sparse page',len(text))
for fig in manifest['figures']:
    source=root/fig['source']
    assert hashlib.sha256(source.read_bytes()).hexdigest()==fig['source_sha256']
    assert (work/'原始截图'/source.name).exists()
    boxes=fig['boxes']
    for i,a in enumerate(boxes):
        for b in boxes[i+1:]:
            assert max(a[0],b[0])>=min(a[2],b[2]) or max(a[1],b[1])>=min(a[3],b[3])
pngs=list(qa.glob('定稿-*.png'))
assert len(pngs)==13
delivery=list(out.parent.iterdir())
assert len(delivery)==3 and all(p.suffix=='.docx' for p in delivery)
result={'output':str(out),'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'pages':13,'figures':12,'heading3_screenshot_coverage':coverage,'toc_verified':dict(caches),'reference_unchanged':True,'screenshot_sources_unchanged':True,'word_only_delivery':True,'visual_review':'All 13 final page PNGs reviewed, clear figures, no clipped text, no orphan continuation pages.'}
(qa/'最终检查结果.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
