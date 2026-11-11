# Готовит окончательные картинки из ..\art для игры (уменьшает, убирает белый фон).
# Запуск: python tools/make_art.py   Результат: assets\art\
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(os.path.dirname(ROOT), 'art')
OUT = os.path.join(ROOT, 'assets', 'art')
os.makedirs(OUT, exist_ok=True)


def save(img, name, q=80):
    path = os.path.join(OUT, name)
    img.save(path, 'WEBP', quality=q, method=6)
    print(f'{name:28s} {img.size}  {os.path.getsize(path) // 1024} KB')


def bbox_of(mask):
    ys, xs = np.where(mask)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


# --- столы: 1080x1920 ---
for src, name in (('table_01_library.jpg', 'table_library'), ('table_02_kitchen.jpeg', 'table_kitchen'),
                  ('table_03_tearoom.jpeg', 'table_tearoom'), ('table_04_lighthouse.jpeg', 'table_lighthouse'),
                  ('study_board.png', 'study_board')):
    im = Image.open(os.path.join(ART, src)).convert('RGB').resize((1080, 1920), Image.LANCZOS)
    save(im, name + '.webp', 78)

# --- карта ---
im = Image.open(os.path.join(ART, 'map_clean.jpeg')).convert('RGB').resize((1080, 1920), Image.LANCZOS)
save(im, 'map.webp', 80)

# --- рубашка: берём красное поле с орнаментом, кремовый кант и скругление рисует код ---
im = Image.open(os.path.join(ART, 'card_back.jpg')).convert('RGB')
a = np.asarray(im).astype(int)
red = (a[:, :, 0] > 90) & (a[:, :, 0] - a[:, :, 1] > 50) & (a[:, :, 0] - a[:, :, 2] > 50)
rows = np.where(red.mean(axis=1) > 0.3)[0]
cols = np.where(red.mean(axis=0) > 0.3)[0]
box = (cols.min(), rows.min(), cols.max() + 1, rows.max() + 1)
back = im.crop(box).resize((280, 420), Image.LANCZOS)
save(back, 'card_back_art.webp', 86)

# --- бумага лицевой стороны: середина листа, без краёв ---
im = Image.open(os.path.join(ART, 'card_face_paper.jpg')).convert('RGB')
w, h = im.size
paper = im.crop((int(w * 0.34), int(h * 0.2), int(w * 0.66), int(h * 0.8))).resize((312, 468), Image.LANCZOS)
save(paper, 'card_paper.webp', 84)

# --- круглая кнопка: вырезаем круг ---
im = Image.open(os.path.join(ART, 'button_round.jpg')).convert('RGB')
a = np.asarray(im).astype(int)
notwhite = (a.min(axis=2) < 200)
x0, y0, x1, y1 = bbox_of(notwhite)
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
r = min(x1 - x0, y1 - y0) / 2 - 3
S = 4
mask = Image.new('L', (im.width, im.height), 0)
ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(1.5))
btn = im.convert('RGBA')
btn.putalpha(mask)
btn = btn.crop((int(cx - r - 4), int(cy - r - 4), int(cx + r + 4), int(cy + r + 4))).resize((300, 300), Image.LANCZOS)
save(btn, 'button_round.webp', 88)

# --- портрет Эдит: круг по лицу ---
im = Image.open(os.path.join(ART, 'edith_portrait.jpeg')).convert('RGB')
cx, cy, r = 1260, 900, 640
ed = im.crop((cx - r, cy - r, cx + r, cy + r)).resize((360, 360), Image.LANCZOS).convert('RGBA')
mask = Image.new('L', (360 * S, 360 * S), 0)
ImageDraw.Draw(mask).ellipse((0, 0, 360 * S - 1, 360 * S - 1), fill=255)
ed.putalpha(mask.resize((360, 360), Image.LANCZOS))
save(ed, 'edith.webp', 86)

# --- улики: 440x440 с прозрачным фоном ---
for n in range(1, 13):
    im = Image.open(os.path.join(ART, 'clues', f'clue{n:02d}.png')).convert('RGBA').resize((440, 440), Image.LANCZOS)
    save(im, f'clue{n:02d}.webp', 84)
