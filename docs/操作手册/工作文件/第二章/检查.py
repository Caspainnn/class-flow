from pathlib import Path
from PIL import Image,ImageOps
from zipfile import ZipFile
w=Path.cwd()/'docs/操作手册/工作文件/第二章'
canvas=Image.new('RGB',(1100,1120),'#eeeeee')
for i,p in enumerate(sorted((w/'图片').glob('*.png'))):
 im=Image.open(p);im.thumbnail((530,270))
 canvas.paste(im,(10+i%2*550,10+i//2*280))
canvas.save(w/'排版检查'/'配图总览.png')
out=w.parent.parent/'Word文档'/'第二章 数据看板.docx'
with ZipFile(out) as z:
 assert z.testzip() is None
 print('images:',len([s for s in z.namelist() if s.startswith('word/media/')]))
 print('PAGEREF:',z.read('word/document.xml').count(b'PAGEREF'))
 print('external attached template:',b'attachedTemplate' in z.read('word/settings.xml'))

