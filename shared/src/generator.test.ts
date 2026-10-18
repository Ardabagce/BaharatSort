import { describe, expect, it } from 'vitest';
import { analyzeLevel } from './analysis';
import { generateDaily, generateLevel, levelKind, targetDifficulty } from './generator';
import { BUILTIN_LEVEL_COUNT, BUILTIN_LEVELS } from './levels/builtin';
import { createGame, isWon, pour } from './rules';
import { solveLevel } from './solver';
import type { LevelDef } from './types';

describe('eğri', () => {
  it('her 5. zor, her 20. çok zor, ardından rahatlatıcı', () => {
    expect(levelKind(5)).toBe('hard');
    expect(levelKind(20)).toBe('veryHard');
    expect(levelKind(40)).toBe('veryHard');
    expect(levelKind(25)).toBe('hard');
    expect(levelKind(26)).toBe('relief');
    expect(levelKind(21)).toBe('relief');
    expect(levelKind(7)).toBe('tutorial');
    expect(levelKind(12)).toBe('normal');
  });

  it('zordan sonraki seviye hedefte daha kolay', () => {
    for (const n of [15, 25, 40, 95, 200])
      expect(targetDifficulty(n + 1)).toBeLessThan(targetDifficulty(n));
  });
});

describe('üretici', () => {
  it('deterministik: aynı seviye iki kez aynı çıkar', () => {
    expect(generateLevel(23)).toEqual(generateLevel(23));
  });

  it('günün bulmacası tarihe göre deterministik ve farklı', () => {
    const a = generateDaily('2026-10-17', { candidates: 3 });
    expect(a).toEqual(generateDaily('2026-10-17', { candidates: 3 }));
    expect(a.jars).not.toEqual(generateDaily('2026-10-18', { candidates: 3 }).jars);
  });

  it('başlangıçta tamamlanmış kavanoz yok; kilit rengi kilitli kavanozda yok', () => {
    for (const n of [3, 21, 33, 64, 120]) {
      const l = generateLevel(n);
      for (const j of l.jars) {
        expect(j.layers.length === l.cap && new Set(j.layers).size === 1).toBe(false);
        if (j.lock !== undefined) expect(j.layers).not.toContain(j.lock);
      }
    }
  });
});

function playSolution(level: LevelDef) {
  const r = solveLevel(level, { maxNodes: 300_000, weight: 3 });
  expect(r.solved, `${level.id} çözülemedi`).toBe(true);
  let s = createGame(level);
  for (const m of r.moves) {
    const p = pour(s, m.from, m.to);
    expect(p.ok).toBe(true);
    if (p.ok) s = p.state;
  }
  expect(isWon(s)).toBe(true);
}

describe(`gömülü ${BUILTIN_LEVEL_COUNT} seviye`, () => {
  it(`${BUILTIN_LEVEL_COUNT} seviye var, sıralı`, () => {
    expect(BUILTIN_LEVELS).toHaveLength(BUILTIN_LEVEL_COUNT);
    BUILTIN_LEVELS.forEach((l, i) => expect(l.n).toBe(i + 1));
  });

  it('her seviye güçlendiricisiz çözülebilir (çözüm oynatılıp doğrulanır)', () => {
    for (const l of BUILTIN_LEVELS) playSolution(l);
  });

  it('kayıtlı istatistikler en kısa çözümle tutarlı (örneklem)', () => {
    for (const l of BUILTIN_LEVELS.filter((x) => x.n % 37 === 1)) {
      const a = analyzeLevel(l);
      expect(a.stats.minMoves).toBe(l.stats.minMoves);
    }
  });

  it('dosya üreticiyle birebir aynı (her 23. seviye yeniden üretilir)', () => {
    for (const l of BUILTIN_LEVELS.filter((x) => x.n % 23 === 0 || x.n <= 2))
      expect(generateLevel(l.n)).toEqual(l);
  });

  it('ilk 10 seviye kolay, zor seviyeler komşularından zor', () => {
    for (const l of BUILTIN_LEVELS.slice(0, 10))
      expect(l.stats.difficulty).toBeLessThanOrEqual(3.5);
    const avg = (k: string) => {
      const xs = BUILTIN_LEVELS.filter((l) => l.kind === k && l.n > 10).map(
        (l) => l.stats.difficulty,
      );
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(avg('hard')).toBeGreaterThan(avg('normal'));
    expect(avg('veryHard')).toBeGreaterThan(avg('hard'));
    expect(avg('relief')).toBeLessThan(avg('normal'));
  });
});
