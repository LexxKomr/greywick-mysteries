// Пасьянс «Свободная ячейка» (FreeCell). Чистая логика без отрисовки.

import { Card } from './tripeaks';
import { shuffledDeck } from './klondike';

export type FSource = { type: 'cell'; i: number } | { type: 'col'; col: number; index: number };
export type FDest = { type: 'found' } | { type: 'cell' } | { type: 'col'; col: number };

const isRed = (suit: number) => suit === 1 || suit === 2;

/** Можно ли положить карту a на карту b в столбике: на одну младше и другого цвета. */
const stacks = (a: Card, b: Card) => b.rank === a.rank + 1 && isRed(a.suit) !== isRed(b.suit);

interface Snapshot {
  cols: Card[][];
  cells: (Card | null)[];
  found: number[];
  /** снимок перед авто-сбором (не перед ходом игрока) */
  auto: boolean;
}

export class FreeCellGame {
  cols: Card[][] = [[], [], [], [], [], [], [], []];
  cells: (Card | null)[] = [null, null, null, null];
  found = [0, 0, 0, 0];
  /** ходы игрока (авто-сбор в дома не считается) */
  moves = 0;
  private history: Snapshot[] = [];

  constructor(seed: number) {
    shuffledDeck(seed).forEach((c, i) => this.cols[i % 8].push(c));
  }

  get inFoundations(): number {
    return this.found[0] + this.found[1] + this.found[2] + this.found[3];
  }

  get won(): boolean {
    return this.inFoundations === 52;
  }

  get freeCells(): number {
    return this.cells.filter((c) => !c).length;
  }

  get emptyCols(): number {
    return this.cols.filter((c) => c.length === 0).length;
  }

  private snapshot(auto: boolean): void {
    this.history.push({ cols: this.cols.map((c) => c.slice()), cells: this.cells.slice(), found: this.found.slice(), auto });
    if (this.history.length > 500) this.history.shift();
  }

  get canUndo(): boolean {
    return this.history.length > 0 && !this.won;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    // откатываем ход игрока вместе с авто-сбором, который за ним последовал
    for (;;) {
      const h = this.history.pop()!;
      this.cols = h.cols;
      this.cells = h.cells;
      this.found = h.found;
      if (!h.auto || !this.history.length) break;
    }
    return true;
  }

  /** Карты, которые переносятся с этого места: одна или правильная стопка до конца столбика. */
  cardsAt(from: FSource): Card[] {
    if (from.type === 'cell') {
      const c = this.cells[from.i];
      return c ? [c] : [];
    }
    const col = this.cols[from.col];
    if (from.index < 0 || from.index >= col.length) return [];
    const run = col.slice(from.index);
    for (let i = 0; i + 1 < run.length; i++) if (!stacks(run[i + 1], run[i])) return [];
    return run;
  }

  fitsFoundation(card: Card): boolean {
    return this.found[card.suit] === card.rank - 1;
  }

  /** Сколько карт можно перенести стопкой: зависит от свободных ячеек и пустых столбиков. */
  maxRun(toEmptyColumn: boolean): number {
    const empty = this.emptyCols - (toEmptyColumn ? 1 : 0);
    return (this.freeCells + 1) * Math.pow(2, Math.max(0, empty));
  }

  canMove(from: FSource, to: FDest): boolean {
    const cards = this.cardsAt(from);
    if (!cards.length) return false;
    if (to.type === 'found') return cards.length === 1 && this.fitsFoundation(cards[0]);
    if (to.type === 'cell') return cards.length === 1 && from.type === 'col' && this.freeCells > 0;
    if (from.type === 'col' && from.col === to.col) return false;
    const dest = this.cols[to.col];
    if (dest.length && !stacks(cards[0], dest[dest.length - 1])) return false;
    return cards.length <= this.maxRun(dest.length === 0);
  }

  move(from: FSource, to: FDest, countMove = true): boolean {
    if (!this.canMove(from, to)) return false;
    this.snapshot(!countMove);
    const cards = this.cardsAt(from);
    if (from.type === 'cell') this.cells[from.i] = null;
    else this.cols[from.col].splice(from.index);
    if (to.type === 'found') this.found[cards[0].suit]++;
    else if (to.type === 'cell') this.cells[this.cells.indexOf(null)] = cards[0];
    else this.cols[to.col].push(...cards);
    if (countMove) this.moves++;
    return true;
  }

  /** Куда можно положить, в порядке «что разумнее»: дом, занятый столбик, пустой столбик, ячейка. */
  destinations(from: FSource): FDest[] {
    const cards = this.cardsAt(from);
    const res: FDest[] = [];
    if (!cards.length) return res;
    if (this.canMove(from, { type: 'found' })) res.push({ type: 'found' });
    let empty: FDest | null = null;
    for (let col = 0; col < 8; col++) {
      if (!this.canMove(from, { type: 'col', col })) continue;
      if (this.cols[col].length === 0) {
        // весь столбик в пустой столбик не переносим — это ничего не меняет
        if (from.type === 'col' && from.index === 0) continue;
        if (!empty) empty = { type: 'col', col };
      } else res.push({ type: 'col', col });
    }
    if (empty) res.push(empty);
    if (this.canMove(from, { type: 'cell' })) res.push({ type: 'cell' });
    return res;
  }

