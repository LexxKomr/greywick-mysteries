import { describe, expect, it } from 'vitest';
import { Card, Deal, Game, TABLEAU_SIZE, coveredBy, isAdjacent, makeBonusCards, rowOf, starsFor } from '../src/logic/tripeaks';
import { dealForDaily, dealForLevel, generateDeal, mulberry32, rateDeal } from '../src/logic/generator';
import { replay, solve } from '../src/logic/solver';

const c = (rank: number, suit = 0): Card => ({ rank, suit });

/** Раскладка для тестов: все карты пиков — пятёрки, кроме заданных; колода задаётся явно. */
function makeDeal(tableau: Record<number, number>, stock: number[]): Deal {
  const t: Card[] = [];
  for (let i = 0; i < TABLEAU_SIZE; i++) t.push(c(tableau[i] ?? 5));
  return { tableau: t, stock: stock.map((r) => c(r)), solution: [], par: 0 };
}

describe('раскладка', () => {
  it('ряды 3, 6, 9, 10', () => {
    const rows = [0, 0, 0, 0];
    for (let i = 0; i < TABLEAU_SIZE; i++) rows[rowOf(i)]++;
    expect(rows).toEqual([3, 6, 9, 10]);
  });

  it('каждую закрытую карту накрывают две карты следующего ряда', () => {
    for (let i = 0; i < 18; i++) {
      const cov = coveredBy(i);
      expect(cov.length).toBe(2);
      expect(cov[1]).toBe(cov[0] + 1);
      for (const j of cov) expect(rowOf(j)).toBe(rowOf(i) + 1);
    }
    for (let i = 18; i < 28; i++) expect(coveredBy(i)).toEqual([]);
    expect(coveredBy(0)).toEqual([3, 4]);
    expect(coveredBy(3)).toEqual([9, 10]);
    expect(coveredBy(8)).toEqual([16, 17]);
    expect(coveredBy(9)).toEqual([18, 19]);
    expect(coveredBy(17)).toEqual([26, 27]);
  });

  it('в начале открыт только нижний ряд, одна карта в сбросе, 23 в колоде', () => {
    const g = new Game(generateDeal(1, { runs: 8, interleave: 0.3 }));
    for (let i = 0; i < TABLEAU_SIZE; i++) expect(g.isOpen(i)).toBe(i >= 18);
    expect(g.waste.length).toBe(1);
    expect(g.stock.length).toBe(23);
  });
});

describe('ходы', () => {
  it('соседние старшинства, король и туз замыкаются, масть не важна', () => {
    expect(isAdjacent(5, 6)).toBe(true);
    expect(isAdjacent(6, 5)).toBe(true);
    expect(isAdjacent(13, 1)).toBe(true);
    expect(isAdjacent(1, 13)).toBe(true);
    expect(isAdjacent(5, 5)).toBe(false);
    expect(isAdjacent(5, 7)).toBe(false);
    expect(isAdjacent(1, 12)).toBe(false);
    expect(isAdjacent(0, 9)).toBe(true); // джокер
  });

  it('можно взять только открытую и подходящую карту', () => {
    const g = new Game(makeDeal({ 18: 7, 19: 9, 9: 7 }, [8, 2]));
    expect(g.canPlay(9)).toBe(false); // закрыта, хотя старшинство подходит
    expect(g.canPlay(20)).toBe(false); // открыта, но пятёрка на восьмёрку не идёт
    expect(g.play(20)).toBe(false);
    expect(g.play(18)).toBe(true);
    expect(g.top.rank).toBe(7);
    expect(g.tableau[18]).toBeNull();
  });

  it('карта открывается, когда убраны обе накрывающие', () => {
    const g = new Game(makeDeal({ 18: 7, 19: 8, 9: 9 }, [8, 2]));
    g.play(18);
    expect(g.isOpen(9)).toBe(false);
    g.play(19);
    expect(g.isOpen(9)).toBe(true);
    expect(g.play(9)).toBe(true);
  });

  it('колода кладёт карту в сброс и обрывает серию', () => {
    const g = new Game(makeDeal({ 18: 7, 19: 8 }, [8, 2, 3]));
    g.play(18);
    g.play(19);
    expect(g.streak).toBe(2);
    expect(g.score).toBe(30);
    expect(g.draw()).toBe(true);
    expect(g.top.rank).toBe(2);
    expect(g.streak).toBe(0);
    expect(g.bestStreak).toBe(2);
    expect(g.stock.length).toBe(1);
  });

  it('отмена возвращает карту, счёт и серию; бесплатных отмен три', () => {
    const g = new Game(makeDeal({ 18: 7 }, [8, 2, 3, 4, 6]));
    g.play(18);
    g.draw();
    expect(g.undo()?.type).toBe('draw');
    expect(g.top.rank).toBe(7);
    expect(g.streak).toBe(1);
    expect(g.stock.length).toBe(4);
    expect(g.undo()?.type).toBe('play');
    expect(g.tableau[18]?.rank).toBe(7);
    expect(g.score).toBe(0);
    expect(g.undo()).toBeNull(); // отменять больше нечего
    g.draw();
    expect(g.undo()).not.toBeNull();
    g.draw();
    expect(g.undosLeft).toBe(0);
    expect(g.undo()).toBeNull(); // отмены кончились
  });

  it('джокер принимает любую карту', () => {
    const g = new Game(makeDeal({}, [9, 2]));
    expect(g.playable()).toEqual([]);
    g.addJoker();
    expect(g.playable().length).toBe(10);
    expect(g.play(18)).toBe(true);
  });

  it('«+5 карт» добавляет подходящие карты и не даёт лишних звёзд', () => {
    const g = new Game(makeDeal({}, [9]));
    expect(g.status).toBe('lost');
    const bonus = makeBonusCards(g, mulberry32(1));
    expect(bonus.length).toBe(5);
    for (const b of bonus) expect([4, 6]).toContain(b.rank);
    g.addCards(bonus);
    expect(g.status).toBe('playing');
    expect(g.stock.length).toBe(5);
    expect(g.stockLeft).toBe(0);
    g.draw();
    expect(g.playable().length).toBe(10);
  });
});

