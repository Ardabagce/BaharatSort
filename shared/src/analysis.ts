import { createRng, type Rng } from './rng';
import { createGame, isWon, meaningfulMoves, pour, topColor } from './rules';
import { solveRobust } from './solver';
import type { Feature, GameState, LevelDef, LevelStats, Move } from './types';

/**
 * Seviye ölçümleri: en kısa çözüm, dallanma, rastgele botun kilitlenme oranı, gizli katman ve
 * renk/kavanoz oranı; bunlardan 1–10 zorluk skoru.
 */

export interface BotRun {
  won: boolean;
  /** Anlamlı hamle kalmadı. */
  deadEnd: boolean;
  steps: number;
}

/**
 * "Rastgele" bot: anlamlı hamlelerden rastgele seçer, az önce yaptığı dökümü hemen geri almaz.
 * `greedy` olasılıkla aynı renge (boş olmayan hedefe) dökmeyi tercih eder; sıradan bir oyuncu gibi.
 */
export function randomBot(start: GameState, rng: Rng, greedy = 0.6, maxSteps = 250): BotRun {
  let s = start;
  let last: Move | null = null;
  for (let step = 0; step < maxSteps; step++) {
    if (isWon(s)) return { won: true, deadEnd: false, steps: step };
    let moves = meaningfulMoves(s);
    if (moves.length === 0) return { won: false, deadEnd: true, steps: step };
    if (last && moves.length > 1)
      moves = moves.filter((m) => !(m.from === last!.to && m.to === last!.from));
    const onto = moves.filter((m) => topColor(s.jars[m.to]!) !== undefined);
    const pool = onto.length > 0 && rng() < greedy ? onto : moves;
    const m = pool[Math.floor(rng() * pool.length)]!;
    const r = pour(s, m.from, m.to);
    if (!r.ok) return { won: false, deadEnd: true, steps: step };
    s = r.state;
    last = m;
  }
  return { won: isWon(s), deadEnd: false, steps: maxSteps };
}

export function deadEndRate(start: GameState, seed: string, runs = 40): number {
  const rng = createRng(`${seed}:bot`);
  let dead = 0;
  for (let i = 0; i < runs; i++) if (randomBot(start, rng).deadEnd) dead++;
  return dead / runs;
}

/** Çözüm yolu boyunca ortalama anlamlı hamle sayısı. */
export function branchingAlong(start: GameState, moves: readonly Move[]): number {
  if (moves.length === 0) return 0;
  let s = start;
  let total = 0;
  for (const m of moves) {
    total += meaningfulMoves(s).length;
    const r = pour(s, m.from, m.to);
    if (!r.ok) break;
    s = r.state;
  }
  return total / moves.length;
}

const FEATURE_WEIGHT: Record<Feature, number> = { hidden: 0, lock: 0.12, tall: 0.05, narrow: 0.15 };

/**
 * Zorluk skoru (1–10). Ham değer: en kısa çözüm × log2(1 + dallanma) × kilitlenme ve gizlilik
 * çarpanları × öğe çarpanı; `1 + 9·x/(x+K)` ile sıkıştırılır.
 */
export function difficultyScore(p: {
  minMoves: number;
  branching: number;
  deadEndRate: number;
  hiddenRatio: number;
  colorJarRatio: number;
  features: readonly Feature[];
}): number {
  const featureMul = 1 + p.features.reduce((a, f) => a + FEATURE_WEIGHT[f], 0);
  const raw =
    p.minMoves *
    Math.log2(1 + p.branching) *
    (1 + 2.5 * p.deadEndRate) *
    (1 + 1.2 * p.hiddenRatio) *
    (0.6 + p.colorJarRatio) *
    featureMul;
  const K = 140;
  return Math.round((1 + (9 * raw) / (raw + K)) * 10) / 10;
}

export interface Analysis {
  solvable: boolean;
  stats: LevelStats;
  solution: Move[];
}

export function analyzeLevel(
  level: Pick<LevelDef, 'cap' | 'jars' | 'features' | 'seed'>,
  botRuns = 40,
): Analysis {
  const start = createGame(level);
  const res = solveRobust(start);
  const colors = new Set(level.jars.flatMap((j) => j.layers)).size;
  const layers = level.jars.reduce((a, j) => a + j.layers.length, 0);
  const hiddenLayers = level.jars.reduce((a, j) => a + (j.hidden ?? 0), 0);
  const colorJarRatio = Math.round((colors / level.jars.length) * 100) / 100;
  if (!res.solved) {
    return {
      solvable: false,
      solution: [],
      stats: {
        minMoves: 0,
        exact: false,
        branching: 0,
        deadEndRate: 1,
        hiddenLayers,
        colorJarRatio,
        difficulty: 10,
      },
    };
  }
  const branching = Math.round(branchingAlong(start, res.moves) * 100) / 100;
  const dead = deadEndRate(start, level.seed, botRuns);
  const difficulty = difficultyScore({
    minMoves: res.moves.length,
    branching,
    deadEndRate: dead,
    hiddenRatio: layers ? hiddenLayers / layers : 0,
    colorJarRatio,
    features: level.features,
  });
  return {
    solvable: true,
    solution: res.moves,
    stats: {
      minMoves: res.moves.length,
      exact: res.optimal,
      branching,
      deadEndRate: Math.round(dead * 1000) / 1000,
      hiddenLayers,
      colorJarRatio,
      difficulty,
    },
  };
}
