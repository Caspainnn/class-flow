from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

work = Path(__file__).parent
files = sorted((work / '原始截图').glob('*.png'))
thumb_w, thumb_h = 540, 360
for start in range(0, len(files), 6):
    canvas = Image.new('RGB', (thumb_w * 2, thumb_h * 3), '#d8d8d8')
    draw = ImageDraw.Draw(canvas)
    for index, file in enumerate(files[start:start + 6]):
        image = ImageOps.contain(Image.open(file).convert('RGB'), (thumb_w - 16, thumb_h - 42))
        x = (index % 2) * thumb_w + 8
        y = (index // 2) * thumb_h + 34
        canvas.paste(image, (x, y))
        draw.text((x + 2, y - 25), file.stem, fill='black')
    canvas.save(work / f'原始截图总览-{start // 6 + 1:02}.png')
