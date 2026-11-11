import { describe, expect, it } from 'vitest';
import { KlondikeGame, klondikeStars, rateKlondike, replayKlondike, shuffledDeck, solveKlondike } from '../src/logic/klondike';
import { KLONDIKE_SEEDS, klondikeSeed } from '../src/logic/seeds';

const up = (rank: number, suit: number) => ({ rank, suit, up: true });
const down = (rank: number, suit: number) => ({ rank, suit, up: false });

/** Пустая игра, в которую тест сам кладёт карты. */
function empty(): KlondikeGame {
  const g = new KlondikeGame(1);
  g.tableau = [[], [], [], [], [], [], []];
  g.stock = [];
  g.waste = [];
  g.found = [0, 0, 0, 0];
  return g;
}

describe('косынка: раздача', () => {
  it('колода из 52 разных карт, одинаковая для одного сида', () => {
    const d = shuffledDeck(5);
    expect(new Set(d.map((c) => c.rank * 4 + c.suit)).size).toBe(52);
    expect(shuffledDeck(5)).toEqual(d);
    expect(shuffledDeck(6)).not.toEqual(d);
  });

  it('семь столбиков по 1…7 карт, открыта только верхняя, в колоде 24', () => {
    const g = new KlondikeGame(3);
    g.tableau.forEach((pile, col) => {
      expect(pile.length).toBe(col + 1);
      pile.forEach((c, i) => expect(c.up).toBe(i === col));
    });
    expect(g.stock.length).toBe(24);
    expect(g.waste.length).toBe(0);
    expect(g.faceDown).toBe(21);
  });
});

