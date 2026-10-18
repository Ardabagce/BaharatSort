/**
 * Uygulamaya gömülü 1000 seviyeyi üretir: `pnpm levels`.
 * Çıktı deterministiktir; test, dosyanın üreticiyle birebir aynı olduğunu ve her seviyenin
 * güçlendiricisiz çözülebildiğini doğrular. Ayrıca docs/levels.md dağılım raporunu yazar.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateLevel, targetDifficulty } from '../src/generator';
import { BUILTIN_LEVEL_COUNT } from '../src/levels/builtin';
import type { LevelDef } from '../src/types';
import { levelReport } from './level-report';

const out = fileURLToPath(new URL('../src/levels/builtin.json', import.meta.url));
const docs = fileURLToPath(new URL('../../docs/levels.md', import.meta.url));
const levels: LevelDef[] = [];
const started = Date.now();
for (let n = 1; n <= BUILTIN_LEVEL_COUNT; n++) {
  levels.push(generateLevel(n));
  if (n % 25 === 0) console.log(`${n}/${BUILTIN_LEVEL_COUNT} (${Date.now() - started} ms)`);
}
writeFileSync(out, JSON.stringify(levels) + '\n');
writeFileSync(docs, levelReport(levels, targetDifficulty));
console.log(`Yazıldı: ${out}\nRapor: ${docs}`);