  /** Карту можно спокойно убрать в дом: она больше не понадобится в столбиках. */
  private safeToFoundation(card: Card): boolean {
    if (!this.fitsFoundation(card)) return false;
    if (card.rank <= 2) return true;
    const others = [0, 1, 2, 3].filter((s) => isRed(s) !== isRed(card.suit));
    return others.every((s) => this.found[s] >= card.rank - 1);
  }

  /** Один шаг авто-сбора: убирает в дом карту, которая точно больше не нужна. */
  autoStep(): boolean {
    for (let col = 0; col < 8; col++) {
      const pile = this.cols[col];
      if (pile.length && this.safeToFoundation(pile[pile.length - 1])) return this.move({ type: 'col', col, index: pile.length - 1 }, { type: 'found' }, false);
    }
    for (let i = 0; i < 4; i++) {
      const c = this.cells[i];
      if (c && this.safeToFoundation(c)) return this.move({ type: 'cell', i }, { type: 'found' }, false);
    }
    return false;
  }

  /** Все возможные ходы одной картой (для подсказки и проверки тупика). */
  singleMoves(): { from: FSource; to: FDest }[] {
    const res: { from: FSource; to: FDest }[] = [];
    const sources: FSource[] = [];
    for (let col = 0; col < 8; col++) if (this.cols[col].length) sources.push({ type: 'col', col, index: this.cols[col].length - 1 });
    for (let i = 0; i < 4; i++) if (this.cells[i]) sources.push({ type: 'cell', i });
    for (const from of sources) for (const to of this.destinations(from)) res.push({ from, to });
    return res;
  }

  get stuck(): boolean {
    return !this.won && this.singleMoves().length === 0;
  }

  /** Ход для подсказки: в дом, на другую карту, потом в пустой столбик, потом в ячейку. */
  hintMove(): { from: FSource; to: FDest } | null {
    // сначала спрашиваем решатель: его первый ход ведёт к победе
    const first = solveFrom(this, 12_000).first;
    if (first) {
      const from: FSource = first.fromCol >= 0
        ? { type: 'col', col: first.fromCol, index: this.cols[first.fromCol].length - 1 }
        : { type: 'cell', i: this.cells.findIndex((x) => !!x && (x.rank - 1) * 4 + x.suit === first.card) };
      const to: FDest = first.to === 'found' ? { type: 'found' } : first.to === 'cell' ? { type: 'cell' } : { type: 'col', col: first.to };
      if (this.canMove(from, to)) return { from, to };
    }
    const all = this.singleMoves();
    const rank = (m: { from: FSource; to: FDest }) => {
      if (m.to.type === 'found') return 0;
      if (m.to.type === 'col' && this.cols[m.to.col].length > 0) return m.from.type === 'cell' ? 1 : 2;
      if (m.to.type === 'col') return 3;
      return 4;
    };
    all.sort((a, b) => rank(a) - rank(b));
    return all[0] ?? null;
  }
}

/** Звёзды: чем меньше ходов, тем больше. */
export function freecellStars(moves: number): number {
  return moves <= 110 ? 3 : moves <= 150 ? 2 : 1;
}

// ------------------------------------------------------------------
// Решатель: поиск «сначала лучшее». Нужен, чтобы каждая раскладка дела была проверена.
// ------------------------------------------------------------------

/** Ход решателя: карта, откуда (столбик или -1 = из ячейки) и куда. */
interface SolverMove {
  card: number;
  fromCol: number;
  to: 'found' | 'cell' | number;
}

interface Node {
  cols: number[][]; // карта = (rank - 1) * 4 + suit
  cells: number[];
  found: number[];
  g: number;
  f: number;
  /** первый ход пути от начала к этому положению */
  first?: SolverMove;
}

const rk = (id: number) => (id >> 2) + 1;
const st = (id: number) => id & 3;
const redId = (id: number) => st(id) === 1 || st(id) === 2;

function heuristic(n: Node): number {
  let inFound = 0;
  for (const v of n.found) inFound += v;
  let blockers = 0;
  for (const col of n.cols) {
    for (let i = 0; i < col.length; i++) {
      // карта мешает, если под ней лежит младшая карта той же масти
      for (let j = 0; j < i; j++) {
        if (st(col[j]) === st(col[i]) && rk(col[j]) < rk(col[i])) {
          blockers++;
          break;
        }
      }
    }
  }
  return (52 - inFound) * 2 + blockers * 2 + n.cells.length;
}

function keyOf(n: Node): string {
  const cols = n.cols.map((c) => String.fromCharCode(...c.map((x) => x + 48))).sort();
  return cols.join('|') + '#' + n.cells.slice().sort((a, b) => a - b).join(',');
}

