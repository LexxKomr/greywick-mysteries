import { expect, it } from 'vitest';
import { GOLF_SEEDS, GolfGame } from '../src/logic/golf';
import { SpiderGame } from '../src/logic/spider';
import { KlondikeGame } from '../src/logic/klondike';
import { FreeCellGame } from '../src/logic/freecell';
import { generatePyramid, PyramidGame } from '../src/logic/pyramid';
import { dealForBlock } from '../src/logic/generator';
import { Game } from '../src/logic/tripeaks';

const freecell = new FreeCellGame(25, 3);
const spider = new SpiderGame(5);
const klondike = new KlondikeGame(12, 3);
const golf = new GolfGame(GOLF_SEEDS[0]);
const pyramid = new PyramidGame(generatePyramid(7, 0.8));
const peaks = new Game(dealForBlock(1, 1, 1));
const variants = [
  { name: 'TriPeaks', game: peaks, move: () => peaks.draw() },
  { name: 'Pyramid', game: pyramid, move: () => pyramid.draw() },
  { name: 'Klondike', game: klondike, move: () => klondike.draw() },
  { name: 'FreeCell', game: freecell, move: (i: number) => freecell.move({ type: 'col', col: i, index: 6 }, { type: 'cell' }) },
  { name: 'Golf', game: golf, move: () => golf.play({ type: 'draw' }) },
  { name: 'Spider', game: spider, move: () => spider.play({ type: 'draw' }) },
];

it.each(variants)('$name gives three free undos and consumes a reward for the next', ({ game, move }) => {
  expect(game.hasUndo).toBe(false);
  for (let i = 0; i < 4; i++) expect(move(i)).toBeTruthy();
  for (const remaining of [2, 1, 0]) {
    expect(game.undo()).toBeTruthy();
    expect(game.undosLeft).toBe(remaining);
  }
  expect(game.hasUndo).toBe(true);
  expect(game.undo()).toBeFalsy();
  expect(game.undo(true)).toBeTruthy();
  expect(game.undosLeft).toBe(0);
  expect(game.hasUndo).toBe(false);
  expect(game.undo(true)).toBeFalsy();
});
