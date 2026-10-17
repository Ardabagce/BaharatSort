import { createGame, isWon, meaningfulMoves, pour, stateKey } from './rules';
import type { GameState, LevelDef, Move } from './types';

/**
 * Durum uzayı çözücüsü: A* + kanonik durum anahtarı (kavanoz sırası önemsiz) + simetri budaması
 * (`meaningfulMoves`: aynı türden boş kavanozlar arasında tekrar ve tek renkli kavanozu boşa
 * aktarmak gibi anlamsız dökümler atlanır).
 *
 * Sezgisel (kabul edilebilir ve tutarlı): her dökümün kaynağı tek bir "üst dizi"dir.
 *  - Bir kavanozda farklı renk üstünde duran her dizi en az bir kez taşınmalı: Σ (dizi sayısı − 1).
 *  - Bir renk birden çok kavanozun dibindeyse, biri hariç hepsi taşınmalı: Σ (dipteki dizi − 1).
 * Bir döküm bu toplamı en fazla 1 azaltır; bu yüzden `weight = 1` iken bulunan çözüm en kısadır.
 */

export interface SolveOptions {
  /** Açılacak en fazla düğüm; aşılırsa `solved: false, exhausted: false`. */
  maxNodes?: number;
  /** 1 = en kısa çözüm (A*). >1 = daha hızlı, kısa olması garanti değil (ağırlıklı A*). */
  weight?: number;
}

export interface SolveResult {
  solved: boolean;
  /** Arama bütçe dolmadan bitti (çözülemez olduğu kesin). */
  exhausted: boolean;
  moves: Move[];
  nodes: number;
  /** Çözüm en kısa mı (weight = 1 ve çözüldü). */
  optimal: boolean;
}

export function heuristic(state: GameState): number {
  let h = 0;
  const bottoms = new Map<number, number>();
  for (const j of state.jars) {
    const n = j.layers.length;
    if (n === 0 || j.capped) continue;
    let runs = 1;
    for (let i = 1; i < n; i++) if (j.layers[i] !== j.layers[i - 1]) runs++;
    h += runs - 1;
    const b = j.layers[0]!;
    bottoms.set(b, (bottoms.get(b) ?? 0) + 1);
  }
  for (const [, k] of bottoms) h += k - 1;
  return h;
}

/** İkili yığın (min-heap), öncelik f, eşitlikte büyük g (derine gitmeyi tercih eder). */
class Heap {
  private ids: number[] = [];
  private f: number[] = [];
  private g: number[] = [];
  get size() {
    return this.ids.length;
  }
  private less(i: number, j: number) {
    return this.f[i]! < this.f[j]! || (this.f[i] === this.f[j] && this.g[i]! > this.g[j]!);
  }
  private swap(i: number, j: number) {
    [this.ids[i], this.ids[j]] = [this.ids[j]!, this.ids[i]!];
    [this.f[i], this.f[j]] = [this.f[j]!, this.f[i]!];
    [this.g[i], this.g[j]] = [this.g[j]!, this.g[i]!];
  }
  push(id: number, f: number, g: number) {
    this.ids.push(id);
    this.f.push(f);
    this.g.push(g);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0]!;
    const last = this.ids.length - 1;
    this.swap(0, last);
    this.ids.pop();
    this.f.pop();
    this.g.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.ids.length && this.less(l, m)) m = l;
      if (r < this.ids.length && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

export function solve(start: GameState, opts: SolveOptions = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 200_000;
  const weight = opts.weight ?? 1;
  if (isWon(start)) return { solved: true, exhausted: false, moves: [], nodes: 0, optimal: true };

  const states: GameState[] = [start];
  const parent: number[] = [-1];
  const move: (Move | null)[] = [null];
  const gOf: number[] = [0];
  const best = new Map<string, number>([[stateKey(start), 0]]);
  const closed = new Set<number>();
  const heap = new Heap();
  heap.push(0, weight * heuristic(start), 0);
  let expanded = 0;

  while (heap.size) {
    const id = heap.pop();
    if (closed.has(id)) continue;
    closed.add(id);
    const s = states[id]!;
    if (isWon(s)) {
      const moves: Move[] = [];
      for (let k = id; parent[k]! >= 0; k = parent[k]!) moves.push(move[k]!);
      moves.reverse();
      return { solved: true, exhausted: false, moves, nodes: expanded, optimal: weight === 1 };
    }
    if (++expanded > maxNodes)
      return { solved: false, exhausted: false, moves: [], nodes: expanded, optimal: false };
    const g = gOf[id]! + 1;
    for (const m of meaningfulMoves(s)) {
      const r = pour(s, m.from, m.to);
      if (!r.ok) continue;
      const key = stateKey(r.state);
      const prev = best.get(key);
      if (prev !== undefined && gOf[prev]! <= g) continue;
      const nid = states.length;
      states.push(r.state);
      parent.push(id);
      move.push(m);
      gOf.push(g);
      best.set(key, nid);
      heap.push(nid, g + weight * heuristic(r.state), g);
    }
  }
  return { solved: false, exhausted: true, moves: [], nodes: expanded, optimal: false };
}

export function solveLevel(level: Pick<LevelDef, 'cap' | 'jars'>, opts?: SolveOptions) {
  return solve(createGame(level), opts);
}

/**
 * Önce kesin en kısa çözüm denenir; bütçe yetmezse ağırlıklı A* ile en azından çözülebilirlik
 * doğrulanır (çözüm uzunluğu o zaman üst sınırdır).
 */
export function solveRobust(
  state: GameState,
  exactNodes = 120_000,
  fallbackNodes = 300_000,
): SolveResult {
  const exact = solve(state, { maxNodes: exactNodes });
  if (exact.solved || exact.exhausted) return exact;
  return solve(state, { maxNodes: fallbackNodes, weight: 3 });
}

/** İpucu: bir sonraki doğru döküm. Hızlı olsun diye ağırlıklı arama; çözüm yoksa null. */
export function hint(state: GameState, maxNodes = 60_000): Move | null {
  let r = solve(state, { maxNodes, weight: 2 });
  if (!r.solved && !r.exhausted) r = solve(state, { maxNodes: maxNodes * 2, weight: 5 });
  return r.solved ? (r.moves[0] ?? null) : null;
}
