import { analyzeLevel } from './analysis';
import { DEFAULT_CONFIG, type DifficultyConfig } from './config';
import { createRng, pick, randomInt, shuffled, type Rng } from './rng';
import { CONFUSABLE_PAIRS, SPICE_COUNT } from './spices';
import type { Feature, JarDef, LevelDef, LevelKind } from './types';

/**
 * Seed'li, deterministik seviye üreticisi. Seviye n'in seed'i `baharat:n`, günün bulmacasınınki
 * `daily:YYYY-MM-DD`. Her seviye için birkaç aday üretilir, çözücüyle doğrulanır (güçlendiricisiz
 * çözülemeyen aday asla seçilmez) ve hedef zorluğa en yakını alınır.
 */

export const FEATURES: readonly Feature[] = ['hidden', 'lock', 'tall', 'narrow'];

/** Testere dişi eğri: her 5. zor, her 20. çok zor, zordan sonraki rahatlatıcı. */
export function levelKind(n: number, d: DifficultyConfig = DEFAULT_CONFIG.difficulty): LevelKind {
  if (n % d.veryHardEvery === 0) return 'veryHard';
  if (n % d.hardEvery === 0) return 'hard';
  if (n <= d.tutorialLevels) return 'tutorial';
  if ((n - 1) % d.hardEvery === 0) return 'relief';
  return 'normal';
}

/** n. seviyenin hedef zorluk skoru (1–10). */
export function targetDifficulty(n: number, d: DifficultyConfig = DEFAULT_CONFIG.difficulty) {
  const kind = levelKind(n, d);
  if (n <= d.tutorialLevels) {
    // İlk 10 seviye neredeyse kaybedilemez; 5 ve 10 rozetli ama yine yumuşak.
    const t = 1.2 + (d.tutorialMax - 1.2) * ((n - 1) / Math.max(1, d.tutorialLevels - 1));
    return kind === 'hard' || kind === 'veryHard' ? t + 0.5 : t;
  }
  const f = Math.min(1, (n - d.tutorialLevels) / Math.max(1, d.rampEndLevel - d.tutorialLevels));
  const base = d.normalStart + (d.normalEnd - d.normalStart) * f;
  if (kind === 'veryHard') return Math.min(9.6, base + d.veryHardBonus);
  if (kind === 'hard') return Math.min(9, base + d.hardBonus);
  if (kind === 'relief') return Math.max(1.5, base - d.reliefPenalty);
  return base;
}

/** Bu seviyede tanıtılan öğe (eğitici seviye). */
export function introducedAt(n: number, d: DifficultyConfig = DEFAULT_CONFIG.difficulty) {
  return FEATURES.find((f) => d.featureStart[f] === n);
}

/** 61. seviyeden sonra her 20 seviyelik blokta öne çıkan öğe birleşimi ("her 20 seviyede yeni bir şey"). */
const THEMES: readonly Feature[][] = [
  ['hidden', 'lock'],
  ['tall', 'narrow'],
  ['hidden', 'tall'],
  ['lock', 'narrow'],
  ['hidden', 'narrow'],
  ['lock', 'tall'],
  ['hidden', 'lock', 'tall'],
  ['hidden', 'lock', 'narrow'],
  ['hidden', 'tall', 'narrow'],
  ['lock', 'tall', 'narrow'],
  ['hidden', 'lock', 'tall', 'narrow'],
  ['hidden', 'lock', 'tall', 'narrow'],
];

export function themeFor(n: number, d: DifficultyConfig = DEFAULT_CONFIG.difficulty) {
  const firstThemed = Math.max(...Object.values(d.featureStart)) + 20;
  if (n < firstThemed) return null;
  return THEMES[Math.floor((n - firstThemed) / 20) % THEMES.length]!;
}

interface Shape {
  colors: number;
  empties: number;
  cap: number;
  features: Feature[];
  hiddenJars: number;
  locks: number;
  narrow: number;
  /** Tutorial seviyelerde çözülmüş durumdan geri dökümle karıştırma adımı. */
  scramble: number;
}

function chooseFeatures(n: number, kind: LevelKind, rng: Rng, d: DifficultyConfig): Feature[] {
  const intro = introducedAt(n, d);
  if (intro) return [intro];
  const unlocked = FEATURES.filter((f) => n >= d.featureStart[f]);
  if (unlocked.length === 0) return [];
  const theme = themeFor(n, d);
  if (theme && rng() < 0.55) return [...theme];
  // En yeni öğe kendi 20 seviyesinde daha sık görünür.
  const newest = unlocked.reduce((a, b) => (d.featureStart[a] > d.featureStart[b] ? a : b));
  const out: Feature[] = [];
  for (const f of unlocked) {
    const recent = f === newest && n < d.featureStart[f] + 20;
    const p = recent ? 0.6 : kind === 'relief' ? 0.15 : 0.3;
    if (rng() < p) out.push(f);
  }
  const max = n < 100 ? 2 : 3;
  return shuffled(rng, out).slice(0, max);
}

