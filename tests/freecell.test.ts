import { describe, expect, it } from 'vitest';
import { FreeCellGame, freecellStars, solveFreeCell } from '../src/logic/freecell';
import { FREECELL_SEEDS, freecellSeed } from '../src/logic/seeds';

const c = (rank: number, suit: number) => ({ rank, suit });

function empty(): FreeCellGame {
  const g = new FreeCellGame(1);
  g.cols = [[], [], [], [], [], [], [], []];
  g.cells = [null, null, null, null];
  g.found = [0, 0, 0, 0];
  return g;
}

describe('свободная ячейка: раздача', () => {
  it('все 52 карты открыты в восьми столбиках: 7, 7, 7, 7, 6, 6, 6, 6', () => {
    const g = new FreeCellGame(7);
    expect(g.cols.map((p) => p.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(new Set(g.cols.flat().map((x) => x.rank * 4 + x.suit)).size).toBe(52);
    expect(g.freeCells).toBe(4);
  });
});

describe('свободная ячейка: ходы', () => {
  it('в столбике — по убыванию с чередованием цвета', () => {
    const g = empty();
    g.cols[0] = [c(12, 1)]; // красная дама
    g.cols[1] = [c(11, 0)]; // чёрный валет
    g.cols[2] = [c(11, 2)]; // красный валет
    g.cols[3] = [c(9, 3)];
    expect(g.canMove({ type: 'col', col: 2, index: 0 }, { type: 'col', col: 0 })).toBe(false);
    expect(g.canMove({ type: 'col', col: 3, index: 0 }, { type: 'col', col: 0 })).toBe(false);
    expect(g.move({ type: 'col', col: 1, index: 0 }, { type: 'col', col: 0 })).toBe(true);
    expect(g.cols[0].map((x) => x.rank)).toEqual([12, 11]);
  });

  it('в ячейку — одна любая карта; ячеек четыре', () => {
    const g = empty();
    g.cols[0] = [c(5, 0), c(9, 1), c(2, 2), c(7, 3), c(3, 0)];
    for (let i = 0; i < 4; i++) expect(g.move({ type: 'col', col: 0, index: g.cols[0].length - 1 }, { type: 'cell' })).toBe(true);
    expect(g.freeCells).toBe(0);
    expect(g.canMove({ type: 'col', col: 0, index: 0 }, { type: 'cell' })).toBe(false);
  });

  it('из ячейки карта возвращается в столбик и уходит в дом', () => {
    const g = empty();
    g.cells[0] = c(1, 2);
    g.cells[1] = c(6, 0);
    g.cols[0] = [c(7, 1)];
    expect(g.move({ type: 'cell', i: 1 }, { type: 'col', col: 0 })).toBe(true);
    expect(g.move({ type: 'cell', i: 0 }, { type: 'found' })).toBe(true);
    expect(g.found[2]).toBe(1);
    expect(g.freeCells).toBe(4);
  });

  it('в пустой столбик можно любую карту', () => {
    const g = empty();
    g.cols[0] = [c(9, 0), c(4, 1)];
    expect(g.canMove({ type: 'col', col: 0, index: 1 }, { type: 'col', col: 3 })).toBe(true);
  });

  it('стопка переносится, если хватает ячеек и пустых столбиков', () => {
    const g = empty();
    g.cols[0] = [c(2, 0), c(9, 1), c(8, 0), c(7, 1), c(6, 0)]; // стопка 9-8-7-6
    g.cols[1] = [c(10, 3)];
    for (let col = 2; col < 8; col++) g.cols[col] = [c(13, col % 4)];
    const run = { type: 'col' as const, col: 0, index: 1 };
    expect(g.cardsAt(run).length).toBe(4);
    g.cells = [c(1, 0), c(1, 1), c(1, 2), null]; // свободна одна ячейка: можно 2 карты
    expect(g.maxRun(false)).toBe(2);
    expect(g.canMove(run, { type: 'col', col: 1 })).toBe(false);
    g.cells = [c(1, 0), null, null, null]; // три ячейки: можно 4 карты
    expect(g.move(run, { type: 'col', col: 1 })).toBe(true);
    expect(g.cols[1].map((x) => x.rank)).toEqual([10, 9, 8, 7, 6]);
  });

  it('неправильную стопку взять нельзя', () => {
    const g = empty();
    g.cols[0] = [c(9, 1), c(8, 1), c(7, 0)]; // 9 и 8 одного цвета
    expect(g.cardsAt({ type: 'col', col: 0, index: 0 })).toEqual([]);
    expect(g.cardsAt({ type: 'col', col: 0, index: 1 }).length).toBe(2);
  });

  it('дом собирается по масти от туза; ненужные карты уходят сами', () => {
    const g = empty();
    g.cols[0] = [c(2, 0)];
    g.cols[1] = [c(1, 0)];
    expect(g.canMove({ type: 'col', col: 0, index: 0 }, { type: 'found' })).toBe(false);
    expect(g.autoStep()).toBe(true); // туз
    expect(g.autoStep()).toBe(true); // двойка
    expect(g.autoStep()).toBe(false);
    expect(g.found[0]).toBe(2);
    expect(g.moves).toBe(0); // авто-сбор ходами не считается
  });

  it('отмена без ограничений возвращает раскладку', () => {
    const g = new FreeCellGame(11);
    const before = JSON.stringify([g.cols, g.cells, g.found]);
    for (let i = 0; i < 25; i++) {
      const m = g.hintMove();
      if (!m) break;
      g.move(m.from, m.to);
    }
    while (g.undo());
    expect(JSON.stringify([g.cols, g.cells, g.found])).toBe(before);
  });

  it('тупик, когда ходов нет', () => {
    const g = empty();
    for (let col = 0; col < 8; col++) g.cols[col] = [c(1, 0), c(13, col % 4)]; // сверху одни короли: класть их некуда
    g.found = [0, 0, 0, 0];
    g.cells = [c(5, 0), c(5, 1), c(5, 2), c(5, 3)];
    expect(g.stuck).toBe(true);
    g.cells[0] = null;
    expect(g.stuck).toBe(false);
  });

  it('звёзды по числу ходов', () => {
    expect(freecellStars(90)).toBe(3);
    expect(freecellStars(130)).toBe(2);
    expect(freecellStars(200)).toBe(1);
  });
});

describe('свободная ячейка: раскладки дела решаемы', () => {
  it('каждый сид из таблицы решается решателем; трудность растёт', () => {
    const avg: number[] = [];
    for (const band of FREECELL_SEEDS) {
      expect(band.length).toBeGreaterThanOrEqual(12);
      let nodes = 0;
      for (const seed of band) {
        const r = solveFreeCell(seed);
        expect(r.solved, 'сид ' + seed).toBe(true);
        nodes += r.nodes;
      }
      avg.push(nodes / band.length);
    }
    expect(avg[0]).toBeLessThan(avg[1]);
    expect(avg[1]).toBeLessThan(avg[2]);
  }, 60000);

  it('подсказки ведут к победе: если ходить только по ним, пасьянс сходится', () => {
    const g = new FreeCellGame(FREECELL_SEEDS[0][0]);
    let guard = 0;
    while (!g.won && guard++ < 400) {
      while (g.autoStep());
      if (g.won) break;
      const m = g.hintMove();
      expect(m).not.toBeNull();
      expect(g.move(m!.from, m!.to)).toBe(true);
    }
    expect(g.won).toBe(true);
  }, 60000);

  it('решатель не «решает» невозможное', () => {
    expect(solveFreeCell(1, 5).solved).toBe(false); // лимит перебора слишком мал
  });

  it('партии 10-12 дела 1 получают свои сиды', () => {
    const seeds = [1, 2, 3].map((d) => freecellSeed(1, 9 + d, d));
    seeds.forEach((s, i) => expect(FREECELL_SEEDS[i]).toContain(s));
  });
});
