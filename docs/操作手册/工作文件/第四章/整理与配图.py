from pathlib import Path
import shutil, json, hashlib
from PIL import Image, ImageOps, ImageDraw, ImageFont

root=Path(r'E:\MyProjects\Inclass')
manual=root/'docs/操作手册'
delivery=manual/'Word文档'
work=manual/'工作文件'
chapter3=work/'第三章'
chapter4=work/'第四章'
for p in [delivery,chapter3/'图片',chapter3/'排版检查',chapter4/'图片',chapter4/'原始截图',chapter4/'排版检查',work/'参考模板']:
    p.mkdir(parents=True,exist_ok=True)
def move(source,target):
    if source.exists():
        if target.exists(): raise FileExistsError(str(target))
        shutil.move(str(source),str(target))
move(manual/'第三章 课程管理.docx',delivery/'第三章 课程管理.docx')
move(manual/'第三章 课程管理.md',chapter3/'第三章 课程管理.md')
move(manual/'第三章 课程管理.pdf',chapter3/'排版检查/第三章 课程管理.pdf')
move(manual/'参考模板/排版参考.docx',work/'参考模板/排版参考.docx')
if (manual/'图片').exists():
    for f in (manual/'图片').iterdir(): move(f,chapter3/'图片'/f.name)
    (manual/'图片').rmdir()
if (manual/'参考模板').exists(): (manual/'参考模板').rmdir()
old=Path(r'C:\Users\29263\.codex\visualizations\2026\11\06\01a1aee4-e582-7ac0-982a-654c01951e28')
for name in ['build_course_manual.py','export_manual.py']:
    move(old/name,chapter3/name)
if (old/'manual-qa').exists(): move(old/'manual-qa',chapter3/'排版检查/早期检查材料')

candidates=[
 'docs/ppt-template-management/prototype-review/formal-courseware.png',
 'docs/ppt-template-management/prototype-review/formal-templates.png',
 'docs/ppt-template-management/prototype-review/formal-template-detail.png',
 'docs/ppt-template-management/prototype-review/formal-template-original.png',
 'docs/ppt-preparation/real-review/element-upload.png',
 'docs/ppt-preparation/real-review/outline-inline-editor.png',
 'docs/ppt-preparation/real-review/execution-progress.png',
 'docs/ppt-preparation/real-review/generated-deck.png',
 'docs/ppt-preparation/real-review/manual-persisted.png',
 'docs/ppt-preparation/teacher20-review/ready.jpg',
 'docs/ppt-preparation/teacher20-review/html-revised.jpg',
 'docs/ppt-preparation/template-pages-review/complete.jpg',
]
font=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',18)
sheet=Image.new('RGB',(1800,420*6),'#e6e6e6')
draw=ImageDraw.Draw(sheet)
inventory=[]
for i,name in enumerate(candidates):
    source=root/name
    if not source.exists(): continue
    im=Image.open(source).convert('RGB')
    inventory.append({'index':i,'path':name,'size':im.size})
    thumb=ImageOps.contain(im,(880,380))
    x=(i%2)*900;y=(i//2)*420
    sheet.paste(thumb,(x,y+32))
    draw.text((x+8,y+5),f'{i} {source.name} ({im.width}x{im.height})',font=font,fill='black')
sheet.save(chapter4/'排版检查/截图选取.png')
(chapter4/'排版检查/截图清单.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(inventory,ensure_ascii=False))
