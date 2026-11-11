// Заранее подобранные раскладки «Косынки»: каждая проверена ботом-игроком (он её выигрывает,
// значит решение есть). Три набора по трудности: лёгкие, средние, трудные.
// Список получен скриптом tools/find_seeds.test.ts; тесты перепроверяют каждый сид.

export const KLONDIKE_SEEDS: number[][] = [
  [12, 20, 28, 33, 37, 48, 54, 58, 62, 75, 92, 94, 96, 107, 112, 115, 116, 117, 121, 122, 123, 126, 145, 159],
  [1, 4, 43, 71, 104, 149, 151, 179, 197, 198, 202, 211, 212, 228, 284, 315, 343, 358, 361, 369, 372, 401, 413, 447],
  [15, 30, 46, 76, 90, 119, 132, 141, 167, 168, 193, 259, 263, 295, 314, 374, 387, 412, 446, 461, 480, 511, 539, 547],
];

/** Сид «Косынки» для партии дела: одинаковый у всех игроков. */
export function klondikeSeed(caseNumber: number, level: number, difficulty: number): number {
  const band = KLONDIKE_SEEDS[Math.max(0, Math.min(2, difficulty - 1))];
  return band[(caseNumber * 7 + level * 3) % band.length];
}

// Раскладки «Свободной ячейки»: каждая решена решателем (src/logic/freecell.ts).
// Наборы по трудности: чем больше решателю пришлось перебрать, тем раскладка труднее.
export const FREECELL_SEEDS: number[][] = [
  [25, 31, 37, 55, 83, 98, 149, 158, 222, 251, 259, 263],
  [85, 103, 128, 142, 164, 187, 190, 200, 240, 241, 248, 250],
  [13, 27, 43, 58, 75, 86, 87, 122, 161, 203, 227, 252],
];

export function freecellSeed(caseNumber: number, level: number, difficulty: number): number {
  const band = FREECELL_SEEDS[Math.max(0, Math.min(2, difficulty - 1))];
  return band[(caseNumber * 7 + level * 3) % band.length];
}