describe('победа и поражение', () => {
  it('поражение: колода пуста и ходов нет', () => {
    const g = new Game(makeDeal({}, [9, 10]));
    expect(g.status).toBe('playing');
    g.draw();
    expect(g.status).toBe('lost');
  });

  it('пока в колоде есть карты, партия не проиграна', () => {
    const g = new Game(makeDeal({}, [9, 10, 11]));
    g.draw();
    expect(g.status).toBe('playing');
  });

  it('победа: убраны все 28 карт, известное решение проходит', () => {
    const deal = generateDeal(7, { runs: 9, interleave: 0.3 });
    const g = new Game(deal);
    for (const m of deal.solution) expect(m.type === 'draw' ? g.draw() : g.play(m.index)).toBe(true);
    expect(g.remaining).toBe(0);
    expect(g.status).toBe('won');
    expect(g.stock.length).toBe(deal.par);
  });

  it('звёзды растут с остатком колоды', () => {
    expect(starsFor(0)).toBe(1);
    expect(starsFor(4)).toBe(2);
    expect(starsFor(8)).toBe(3);
    expect(starsFor(23)).toBe(3);
  });
});

describe('генератор', () => {
  it('в раскладке ровно колода из 52 разных карт', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const d = generateDeal(seed, { runs: 6 + (seed % 9), interleave: 0.3 });
      expect(d.tableau.length).toBe(28);
      expect(d.stock.length).toBe(24);
      const all = new Set([...d.tableau, ...d.stock].map((x) => x.rank * 4 + x.suit));
      expect(all.size).toBe(52);
    }
  });

  it('один сид — одна и та же раскладка', () => {
    expect(dealForLevel(1, 5)).toEqual(dealForLevel(1, 5));
    expect(dealForLevel(1, 5)).not.toEqual(dealForLevel(1, 6));
  });

  it('200 случайных сидов решаемы (независимый решатель)', () => {
    for (let seed = 1000; seed < 1200; seed++) {
      const d = generateDeal(seed, { runs: 4 + (seed % 14), interleave: 0.3 });
      expect(replay(d, d.solution), 'решение сида ' + seed).toBe(true);
      expect(solve(d), 'решатель, сид ' + seed).toBe(true);
    }
  });

  it('решатель отличает нерешаемую раскладку', () => {
    expect(solve(makeDeal({}, [9, 10, 11]))).toBe(false);
  });

  it('все 12 партий дела 1 решаемы, сложность растёт', () => {
    const rates: number[] = [];
    for (let level = 1; level <= 12; level++) {
      const d = dealForLevel(1, level);
      expect(replay(d, d.solution)).toBe(true);
      expect(solve(d)).toBe(true);
      rates.push(rateDeal(d, 200));
    }
    const first = (rates[0] + rates[1] + rates[2]) / 3;
    const last = (rates[9] + rates[10] + rates[11]) / 3;
    expect(first).toBeGreaterThan(0.8);
    expect(last).toBeLessThan(0.65);
    expect(first - last).toBeGreaterThan(0.25);
  });

  it('партия дня решаема и одинакова в течение дня', () => {
    const day = new Date(2026, 10, 10);
    const d = dealForDaily(day);
    expect(solve(d)).toBe(true);
    expect(dealForDaily(new Date(2026, 10, 10, 23, 59))).toEqual(d);
  });
});
