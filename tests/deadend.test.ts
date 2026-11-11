// Проверка тупика и подсказки «как выиграть» во всех четырёх пасьянсах.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/logic/tripeaks';
import { dealForLevel } from '../src/logic/generator';
import { solveTriPeaksFrom } from '../src/logic/solver';
import { PyramidGame, generatePyramid, solvePyramidFrom } from '../src/logic/pyramid';
import { KlondikeGame, solveKlondikeFrom } from '../src/logic/klondike';
import { FreeCellGame, freecellDead } from '../src/logic/freecell';
import { FREECELL_SEEDS, KLONDIKE_SEEDS } from '../src/logic/seeds';

describe('три пика: можно ли ещё выиграть', () => {
  it('с начала раскладки — да; ходы по подсказкам решателя выигрывают', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = new Game(dealForLevel(1, seed));
      for (let step = 0; step < 80 && g.status === 'playing'; step++) {
        const r = solveTriPeaksFrom(g);
        expect(r.result).toBe(true);
        if (r.first === 'draw') g.draw();
        else g.play(r.first!);
      }
      expect(g.status).toBe('won');
    }
  }, 60_000);
  it('пустая колода и ни одного хода — тупик', () => {
    const g = new Game(dealForLevel(1, 5));
    g.stock = [];
    g.waste = [{ rank: 7, suit: 0 }];
    g.tableau = g.tableau.map((c, i) => (i >= 18 ? { rank: 1, suit: 0 } : c));
    expect(solveTriPeaksFrom(g).result).toBe(false);
  });
});

describe('пирамида: можно ли ещё выиграть', () => {
  it('с начала — да; подсказки решателя выигрывают, даже когда колода пуста', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = new PyramidGame(generatePyramid(seed, 0.5), 0);
      for (let step = 0; step < 200 && g.status === 'playing'; step++) {
        const r = solvePyramidFrom(g);
        expect(r.result).toBe(true);
        if (r.first === 'draw') g.draw();
        else g.remove(r.first!);
      }
      expect(g.status).toBe('won');
    }
  }, 60_000);
  it('колода пройдена трижды, пар нет — тупик', () => {
    const g = new PyramidGame(generatePyramid(3, 0.5), 0);
    while (g.canDraw) g.draw();
    if (g.status === 'playing') expect(solvePyramidFrom(g).result).not.toBe(true);
    else expect(solvePyramidFrom(g).result).toBe(false);
  });
});

describe('косынка: можно ли ещё выиграть', () => {
  it('ни одна раскладка дела не считается тупиком', () => {
    for (const band of KLONDIKE_SEEDS) {
      for (const seed of band) expect(solveKlondikeFrom(new KlondikeGame(seed), 3000).result).not.toBe(false);
    }
  }, 60_000);
  it('подсказки решателя доводят лёгкие раскладки до победы', () => {
    for (const seed of KLONDIKE_SEEDS[0].slice(0, 3)) {
      const g = new KlondikeGame(seed);
      for (let step = 0; step < 3000 && !g.won && !g.canAutoFinish; step++) {
        const r = solveKlondikeFrom(g);
        expect(r.result).not.toBe(false);
        const f = r.first;
        if (!f) break;
        if (f.type === 'draw') g.draw();
        else expect(g.move(f.from, f.to)).toBe(true);
      }
      while (!g.won && g.canAutoFinish && g.autoStep());
      expect(g.won).toBe(true);
    }
  }, 60_000);
  it('застрявшая раскладка — тупик', () => {
    const g = new KlondikeGame(1);
    // все семь столбиков — закрытые карты под королями; в колоде только двойки
    g.tableau = Array.from({ length: 7 }, (_, i) => [
      { rank: 5, suit: i % 4, up: false },
      { rank: 13, suit: i % 4, up: true },
    ]);
    g.stock = [{ rank: 2, suit: 0 }];
    g.waste = [{ rank: 2, suit: 1 }];
    expect(solveKlondikeFrom(g).result).toBe(false);
  });
});

describe('свободная ячейка: тупик', () => {
  it('раскладки дела тупиком не считаются', () => {
    for (const band of FREECELL_SEEDS) for (const seed of band) expect(freecellDead(new FreeCellGame(seed))).toBe(false);
  }, 60_000);
  it('ячейки заняты, ходов нет — тупик', () => {
    const g = new FreeCellGame(1);
    const k = (rank: number, suit: number) => ({ rank, suit });
    g.cells = [k(13, 0), k(13, 1), k(13, 2), k(13, 3)];
    g.cols = Array.from({ length: 8 }, (_, i) => [k(2, i % 4), k(12, i % 4)]);
    g.found = [0, 0, 0, 0];
    expect(freecellDead(g)).toBe(true);
  });
});
