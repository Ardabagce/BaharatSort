import type { GameState, Jar, JarDef, LevelDef, Move, SpiceId } from './types';
import { shuffled, type Rng } from './rng';

/**
 * Kural motoru. Tüm fonksiyonlar saftır: durum değiştirilmez, yenisi döner.
 *
 * Döküm: kaynağın en üstündeki aynı renkli bitişik katmanlar, hedefe sığdığı kadar dökülür.
 * Hedef boşsa ya da en üst rengi aynıysa ve yer varsa geçerlidir. Dar ağızlı kavanoz (kaynak ya da
 * hedef) bir dökümde yalnızca 1 katman geçirir. Tek renkle dolan kavanoz kapanır; o renkle kilitli
 * kavanozların kilidi açılır.
 */

export function createGame(level: Pick<LevelDef, 'cap' | 'jars'>): GameState {
  return { cap: level.cap, jars: level.jars.map(jarFromDef) };
}

export function jarFromDef(d: JarDef): Jar {
  const layers = [...d.layers];
  return {
    layers,
    hidden: Math.max(0, Math.min(d.hidden ?? 0, layers.length - 1)),
    lock: d.lock ?? null,
    narrow: d.narrow ?? false,
    capped: false,
  };
}

export const emptyJar = (): Jar => ({
  layers: [],
  hidden: 0,
  lock: null,
  narrow: false,
  capped: false,
});

export function topColor(jar: Jar): SpiceId | undefined {
  return jar.layers[jar.layers.length - 1];
}

/** En üstteki aynı renkli bitişik katman sayısı. */
export function topRun(jar: Jar): number {
  const n = jar.layers.length;
  if (n === 0) return 0;
  const c = jar.layers[n - 1];
  let k = 1;
  while (k < n && jar.layers[n - 1 - k] === c) k++;
  return k;
}

export function isMono(jar: Jar): boolean {
  return jar.layers.length > 0 && topRun(jar) === jar.layers.length;
}

export function isComplete(jar: Jar, cap: number): boolean {
  return jar.layers.length === cap && isMono(jar);
}

/** Kavanoz şu an oyunda kullanılabilir mi (kapalı ya da kilitli değil). */
export function isActive(jar: Jar): boolean {
  return !jar.capped && jar.lock === null;
}

export type PourFail =
  'same' | 'empty' | 'source-closed' | 'target-closed' | 'full' | 'mismatch' | 'no-jar';

export type PourCheck =
  { ok: true; amount: number; color: SpiceId } | { ok: false; reason: PourFail };

export function checkPour(state: GameState, from: number, to: number): PourCheck {
  const a = state.jars[from];
  const b = state.jars[to];
  if (!a || !b) return { ok: false, reason: 'no-jar' };
  if (from === to) return { ok: false, reason: 'same' };
  if (!isActive(a)) return { ok: false, reason: 'source-closed' };
  if (a.layers.length === 0) return { ok: false, reason: 'empty' };
  if (!isActive(b)) return { ok: false, reason: 'target-closed' };
  const free = state.cap - b.layers.length;
  if (free <= 0) return { ok: false, reason: 'full' };
  const color = topColor(a)!;
  const bt = topColor(b);
  if (bt !== undefined && bt !== color) return { ok: false, reason: 'mismatch' };
  let amount = Math.min(topRun(a), free);
  if (a.narrow || b.narrow) amount = Math.min(amount, 1);
  return { ok: true, amount, color };
}

export interface PourResult {
  state: GameState;
  amount: number;
  color: SpiceId;
  /** Hedef kavanoz bu dökümle kapandı. */
  capped: boolean;
  /** Kilidi açılan kavanozlar. */
  unlocked: number[];
  /** Kaynakta yeni açığa çıkan gizli katman var mı. */
  revealed: boolean;
}

export type PourOutcome = ({ ok: true } & PourResult) | { ok: false; reason: PourFail };

export function pour(state: GameState, from: number, to: number): PourOutcome {
  const check = checkPour(state, from, to);
  if (!check.ok) return check;
  const { amount, color } = check;
  const jars = state.jars.slice();
  const a = jars[from]!;
  const b = jars[to]!;
  const aLayers = a.layers.slice(0, a.layers.length - amount);
  const aHidden = Math.max(0, Math.min(a.hidden, aLayers.length - 1));
  jars[from] = { ...a, layers: aLayers, hidden: aHidden };
  const bLayers = [...b.layers];
  for (let i = 0; i < amount; i++) bLayers.push(color);
  const nb: Jar = { ...b, layers: bLayers };
  let capped = false;
  if (isComplete(nb, state.cap)) {
    nb.capped = true;
    capped = true;
  }
  jars[to] = nb;
  const unlocked = capped ? unlockCascade(jars, state.cap) : [];
  return {
    ok: true,
    state: { cap: state.cap, jars },
    amount,
    color,
    capped,
    unlocked,
    revealed: aHidden < a.hidden && aLayers.length > 0,
  };
}

/** Kapalı renklere bağlı kilitleri açar (yerinde). Açılan kavanoz zaten tamamsa o da kapanır. */
function unlockCascade(jars: Jar[], cap: number): number[] {
  const unlocked: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    const done = new Set<SpiceId>();
    for (const j of jars) if (j.capped) done.add(j.layers[0]!);
    jars.forEach((j, i) => {
      if (j.lock === null || !done.has(j.lock)) return;
      const nj: Jar = { ...j, lock: null };
      if (isComplete(nj, cap)) nj.capped = true;
      jars[i] = nj;
      unlocked.push(i);
      changed = true;
    });
  }
  return unlocked;
}

