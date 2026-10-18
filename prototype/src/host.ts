/**
 * Uygulama köprüsü. Oyun iOS uygulamasının içinde (react-native-webview) çalışırken kayıt, titreşim
 * ve ileride reklamlar telefonun kendi API'lerine gider; tarayıcıda (prototip) her şey yerinde kalır.
 */
interface NativeBridge {
  postMessage(data: string): void;
}
/** Uygulamanın yetenekleri (sayfa yüklenmeden önce verilir, sonra `hostState` ile güncellenir). */
export interface HostCaps {
  /** Gerçek reklamlar var (AdMob). Expo Go'da yok. */
  ads: boolean;
  /** AB/İngiltere'de "Gizlilik seçenekleri" düğmesi gösterilmeli (UMP). */
  privacyOptions: boolean;
}
export type HostEvent =
  | { type: 'adResult'; id: number; shown: boolean; rewarded: boolean }
  | ({ type: 'hostState' } & Partial<HostCaps>);

interface HostWindow {
  ReactNativeWebView?: NativeBridge;
  /** Uygulama, sayfa yüklenmeden önce telefondaki kaydı buraya koyar. */
  __BS_SAVED?: string | null;
  __BS_HOST?: Partial<HostCaps>;
  /** Uygulama → oyun olayları. */
  __BS_onHost?: (e: HostEvent) => void;
}
const w = window as unknown as HostWindow;

/** Oyun iOS uygulamasının içinde mi? */
export const inApp = !!w.ReactNativeWebView;

export type HostMessage =
  | { type: 'save'; data: string; reset?: boolean }
  | { type: 'haptic'; pattern: number | number[] }
  | { type: 'ready' }
  | { type: 'ad'; id: number; kind: 'rewarded' | 'interstitial' }
  | { type: 'banner'; visible: boolean }
  | { type: 'privacyOptions' };

export function postHost(msg: HostMessage) {
  try {
    w.ReactNativeWebView?.postMessage(JSON.stringify(msg));
  } catch {
    // köprü yoksa sessizce geç
  }
}

/** Uygulamanın verdiği kayıt (yoksa null). */
export function hostSaved(): string | null {
  return inApp ? (w.__BS_SAVED ?? null) : null;
}

export const hostCaps: HostCaps = {
  ads: !!w.__BS_HOST?.ads,
  privacyOptions: !!w.__BS_HOST?.privacyOptions,
};
const capListeners: (() => void)[] = [];
export function onHostCaps(cb: () => void) {
  capListeners.push(cb);
}

let nextAdId = 1;
const pendingAds = new Map<number, (r: { shown: boolean; rewarded: boolean }) => void>();

w.__BS_onHost = (e) => {
  if (e.type === 'adResult') {
    pendingAds.get(e.id)?.({ shown: e.shown, rewarded: e.rewarded });
    pendingAds.delete(e.id);
  } else if (e.type === 'hostState') {
    if (typeof e.ads === 'boolean') hostCaps.ads = e.ads;
    if (typeof e.privacyOptions === 'boolean') hostCaps.privacyOptions = e.privacyOptions;
    for (const cb of capListeners) cb();
  }
};

/** Uygulamadan tam ekran reklam ister; reklam kapanınca sonuç döner (en fazla 90 sn beklenir). */
export function hostAd(
  kind: 'rewarded' | 'interstitial',
): Promise<{ shown: boolean; rewarded: boolean }> {
  const id = nextAdId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingAds.delete(id);
      resolve({ shown: false, rewarded: false });
    }, 90_000);
    pendingAds.set(id, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
    postHost({ type: 'ad', id, kind });
  });
}
