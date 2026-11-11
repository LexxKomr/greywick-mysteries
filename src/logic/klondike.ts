// Пасьянс «Косынка» (Klondike), сдача по одной карте, колоду можно проходить сколько угодно.
// Чистая логика без отрисовки.

import { Card } from './tripeaks';
import { mulberry32 } from './generator';

export interface TCard extends Card {
  up: boolean;
}

/** Откуда берём: верх сброса или карта столбика (index — место в столбике, от нижней). */
export type KSource = { type: 'waste' } | { type: 'tab'; col: number; index: number };
/** Куда кладём: дом масти или столбик. */
export type KDest = { type: 'found' } | { type: 'tab'; col: number };

export type KMove = { type: 'draw' } | { type: 'move'; from: KSource; to: KDest };

const isRed = (suit: number) => suit === 1 || suit === 2;

/** Полная перетасованная колода по сиду. */
export function shuffledDeck(seed: number): Card[] {
  const rng = mulberry32(seed);
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

interface Snapshot {
  tableau: TCard[][];
  stock: Card[];
  waste: Card[];
  found: number[];
  recycles: number;
}

export class KlondikeGame {
  tableau: TCard[][] = [];
  stock: Card[] = []; // верхняя карта — последняя
  waste: Card[] = [];
  /** сколько карт уже лежит в доме каждой масти */
  found = [0, 0, 0, 0];
  recycles = 0;
  moves = 0;
  private history: Snapshot[] = [];

  constructor(seed: number) {
    const deck = shuffledDeck(seed);
    let k = 0;
    for (let col = 0; col < 7; col++) {
      const pile: TCard[] = [];
      for (let i = 0; i <= col; i++) pile.push({ ...deck[k++], up: i === col });
      this.tableau.push(pile);
    }
    this.stock = deck.slice(k).reverse();
  }

  get inFoundations(): number {
    return this.found[0] + this.found[1] + this.found[2] + this.found[3];
  }

  get won(): boolean {
    return this.inFoundations === 52;
  }

  get faceDown(): number {
    let n = 0;
    for (const pile of this.tableau) for (const c of pile) if (!c.up) n++;
    return n;
  }

  private snapshot(): void {
    this.history.push({
      tableau: this.tableau.map((p) => p.map((c) => ({ ...c }))),
      stock: this.stock.slice(),
      waste: this.waste.slice(),
      found: this.found.slice(),
      recycles: this.recycles,
    });
    if (this.history.length > 400) this.history.shift();
  }

  get canUndo(): boolean {
    return this.history.length > 0 && !this.won;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const h = this.history.pop()!;
    this.tableau = h.tableau;
    this.stock = h.stock;
    this.waste = h.waste;
    this.found = h.found;
    this.recycles = h.recycles;
    return true;
  }

  get canDraw(): boolean {
    return this.stock.length > 0 || this.waste.length > 0;
  }

  /** Нажатие на колоду: открыть карту или, если колода кончилась, перевернуть сброс. */
  draw(): 'card' | 'recycle' | null {
    if (!this.canDraw) return null;
    this.snapshot();
    this.moves++;
    if (this.stock.length > 0) {
      this.waste.push(this.stock.pop()!);
      return 'card';
    }
    this.stock = this.waste.reverse();
    this.waste = [];
    this.recycles++;
    return 'recycle';
  }

  /** Карты, которые переносятся с этого места (одна или стопка открытых). */
  cardsAt(from: KSource): Card[] {
    if (from.type === 'waste') return this.waste.length ? [this.waste[this.waste.length - 1]] : [];
    const pile = this.tableau[from.col];
    if (from.index < 0 || from.index >= pile.length || !pile[from.index].up) return [];
    return pile.slice(from.index);
  }

  fitsFoundation(card: Card): boolean {
    return this.found[card.suit] === card.rank - 1;
  }

  fitsColumn(card: Card, col: number): boolean {
    const pile = this.tableau[col];
    if (pile.length === 0) return card.rank === 13;
    const top = pile[pile.length - 1];
    return top.up && top.rank === card.rank + 1 && isRed(top.suit) !== isRed(card.suit);
  }

  canMove(from: KSource, to: KDest): boolean {
    const cards = this.cardsAt(from);
    if (!cards.length) return false;
    if (to.type === 'found') return cards.length === 1 && this.fitsFoundation(cards[0]);
    if (from.type === 'tab' && from.col === to.col) return false;
    return this.fitsColumn(cards[0], to.col);
  }

  move(from: KSource, to: KDest): boolean {
    if (!this.canMove(from, to)) return false;
    this.snapshot();
    let cards: Card[];
    if (from.type === 'waste') {
      cards = [this.waste.pop()!];
    } else {
      const pile = this.tableau[from.col];
      cards = pile.splice(from.index);
      if (pile.length && !pile[pile.length - 1].up) pile[pile.length - 1].up = true; // открываем следующую
    }
    if (to.type === 'found') this.found[cards[0].suit]++;
    else for (const c of cards) this.tableau[to.col].push({ rank: c.rank, suit: c.suit, up: true });
    this.moves++;
    return true;
  }

  /**
   * Куда можно положить карту с этого места, в порядке «что разумнее»:
   * дом, потом непустые столбики, потом пустой столбик (только если ход не бессмысленный).
   */
  destinations(from: KSource): KDest[] {
    const cards = this.cardsAt(from);
    const res: KDest[] = [];
    if (!cards.length) return res;
    if (cards.length === 1 && this.fitsFoundation(cards[0])) res.push({ type: 'found' });
    const empty: KDest[] = [];
    for (let col = 0; col < 7; col++) {
      if (from.type === 'tab' && from.col === col) continue;
      if (!this.fitsColumn(cards[0], col)) continue;
      if (this.tableau[col].length === 0) {
        // король, который и так лежит в основании столбика, в пустой столбик не переносим
        if (from.type === 'tab' && from.index === 0) continue;
        if (!empty.length) empty.push({ type: 'tab', col });
      } else res.push({ type: 'tab', col });
    }
    return res.concat(empty);
  }

  /** Ходы, которые что-то дают: в дом, с открытием закрытой карты, со сброса, освобождение столбика под короля. */
  usefulMoves(): { from: KSource; to: KDest; weight: number }[] {
    const res: { from: KSource; to: KDest; weight: number }[] = [];
    const kingWaiting = this.tableau.some((p) => p.some((c, i) => c.up && c.rank === 13 && i > 0)) || this.stock.concat(this.waste).some((c) => c.rank === 13);
    for (let col = 0; col < 7; col++) {
      const pile = this.tableau[col];
      if (!pile.length) continue;
      const topSrc: KSource = { type: 'tab', col, index: pile.length - 1 };
      if (this.fitsFoundation(pile[pile.length - 1])) res.push({ from: topSrc, to: { type: 'found' }, weight: 5 });
      const first = pile.findIndex((c) => c.up);
      const src: KSource = { type: 'tab', col, index: first };
      for (const to of this.destinations(src)) {
        if (to.type !== 'tab') continue;
        if (first > 0) res.push({ from: src, to, weight: 4 }); // откроется закрытая карта
        else if (this.tableau[to.col].length > 0 && kingWaiting) res.push({ from: src, to, weight: 2 }); // освободится столбик
      }
    }
    if (this.waste.length) {
      for (const to of this.destinations({ type: 'waste' })) res.push({ from: { type: 'waste' }, to, weight: to.type === 'found' ? 5 : 3 });
    }
    return res;
  }

  /** Есть ли в колоде или сбросе карта, которую можно куда-то положить. */
  private stockHelps(): boolean {
    for (const c of this.stock.concat(this.waste)) {
      if (this.fitsFoundation(c)) return true;
      for (let col = 0; col < 7; col++) if (this.fitsColumn(c, col)) return true;
    }
    return false;
  }

  /** Тупик: ни одного полезного хода ни на столе, ни в колоде. */
  get stuck(): boolean {
    if (this.won) return false;
    return this.usefulMoves().length === 0 && !this.stockHelps();
  }

  /** Все карты открыты — дальше пасьянс сходится сам. */
  get canAutoFinish(): boolean {
    return !this.won && this.faceDown === 0;
  }

  /** Один шаг авто-сбора в дома. Возвращает false, когда собирать больше нечего. */
  autoStep(): boolean {
    for (let col = 0; col < 7; col++) {
      const pile = this.tableau[col];
      if (pile.length && this.fitsFoundation(pile[pile.length - 1])) return this.move({ type: 'tab', col, index: pile.length - 1 }, { type: 'found' });
    }
    if (this.waste.length && this.fitsFoundation(this.waste[this.waste.length - 1])) return this.move({ type: 'waste' }, { type: 'found' });
    return this.draw() !== null;
  }
}

/** Звёзды: чем меньше раз пришлось переворачивать колоду, тем больше. */
export function klondikeStars(recycles: number): number {
  return recycles <= 2 ? 3 : recycles <= 4 ? 2 : 1;
}

/**
 * Бот «обычный игрок»: делает полезные ходы (в дом, открыть карту, со сброса), иначе берёт
 * из колоды. Если он выиграл — раскладка заведомо решаема, а его ходы и есть решение.
 */
export function klondikeBot(seed: number, rng: () => number, maxMoves = 900): KMove[] | null {
  const g = new KlondikeGame(seed);
  const moves: KMove[] = [];
  let idleDraws = 0;
  while (!g.won && moves.length < maxMoves) {
    const useful = g.usefulMoves();
    if (useful.length) {
      const best = Math.max(...useful.map((m) => m.weight));
      const pool = useful.filter((m) => m.weight === best || rng() < 0.15);
      const m = pool[Math.floor(rng() * pool.length)];
      g.move(m.from, m.to);
      moves.push({ type: 'move', from: m.from, to: m.to });
      idleDraws = 0;
      continue;
    }
    if (!g.canDraw || idleDraws > g.stock.length + g.waste.length + 1) return null;
    g.draw();
    moves.push({ type: 'draw' });
    idleDraws++;
  }
  return g.won ? moves : null;
}

/** Ищет решение: несколько попыток бота. Возвращает ходы или null. */
export function solveKlondike(seed: number, tries = 40): KMove[] | null {
  const rng = mulberry32(seed * 31 + 7);
  for (let k = 0; k < tries; k++) {
    const moves = klondikeBot(seed, rng);
    if (moves) return moves;
  }
  return null;
}

/** Лёгкость раскладки: доля побед бота. */
export function rateKlondike(seed: number, n = 40): number {
  const rng = mulberry32(seed * 17 + 3);
  let wins = 0;
  for (let k = 0; k < n; k++) if (klondikeBot(seed, rng)) wins++;
  return wins / n;
}

export function replayKlondike(seed: number, moves: KMove[]): boolean {
  const g = new KlondikeGame(seed);
  for (const m of moves) {
    const ok = m.type === 'draw' ? g.draw() !== null : g.move(m.from, m.to);
    if (!ok) return false;
  }
  return g.won;
}
