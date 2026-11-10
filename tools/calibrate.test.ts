// Не тест, а замер сложности: npx vitest run tools/calibrate.test.ts  (итог в calibrate.log)
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { dealForLevel, mulberry32 } from '../src/logic/generator';
import { botPlay } from '../src/logic/solver';

it('замер сложности', () => {
  const out: string[] = [];
  const t0 = Date.now();
  for (let level = 1; level <= 12; level++) {
    let wins = 0;
    const left: number[] = [];
    const N = 300;
    let par = 0;
    for (let c = 1; c <= 5; c++) {
      const deal = dealForLevel(c, level);
      par += deal.par / 5;
      const rng = mulberry32(99 + c);
      for (let s = 0; s < N / 5; s++) {
        const r = botPlay(deal, rng);
        if (r.won) {
          wins++;
          left.push(r.stockLeft);
        }
      }
    }
    left.sort((a, b) => a - b);
    const q = (p: number) => left[Math.floor(left.length * p)] ?? 0;
    out.push(`партия ${level}: победы бота ${Math.round((100 * wins) / N)}%, осталось в колоде 25%/50%/75%: ${q(0.25)}/${q(0.5)}/${q(0.75)}, par ${par.toFixed(1)}`);
  }
  out.push(`время генерации 60 раскладок: ${Date.now() - t0} мс`);
  writeFileSync('calibrate.log', out.join('\n'));
}, 120000);
