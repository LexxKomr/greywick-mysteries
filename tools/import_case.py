# Переносит текст дела из ..\cases\case-NN-ru.txt в src\data\cases\caseNN.ru.json.
# Запуск: python tools/import_case.py 1
# Текст берётся из файла дословно. Всё, чего в тексте нет (короткие названия улик,
# подписи подозреваемых, картинки), лежит ниже в META.
import io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

META = {
    1: {
        'title': 'Последний огонь маяка',
        'place': 'Маяк',
        'clueTitles': [
            'Бутылка коньяка', 'Доктор Марш', 'Ссора у гостиницы', 'Сиреневый шарф',
            'Закладка в лоции', 'Срезанные страницы', 'Часы у рыбака', 'Тайна вдовы',
            'Партия в вист', 'Вмятина на затылке', 'Ящики в лодочном сарае', 'Ночь на ферме Холлоу',
        ],
        'suspects': [
            {'id': 'marsh', 'name': 'Доктор Филип Марш', 'short': 'Доктор Марш', 'role': 'Городской врач', 'match': 'МАРШ'},
            {'id': 'blake', 'name': 'Гордон Блэйк', 'short': 'Гордон Блэйк', 'role': 'Хозяин гостиницы', 'match': 'БЛЭЙК'},
            {'id': 'everly', 'name': 'Маргарет Эверли', 'short': 'Маргарет Эверли', 'role': 'Вдова капитана', 'match': 'ЭВЕРЛИ'},
            {'id': 'burke', 'name': 'Томми Берк', 'short': 'Томми Берк', 'role': 'Рыбак', 'match': 'БЕРК'},
        ],
        'culprit': 'marsh',
        # вид пасьянса и трудность (1-3) для каждой партии: 4 блока по 3 улики
        'levels': [(g, d) for g in ('tripeaks', 'pyramid', 'klondike', 'freecell') for d in (1, 2, 3)],
    },
}

SEP = re.compile(r'^[—-]{5,}\s*$', re.M)


def paragraphs(block):
    return [p.strip() for p in re.split(r'\n\s*\n', block.strip()) if p.strip()]


def main(n):
    meta = META[n]
    src = os.path.join(os.path.dirname(ROOT), 'cases', f'case-{n:02d}-ru.txt')
    text = io.open(src, encoding='utf-8').read().replace('\r\n', '\n')
    sections = [s.strip() for s in SEP.split(text)]
    case = {
        'id': f'case{n:02d}', 'number': n, 'title': meta['title'], 'place': meta['place'],
        'intro': [], 'clues': [], 'accuse': [], 'suspects': [], 'culprit': meta['culprit'],
        'wrong': {}, 'ending': [],
        'levels': [{'game': g, 'difficulty': d} for g, d in meta['levels']],
    }
    for s in meta['suspects']:
        case['suspects'].append({'id': s['id'], 'name': s['name'], 'short': s['short'], 'role': s['role'],
                                 'portrait': 'portrait_' + s['id']})
    for sec in sections:
        head, _, body = sec.partition('\n')
        head = head.strip()
        if head == 'ВСТУПЛЕНИЕ':
            case['intro'] = paragraphs(body)
        elif head.startswith('УЛИКА '):
            num = int(re.match(r'УЛИКА (\d+)', head).group(1))
            lines = body.split('\n')
            # служебные строки «Картинка:», «Указывает на:», «Снимает подозрение с:» игроку не показываем
            while lines and (lines[0].strip() == '' or re.match(r'^(Картинка|Указывает на|Снимает подозрение с):', lines[0])):
                lines.pop(0)
            assert num == len(case['clues']) + 1, head
            case['clues'].append({'title': meta['clueTitles'][num - 1], 'image': f'clue{num:02d}',
                                  'text': paragraphs('\n'.join(lines))})
        elif head == 'ВЫБОР ВИНОВНОГО':
            case['accuse'] = [p for p in paragraphs(body) if not p.startswith('[')]
        elif head.startswith('ЕСЛИ ВЫБРАН'):
            who = [s for s in meta['suspects'] if s['match'] in head]
            assert len(who) == 1, head
            case['wrong'][who[0]['id']] = paragraphs(body)
        elif head.startswith('РАЗВЯЗКА'):
            case['ending'] = paragraphs(body)
    assert case['intro'] and case['ending'] and case['accuse'], 'не все разделы найдены'
    assert len(case['clues']) == len(meta['clueTitles']), 'улик: %d' % len(case['clues'])
    wrong_ids = {s['id'] for s in meta['suspects']} - {meta['culprit']}
    assert set(case['wrong']) == wrong_ids, case['wrong'].keys()
    out = os.path.join(ROOT, 'src', 'data', 'cases', f'case{n:02d}.ru.json')
    io.open(out, 'w', encoding='utf-8', newline='\n').write(json.dumps(case, ensure_ascii=False, indent=2) + '\n')
    words = sum(len(p.split()) for k in ('intro', 'ending') for p in case[k]) + sum(len(p.split()) for c in case['clues'] for p in c['text'])
    print('готово:', out, '| улик', len(case['clues']), '| слов', words)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
