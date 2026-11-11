// Пасьянс «Пирамида». Чистая логика без отрисовки.
// Убираем пары открытых карт с суммой 13; король уходит один.
// Колода: нажатие открывает карту в сброс; колоду можно пройти до трёх раз.

import { Card } from './tripeaks';
import { mulberry32 } from './generator';

export const PYRAMID_SIZE = 28;
export const PYRAMID_ROWS = 7;
export const MAX_PASSES = 3;

/** Место хода: номер карты пирамиды (0…27) или 'waste' — верхняя карта сброса. */
export type Spot = number | 'waste';

export type PyramidMove = { type: 'draw' } | { type: 'remove'; spots: Spot[] };

export interface PyramidDeal {
  pyramid: Card[]; // 28 карт, ряд за рядом сверху вниз
  stock: Card[]; // 24 карты, stock[0] откроется первой
  solution: PyramidMove[];
}

export function rowOfPyramid(i: number): number {
  let r = 0;
  while ((r + 1) * (r + 2) / 2 <= i) r++;
  return r;
}

/** Две карты следующего ряда, которые накрывают карту i (у нижнего ряда — пусто). */
export function pyramidCovers(i: number): number[] {
  const r = rowOfPyramid(i);
  if (r === PYRAMID_ROWS - 1) return [];
  const c = i - (r * (r + 1)) / 2;
  const next = ((r + 1) * (r + 2)) / 2;
  return [next + c, next + c + 1];
}

const COVERS: number[][] = Array.from({ length: PYRAMID_SIZE }, (_, i) => pyramidCovers(i));

type Status = 'playing' | 'won' | 'lost';

interface Snapshot {
  pyramid: (Card | null)[];
  stock: Card[];
  waste: Card[];
  pass: number;
}

export class PyramidGame {
  pyramid: (Card | null)[];
  stock: Card[];
  waste: Card[] = [];
  pass = 1;
  maxPasses = MAX_PASSES;
  undosLeft: number;
  moves = 0;
  private history: Snapshot[] = [];

  constructor(deal: PyramidDeal, freeUndos = 3) {
    this.pyramid = deal.pyramid.map((c) => ({ ...c }));
    this.stock = deal.stock.map((c) => ({ ...c }));
    this.undosLeft = freeUndos;
  }

  get remaining(): number {
    let n = 0;
    for (const c of this.pyramid) if (c) n++;
    return n;
  }

  /** Открытая карта — та, которую не накрывает ни одна карта ниже. */
  isOpen(i: number): boolean {
    if (!this.pyramid[i]) return false;
    for (const j of COVERS[i]) if (this.pyramid[j]) return false;
    return true;
  }

  cardAt(spot: Spot): Card | null {
    if (spot === 'waste') return this.waste.length ? this.waste[this.waste.length - 1] : null;
    return this.isOpen(spot) ? this.pyramid[spot] : null;
  }

  /** Все места, с которых сейчас можно взять карту. */
  spots(): Spot[] {
    const res: Spot[] = [];
    for (let i = 0; i < PYRAMID_SIZE; i++) if (this.isOpen(i)) res.push(i);
    if (this.waste.length) res.push('waste');
    return res;
  }

  canRemove(spots: Spot[]): boolean {
    if (spots.length === 1) return this.cardAt(spots[0])?.rank === 13;
    if (spots.length !== 2 || spots[0] === spots[1]) return false;
    const a = this.cardAt(spots[0]);
    const b = this.cardAt(spots[1]);
    return !!a && !!b && a.rank + b.rank === 13;
  }

  private snapshot(): void {
    this.history.push({ pyramid: this.pyramid.slice(), stock: this.stock.slice(), waste: this.waste.slice(), pass: this.pass });
  }

  remove(spots: Spot[]): boolean {
    if (this.status !== 'playing' || !this.canRemove(spots)) return false;
    this.snapshot();
    for (const s of spots) {
      if (s === 'waste') this.waste.pop();
      else this.pyramid[s] = null;
    }
    this.moves++;
    return true;
  }

  get canDraw(): boolean {
    return this.stock.length > 0 || (this.waste.length > 0 && this.pass < this.maxPasses);
  }

  /** Нажатие на колоду: открыть карту, а если колода кончилась — начать новый проход. */
  draw(): 'card' | 'pass' | null {
    if (this.status !== 'playing' || !this.canDraw) return null;
    this.snapshot();
    this.moves++;
    if (this.stock.length > 0) {
      this.waste.push(this.stock.shift()!);
      return 'card';
    }
    this.stock = this.waste;
    this.waste = [];
    this.pass++;
    return 'pass';
  }

  get canUndo(): boolean {
    return this.undosLeft > 0 && this.history.length > 0 && this.remaining > 0;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const h = this.history.pop()!;
    this.pyramid = h.pyramid;
    this.stock = h.stock;
    this.waste = h.waste;
    this.pass = h.pass;
    this.undosLeft--;
    return true;
  }

