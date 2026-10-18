/**
 * Oyun (WebView) ↔ uygulama mesajları. Oyun tarafı: prototype/src/host.ts.
 * Saf fonksiyonlar; React Native'e bağımlı değil, test edilebilir.
 */
export type HostMessage =
  | { type: 'save'; data: string; reset?: boolean }
  | { type: 'haptic'; pattern: number | number[] }
  | { type: 'ready' }
  | { type: 'ad'; id: number; kind: 'rewarded' | 'interstitial' }
  | { type: 'banner'; visible: boolean }
  | { type: 'privacyOptions' };

/** Gelen metni doğrular; tanınmayan ya da bozuk mesaj null döner. */
export function parseHostMessage(raw: string): HostMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  if (o.type === 'save' && typeof o.data === 'string' && o.data.length < 1_000_000)
    return o.reset === true
      ? { type: 'save', data: o.data, reset: true }
      : { type: 'save', data: o.data };
  if (o.type === 'haptic') {
    const p = o.pattern;
    if (typeof p === 'number' && Number.isFinite(p)) return { type: 'haptic', pattern: p };
    if (Array.isArray(p) && p.every((x) => typeof x === 'number'))
      return { type: 'haptic', pattern: p as number[] };
    return null;
  }
  if (o.type === 'ready') return { type: 'ready' };
  if (
    o.type === 'ad' &&
    typeof o.id === 'number' &&
    Number.isInteger(o.id) &&
    (o.kind === 'rewarded' || o.kind === 'interstitial')
  )
    return { type: 'ad', id: o.id, kind: o.kind };
  if (o.type === 'banner' && typeof o.visible === 'boolean')
    return { type: 'banner', visible: o.visible };
  if (o.type === 'privacyOptions') return { type: 'privacyOptions' };
  return null;
}

/**
 * Tarayıcı titreşim desenini iPhone dokunsal geri bildirimine çevirir:
 * kısa (≤15 ms) dokunuş → hafif darbe, uzun tek titreşim (geçersiz döküm) → uyarı,
 * desen (kapak kapandı, kazanma) → başarı.
 */
export type Haptic = 'light' | 'medium' | 'warning' | 'success';
export function hapticFor(pattern: number | number[]): Haptic {
  if (Array.isArray(pattern)) return 'success';
  if (pattern <= 15) return 'light';
  if (pattern >= 30) return 'warning';
  return 'medium';
}

/** Sayfa yüklenmeden önce çalışır: telefondaki kaydı ve uygulamanın yeteneklerini oyuna verir. */
export function injectSaved(saved: string | null, caps: { ads: boolean } = { ads: false }): string {
  return `window.__BS_SAVED = ${JSON.stringify(saved)}; window.__BS_HOST = ${JSON.stringify(caps)}; true;`;
}

/** Uygulama → oyun olayı (prototype/src/host.ts › HostEvent). */
export type HostEvent =
  | { type: 'adResult'; id: number; shown: boolean; rewarded: boolean }
  | { type: 'hostState'; ads?: boolean; privacyOptions?: boolean };

export function hostEventJs(e: HostEvent): string {
  return `window.__BS_onHost && window.__BS_onHost(${JSON.stringify(e)}); true;`;
}

/** Kayıttan ilerlemenin geri alınamaz kısmı: açılan seviye ve alınan dükkân parçası sayısı. */
function milestones(save: string | null): { unlocked: number; owned: number } | null {
  if (!save) return null;
  try {
    const outer = JSON.parse(save) as { progress?: unknown };
    const p = typeof outer.progress === 'string' ? JSON.parse(outer.progress) : outer.progress;
    if (!p || typeof p !== 'object') return null;
    const v = p as { unlocked?: unknown; owned?: unknown };
    const unlocked = typeof v.unlocked === 'number' ? v.unlocked : 0;
    const owned = v.owned && typeof v.owned === 'object' ? Object.keys(v.owned).length : 0;
    return { unlocked, owned };
  } catch {
    return null;
  }
}

/**
 * Yeni kayıt telefondakinin üstüne yazılabilir mi? Oyuncu ilerlemesi asla geri gitmez: açılan seviye ya da
 * alınan parça sayısı azalıyorsa (ör. kayıt okunamadığı için oyun sıfırdan başladıysa) yazılmaz.
 * Tek istisna, oyuncunun Ayarlar'dan bilerek yaptığı sıfırlama (`reset`).
 */
export function shouldAcceptSave(previous: string | null, next: string, reset = false): boolean {
  if (reset) return true;
  const a = milestones(previous);
  const b = milestones(next);
  if (!b) return false;
  if (!a) return true;
  return b.unlocked >= a.unlocked && b.owned >= a.owned;
}
