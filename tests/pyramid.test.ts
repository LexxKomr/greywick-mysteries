import { describe, expect, it } from 'vitest';
import { Card } from '../src/logic/tripeaks';
import { PYRAMID_SIZE, PYRAMID_TARGETS, PyramidDeal, PyramidGame, generatePyramid, generateRatedPyramid, pyramidCovers, pyramidStars, ratePyramid, replayPyramid, rowOfPyramid, solvePyramid } from '../src/logic/pyramid';

const c = (rank: number, suit = 0): Card => ({ rank, suit });

/** Пирамида из одних шестёрок, кроме заданных мест; колода задаётся явно. */
function makeDeal(pyramid: Record<number, number>, stock: number[]): PyramidDeal {
  const p: Card[] = [];
  for (let i = 0; i < PYRAMID_SIZE; i++) p.push(c(pyramid[i] ?? 6));
  return { pyramid: p, stock: stock.map((r) => c(r)), solution: [] };
}

describe('пирамида: раскладка', () => {
  it('семь рядов: 1, 2, … 7 карт', () => {
    const rows = new Array(7).fill(0);
    for (let i = 0; i < PYRAMID_SIZE; i++) rows[rowOfPyramid(i)]++;
    expect(rows).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('карту накрывают две карты следующего ряда', () => {
    expect(pyramidCovers(0)).toEqual([1, 2]);
    expect(pyramidCovers(1)).toEqual([3, 4]);
    expect(pyramidCovers(2)).toEqual([4, 5]);
    expect(pyramidCovers(20)).toEqual([26, 27]);
    for (let i = 21; i < 28; i++) expect(pyramidCovers(i)).toEqual([]);
  });

  it('в начале открыт только нижний ряд', () => {
    const g = new PyramidGame(generatePyramid(1, 0.5));
    for (let i = 0; i < PYRAMID_SIZE; i++) expect(g.isOpen(i)).toBe(i >= 21);
    expect(g.stock.length).toBe(24);
    expect(g.waste.length).toBe(0);
  });
});

describe('пирамида: ходы', () => {
  it('пара с суммой 13 убирается, другая — нет', () => {
    const g = new PyramidGame(makeDeal({ 21: 5, 22: 8, 23: 9 }, [1]));
    expect(g.canRemove([21, 23])).toBe(false); // 5 + 9
    expect(g.remove([21, 23])).toBe(false);
    expect(g.remove([21, 22])).toBe(true); // 5 + 8
    expect(g.pyramid[21]).toBeNull();
    expect(g.pyramid[22]).toBeNull();
    expect(g.isOpen(15)).toBe(true); // открылась карта над ними
  });

  it('король уходит один', () => {
    const g = new PyramidGame(makeDeal({ 24: 13 }, [1]));
    expect(g.remove([24])).toBe(true);
    expect(g.remove([25])).toBe(false); // шестёрка одна не уходит
  });

  it('закрытую карту взять нельзя', () => {
    const g = new PyramidGame(makeDeal({ 15: 7 }, [1]));
    expect(g.canRemove([15, 21])).toBe(false); // 7 + 6 = 13, но семёрка накрыта
  });

  it('карта сброса складывается в пару с картой пирамиды', () => {
    const g = new PyramidGame(makeDeal({}, [7, 2]));
    expect(g.draw()).toBe('card');
    expect(g.remove([21, 'waste'])).toBe(true);
    expect(g.waste.length).toBe(0);
  });

  it('колоду можно пройти три раза, потом она не открывается', () => {
    const g = new PyramidGame(makeDeal({}, [2, 3]));
    for (let pass = 1; pass <= 3; pass++) {
      expect(g.pass).toBe(pass);
      expect(g.draw()).toBe('card');
      expect(g.draw()).toBe('card');
      if (pass < 3) expect(g.draw()).toBe('pass');
    }
    expect(g.canDraw).toBe(false);
    expect(g.draw()).toBeNull();
    expect(g.status).toBe('lost');
  });

  it('новый проход идёт в том же порядке', () => {
    const g = new PyramidGame(makeDeal({}, [2, 3, 4]));
    g.draw();
    g.draw();
    g.draw();
    g.draw(); // новый проход
    g.draw();
    expect(g.cardAt('waste')?.rank).toBe(2);
  });

  it('«+1 проход» продлевает игру', () => {
    const g = new PyramidGame(makeDeal({}, [2]));
    for (let i = 0; i < 5; i++) g.draw();
    expect(g.status).toBe('lost');
    g.addPass();
    expect(g.status).toBe('playing');
    expect(g.draw()).toBe('pass');
  });

  it('отмена возвращает карты; бесплатных отмен три', () => {
    const g = new PyramidGame(makeDeal({ 21: 5, 22: 8 }, [7, 2, 3, 4]));
    g.remove([21, 22]);
    g.draw();
    expect(g.undo()).toBe(true);
    expect(g.waste.length).toBe(0);
    expect(g.stock.length).toBe(4);
    expect(g.undo()).toBe(true);
    expect(g.pyramid[21]?.rank).toBe(5);
    expect(g.undo()).toBe(false); // отменять нечего
    g.draw();
    expect(g.undo()).toBe(true);
    g.draw();
    expect(g.undo()).toBe(false); // отмены кончились
  });

  it('подсказка находит короля или пару', () => {
    expect(new PyramidGame(makeDeal({ 26: 13 }, [1])).findRemoval()).toEqual([26]);
    expect(new PyramidGame(makeDeal({ 22: 7 }, [1])).findRemoval()).toEqual([21, 22]);
    expect(new PyramidGame(makeDeal({}, [1])).findRemoval()).toBeNull();
  });

  it('звёзды по числу проходов', () => {
    expect(pyramidStars(1)).toBe(3);
    expect(pyramidStars(2)).toBe(2);
    expect(pyramidStars(3)).toBe(1);
    expect(pyramidStars(4)).toBe(1);
  });
});

describe('пирамида: генератор', () => {
  it('в раскладке ровно колода из 52 разных карт', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const d = generatePyramid(seed, (seed % 10) / 10);
      expect(d.pyramid.length).toBe(28);
      expect(d.stock.length).toBe(24);
      expect(new Set([...d.pyramid, ...d.stock].map((x) => x.rank * 4 + x.suit)).size).toBe(52);
    }
  });

  it('200 случайных сидов решаемы: известное решение проходит за один проход колоды', () => {
    for (let seed = 1000; seed < 1200; seed++) {
      const d = generatePyramid(seed, (seed % 11) / 10);
      const g = replayPyramid(d, d.solution);
      expect(g, 'сид ' + seed).not.toBeNull();
      expect(g!.pass).toBe(1);
    }
  });

  it('независимый решатель подтверждает решаемость', () => {
    for (let seed = 2000; seed < 2040; seed++) {
      expect(solvePyramid(generatePyramid(seed, (seed % 11) / 10)), 'сид ' + seed).toBe(true);
    }
  });

  it('решатель отличает нерешаемую раскладку', () => {
    expect(solvePyramid(makeDeal({}, [1, 2, 3]))).toBe(false);
  });

  it('один сид — одна раскладка; трудность растёт', () => {
    expect(generateRatedPyramid(1004, 0.7)).toEqual(generateRatedPyramid(1004, 0.7));
    const rates = PYRAMID_TARGETS.map((target, i) => ratePyramid(generateRatedPyramid(1004 + i, target), 300));
    expect(rates[0]).toBeGreaterThan(rates[2] + 0.15);
    for (let i = 0; i < 3; i++) expect(replayPyramid(generateRatedPyramid(1004 + i, PYRAMID_TARGETS[i]), generateRatedPyramid(1004 + i, PYRAMID_TARGETS[i]).solution)).not.toBeNull();
  });
});