  /** «+1 проход» (помощник за рекламу). */
  addPass(): void {
    this.maxPasses++;
    this.history = [];
  }

  /** Подходящий ход для подсказки: король, пара или null (тогда — колода). */
  findRemoval(): Spot[] | null {
    const spots = this.spots();
    for (const s of spots) if (this.cardAt(s)!.rank === 13) return [s];
    for (let a = 0; a < spots.length; a++) {
      for (let b = a + 1; b < spots.length; b++) {
        if (this.cardAt(spots[a])!.rank + this.cardAt(spots[b])!.rank === 13) return [spots[a], spots[b]];
      }
    }
    return null;
  }

  get status(): Status {
    if (this.remaining === 0) return 'won';
    if (!this.canDraw && !this.findRemoval()) return 'lost';
    return 'playing';
  }
}

/** Звёзды: чем меньше проходов колоды понадобилось, тем больше. */
export function pyramidStars(pass: number): number {
  return pass <= 1 ? 3 : pass === 2 ? 2 : 1;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Раскладка строится «от решения»: по шагам разбираем пустую пирамиду и на каждом шаге
 * решаем, какие старшинства лежали на снятых местах. Поэтому решение есть всегда.
 * ease 0…1: чем больше, тем больше королей и пар внутри самой пирамиды (легче).
 */
function tryBuildPyramid(rng: () => number, ease: number): PyramidDeal | null {
  const left = new Array<number>(14).fill(4);
  const suits: number[][] = Array.from({ length: 14 }, () => shuffle([0, 1, 2, 3], rng));
  const take = (rank: number): Card => {
    left[rank]--;
    return { rank, suit: suits[rank].pop()! };
  };
  const pyramid = new Array<Card | null>(PYRAMID_SIZE).fill(null);
  const gone = new Array<boolean>(PYRAMID_SIZE).fill(false);
  const isOpen = (i: number) => !gone[i] && COVERS[i].every((j) => gone[j]);
  const pairRank = (): number => {
    const options: number[] = [];
    for (let r = 1; r <= 12; r++) if (left[r] > 0 && left[13 - r] > 0) options.push(r);
    return options.length ? options[Math.floor(rng() * options.length)] : 0;
  };

  // шаги решения: снятые места и (для пары с колодой) карта-напарник из колоды
  const steps: { spots: number[]; partner?: Card }[] = [];
  let removed = 0;
  while (removed < PYRAMID_SIZE) {
    const open: number[] = [];
    for (let i = 0; i < PYRAMID_SIZE; i++) if (isOpen(i)) open.push(i);
    const roll = rng();
    const pick = () => open.splice(Math.floor(rng() * open.length), 1)[0];
    if (left[13] > 0 && roll < 0.06 + 0.1 * ease) {
      const a = pick();
      pyramid[a] = take(13);
      gone[a] = true;
      removed++;
      steps.push({ spots: [a] });
    } else if (open.length >= 2 && roll < 0.3 + 0.45 * ease) {
      const r = pairRank();
      if (!r) return null;
      const a = pick();
      const b = pick();
      pyramid[a] = take(r);
      pyramid[b] = take(13 - r);
      gone[a] = gone[b] = true;
      removed += 2;
      steps.push({ spots: [a, b] });
    } else {
      const r = pairRank();
      if (!r) return null;
      const a = pick();
      pyramid[a] = take(r);
      gone[a] = true;
      removed++;
      steps.push({ spots: [a], partner: take(13 - r) });
    }
  }

  const partners = steps.filter((s) => s.partner).length;
  if (partners > 24) return null;
  const junk: Card[] = [];
  for (let r = 1; r <= 13; r++) while (left[r] > 0) junk.push(take(r));
  shuffle(junk, rng);
  if (partners + junk.length !== 24) return null;

  // лишние карты колоды вставляем перед случайными напарниками, остаток — в конец
  const before: Card[][] = Array.from({ length: partners + 1 }, () => []);
  for (const c of junk) before[Math.floor(rng() * (partners + 1))].push(c);

  const stock: Card[] = [];
  const solution: PyramidMove[] = [];
  let k = 0;
  for (const s of steps) {
    if (!s.partner) {
      solution.push({ type: 'remove', spots: s.spots });
      continue;
    }
    for (const c of before[k]) {
      stock.push(c);
      solution.push({ type: 'draw' });
    }
    stock.push(s.partner);
    solution.push({ type: 'draw' });
    solution.push({ type: 'remove', spots: [s.spots[0], 'waste'] });
    k++;
  }
  stock.push(...before[partners]);
  return { pyramid: pyramid as Card[], stock, solution };
}

export function generatePyramid(seed: number, ease: number): PyramidDeal {
  for (let attempt = 0; attempt < 500; attempt++) {
    const deal = tryBuildPyramid(mulberry32(seed * 6151 + attempt * 92821 + 5), ease);
    if (deal) return deal;
  }
  throw new Error('Не удалось построить пирамиду для сида ' + seed);
}

/** Проигрывает список ходов и говорит, привёл ли он к победе. */
export function replayPyramid(deal: PyramidDeal, moves: PyramidMove[]): PyramidGame | null {
  const g = new PyramidGame(deal);
  for (const m of moves) {
    const ok = m.type === 'draw' ? g.draw() !== null : g.remove(m.spots);
    if (!ok) return null;
  }
  return g.status === 'won' ? g : null;
}

/**
 * Бот «обычный игрок»: убирает королей и пары, как только видит (пары внутри пирамиды
 * раньше пар со сбросом), иначе берёт карту из колоды. Решения он не знает.
 */
export function pyramidBot(deal: PyramidDeal, rng: () => number): { won: boolean; pass: number } {
  const g = new PyramidGame(deal);
  let guard = 0;
  while (g.status === 'playing' && guard++ < 2000) {
    const spots = g.spots();
    const options: Spot[][] = [];
    for (const s of spots) if (g.cardAt(s)!.rank === 13) options.push([s]);
    for (let a = 0; a < spots.length; a++) {
      for (let b = a + 1; b < spots.length; b++) {
        if (g.cardAt(spots[a])!.rank + g.cardAt(spots[b])!.rank === 13) options.push([spots[a], spots[b]]);
      }
    }
    if (!options.length) {
      g.draw();
      continue;
    }
    const inner = options.filter((o) => !o.includes('waste'));
    const pool = inner.length && rng() < 0.8 ? inner : options;
    g.remove(pool[Math.floor(rng() * pool.length)]);
  }
  return { won: g.status === 'won', pass: g.pass };
}

export function ratePyramid(deal: PyramidDeal, n = 40): number {
  const rng = mulberry32(7654321);
  let wins = 0;
  for (let k = 0; k < n; k++) if (pyramidBot(deal, rng).won) wins++;
  return wins / n;
}

/** Раскладка нужной трудности: доля побед бота близка к target. */
export function generateRatedPyramid(seed: number, target: number, tolerance = 0.08): PyramidDeal {
  let best: PyramidDeal | null = null;
  let bestDiff = Infinity;
  for (let k = 0; k < 150; k++) {
    const deal = generatePyramid(seed * 211 + k * 13, 0.2 + ((k * 7) % 10) / 12);
    const diff = Math.abs(ratePyramid(deal) - target);
    if (diff <= tolerance) return deal;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = deal;
    }
  }
  return best!;
}