/** Kazanma: her kavanoz ya boş ya da tek renkle dolu ve kapalı. */
export function isWon(state: GameState): boolean {
  return state.jars.every((j) => j.capped || (j.layers.length === 0 && j.lock === null));
}

/** Tüm geçerli dökümler (anlamsızları dahil). */
export function validMoves(state: GameState): Move[] {
  const out: Move[] = [];
  for (let from = 0; from < state.jars.length; from++)
    for (let to = 0; to < state.jars.length; to++)
      if (checkPour(state, from, to).ok) out.push({ from, to });
  return out;
}

/**
 * Durumu değiştirmeyen (simetrik) dökümler hariç geçerli hamleler:
 * tek renkli bir kavanozun tamamını aynı türden boş bir kavanoza dökmek ve aynı türden ikinci bir
 * boş kavanoza dökmek (ilkiyle aynı sonucu verir).
 */
export function meaningfulMoves(state: GameState): Move[] {
  const out: Move[] = [];
  const { jars } = state;
  for (let from = 0; from < jars.length; from++) {
    const a = jars[from]!;
    if (!isActive(a) || a.layers.length === 0) continue;
    let emptyNormalSeen = false;
    let emptyNarrowSeen = false;
    for (let to = 0; to < jars.length; to++) {
      const c = checkPour(state, from, to);
      if (!c.ok) continue;
      const b = jars[to]!;
      if (b.layers.length === 0) {
        if (b.narrow ? emptyNarrowSeen : emptyNormalSeen) continue;
        if (b.narrow) emptyNarrowSeen = true;
        else emptyNormalSeen = true;
        if (c.amount === a.layers.length && a.narrow === b.narrow) continue;
      }
      out.push({ from, to });
    }
  }
  return out;
}

/** Kanonik anahtar: kavanoz sırası önemsiz; tür (dar, kilit) ve içerik önemli. */
export function stateKey(state: GameState): string {
  const keys = state.jars.map(jarKey);
  keys.sort();
  return keys.join('|');
}

export function jarKey(j: Jar): string {
  let k = '';
  if (j.capped) return 'C' + String.fromCharCode(97 + j.layers[0]!);
  if (j.narrow) k += 'n';
  if (j.lock !== null) k += 'L' + String.fromCharCode(97 + j.lock);
  k += ':';
  for (const c of j.layers) k += String.fromCharCode(97 + c);
  return k;
}

/**
 * Kilitlenme: anlamlı hamle yok ya da erişilebilen durumların tamamı küçük, kapalı bir küme ve
 * hiçbiri kazanmıyor (oyuncu yalnızca aynı dökümleri ileri geri yapabilir).
 */
export function isStuck(state: GameState, budget = 2000): boolean {
  if (isWon(state)) return false;
  if (meaningfulMoves(state).length === 0) return true;
  const seen = new Set<string>([stateKey(state)]);
  const stack: GameState[] = [state];
  while (stack.length) {
    const s = stack.pop()!;
    for (const m of meaningfulMoves(s)) {
      const r = pour(s, m.from, m.to);
      if (!r.ok) continue;
      if (isWon(r.state) || r.capped) return false;
      const k = stateKey(r.state);
      if (seen.has(k)) continue;
      if (seen.size >= budget) return false;
      seen.add(k);
      stack.push(r.state);
    }
  }
  return true;
}

/** "Boş kavanoz +1" güçlendiricisi / "Son bir şans". */
export function addEmptyJar(state: GameState): GameState {
  return { cap: state.cap, jars: [...state.jars, emptyJar()] };
}

/**
 * Karıştır: kapalı ve kilitli olmayan kavanozlardaki katmanları, her kavanozun doluluğu aynı kalacak
 * şekilde karıştırır. Tek renkle dolu kavanoz oluşursa kapanır.
 */
export function shuffleJars(state: GameState, rng: Rng): GameState {
  const idx = state.jars.map((j, i) => (isActive(j) ? i : -1)).filter((i) => i >= 0);
  const pool = shuffled(
    rng,
    idx.flatMap((i) => state.jars[i]!.layers),
  );
  const jars = state.jars.slice();
  let p = 0;
  for (const i of idx) {
    const j = jars[i]!;
    const layers = pool.slice(p, p + j.layers.length);
    p += layers.length;
    const nj: Jar = { ...j, layers, hidden: Math.min(j.hidden, Math.max(0, layers.length - 1)) };
    if (isComplete(nj, state.cap)) nj.capped = true;
    jars[i] = nj;
  }
  unlockCascade(jars, state.cap);
  return { cap: state.cap, jars };
}

/** Durumu seviye tanımı biçimine çevirir (karıştırma sonrası çözücüye vermek için). */
export function toDefs(state: GameState): JarDef[] {
  return state.jars.map((j) => ({
    layers: [...j.layers],
    ...(j.hidden ? { hidden: j.hidden } : {}),
    ...(j.lock !== null ? { lock: j.lock } : {}),
    ...(j.narrow ? { narrow: true } : {}),
  }));
}
