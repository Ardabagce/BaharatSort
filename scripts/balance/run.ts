/**
 * Denge simülasyonu: `pnpm balance` → docs/balance-report.md
 * Üç profil × birkaç oyuncu × gömülü 300 seviye. Tüm sayılar DEFAULT_CONFIG'ten gelir.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG } from '@baharat-sort/shared';
import { BUILTIN_LEVELS as ALL_LEVELS } from '@baharat-sort/shared/levels';

/** Denge ilk 300 seviyede ölçülür: 5 dükkân ~140. seviyede biter, sonrası ek stiller. */
const BUILTIN_LEVELS = ALL_LEVELS.slice(0, 300);
import { PROFILES } from './profiles';
import { checks, renderReport, summarize } from './report';
import { simulatePlayer } from './sim';

const PLAYERS = Number(process.env.PLAYERS ?? 5);
const started = Date.now();
const sums = PROFILES.map((profile) => {
  const runs = Array.from({ length: PLAYERS }, (_, i) =>
    simulatePlayer(BUILTIN_LEVELS, DEFAULT_CONFIG, profile, `p${i}`),
  );
  console.log(`${profile.label}: ${PLAYERS} oyuncu (${Date.now() - started} ms)`);
  return summarize(profile, runs, DEFAULT_CONFIG);
});
const seconds = Math.round((Date.now() - started) / 1000);
const out = fileURLToPath(new URL('../../docs/balance-report.md', import.meta.url));
writeFileSync(
  out,
  renderReport(sums, DEFAULT_CONFIG, BUILTIN_LEVELS, { players: PLAYERS, seconds }),
);
for (const c of checks(sums, DEFAULT_CONFIG))
  console.log(`${c.ok ? '✅' : '❌'} ${c.label}: ${c.value} (hedef ${c.target})`);
console.log(`Yazıldı: ${out}`);
