// Независимый решатель и «бот-игрок». Нужны для тестов и подбора сложности.

import { Deal, Game, Move, TABLEAU_SIZE, coveredBy, isAdjacent } from './tripeaks';

const COVERS: number[][] = Array.from({ length: TABLEAU_SIZE }, (_, i) => coveredBy(i));

/**
 * Ищет решение перебором с запоминанием тупиков.
 * true — решение есть, false — точно нет, null — не хватило лимита.
 */
export function solve(deal: Deal, nodeLimit = 2_000_000): boolean | null {
  const ranks = deal.tableau.map((c) => c.rank);
  const stock = deal.stock.map((c) => c.rank);
  const dead = new Set<number>();
  let nodes = 0;
  let overflow = false;

  const rec = (mask: number, pos: number, top: number): boolean => {
    if (mask === 0) return true;
    const key = (mask * 32 + pos) * 16 + top;
    if (dead.has(key)) return false;
    if (++nodes > nodeLimit) {
      overflow = true;
      return false;
    }
    for (let i = 0; i < TABLEAU_SIZE; i++) {
      if (!(mask & (1 << i))) continue;
      const cov = COVERS[i];
      if (cov.length && (mask & (1 << cov[0]) || mask & (1 << cov[1]))) continue;
      if (!isAdjacent(ranks[i], top)) continue;
      if (rec(mask & ~(1 << i), pos, ranks[i])) return true;
      if (overflow) return false;
    }
    if (pos < stock.length && rec(mask, pos + 1, stock[pos])) return true;
    if (!overflow) dead.add(key);
    return false;
  };

  const ok = rec((1 << TABLEAU_SIZE) - 1, 1, stock[0]);
  if (ok) return true;
  return overflow ? null : false;
}

/** Проигрывает список ходов и говорит, привёл ли он к победе. */
export function replay(deal: Deal, moves: Move[]): boolean {
  const g = new Game(deal);
  for (const m of moves) {
    const ok = m.type === 'draw' ? g.draw() : g.play(m.index);
    if (!ok) return false;
  }
  return g.status === 'won';
}

/**
 * Бот «обычный игрок»: если есть ход — делает его (выбирает ту карту, после которой
 * можно продолжить серию, иначе случайную), если нет — берёт из колоды.
 */
export function botPlay(deal: Deal, rng: () => number): { won: boolean; stockLeft: number } {
  const g = new Game(deal);
  while (g.status === 'playing') {
    const moves = g.playable();
    if (!moves.length) {
      g.draw();
      continue;
    }
    let best = moves[Math.floor(rng() * moves.length)];
    let bestScore = -1;
    for (const m of moves) {
      const rank = g.tableau[m]!.rank;
      let score = rng() * 0.5;
      for (let i = 0; i < TABLEAU_SIZE; i++) {
        if (i !== m && g.isOpen(i) && isAdjacent(g.tableau[i]!.rank, rank)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    g.play(best);
  }
  return { won: g.status === 'won', stockLeft: g.stockLeft };
}
