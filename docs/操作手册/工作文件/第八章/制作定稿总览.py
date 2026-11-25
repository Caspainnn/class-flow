from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

folder = Path(__file__).parent / '排版检查/定稿'
files = sorted(folder.glob('页-*.png'))
width, height = 520, 740
for start in range(0, len(files), 4):
    canvas = Image.new('RGB', (width * 2, height * 2), '#d8d8d8')
    draw = ImageDraw.Draw(canvas)
    for index, file in enumerate(files[start:start + 4]):
        image = ImageOps.contain(Image.open(file).convert('RGB'), (width - 16, height - 36))
        x = (index % 2) * width + 8
        y = (index // 2) * height + 28
        canvas.paste(image, (x, y))
        draw.text((x + 2, y - 22), file.stem, fill='black')
    canvas.save(folder / f'总览-{start // 4 + 1:02}.png')
