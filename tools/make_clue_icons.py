# Временные значки улик (простые рисунки). Запуск: python tools/make_clue_icons.py
# Позже заменяются настоящими иллюстрациями с теми же именами (clue01 … clue12).
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'temp')
INK, MID, BRASS, CREAM, WINE, LILAC, STEEL = '#3f2c20', '#7a5a3c', '#c39a4e', '#f3e7cc', '#7a1f2b', '#9b86b8', '#a9b0b3'

ICONS = {
    # 1. бутылка коньяка
    1: f'''<rect x="92" y="22" width="16" height="14" rx="3" fill="{MID}"/>
<path d="M90 36h20v30c14 8 20 18 20 34v70a10 10 0 0 1-10 10H80a10 10 0 0 1-10-10v-70c0-16 6-26 20-34z" fill="{INK}"/>
<rect x="76" y="104" width="48" height="46" rx="4" fill="{BRASS}"/>
<rect x="84" y="114" width="32" height="5" fill="{INK}" opacity=".6"/><rect x="84" y="126" width="32" height="5" fill="{INK}" opacity=".6"/>
<rect x="88" y="44" width="24" height="8" fill="{BRASS}"/>''',
    # 2. фляжка и крышечка
    2: f'''<rect x="66" y="28" width="28" height="22" rx="4" fill="{MID}"/>
<path d="M44 62a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16v100a16 16 0 0 1-16 16H60a16 16 0 0 1-16-16z" fill="{STEEL}" stroke="{INK}" stroke-width="6"/>
<path d="M58 70v84" stroke="#fff" stroke-width="6" opacity=".6" stroke-linecap="round"/>
<path d="M134 138h36l-5 38h-26z" fill="{STEEL}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M138 150h28" stroke="{BRASS}" stroke-width="6"/>''',
    # 3. чайник и чашка
    3: f'''<ellipse cx="88" cy="112" rx="50" ry="42" fill="{INK}"/>
<path d="M134 100c22-4 30-22 40-28l8 10c-14 10-16 34-42 42z" fill="{INK}"/>
<path d="M42 92c-26 0-26 44 4 46" fill="none" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>
<rect x="64" y="62" width="48" height="12" rx="6" fill="{BRASS}"/><circle cx="88" cy="56" r="8" fill="{BRASS}"/>
<path d="M60 112h56" stroke="{BRASS}" stroke-width="6"/>
<path d="M118 164h52c0 14-10 20-26 20s-26-6-26-20z" fill="{CREAM}" stroke="{INK}" stroke-width="5"/>''',
    # 4. сиреневый шарф
    4: f'''<path d="M30 50c30-18 50 14 80 0s44-16 62 4l-14 30c-16-16-28-10-48-2s-44 6-66-6z" fill="{LILAC}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M112 80c10 30-14 50-4 84l28-8c-8-26 14-48 6-78z" fill="{LILAC}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M108 164l-4 18m12-20l0 20m12-22l4 18" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>
<path d="M44 58c26-10 44 10 66 2" fill="none" stroke="#fff" stroke-width="4" opacity=".5"/>''',
    # 5. книга с закладкой
    5: f'''<rect x="92" y="14" width="26" height="60" fill="{CREAM}" stroke="{INK}" stroke-width="4"/>
<path d="M98 28h14M98 38h14M98 48h10" stroke="{INK}" stroke-width="3"/>
<rect x="40" y="48" width="120" height="136" rx="8" fill="{WINE}" stroke="{INK}" stroke-width="6"/>
<rect x="40" y="48" width="20" height="136" fill="{INK}" opacity=".45"/>
<rect x="76" y="82" width="68" height="34" rx="4" fill="{BRASS}"/>
<circle cx="110" cy="146" r="16" fill="none" stroke="{BRASS}" stroke-width="5"/>''',
    # 6. журнал со срезанными страницами
    6: f'''<path d="M18 52l76-10v124l-76 10z" fill="{CREAM}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M182 52l-76-10v124l76 10z" fill="{CREAM}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M30 74l52-7M30 94l52-7M30 114l52-7M30 134l52-7" stroke="{MID}" stroke-width="4"/>
<path d="M118 67l52 7M118 87l52 7M118 107l52 7" stroke="{MID}" stroke-width="4"/>
<path d="M94 42h12v124H94z" fill="{WINE}"/>
<path d="M100 36v136" stroke="{INK}" stroke-width="3" stroke-dasharray="7 6"/>''',
    # 7. карманные часы, без двадцати два
    7: f'''<rect x="90" y="12" width="20" height="20" rx="5" fill="{BRASS}" stroke="{INK}" stroke-width="4"/>
<circle cx="100" cy="24" r="14" fill="none" stroke="{INK}" stroke-width="4"/>
<circle cx="100" cy="110" r="72" fill="{STEEL}" stroke="{INK}" stroke-width="6"/>
<circle cx="100" cy="110" r="56" fill="{CREAM}" stroke="{INK}" stroke-width="4"/>
<path d="M100 60v10M100 150v10M50 110h10M140 110h10" stroke="{INK}" stroke-width="5"/>
<path d="M100 110l22-22" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>
<path d="M100 110l-36 20" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>
<circle cx="100" cy="110" r="6" fill="{INK}"/>
<path d="M62 70l26 22-10 16 30 14-14 22 22 12" fill="none" stroke="{WINE}" stroke-width="3"/>''',
    # 8. пачка писем с лентой
    8: f'''<rect x="30" y="46" width="130" height="86" rx="4" fill="{CREAM}" stroke="{INK}" stroke-width="5" transform="rotate(-6 95 89)"/>
<rect x="36" y="64" width="134" height="92" rx="4" fill="{CREAM}" stroke="{INK}" stroke-width="5"/>
<path d="M36 66l67 46 67-46" fill="none" stroke="{INK}" stroke-width="4"/>
<path d="M36 112h134M103 64v92" stroke="{LILAC}" stroke-width="12"/>
<path d="M103 112c-26-30-44-8-22 4zm0 0c26-30 44-8 22 4z" fill="{LILAC}" stroke="{INK}" stroke-width="4"/>
<path d="M103 112l-16 34m16-34l16 34" stroke="{LILAC}" stroke-width="8" stroke-linecap="round"/>''',
    # 9. карты
    9: f'''<rect x="34" y="50" width="74" height="108" rx="8" fill="{CREAM}" stroke="{INK}" stroke-width="5" transform="rotate(-18 71 104)"/>
<rect x="64" y="42" width="74" height="108" rx="8" fill="{CREAM}" stroke="{INK}" stroke-width="5"/>
<rect x="96" y="50" width="74" height="108" rx="8" fill="{CREAM}" stroke="{INK}" stroke-width="5" transform="rotate(18 133 104)"/>
<path d="M135 84c-22-22-34 8 0 30 34-22 22-52 0-30z" fill="{WINE}" transform="rotate(18 133 104)"/>
<path d="M101 66l10 14-10 14-10-14z" fill="{WINE}"/>
<circle cx="56" cy="92" r="9" fill="{INK}" transform="rotate(-18 71 104)"/>''',
    # 10. рыжий кот на кухне миссис Пайк
    10: f'''<path d="M150 150c26 0 34-30 20-48" fill="none" stroke="#b5651d" stroke-width="13" stroke-linecap="round"/>
<path d="M58 176c-8-50 6-88 44-88s54 38 46 88z" fill="#b5651d" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M62 44l8 30 24-12zM138 44l-8 30-24-12z" fill="#b5651d" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>
<circle cx="100" cy="78" r="36" fill="#b5651d" stroke="{INK}" stroke-width="5"/>
<path d="M82 76c4-5 10-5 14 0M104 76c4-5 10-5 14 0" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>
<path d="M96 88h8l-4 5z" fill="{INK}"/>
<path d="M84 176v-34M116 176v-34" stroke="{INK}" stroke-width="4"/>''',
    # 11. ящик с бутылками
    11: f'''<path d="M62 84V52h12v32M94 84V44h12v40M126 84V52h12v32" fill="{INK}"/>
<rect x="62" y="44" width="12" height="9" fill="{BRASS}"/><rect x="94" y="36" width="12" height="9" fill="{BRASS}"/><rect x="126" y="44" width="12" height="9" fill="{BRASS}"/>
<path d="M36 84l10-10 12 10 12-10 12 10 12-10 12 10 12-10 12 10 12-10 10 10" fill="none" stroke="{BRASS}" stroke-width="5"/>
<rect x="28" y="84" width="144" height="92" rx="4" fill="{MID}" stroke="{INK}" stroke-width="6"/>
<path d="M28 114h144M28 146h144" stroke="{INK}" stroke-width="4"/>
<path d="M52 84v92M148 84v92" stroke="{INK}" stroke-width="6"/>''',
    # 12. корзина яиц
    12: f'''<path d="M44 96c0-64 112-64 112 0" fill="none" stroke="{MID}" stroke-width="10"/>
<ellipse cx="72" cy="92" rx="17" ry="22" fill="{CREAM}" stroke="{INK}" stroke-width="4"/>
<ellipse cx="128" cy="92" rx="17" ry="22" fill="{CREAM}" stroke="{INK}" stroke-width="4"/>
<ellipse cx="100" cy="84" rx="18" ry="24" fill="{CREAM}" stroke="{INK}" stroke-width="4"/>
<path d="M30 98h140l-16 70a12 12 0 0 1-12 9H58a12 12 0 0 1-12-9z" fill="{MID}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M38 122h124M44 146h112M70 100l8 76M100 100v76M130 100l-8 76" stroke="{INK}" stroke-width="4" opacity=".7"/>''',
}

for n, body in ICONS.items():
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">\n{body}\n</svg>\n'
    io.open(os.path.join(OUT, f'clue{n:02d}.svg'), 'w', encoding='utf-8', newline='\n').write(svg)
print('значков:', len(ICONS))
