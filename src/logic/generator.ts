// Генератор раскладок. Раскладка строится «от решения», поэтому всегда решаема:
// сначала придумываем порядок, в котором карты снимаются с пиков, потом раздаём
// картам старшинства так, чтобы этот порядок был законной игрой.

import { Card, Deal, Move, STOCK_SIZE, TABLEAU_SIZE, coveredBy } from './tripeaks';
import { botPlay } from './solver';

/** Быстрый генератор случайных чисел с сидом (одинаковый сид = одинаковая раскладка). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DealParams {
  /** Сколько карт колоды нужно в решении (включая первую в сбросе). Больше = труднее. */
  runs: number;
  /** Доля «лишних» карт, перемешанных в середину колоды (остальные лежат в конце). */
  interleave: number;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tryBuild(rng: () => number, params: DealParams): Deal | null {
  const K = Math.max(1, Math.min(STOCK_SIZE, params.runs));

  // 1. Порядок снятия карт: случайный, но карту нельзя снять раньше тех, что на ней лежат.
  const blockers = Array.from({ length: TABLEAU_SIZE }, (_, i) => coveredBy(i).length);
  const parents: number[][] = Array.from({ length: TABLEAU_SIZE }, () => []);
  for (let i = 0; i < TABLEAU_SIZE; i++) for (const j of coveredBy(i)) parents[j].push(i);
  const avail: number[] = [];
  for (let i = 0; i < TABLEAU_SIZE; i++) if (blockers[i] === 0) avail.push(i);
  const order: number[] = [];
  while (avail.length) {
    const k = Math.floor(rng() * avail.length);
    const i = avail.splice(k, 1)[0];
    order.push(i);
    for (const p of parents[i]) if (--blockers[p] === 0) avail.push(p);
  }

  // 2. Длины серий: K серий, в сумме 28 карт.
  const lens = new Array<number>(K).fill(1);
  for (let extra = TABLEAU_SIZE - K; extra > 0; extra--) lens[Math.floor(rng() * K)]++;

  // 3. Раздаём старшинства. В колоде по 4 карты каждого старшинства.
  const left = new Array<number>(14).fill(4);
  left[0] = 0;
  const suits: number[][] = Array.from({ length: 14 }, () => shuffle([0, 1, 2, 3], rng));
  const take = (rank: number): Card => {
    left[rank]--;
    return { rank, suit: suits[rank].pop()! };
  };
  const tableau = new Array<Card>(TABLEAU_SIZE);
  const starters: Card[] = [];
  let pos = 0;
  for (let r = 0; r < K; r++) {
    const options: number[] = [];
    for (let rank = 1; rank <= 13; rank++) if (left[rank] > 0) options.push(rank);
    if (!options.length) return null;
    let cur = options[Math.floor(rng() * options.length)];
    starters.push(take(cur));
    let dir = rng() < 0.5 ? 1 : -1;
    for (let n = 0; n < lens[r]; n++) {
      if (rng() < 0.35) dir = -dir;
      const step = (d: number) => ((cur - 1 + d + 13) % 13) + 1;
      let next = step(dir);
      if (left[next] === 0) {
        dir = -dir;
        next = step(dir);
        if (left[next] === 0) return null;
      }
      tableau[order[pos++]] = take(next);
      cur = next;
    }
  }

  // 4. Оставшиеся карты — «лишние»: часть в середину колоды, остальные в конец.
  const spares: Card[] = [];
  for (let rank = 1; rank <= 13; rank++) while (left[rank] > 0) spares.push(take(rank));
  shuffle(spares, rng);
  const slots: Card[][] = Array.from({ length: K }, () => []); // slots[r] — лишние перед серией r (r ≥ 1)
  const tail: Card[] = [];
  for (const c of spares) {
    if (K > 1 && rng() < params.interleave) slots[1 + Math.floor(rng() * (K - 1))].push(c);
    else tail.push(c);
  }

  // 5. Колода и решение.
  const stock: Card[] = [];
  const solution: Move[] = [];
  pos = 0;
  for (let r = 0; r < K; r++) {
    for (const c of slots[r]) {
      stock.push(c);
      solution.push({ type: 'draw' });
    }
    stock.push(starters[r]);
    if (r > 0) solution.push({ type: 'draw' });
    for (let n = 0; n < lens[r]; n++) solution.push({ type: 'play', index: order[pos++] });
  }
  stock.push(...tail);
  return { tableau, stock, solution, par: tail.length };
}

export function generateDeal(seed: number, params: DealParams): Deal {
  for (let attempt = 0; attempt < 500; attempt++) {
    const deal = tryBuild(mulberry32(seed * 7919 + attempt * 104729 + 17), params);
    if (deal) return deal;
  }
  throw new Error('Не удалось построить раскладку для сида ' + seed);
}

/**
 * Оценка лёгкости раскладки: доля побед «обычного игрока»-бота из n попыток.
 * Бот не знает задуманного решения и играет по простому правилу, как новичок.
 */
export function rateDeal(deal: Deal, n = 40): number {
  const rng = mulberry32(1234567);
  let wins = 0;
  for (let k = 0; k < n; k++) if (botPlay(deal, rng).won) wins++;
  return wins / n;
}

/**
 * Раскладка нужной трудности: перебираем кандидатов по сиду и берём первую,
 * у которой доля побед бота близка к target (1 = выигрывает почти всегда).
 */
export function generateRatedDeal(seed: number, target: number, tolerance = 0.07): Deal {
  let best: Deal | null = null;
  let bestDiff = Infinity;
  for (let k = 0; k < 120; k++) {
    const deal = generateDeal(seed * 131 + k * 7, { runs: 6 + (k % 7), interleave: 0.3 });
    const diff = Math.abs(rateDeal(deal) - target);
    if (diff <= tolerance) return deal;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = deal;
    }
  }
  return best!;
}

/** Трудность партии дела: партия 1 почти всегда выигрывается, последняя — меньше чем в половине попыток. */
export function targetForLevel(level: number, total = 12): number {
  const t = total > 1 ? (level - 1) / (total - 1) : 0;
  return EASY_TARGET + (HARD_TARGET - EASY_TARGET) * t;
}

export const EASY_TARGET = 0.95;
export const HARD_TARGET = 0.42;
export const DAILY_TARGET = 0.65;

/** Раскладка партии дела. Сид = номер дела и номер партии: у всех игроков она одна и та же. */
export function dealForLevel(caseNumber: number, level: number, total = 12): Deal {
  return generateRatedDeal(caseNumber * 1000 + level, targetForLevel(level, total));
}

/** Трудность 1…3 внутри блока дела → доля побед бота-новичка. */
export const TRIPEAKS_TARGETS = [0.95, 0.85, 0.75];

export function dealForBlock(caseNumber: number, level: number, difficulty: number): Deal {
  return generateRatedDeal(caseNumber * 1000 + level, TRIPEAKS_TARGETS[Math.max(0, Math.min(2, difficulty - 1))]);
}

/** Сид партии дня: из даты. */
export function dailySeed(date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function dealForDaily(date = new Date()): Deal {
  return generateRatedDeal(dailySeed(date), DAILY_TARGET);
}
