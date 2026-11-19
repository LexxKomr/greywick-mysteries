import { describe, expect, it } from 'vitest';
import { GOLF_SEEDS, GolfGame, solveGolf } from '../src/logic/golf';
import { SPIDER_DEALS } from '../src/logic/spiderDeals';
import { SpiderGame } from '../src/logic/spider';
import { generateRatedPyramid, PYRAMID_TARGETS, solvePyramid } from '../src/logic/pyramid';
import { replayKlondike, solveKlondike } from '../src/logic/klondike';
import { klondikeSeed } from '../src/logic/seeds';

describe('case 2 games', () => {
  it.each(GOLF_SEEDS)('solves Golf #%i from its initial deal', seed => {
    const game = new GolfGame(seed);
    while (!game.won) {
      const hint = solveGolf(game);
      expect(hint.result).toBe(true);
      expect(hint.first && game.play(hint.first)).toBe(true);
    }
  });

  it('checks Golf rank boundaries and restores the draw on undo', () => {
    const game = new GolfGame(GOLF_SEEDS[0]);
    const initial = { columns: structuredClone(game.columns), stock: game.stock.slice(), top: game.top };
    expect(game.play({ type: 'draw' })).toBe(true);
    expect(game.undo()).toBe(true);
    expect({ columns: game.columns, stock: game.stock, top: game.top }).toEqual(initial);
    game.waste.push({ rank: 13, suit: 0 });
    game.columns[0].push({ rank: 1, suit: 0 });
    expect(game.play({ type: 'play', col: 0 })).toBe(false);
  });

  it('keeps Golf playable after the screenshot move and after the last available draw', () => {
    const game = new GolfGame(GOLF_SEEDS[0]);
    const lengths = [2, 2, 2, 4, 4, 3, 3];
    game.columns.forEach((col, i) => col.splice(lengths[i]));
    game.stock.splice(0, 3);
    game.waste.push({ rank: 9, suit: 0 });

    expect(game.play({ type: 'play', col: 2 })).toBe(true);
    expect(solveGolf(game).result).toBe(false);
    expect(game.stuck).toBe(false);

    for (const col of [1, 1, 5]) expect(game.play({ type: 'play', col })).toBe(true);
    expect(game.stuck).toBe(false); // Можно взять карту из колоды.
    while (game.stock.length) expect(game.play({ type: 'draw' })).toBe(true);
    expect(game.top.rank).toBe(1);
    expect(game.stuck).toBe(false); // Открытая двойка ещё подходит на туза.
    expect(game.play({ type: 'play', col: 0 })).toBe(true);
    expect(game.play({ type: 'play', col: 2 })).toBe(true);
    expect(game.stuck).toBe(true);
  });

  it('distinguishes a real Golf dead end from a cleared tableau', () => {
    const game = new GolfGame(GOLF_SEEDS[0]);
    game.stock.splice(0);
    game.columns.forEach(col => col.splice(0));
    game.waste.push({ rank: 13, suit: 0 });
    game.columns[0].push({ rank: 1, suit: 0 });
    expect(game.stuck).toBe(true);
    game.columns[0].pop();
    expect(game.won).toBe(true);
    expect(game.stuck).toBe(false);
  });

  it.each(SPIDER_DEALS)('completes all eight Spider runs on deal $seed', ({ seed, path }) => {
    const game = new SpiderGame(seed);
    const seen = new Set(game.columns.flat().concat(game.stock).map(card => card.id));
    expect(seen.size).toBe(104);
    for (const move of path) expect(game.play(move)).toBe(true);
    expect(game.won).toBe(true);
    expect(game.columns.flat()).toHaveLength(0);
    expect(game.stock).toHaveLength(0);
  });

  it('undoes a completed Spider run and blocks a draw with an empty column', () => {
    const game = new SpiderGame(5);
    game.columns[0] = Array.from({ length: 12 }, (_, id) => ({ id, rank: 13 - id, up: true }));
    game.columns[1] = [{ id: 12, rank: 1, up: true }];
    const before = game.key(true);
    expect(game.play({ type: 'move', from: 1, at: 0, to: 0 })).toBe(true);
    expect(game.runs).toBe(1);
    expect(game.canDraw).toBe(false);
    expect(game.undo()).toBe(true);
    expect(game.runs).toBe(0);
    expect(game.key(true)).toBe(before);
  });
});
describe('reused games in case 2', () => {
  it.each([4, 5, 6])('has a solvable Pyramid deal for clue %i', level => {
    const deal = generateRatedPyramid(2000 + level, PYRAMID_TARGETS[level - 4]);
    expect(solvePyramid(deal)).toBe(true);
  });

  it.each([7, 8, 9])('has a solvable Klondike deal for clue %i', level => {
    const seed = klondikeSeed(2, level, level - 6);
    const moves = solveKlondike(seed);
    expect(moves && replayKlondike(seed, moves)).toBe(true);
  });
});
