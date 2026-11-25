from pathlib import Path
from copy import deepcopy
from io import BytesIO
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER

root=Path.cwd()/'docs/操作手册'
files=list((root/'Word文档').glob('第?章 *.docx'))
order='一二三四五六七八九'
files.sort(key=lambda p:order.index(p.name[1]))
assert [f.name[1] for f in files]==list(order)
files[0]=root/'工作文件/第一章/第一章 工作台.docx'
master=Document(files[0])
for element in list(master._body._element):
    if element.tag!=qn('w:sectPr'):
        master._body._element.remove(element)

def font(run,name,size):
    run.font.name=name
    run.font.size=Pt(size)
    run.font.color.rgb=RGBColor(0,0,0)
    run._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),name)

def centered(value,size,before):
    p=master.add_paragraph()
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before=Pt(before)
    font(p.add_run(value),'黑体',size)
    return p

centered('一堂课平台操作手册',26,150)
centered('教师端使用说明',14,18)
intro=centered('从课前备课、课堂签到到课后作业与学情分析',12,32)
intro.paragraph_format.page_break_before=False
toc=centered('目录',18,0)
toc.paragraph_format.page_break_before=True
toc.paragraph_format.space_after=Pt(12)

def field(paragraph,anchor):
    node=OxmlElement('w:fldSimple')
    node.set(qn('w:instr'),f' PAGEREF {anchor} \\h ')
    node.set(qn('w:dirty'),'true')
    paragraph._p.append(node)

def bookmark(paragraph,anchor,number):
    start=OxmlElement('w:bookmarkStart')
    start.set(qn('w:id'),str(number))
    start.set(qn('w:name'),anchor)
    end=OxmlElement('w:bookmarkEnd')
    end.set(qn('w:id'),str(number))
    paragraph.insert(1 if len(paragraph) and paragraph[0].tag==qn('w:pPr') else 0,start)
    paragraph.append(end)

def title_text(node):
    return ''.join(node.xpath('.//w:t/text()')).strip()

def nav_row(label,level,anchor):
    p=master.add_paragraph()
    toc._p.addnext(p._p) if not entries else entries[-1]._p.addnext(p._p)
    entries.append(p)
    fmt=p.paragraph_format
    fmt.left_indent=Cm(.65 if level==2 else 0)
    fmt.space_before=Pt(5 if level==1 else 0)
    fmt.space_after=Pt(1)
    fmt.line_spacing=1.08
    fmt.keep_with_next=(level==1)
    fmt.tab_stops.add_tab_stop(Cm(14.3),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
    link=OxmlElement('w:hyperlink')
    link.set(qn('w:anchor'),anchor)
    p._p.append(link)
    run=p.add_run(label)
    font(run,'黑体' if level==1 else '仿宋',11)
    link.append(run._r)
    p.add_run('\t')
    field(p,anchor)

entries=[]
images=0
headings=[]
for chapter,source in enumerate(files,1):
    doc=Document(source)
    marker='第'+order[chapter-1]+'章'
    paragraphs=list(doc._body._element)
    matches=[i for i,node in enumerate(paragraphs) if node.tag==qn('w:p') and title_text(node).startswith(marker) and not node.xpath('.//w:instrText | .//w:fldSimple')]
    assert matches,(source,[(title_text(n),n.tag) for n in paragraphs[:5]])
    start=matches[-1]
    for index,source_node in enumerate(paragraphs[start:]):
        if source_node.tag==qn('w:sectPr'):
            continue
        node=deepcopy(source_node)
        for old in node.xpath('.//w:bookmarkStart | .//w:bookmarkEnd'):
            old.getparent().remove(old)
        for element in node.iter():
            for attr in ('r:embed','r:id','r:link'):
                attr=qn(attr)
                if attr not in element.attrib:
                    continue
                rel=doc.part.rels[element.get(attr)]
                if rel.reltype.endswith('/image') and not rel.is_external:
                    rid,_=master.part.get_or_add_image(BytesIO(rel.target_part.blob))
                    images+=1
                elif rel.is_external:
                    rid=master.part.relate_to(rel.target_ref,rel.reltype,is_external=True)
                else:
                    raise ValueError(rel.reltype)
                element.set(attr,rid)
        if node.tag==qn('w:p'):
            style=node.xpath('./w:pPr/w:pStyle/@w:val')
            text=title_text(node)
            level=1 if index==0 else 2 if (style==['Heading2'] or __import__('re').match(r'^'+str(chapter)+r'\.\d+\s',text)) else 0
            if level:
                from docx.text.paragraph import Paragraph
                p=Paragraph(node,master._body)
                p.style=f'Heading {level}'
                if level==1:
                    p.paragraph_format.page_break_before=True
                n=len(headings)+1
                anchor=f'manual_{n}'
                bookmark(node,anchor,n)
                nav_row(text,level,anchor)
                headings.append(text)
        master._body._element.insert_element_before(node,'w:sectPr')
update=master.settings._element.find(qn('w:updateFields'))
if update is None:
    update=OxmlElement('w:updateFields')
    master.settings._element.append(update)
update.set(qn('w:val'),'true')
for i,drawing in enumerate(master._element.xpath('.//wp:docPr'),1):
    drawing.set('id',str(i))
used=set(master._element.xpath('//@r:embed | //@r:id | //@r:link'))
for rid,rel in list(master.part.rels.items()):
    if rel.reltype.endswith(('/image','/hyperlink')) and rid not in used:
        master.part.drop_rel(rid)
master.core_properties.title='一堂课平台操作手册'
master.core_properties.subject='教师端操作手册'
output=root/'Word文档/一堂课平台操作手册.docx'
master.save(output)
check=Document(output)
assert len(check.inline_shapes)==images
assert len(check._element.xpath('.//w:bookmarkStart'))==len(entries)
assert len(check._element.xpath('.//w:fldSimple'))==len(entries)
assert len([p for p in check.paragraphs if p.style.name=='Heading 1'])==9
print('Chapters:',len(files),'Images:',images,'Directory entries:',len(entries),'Bytes:',output.stat().st_size)
print('\n'.join(headings))

