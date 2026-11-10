# Временные картинки из референсов (куски без надписей). Запуск: python tools/make_temp_assets.py
# Референсы лежат вне репозитория: ..\референсы. Результат: assets\temp\
import os
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(os.path.dirname(ROOT), 'референсы')
OUT = os.path.join(ROOT, 'assets', 'temp')
os.makedirs(OUT, exist_ok=True)


def ref(n):
    name = [f for f in os.listdir(REF) if f.startswith(f'{n}.')][0]
    return Image.open(os.path.join(REF, name)).convert('RGB')


def cover(img, w, h):
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (img.width - w) // 2
    y = (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def save(img, name, q=78):
    img.save(os.path.join(OUT, name), quality=q, optimize=True, progressive=True)
    print(name, img.size, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')


# Фон «набережная с маяком»: левая полоса реф. 1 (без логотипа и кнопок)
r1 = ref(1)
bg = cover(r1.crop((0, 1040, 412, 2100)), 810, 1620)
bg = bg.filter(ImageFilter.GaussianBlur(2.2))
bg = ImageEnhance.Brightness(bg).enhance(0.82)
save(bg, 'bg_harbor.jpg', 72)

# Фон «гавань в тумане»: левый верх реф. 7 (без названия)
r7 = ref(7)
bg = cover(r7.crop((0, 0, 470, 587)), 810, 1620)
bg = bg.filter(ImageFilter.GaussianBlur(5))
bg = ImageEnhance.Brightness(bg).enhance(0.62)
save(bg, 'bg_fog.jpg', 68)

# Эдит Вэйл (канон: реф. 7)
ed = r7.crop((90, 987, 550, 1790)).resize((460, 803), Image.LANCZOS)
save(ed, 'edith.jpg', 82)

# Карта городка: реф. 6 без заголовка, бокового меню и нижней панели; надписи размыты
r6 = ref(6)
mp = r6.crop((0, 412, 1387, 2025))
spots = [  # (cx, cy, w, h) в координатах показанной картинки 1333x2000
    (258, 395, 150, 50), (258, 455, 150, 150), (462, 380, 150, 70),
    (862, 325, 160, 50), (862, 400, 170, 170), (850, 505, 320, 70),
    (320, 735, 220, 110), (765, 810, 300, 110),
    (1005, 805, 160, 50), (1005, 870, 150, 150), (1005, 955, 150, 60),
    (965, 1155, 250, 120),
    (360, 1012, 160, 50), (360, 1085, 150, 150), (360, 1160, 150, 60),
    (345, 1390, 220, 120),
    (850, 1218, 160, 50), (850, 1285, 150, 150), (850, 1360, 150, 60),
    (755, 1555, 240, 110),
]
blurred = mp.filter(ImageFilter.GaussianBlur(26))
mask = Image.new('L', mp.size, 0)
d = ImageDraw.Draw(mask)
for cx, cy, w, h in spots:
    x, y = cx * 1.25, cy * 1.25 - 412
    w, h = w * 1.25, h * 1.25
    d.ellipse((x - w / 2, y - h / 2, x + w / 2, y + h / 2), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(14))
mp = Image.composite(blurred, mp, mask)
mp = mp.resize((1080, round(1080 * mp.height / mp.width)), Image.LANCZOS)
save(mp, 'map.jpg', 76)

# Портреты подозреваемых: лица с карточек реф. 5
r5 = ref(5)
for name, x0 in (('blake', 106), ('burke', 366), ('everly', 631), ('marsh', 868)):
    p = r5.crop((round(x0 * 1.25), round(695 * 1.25), round((x0 + 170) * 1.25), round(978 * 1.25)))
    p = p.resize((340, 566), Image.LANCZOS)
    save(p, f'portrait_{name}.jpg', 84)