function shapeFor(n: number, kind: LevelKind, rng: Rng, d: DifficultyConfig): Shape {
  const features = chooseFeatures(n, kind, rng, d);
  const intro = introducedAt(n, d);
  let colors: number;
  let scramble = 0;
  if (n <= d.tutorialLevels) {
    colors = [3, 3, 4, 4, 4, 4, 5, 5, 5, 5][n - 1] ?? 5;
    if (n <= 4) scramble = [3, 5, 7, 9][n - 1]!;
  } else {
    colors = Math.min(9, 5 + Math.floor((n - d.tutorialLevels - 1) / 20));
    if (kind === 'hard') colors += 1;
    if (kind === 'veryHard') colors += randomInt(rng, 1, 2);
    if (kind === 'relief') colors -= 1;
    if (intro) colors = Math.min(colors, 5);
  }
  let cap = 4;
  if (features.includes('tall')) {
    cap = intro || n < d.featureStart.tall + 30 ? 5 : pick(rng, [5, 6]);
    colors -= cap - 4;
  }
  colors = Math.max(3, Math.min(SPICE_COUNT, colors));
  const hiddenJars = features.includes('hidden')
    ? intro
      ? 2
      : Math.min(colors, randomInt(rng, 2, kind === 'veryHard' ? 5 : 4))
    : 0;
  const locks = features.includes('lock') ? (kind === 'veryHard' && n > 80 ? 2 : 1) : 0;
  const narrow = features.includes('narrow') ? (n > 120 && rng() < 0.4 ? 2 : 1) : 0;
  let empties = 2 + (locks >= 2 ? 1 : 0);
  // Çok zor seviyelerde sık, zor seviyelerde 60'tan sonra bazen tek boş kavanoz
  // (çözücü doğrulamazsa aday zaten atılır).
  if (kind === 'veryHard' && n >= 40 && locks < 2 && rng() < 0.7) empties = 1;
  if (kind === 'hard' && n >= 60 && locks < 2 && rng() < 0.35) empties = 1;
  return { colors, empties, cap, features, hiddenJars, locks, narrow, scramble };
}

/** Renk seçimi: az renkte birbirine benzeyen çiftleri yan yana getirmez. */
function pickColors(k: number, rng: Rng): number[] {
  for (let tries = 0; tries < 50; tries++) {
    const set = shuffled(
      rng,
      Array.from({ length: SPICE_COUNT }, (_, i) => i),
    ).slice(0, k);
    if (k > 6) return set;
    if (!CONFUSABLE_PAIRS.some(([a, b]) => set.includes(a) && set.includes(b))) return set;
  }
  return Array.from({ length: k }, (_, i) => i);
}

const isFullMono = (j: JarDef, cap: number) =>
  j.layers.length === cap && j.layers.every((c) => c === j.layers[0]);

/** Rastgele doldurma: her renkten `cap` katman, renk kavanozlarına karışık; boş kavanozlar sonda. */
function randomFill(colors: number[], cap: number, empties: number, rng: Rng): JarDef[] {
  const pool = shuffled(
    rng,
    colors.flatMap((c) => Array.from({ length: cap }, () => c)),
  );
  const jars: JarDef[] = colors.map((_, i) => ({ layers: pool.slice(i * cap, (i + 1) * cap) }));
  for (let i = 0; i < empties; i++) jars.push({ layers: [] });
  return jars;
}

/**
 * Çözülmüş durumdan geri dökümlerle karıştırma (eğitici seviyeler): her adım, ileri yönde geçerli bir
 * dökümün tersidir; bu yüzden en fazla `steps` hamlede çözülür.
 */
function scrambleFill(
  colors: number[],
  cap: number,
  empties: number,
  steps: number,
  rng: Rng,
): JarDef[] {
  const jars: number[][] = colors.map((c) => Array.from({ length: cap }, () => c));
  for (let i = 0; i < empties; i++) jars.push([]);
  let done = 0;
  for (let guard = 0; done < steps && guard < steps * 50; guard++) {
    const b = randomInt(rng, 0, jars.length - 1);
    const a = randomInt(rng, 0, jars.length - 1);
    const B = jars[b]!;
    const A = jars[a]!;
    if (a === b || B.length === 0 || A.length >= cap) continue;
    const c = B[B.length - 1]!;
    // Geri döküm: B'nin üstünden A'ya 1 katman. İleri yönde A→B geçerli olmalı:
    // B'nin yeni üstü aynı renk ya da B boş kalmalı ve A'nın eski üstü c'den farklı olmalı
    // (aynıysa ileri döküm daha fazla katman taşırdı).
    const newTop = B[B.length - 2];
    if (newTop !== undefined && newTop !== c) continue;
    if (A[A.length - 1] === c) continue;
    B.pop();
    A.push(c);
    done++;
  }
  // Boş kavanozlar sonda dursun.
  const filled = jars.filter((j) => j.length > 0);
  const out: JarDef[] = filled.map((layers) => ({ layers }));
  while (out.length < colors.length + empties) out.push({ layers: [] });
  return out;
}

