/**
 * Uygulama köprüsü. Oyun iOS uygulamasının içinde (react-native-webview) çalışırken kayıt, titreşim
 * ve ileride reklamlar telefonun kendi API'lerine gider; tarayıcıda (prototip) her şey yerinde kalır.
 */
interface NativeBridge {
  postMessage(data: string): void;
}
interface HostWindow {
  ReactNativeWebView?: NativeBridge;
  /** Uygulama, sayfa yüklenmeden önce telefondaki kaydı buraya koyar. */
  __BS_SAVED?: string | null;
}
const w = window as unknown as HostWindow;

/** Oyun iOS uygulamasının içinde mi? */
export const inApp = !!w.ReactNativeWebView;

export type HostMessage =
  | { type: 'save'; data: string }
  | { type: 'haptic'; pattern: number | number[] }
  | { type: 'ready' };

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
