// Не тест, а поиск решаемых раскладок: npx vitest run tools/find_seeds.test.ts
// Итог пишется в seeds.log (Косынка) и seeds_fc.log (Свободная ячейка) — переносим в src/logic/seeds.ts.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { rateKlondike, solveKlondike } from '../src/logic/klondike';
import { solveFreeCell } from '../src/logic/freecell';

it.skip('косынка: решаемые сиды по лёгкости', () => {
  const rows: { seed: number; ease: number; len: number }[] = [];
  const t0 = Date.now();
  for (let seed = 1; seed <= 1500; seed++) {
    const sol = solveKlondike(seed, 12);
    if (!sol) continue;
    rows.push({ seed, ease: rateKlondike(seed, 40), len: sol.length });
  }
  rows.sort((a, b) => b.ease - a.ease);
  const out = [`найдено ${rows.length} из 1500 за ${Date.now() - t0} мс`];
  for (const r of rows) out.push(`${r.seed}\t${r.ease.toFixed(2)}\t${r.len}`);
  writeFileSync('seeds.log', out.join('\n'));
}, 600000);

it('свободная ячейка: решаемые сиды по трудности', () => {
  const rows: { seed: number; nodes: number; len: number }[] = [];
  const t0 = Date.now();
  let tried = 0;
  for (let seed = 1; seed <= 300; seed++) {
    tried++;
    const r = solveFreeCell(seed, 40000);
    if (r.solved) rows.push({ seed, nodes: r.nodes, len: r.length });
  }
  rows.sort((a, b) => a.nodes - b.nodes);
  const out = [`решено ${rows.length} из ${tried} за ${Date.now() - t0} мс`];
  for (const r of rows) out.push(`${r.seed}\t${r.nodes}\t${r.len}`);
  writeFileSync('seeds_fc.log', out.join('\n'));
}, 900000);
