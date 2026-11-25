from pathlib import Path
import json
from PIL import Image,ImageOps,ImageDraw,ImageFont
root=Path(r'E:\MyProjects\Inclass')
work=Path(__file__).parent
for part in ['图片','原始截图','排版检查']:(work/part).mkdir(parents=True,exist_ok=True)
names=['library-card-refresh.png','teacher-basic-requirements.png','chapter-save-and-version.png','version-name-dialog.png','floating-section-actions.png','board-row-menu.png','reflection-grid-menu.png','bounded-workbuddy-progress.png','process-heading.png']
canvas=Image.new('RGB',(1800,430*5),'#e8e8e8');draw=ImageDraw.Draw(canvas)
font=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',18)
items=[]
for i,name in enumerate(names):
    source=root/'docs/lesson-plan/detail-review'/name
    im=Image.open(source).convert('RGB');items.append({'index':i,'source':str(source),'size':im.size})
    small=ImageOps.contain(im,(880,390));x=(i%2)*900;y=(i//2)*430
    canvas.paste(small,(x,y+32));draw.text((x+8,y+4),f'{i} {name} {im.size}',font=font,fill='black')
canvas.save(work/'排版检查/截图选取.png')
(work/'排版检查/截图清单.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(items,ensure_ascii=False))