function push(heap: Node[], n: Node): void {
  heap.push(n);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].f <= heap[i].f) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}

function pop(heap: Node[]): Node {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heap[l].f < heap[m].f) m = l;
      if (r < heap.length && heap[r].f < heap[m].f) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}

/** Убирает в дома всё, что точно больше не понадобится. */
function autoFoundation(n: Node): void {
  for (let changed = true; changed; ) {
    changed = false;
    const safe = (id: number) => {
      if (n.found[st(id)] !== rk(id) - 1) return false;
      if (rk(id) <= 2) return true;
      for (let s = 0; s < 4; s++) if ((s === 1 || s === 2) !== redId(id) && n.found[s] < rk(id) - 1) return false;
      return true;
    };
    for (const col of n.cols) {
      if (col.length && safe(col[col.length - 1])) {
        n.found[st(col.pop()!)]++;
        changed = true;
      }
    }
    for (let i = n.cells.length - 1; i >= 0; i--) {
      if (safe(n.cells[i])) {
        n.found[st(n.cells[i])]++;
        n.cells.splice(i, 1);
        changed = true;
      }
    }
  }
}

export interface FreeCellSolution {
  solved: boolean;
  nodes: number;
  /** длина найденного решения в ходах одной картой */
  length: number;
}

export function solveFreeCell(seed: number, nodeLimit = 60_000): FreeCellSolution {
  return solveFrom(new FreeCellGame(seed), nodeLimit);
}

/** Решает с текущего положения игры (для проверки раскладок и для подсказки). */
export function solveFrom(game: FreeCellGame, nodeLimit: number): FreeCellSolution & { first?: SolverMove } {
  const toId = (x: Card) => (x.rank - 1) * 4 + x.suit;
  const start: Node = { cols: game.cols.map((c) => c.map(toId)), cells: game.cells.filter((x): x is Card => !!x).map(toId), found: game.found.slice(), g: 0, f: 0 };
  autoFoundation(start);
  start.f = heuristic(start);
  const heap: Node[] = [start];
  const seen = new Set<string>([keyOf(start)]);
  let nodes = 0;
  while (heap.length && nodes < nodeLimit) {
    const n = pop(heap);
    nodes++;
    if (n.found[0] + n.found[1] + n.found[2] + n.found[3] === 52) return { solved: true, nodes, length: n.g, first: n.first };

    const emit = (mv: SolverMove, apply: (c: Node) => void) => {
      const c: Node = { cols: n.cols.map((x) => x.slice()), cells: n.cells.slice(), found: n.found.slice(), g: n.g + 1, f: 0, first: n.first ?? mv };
      apply(c);
      autoFoundation(c);
      const k = keyOf(c);
      if (seen.has(k)) return;
      seen.add(k);
      c.f = heuristic(c) + c.g * 0.1;
      push(heap, c);
    };

    const emptyCol = n.cols.findIndex((c) => c.length === 0);
    // источники: верх каждого столбика и карты в ячейках
    for (let s = 0; s < 8 + n.cells.length; s++) {
      const fromCol = s < 8;
      if (fromCol && n.cols[s].length === 0) continue;
      const id = fromCol ? n.cols[s][n.cols[s].length - 1] : n.cells[s - 8];
      const take = (c: Node) => {
        if (fromCol) c.cols[s].pop();
        else c.cells.splice(s - 8, 1);
      };
      if (n.found[st(id)] === rk(id) - 1) {
        emit({ card: id, fromCol: fromCol ? s : -1, to: 'found' }, (c) => {
          take(c);
          c.found[st(id)]++;
        });
      }
      for (let d = 0; d < 8; d++) {
        if (fromCol && d === s) continue;
        const dest = n.cols[d];
        if (!dest.length) continue;
        const top = dest[dest.length - 1];
        if (rk(top) === rk(id) + 1 && redId(top) !== redId(id)) {
          emit({ card: id, fromCol: fromCol ? s : -1, to: d }, (c) => {
            take(c);
            c.cols[d].push(id);
          });
        }
      }
      if (emptyCol >= 0 && !(fromCol && n.cols[s].length === 1)) {
        emit({ card: id, fromCol: fromCol ? s : -1, to: emptyCol }, (c) => {
          take(c);
          c.cols[emptyCol].push(id);
        });
      }
      if (fromCol && n.cells.length < 4) {
        emit({ card: id, fromCol: fromCol ? s : -1, to: 'cell' }, (c) => {
          take(c);
          c.cells.push(id);
        });
      }
    }
  }
  return { solved: false, nodes, length: 0 };
}

/**
 * Тупик: решатель перебрал все положения и победы нет (не просто кончился лимит).
 * Ходы одной картой покрывают и переносы стопок, поэтому ответ «тупик» точный.
 */
export function freecellDead(game: FreeCellGame, nodeLimit = 4000): boolean {
  if (game.won) return false;
  const r = solveFrom(game, nodeLimit);
  return !r.solved && r.nodes < nodeLimit;
}
