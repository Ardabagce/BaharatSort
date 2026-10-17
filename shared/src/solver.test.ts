import { describe, expect, it } from 'vitest';
import { createGame, isWon, pour } from './rules';
import { createRng, shuffled } from './rng';
import { heuristic, hint, solve } from './solver';
import type { GameState, JarDef, Move } from './types';

const game = (jars: JarDef[], cap = 4) => createGame({ cap, jars });

function play(s: GameState, moves: Move[]): GameState {
  for (const m of moves) {
    const r = pour(s, m.from, m.to);
    if (!r.ok) throw new Error(`geçersiz hamle ${m.from}->${m.to}: ${r.reason}`);
    s = r.state;
  }
  return s;
}

/** Küçük durumlar için kaba kuvvet BFS (simetri budaması yok): A*'ın en kısa bulduğunu doğrular. */
function bfsLength(start: GameState): number {
  const key = (s: GameState) => JSON.stringify(s.jars.map((j) => [j.layers, j.capped, j.lock]));
  let frontier = [start];
  const seen = new Set([key(start)]);
  for (let d = 0; d < 40; d++) {
    const next: GameState[] = [];
    for (const s of frontier) {
      if (isWon(s)) return d;
      for (let a = 0; a < s.jars.length; a++)
        for (let b = 0; b < s.jars.length; b++) {
          const r = pour(s, a, b);
          if (!r.ok) continue;
          const k = key(r.state);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(r.state);
        }
    }
    frontier = next;
  }
  return -1;
}

function randomLevel(seed: string, colors: number, empties: number, cap = 4): GameState {
  const rng = createRng(seed);
  const pool = shuffled(
    rng,
    Array.from({ length: colors * cap }, (_, i) => i % colors),
  );
  const jars: JarDef[] = Array.from({ length: colors }, (_, i) => ({
    layers: pool.slice(i * cap, (i + 1) * cap),
  }));
  for (let i = 0; i < empties; i++) jars.push({ layers: [] });
  return game(jars, cap);
}

describe('çözücü', () => {
  it('çözülmüş durum 0 hamle', () => {
    const s = game([{ layers: [] }]);
    expect(solve(s).moves).toEqual([]);
  });

  it('bulduğu çözüm gerçekten kazandırır', () => {
    for (let i = 0; i < 10; i++) {
      const s = randomLevel(`t${i}`, 6, 2);
      const r = solve(s);
      expect(r.solved).toBe(true);
      expect(isWon(play(s, r.moves))).toBe(true);
    }
  });

  it('en kısa çözümü bulur (kaba kuvvet BFS ile karşılaştırma)', () => {
    for (let i = 0; i < 8; i++) {
      const s = randomLevel(`bfs${i}`, 3, 2);
      const r = solve(s);
      expect(r.optimal).toBe(true);
      expect(r.moves.length).toBe(bfsLength(s));
    }
  });

  it('sezgisel kabul edilebilir: hiçbir zaman en kısa çözümden büyük değil', () => {
    for (let i = 0; i < 20; i++) {
      const s = randomLevel(`h${i}`, 5, 2);
      const r = solve(s);
      expect(heuristic(s)).toBeLessThanOrEqual(r.moves.length);
    }
  });

  it('çözülemez durumu kesin olarak bildirir', () => {
    const s = game([{ layers: [0, 1, 0, 1] }, { layers: [1, 0, 1, 0] }]);
    const r = solve(s);
    expect(r.solved).toBe(false);
    expect(r.exhausted).toBe(true);
  });

  it('kilit, dar ağız ve uzun kavanozlu seviyeyi çözer', () => {
    const s = game(
      [
        { layers: [0, 1, 2, 0, 1] },
        { layers: [2, 0, 1, 2, 0], narrow: true },
        { layers: [3, 3, 3, 1, 0], lock: 2 },
        { layers: [1, 2] },
        { layers: [3, 3, 2] },
        { layers: [] },
        { layers: [] },
      ],
      5,
    );
    const r = solve(s);
    expect(r.solved).toBe(true);
    expect(isWon(play(s, r.moves))).toBe(true);
  });

  it('ipucu geçerli ve çözüme götüren bir hamle verir', () => {
    const s = randomLevel('hint', 7, 2);
    const m = hint(s);
    expect(m).not.toBeNull();
    const after = play(s, [m!]);
    expect(solve(after).solved).toBe(true);
  });
});