function applyFeatures(jars: JarDef[], shape: Shape, rng: Rng): JarDef[] | null {
  const out = jars.map((j) => ({ ...j, layers: [...j.layers] }));
  const nonEmpty = out.map((j, i) => (j.layers.length > 0 ? i : -1)).filter((i) => i >= 0);
  // Kilit: kavanozda o renkten hiç olmamalı (yoksa o renk asla tamamlanamaz).
  const lockedIdx: number[] = [];
  for (let k = 0; k < shape.locks; k++) {
    const cand = shuffled(
      rng,
      nonEmpty.filter((i) => !lockedIdx.includes(i)),
    );
    let placed = false;
    for (const i of cand) {
      const jar = out[i]!;
      const present = new Set(jar.layers);
      const lockedColors = new Set(lockedIdx.map((x) => out[x]!.lock));
      const options = [...new Set(out.flatMap((j) => j.layers))].filter(
        (c) => !present.has(c) && !lockedColors.has(c),
      );
      if (options.length === 0 || new Set(jar.layers).size < 2) continue;
      jar.lock = pick(rng, options);
      lockedIdx.push(i);
      placed = true;
      break;
    }
    if (!placed) return null;
  }
  // Gizli katmanlar: seçilen kavanozlarda en üst hariç hepsi (ya da çoğu) gizli.
  const hidCand = shuffled(rng, nonEmpty).slice(0, shape.hiddenJars);
  for (const i of hidCand) {
    const len = out[i]!.layers.length;
    out[i]!.hidden = Math.max(1, len - 1 - (rng() < 0.3 ? 1 : 0));
  }
  // Dar ağız: kilitli olmayan herhangi bir kavanoz (boş olabilir).
  const narrowCand = shuffled(
    rng,
    out.map((_, i) => i).filter((i) => !lockedIdx.includes(i)),
  ).slice(0, shape.narrow);
  for (const i of narrowCand) out[i]!.narrow = true;
  return out;
}

export interface GenerateOptions {
  config?: DifficultyConfig;
  /** Seviye başına aday sayısı. */
  candidates?: number;
  botRuns?: number;
}

function buildCandidate(
  id: string,
  n: number,
  seed: string,
  kind: LevelKind,
  shapeRng: Rng,
  d: DifficultyConfig,
): Omit<LevelDef, 'stats'> | null {
  const rng = createRng(seed);
  const shape = shapeFor(n, kind, shapeRng, d);
  const colors = pickColors(shape.colors, rng);
  const base =
    shape.scramble > 0
      ? scrambleFill(colors, shape.cap, shape.empties, shape.scramble, rng)
      : randomFill(colors, shape.cap, shape.empties, rng);
  if (base.some((j) => isFullMono(j, shape.cap))) return null;
  const jars = applyFeatures(base, shape, rng);
  if (!jars) return null;
  const intro = introducedAt(n, d);
  return {
    id,
    n,
    seed,
    kind,
    cap: shape.cap,
    ...(intro ? { introduces: intro } : {}),
    features: shape.features,
    jars,
  };
}

/** Seviye n'i üretir: adaylar → çözücü doğrulaması → hedef zorluğa en yakın aday. */
export function generateLevel(n: number, opts: GenerateOptions = {}): LevelDef {
  const d = opts.config ?? DEFAULT_CONFIG.difficulty;
  const kind = levelKind(n, d);
  const target = targetDifficulty(n, d);
  return pickBest(`level-${n}`, n, `baharat:${n}`, kind, target, d, opts);
}

/** Günün bulmacası: herkese aynı, orta-zor, tüm öğeler açık. */
export function generateDaily(date: string, opts: GenerateOptions = {}): LevelDef {
  const d = opts.config ?? DEFAULT_CONFIG.difficulty;
  // 120. seviye civarı bir şekil, "zor" türünde.
  return pickBest(`daily-${date}`, 0, `daily:${date}`, 'hard', 6.5, d, opts, 125);
}

function pickBest(
  id: string,
  n: number,
  seedBase: string,
  kind: LevelKind,
  target: number,
  d: DifficultyConfig,
  opts: GenerateOptions,
  shapeLevel = n,
): LevelDef {
  const count = opts.candidates ?? 8;
  let best: LevelDef | null = null;
  let bestDist = Infinity;
  let made = 0;
  for (let k = 0; made < count && k < count * 6; k++) {
    const seed = `${seedBase}:${k}`;
    const cand = buildCandidate(id, shapeLevel, seed, kind, createRng(`${seed}:shape`), d);
    if (!cand) continue;
    const a = analyzeLevel(cand, opts.botRuns ?? 40);
    if (!a.solvable) continue;
    made++;
    const dist = Math.abs(a.stats.difficulty - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = { ...cand, n, stats: a.stats };
    }
  }
  if (!best) throw new Error(`${id}: çözülebilir aday üretilemedi`);
  return best;
}