describe('косынка: ходы', () => {
  it('в столбике — по убыванию с чередованием цвета', () => {
    const g = empty();
    g.tableau[0] = [up(10, 0)]; // чёрная десятка
    g.tableau[1] = [up(9, 1)]; // красная девятка
    g.tableau[2] = [up(9, 3)]; // чёрная девятка
    g.tableau[3] = [up(8, 1)]; // красная восьмёрка
    expect(g.canMove({ type: 'tab', col: 2, index: 0 }, { type: 'tab', col: 0 })).toBe(false); // тот же цвет
    expect(g.canMove({ type: 'tab', col: 3, index: 0 }, { type: 'tab', col: 0 })).toBe(false); // не по порядку
    expect(g.move({ type: 'tab', col: 1, index: 0 }, { type: 'tab', col: 0 })).toBe(true);
    expect(g.tableau[0].map((c) => c.rank)).toEqual([10, 9]);
  });

  it('стопка переносится целиком, под ней открывается карта', () => {
    const g = empty();
    g.tableau[0] = [down(2, 0), up(9, 1), up(8, 0)];
    g.tableau[1] = [up(10, 3)];
    expect(g.move({ type: 'tab', col: 0, index: 1 }, { type: 'tab', col: 1 })).toBe(true);
    expect(g.tableau[1].map((c) => c.rank)).toEqual([10, 9, 8]);
    expect(g.tableau[0]).toEqual([up(2, 0)]);
  });

  it('закрытую карту взять нельзя', () => {
    const g = empty();
    g.tableau[0] = [down(9, 1), up(4, 0)];
    g.tableau[1] = [up(10, 3)];
    expect(g.canMove({ type: 'tab', col: 0, index: 0 }, { type: 'tab', col: 1 })).toBe(false);
  });

  it('в пустой столбик — только король', () => {
    const g = empty();
    g.tableau[0] = [down(3, 0), up(12, 1)];
    g.tableau[1] = [down(3, 1), up(13, 0)];
    expect(g.canMove({ type: 'tab', col: 0, index: 1 }, { type: 'tab', col: 2 })).toBe(false);
    expect(g.canMove({ type: 'tab', col: 1, index: 1 }, { type: 'tab', col: 2 })).toBe(true);
  });

  it('дом собирается по масти от туза', () => {
    const g = empty();
    g.tableau[0] = [up(2, 1)];
    g.tableau[1] = [up(1, 1)];
    g.tableau[2] = [up(2, 0)];
    expect(g.canMove({ type: 'tab', col: 0, index: 0 }, { type: 'found' })).toBe(false); // двойка без туза
    expect(g.move({ type: 'tab', col: 1, index: 0 }, { type: 'found' })).toBe(true);
    expect(g.canMove({ type: 'tab', col: 2, index: 0 }, { type: 'found' })).toBe(false); // другая масть
    expect(g.move({ type: 'tab', col: 0, index: 0 }, { type: 'found' })).toBe(true);
    expect(g.found).toEqual([0, 2, 0, 0]);
  });

  it('колода: по одной карте, потом сброс переворачивается, и так сколько угодно', () => {
    const g = empty();
    g.stock = [{ rank: 5, suit: 0 }, { rank: 6, suit: 0 }];
    expect(g.draw()).toBe('card');
    expect(g.waste[0].rank).toBe(6);
    expect(g.draw()).toBe('card');
    for (let pass = 1; pass <= 5; pass++) {
      expect(g.draw()).toBe('recycle');
      expect(g.recycles).toBe(pass);
      expect(g.draw()).toBe('card');
      expect(g.waste[0].rank).toBe(6); // порядок тот же
      g.draw();
    }
  });

  it('карта со сброса идёт в столбик и в дом', () => {
    const g = empty();
    g.tableau[0] = [up(7, 0)];
    g.waste = [{ rank: 1, suit: 2 }, { rank: 6, suit: 1 }];
    expect(g.destinations({ type: 'waste' })).toEqual([{ type: 'tab', col: 0 }]);
    expect(g.move({ type: 'waste' }, { type: 'tab', col: 0 })).toBe(true);
    expect(g.destinations({ type: 'waste' })).toEqual([{ type: 'found' }]);
  });

  it('отмена возвращает всё как было, без ограничений', () => {
    const g = new KlondikeGame(12);
    const before = JSON.stringify([g.tableau, g.stock, g.waste, g.found]);
    for (let i = 0; i < 30; i++) {
      const m = g.usefulMoves()[0];
      if (m) g.move(m.from, m.to);
      else g.draw();
    }
    let n = 0;
    while (g.undo()) n++;
    expect(n).toBe(30);
    expect(JSON.stringify([g.tableau, g.stock, g.waste, g.found])).toBe(before);
  });

  it('тупик: ходов нет ни на столе, ни в колоде', () => {
    const g = empty();
    g.tableau[0] = [up(5, 0)];
    g.tableau[1] = [up(5, 3)];
    g.stock = [{ rank: 9, suit: 1 }];
    expect(g.stuck).toBe(true);
    g.stock = [{ rank: 4, suit: 1 }];
    expect(g.stuck).toBe(false);
  });

  it('когда все карты открыты, пасьянс собирается сам', () => {
    const sol = solveKlondike(12)!;
    const g = new KlondikeGame(12);
    for (const m of sol) {
      if (g.canAutoFinish) break;
      if (m.type === 'draw') g.draw();
      else g.move(m.from, m.to);
    }
    expect(g.canAutoFinish).toBe(true);
    let guard = 0;
    while (!g.won && guard++ < 500) expect(g.autoStep()).toBe(true);
    expect(g.won).toBe(true);
  });

  it('звёзды по числу переворотов колоды', () => {
    expect(klondikeStars(0)).toBe(3);
    expect(klondikeStars(2)).toBe(3);
    expect(klondikeStars(3)).toBe(2);
    expect(klondikeStars(5)).toBe(1);
  });
});

describe('косынка: раскладки дела решаемы', () => {
  it('каждый сид из таблицы решается, решение проходит по правилам', () => {
    for (const band of KLONDIKE_SEEDS) {
      expect(band.length).toBeGreaterThanOrEqual(12);
      for (const seed of band) {
        const sol = solveKlondike(seed);
        expect(sol, 'сид ' + seed).not.toBeNull();
        expect(replayKlondike(seed, sol!), 'сид ' + seed).toBe(true);
      }
    }
  });

  it('трудность растёт от набора к набору', () => {
    const avg = KLONDIKE_SEEDS.map((band) => band.slice(0, 8).reduce((a, s) => a + rateKlondike(s), 0) / 8);
    expect(avg[0]).toBeGreaterThan(avg[1] + 0.1);
    expect(avg[1]).toBeGreaterThan(avg[2] + 0.1);
  });

  it('партии 7-9 дела 1 получают свои сиды', () => {
    const seeds = [1, 2, 3].map((d) => klondikeSeed(1, 6 + d, d));
    expect(new Set(seeds).size).toBe(3);
    seeds.forEach((s, i) => expect(KLONDIKE_SEEDS[i]).toContain(s));
  });
});