/** Трудность 1…3 внутри блока дела → доля побед бота-новичка. */
export const PYRAMID_TARGETS = [0.85, 0.7, 0.55];

/**
 * Независимый решатель (для тестов): перебор с запоминанием тупиков.
 * true — решение есть, false — точно нет, null — не хватило лимита.
 */
export function solvePyramid(deal: PyramidDeal, nodeLimit = 400_000): boolean | null {
  const dead = new Set<string>();
  let nodes = 0;
  let overflow = false;
  const g = new PyramidGame(deal, 0);

  const key = () => g.pyramid.map((c) => (c ? '1' : '0')).join('') + '|' + g.pass + '|' + g.stock.length + '|' + g.waste.map((c) => c.rank * 4 + c.suit).join(',');

  const rec = (): boolean => {
    if (g.remaining === 0) return true;
    const k = key();
    if (dead.has(k)) return false;
    if (++nodes > nodeLimit) {
      overflow = true;
      return false;
    }
    const save = { pyramid: g.pyramid.slice(), stock: g.stock.slice(), waste: g.waste.slice(), pass: g.pass };
    const restore = () => {
      g.pyramid = save.pyramid.slice();
      g.stock = save.stock.slice();
      g.waste = save.waste.slice();
      g.pass = save.pass;
    };
    const spots = g.spots();
    const options: Spot[][] = [];
    for (const s of spots) if (g.cardAt(s)!.rank === 13) options.push([s]);
    for (let a = 0; a < spots.length; a++) {
      for (let b = a + 1; b < spots.length; b++) {
        if (g.cardAt(spots[a])!.rank + g.cardAt(spots[b])!.rank === 13) options.push([spots[a], spots[b]]);
      }
    }
    for (const o of options) {
      for (const s of o) {
        if (s === 'waste') g.waste.pop();
        else g.pyramid[s] = null;
      }
      if (rec()) return true;
      restore();
      if (overflow) return false;
    }
    if (g.canDraw) {
      if (g.stock.length > 0) g.waste.push(g.stock.shift()!);
      else {
        g.stock = g.waste;
        g.waste = [];
        g.pass++;
      }
      if (rec()) return true;
      restore();
      if (overflow) return false;
    }
    dead.add(k);
    return false;
  };

  if (rec()) return true;
  return overflow ? null : false;
}
