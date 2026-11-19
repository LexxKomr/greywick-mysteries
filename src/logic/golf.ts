// «Гольф»: семь открытых столбцов, одна колода, обычное соседство рангов.
import { shuffledDeck } from './klondike';
import type { Card } from './tripeaks';

export type GolfMove = { type: 'play'; col: number } | { type: 'draw' };
export const GOLF_SEEDS = [267, 35, 21];

const adjacent = (a: number, b: number) => Math.abs(a - b) === 1;

export class GolfGame {
  readonly columns: Card[][];
  readonly stock: Card[];
  readonly waste: Card[];
  private history: GolfMove[] = [];
  undosLeft = 3;

  constructor(seed: number) {
    const deck = shuffledDeck(seed);
    this.columns = Array.from({ length: 7 }, (_, col) => deck.slice(col * 5, col * 5 + 5));
    this.stock = deck.slice(36);
    this.waste = [deck[35]];
  }

  get top(): Card { return this.waste[this.waste.length - 1]; }
  get won(): boolean { return this.columns.every((column) => !column.length); }
  get canUndo(): boolean { return this.undosLeft > 0 && this.history.length > 0; }

  play(move: GolfMove): boolean {
    if (this.won) return false;
    if (move.type === 'play') {
      const column = this.columns[move.col];
      const card = column?.[column.length - 1];
      if (!card || !adjacent(card.rank, this.top.rank)) return false;
      this.waste.push(column.pop()!);
    } else {
      if (!this.stock.length) return false;
      this.waste.push(this.stock.shift()!);
    }
    this.history.push(move);
    return true;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const move = this.history.pop()!;
    const card = this.waste.pop()!;
    if (move.type === 'play') this.columns[move.col].push(card);
    else this.stock.unshift(card);
    this.undosLeft--;
    return true;
  }
}

/** Ищет выигрыш из текущей позиции и возвращает его первый ход. */
export function solveGolf(game: GolfGame, limit = 80_000): { result: boolean | null; first?: GolfMove; stockLeft?: number; nodes: number } {
  const lengths = game.columns.map((column) => column.length);
  const failed = new Set<number>();
  let nodes = 0;
  let stockLeft: number | undefined;
  let first: GolfMove | undefined;
  const visit = (rank: number, stock: number, origin?: GolfMove): boolean | null => {
    if (lengths.every((n) => !n)) {
      first = origin;
      stockLeft = game.stock.length - stock;
      return true;
    }
    const key = lengths.reduce((key, n) => key * 6 + n, stock * 14 + rank);
    if (failed.has(key)) return false;
    if (++nodes > limit) return null;
    for (let col = 0; col < lengths.length; col++) {
      const card = game.columns[col][lengths[col] - 1];
      if (!card || !adjacent(card.rank, rank)) continue;
      lengths[col]--;
      const result = visit(card.rank, stock, origin ?? { type: 'play', col });
      lengths[col]++;
      if (result !== false) return result;
    }
    const draw = game.stock[stock];
    if (draw) {
      const result = visit(draw.rank, stock + 1, origin ?? { type: 'draw' });
      if (result !== false) return result;
    }
    failed.add(key);
    return false;
  };
  const result = visit(game.top.rank, 0);
  return { result, first, stockLeft, nodes };
}
