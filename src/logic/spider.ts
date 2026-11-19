// «Паук» в одну масть. У карт одного ранга разные идентификаторы.
import { mulberry32 } from './generator';

export interface SpiderCard { id: number; rank: number; up: boolean }
export type SpiderMove = { type: 'move'; from: number; at: number; to: number } | { type: 'draw' };
interface Snapshot { columns: SpiderCard[][]; stock: SpiderCard[]; runs: number }



export class SpiderGame {
  columns: SpiderCard[][];
  stock: SpiderCard[];
  runs = 0;
  turns = 0;
  undosLeft = 3;
  private history: Snapshot[] = [];

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const deck = Array.from({ length: 104 }, (_, id) => ({ id, rank: id % 13 + 1, up: false }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.columns = Array.from({ length: 10 }, (_, col) => {
      const cards = deck.splice(0, col < 4 ? 6 : 5);
      cards[cards.length - 1].up = true;
      return cards;
    });
    this.stock = deck;
  }

  get won(): boolean { return this.runs === 8; }
  get canDraw(): boolean { return this.stock.length >= 10 && this.columns.every((col) => col.length > 0); }
  get hasUndo(): boolean { return this.history.length > 0; }

  get canUndo(): boolean { return this.hasUndo && this.undosLeft > 0; }

  canLift(from: number, at: number): boolean {
    const column = this.columns[from];
    return !!column?.[at]?.up && column.slice(at + 1).every((card, i) => card.up && card.rank + 1 === column[at + i].rank);
  }

  canMove(from: number, at: number, to: number): boolean {
    const destination = this.columns[to];
    if (from === to || !destination || !this.canLift(from, at)) return false;
    const target = destination[destination.length - 1];
    return !target || target.rank === this.columns[from][at].rank + 1;
  }

  private settle(column: SpiderCard[]): void {
    while (column.length >= 13) {
      const run = column.slice(-13);
      if (!run.every((card, i) => card.up && card.rank === 13 - i)) break;
      column.splice(-13);
      this.runs++;
    }
    const top = column[column.length - 1];
    if (top) top.up = true;
  }

  play(move: SpiderMove, record = true): boolean {
    if (move.type === 'draw' ? !this.canDraw : !this.canMove(move.from, move.at, move.to)) return false;
    if (record) this.history.push({ columns: this.columns.map((col) => col.map((card) => ({ ...card }))), stock: this.stock.slice(), runs: this.runs });
    if (move.type === 'move') {
      const source = this.columns[move.from];
      const destination = this.columns[move.to];
      destination.push(...source.splice(move.at));
      this.settle(source);
      this.settle(destination);
    } else {
      this.columns.forEach((column) => {
        column.push({ ...this.stock.shift()!, up: true });
        this.settle(column);
      });
    }
    this.turns++;
    return true;
  }

  undo(rewarded = false): boolean {
    if (!this.hasUndo || (!rewarded && !this.canUndo)) return false;
    const last = this.history.pop()!;
    this.columns = last.columns;
    this.stock = last.stock;
    this.runs = last.runs;
    this.turns--;
    if (!rewarded) this.undosLeft--;
    return true;
  }

  /** Кандидаты для подсказки и проверки раскладок. Пустые столбцы взаимозаменяемы. */
  options(): { move: SpiderMove; score: number }[] {
    const options: { move: SpiderMove; score: number }[] = [];
    const empty = this.columns.findIndex((col) => col.length === 0);
    for (let from = 0; from < this.columns.length; from++) {
      const col = this.columns[from];
      for (let at = col.length - 1; at >= 0 && this.canLift(from, at); at--) {
        const below = col[at - 1];
        const split = below?.up && below.rank === col[at].rank + 1;
        for (let to = 0; to < this.columns.length; to++) {
          if (!this.canMove(from, at, to)) continue;
          const target = this.columns[to];
          if (!target.length && (at === 0 || to !== empty)) continue;
          const opens = below && !below.up;
          const needed = 13 - (col.length - at);
          const completes = needed > 0 && target.length >= needed && col[col.length - 1]?.rank === 1
            && target.slice(-needed).every((card, i) => card.up && card.rank === 13 - i);
          const score = (opens ? 34 : 0) + (at === 0 ? 22 : 0) + (completes ? 70 : 0)
            + (target.length ? 16 : -10) + (split ? -27 : 0) + (col.length - at) * 0.3;
          options.push({ move: { type: 'move', from, at, to }, score });
        }
      }
    }
    if (this.canDraw) options.push({ move: { type: 'draw' }, score: -8 });
    return options;
  }

  key(ordered = false): string {
    const keys = this.columns.map((col) => col.map((card) => card.up ? card.rank : -card.rank).join(','));
    return (ordered ? keys : keys.sort()).join('|') + ':' + this.stock.length;
  }
}

/** Предпочитает вскрытие карт и сбор серий. Не советует вернуться в уже показанную позицию. */
export function spiderHint(game: SpiderGame, visited: ReadonlySet<string>): SpiderMove | undefined {
  const options = game.options().sort((a, b) => b.score - a.score);
  const sample = new SpiderGame(0);
  for (const { move } of options) {
    sample.columns = game.columns.map((col) => col.map((card) => ({ ...card })));
    sample.stock = game.stock.slice();
    sample.runs = game.runs;
    sample.play(move, false);
    if (!visited.has(sample.key())) return move;
  }
  return options[0]?.move;
}
