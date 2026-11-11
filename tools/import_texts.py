# Переносит правила пасьянсов из ..\texts\rules-ru.txt в src\data\i18n\rules.ru.json.
# Запуск: python tools/import_texts.py   Текст берётся дословно.
import io, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'texts', 'rules-ru.txt')
OUT = os.path.join(ROOT, 'src', 'data', 'i18n', 'rules.ru.json')

KINDS = {'ТРИ ПИКА': ('tripeaks', 'Три пика'), 'ПИРАМИДА': ('pyramid', 'Пирамида'),
         'КОСЫНКА': ('klondike', 'Косынка'), 'СВОБОДНАЯ ЯЧЕЙКА': ('freecell', 'Свободная ячейка')}

text = io.open(SRC, encoding='utf-8').read().replace('\r\n', '\n')
parts = re.split(r'^=+\s*$', text, flags=re.M)
res = {}
for i in range(1, len(parts) - 1, 2):
    title = parts[i].strip()
    if title not in KINDS:
        continue
    kind, name = KINDS[title]
    body = parts[i + 1]
    m = re.search(r'ЗНАКОМСТВО\n(.*?)\nПРАВИЛА\n(.*?)\nПОДСКАЗКИ\n(.*)', body, flags=re.S)
    assert m, title
    paras = [p.strip() for p in re.split(r'\n\s*\n', m.group(2).strip()) if p.strip()]
    res[kind] = {
        'name': name,
        'intro': ' '.join(m.group(1).split()),
        'rules': paras,
        'hints': [l.strip() for l in m.group(3).strip().split('\n') if l.strip()],
    }
assert set(res) == {'tripeaks', 'pyramid', 'klondike', 'freecell'}, res.keys()
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(res, ensure_ascii=False, indent=2) + '\n')
for k, v in res.items():
    print(k, '| абзацев правил', len(v['rules']), '| подсказок', len(v['hints']))
