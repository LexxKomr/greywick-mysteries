// Правила пасьянса «Три пика». Чистая логика без отрисовки.

/** rank: 1 (туз) … 13 (король); 0 = джокер. suit: 0 ♠, 1 ♥, 2 ♦, 3 ♣. */
export interface Card {
  rank: number;
  suit: number;
}

export const TABLEAU_SIZE = 28;
export const STOCK_SIZE = 24; // 23 в колоде + 1 сразу в сброс
export const JOKER: Card = { rank: 0, suit: 0 };

/** Ряд карты в раскладке: 0 (вершины) … 3 (нижний ряд из 10). */
export function rowOf(i: number): number {
  if (i < 3) return 0;
  if (i < 9) return 1;
  if (i < 18) return 2;
  return 3;
}

/** Какие карты лежат поверх карты i (пока они на месте, i закрыта). */
export function coveredBy(i: number): number[] {
  if (i < 3) return [3 + 2 * i, 4 + 2 * i];
  if (i < 9) {
    const q = i - 3;
    const p = Math.floor(q / 2);
    const k = q % 2;
    return [9 + 3 * p + k, 10 + 3 * p + k];
  }
  if (i < 18) return [i + 9, i + 10];
  return [];
}

const COVERS: number[][] = Array.from({ length: TABLEAU_SIZE }, (_, i) => coveredBy(i));

/** Соседние по старшинству? Король и туз замыкаются. Джокер подходит ко всему. */
export function isAdjacent(a: number, b: number): boolean {
  if (a === 0 || b === 0) return true;
  const d = Math.abs(a - b);
  return d === 1 || d === 12;
}

export type Move = { type: 'play'; index: number } | { type: 'draw' };

export interface Deal {
  tableau: Card[]; // 28 карт
  stock: Card[]; // 24 карты, stock[0] сразу уходит в сброс
  solution: Move[]; // известное решение
  par: number; // сколько карт остаётся в колоде при известном решении
}

export type Status = 'playing' | 'won' | 'lost';

interface HistoryEntry {
  type: 'play' | 'draw';
  index: number;
  card: Card;
  streak: number;
  score: number;
  bonusInStock: number;
}

export class Game {
  tableau: (Card | null)[];
  stock: Card[];
  waste: Card[];
  streak = 0;
  bestStreak = 0;
  score = 0;
  undosLeft: number;
  /** сколько добавленных («+5 карт») карт ещё лежит сверху колоды */
  bonusInStock = 0;
  private history: HistoryEntry[] = [];

  constructor(deal: Deal, freeUndos = 3) {
    this.tableau = deal.tableau.map((c) => ({ ...c }));
    this.stock = deal.stock.slice(1).map((c) => ({ ...c }));
    this.waste = [{ ...deal.stock[0] }];
    this.undosLeft = freeUndos;
  }

  get top(): Card {
    return this.waste[this.waste.length - 1];
  }

  get remaining(): number {
    let n = 0;
    for (const c of this.tableau) if (c) n++;
    return n;
  }

  /** Карта открыта, когда убраны обе карты, которые её накрывают. */
  isOpen(i: number): boolean {
    if (!this.tableau[i]) return false;
    for (const j of COVERS[i]) if (this.tableau[j]) return false;
    return true;
  }

  canPlay(i: number): boolean {
    const c = this.tableau[i];
    return !!c && this.isOpen(i) && isAdjacent(c.rank, this.top.rank);
  }

  playable(): number[] {
    const res: number[] = [];
    for (let i = 0; i < TABLEAU_SIZE; i++) if (this.canPlay(i)) res.push(i);
    return res;
  }

  play(i: number): boolean {
    if (this.status !== 'playing' || !this.canPlay(i)) return false;
    const card = this.tableau[i]!;
    this.history.push({ type: 'play', index: i, card, streak: this.streak, score: this.score, bonusInStock: this.bonusInStock });
    this.tableau[i] = null;
    this.waste.push(card);
    this.streak++;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    this.score += 10 * this.streak;
    return true;
  }

  draw(): boolean {
    if (this.status !== 'playing' || this.stock.length === 0) return false;
    const card = this.stock.shift()!;
    this.history.push({ type: 'draw', index: -1, card, streak: this.streak, score: this.score, bonusInStock: this.bonusInStock });
    if (this.bonusInStock > 0) this.bonusInStock--;
    this.waste.push(card);
    this.streak = 0;
    return true;
  }

  get canUndo(): boolean {
    return this.undosLeft > 0 && this.history.length > 0 && this.remaining > 0;
  }

  /** Отменяет последний ход. Возвращает отменённую запись или null. */
  undo(): { type: 'play' | 'draw'; index: number; card: Card } | null {
    if (!this.canUndo) return null;
    const h = this.history.pop()!;
    this.waste.pop();
    if (h.type === 'play') this.tableau[h.index] = h.card;
    else this.stock.unshift(h.card);
    this.streak = h.streak;
    this.score = h.score;
    this.bonusInStock = h.bonusInStock;
    this.undosLeft--;
    return h;
  }

  /** Джокер ложится в сброс: на него можно положить любую карту. */
  addJoker(): void {
    this.waste.push({ ...JOKER });
    this.history = []; // через помощника отмена не идёт
  }

  /** «+5 карт»: карты кладутся сверху колоды. */
  addCards(cards: Card[]): void {
    this.stock.unshift(...cards.map((c) => ({ ...c })));
    this.bonusInStock += cards.length;
    this.history = [];
  }

  get status(): Status {
    if (this.remaining === 0) return 'won';
    if (this.stock.length === 0 && this.playable().length === 0) return 'lost';
    return 'playing';
  }

  /** Сколько «своих» карт осталось в колоде (добавленные не считаются). */
  get stockLeft(): number {
    return Math.max(0, this.stock.length - this.bonusInStock);
  }
}

/** Звёзды за выигранную партию: по оставшимся в колоде картам. */
export function starsFor(stockLeft: number): number {
  if (stockLeft >= 8) return 3;
  if (stockLeft >= 4) return 2;
  return 1;
}

/** Карты для «+5 карт»: каждая подходит к какой-нибудь открытой карте пиков. */
export function makeBonusCards(game: Game, rng: () => number, n = 5): Card[] {
  const open: Card[] = [];
  for (let i = 0; i < TABLEAU_SIZE; i++) if (game.isOpen(i)) open.push(game.tableau[i]!);
  const res: Card[] = [];
  for (let k = 0; k < n; k++) {
    let rank = 1 + Math.floor(rng() * 13);
    if (open.length > 0) {
      const base = open[Math.floor(rng() * open.length)].rank;
      rank = rng() < 0.5 ? (base === 13 ? 1 : base + 1) : base === 1 ? 13 : base - 1;
    }
    res.push({ rank, suit: Math.floor(rng() * 4) });
  }
  return res;
}
