import { inApp, postHost } from './host';
import type { Texture } from '../../shared/src/spices';

/**
 * Gerçek kayıtlardan sesler (OpenGameArt, CC0; kaynaklar docs/assets.md). Dosyalar sayfaya data URI
 * olarak gömülür, ilk dokunuşta Web Audio ile çözülür. Tarayıcı, ilk dokunuştan önce ses çalmaya
 * izin vermez; `unlock()` ilk dokunuşta çağrılır.
 */

const SRC = {
  pour: '__ASSET:sfx_pour.mp3__',
  pourSeed: '__ASSET:sfx_pour_seed.mp3__',
  tink: '__ASSET:sfx_tink.mp3__',
  cork: '__ASSET:sfx_cork.mp3__',
  thud: '__ASSET:sfx_thud.mp3__',
  coins: '__ASSET:sfx_coins.mp3__',
  win: '__ASSET:sfx_win.mp3__',
  meow: '__ASSET:sfx_meow.mp3__',
  calm: '__ASSET:sfx_calm.mp3__',
};
type Name = keyof typeof SRC;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers: Partial<Record<Name, AudioBuffer>> = {};
let loading: Promise<void> | null = null;
let ambience: { stop: () => void; gain: GainNode } | null = null;
const AMBIENCE_GAIN = 0.22;
export const audio = { sound: true, music: true };

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      const C =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function dataToBuffer(uri: string): ArrayBuffer {
  const b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function load(): Promise<void> {
  const c = ac();
  if (!c) return Promise.resolve();
  loading ??= Promise.all(
    (Object.keys(SRC) as Name[]).map((k) =>
      c
        .decodeAudioData(dataToBuffer(SRC[k]))
        .then((b) => {
          buffers[k] = b;
        })
        .catch(() => {}),
    ),
  ).then(() => syncAmbience());
  return loading;
}

export function unlock() {
  ac();
  void load();
  syncAmbience();
}

function play(
  name: Name,
  o: { gain?: number; rate?: number; delay?: number; duration?: number; offset?: number } = {},
) {
  const c = ac();
  const b = buffers[name];
  if (!c || !b || !audio.sound || !master) return;
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = o.rate ?? 1;
  const g = c.createGain();
  g.gain.value = o.gain ?? 1;
  src.connect(g).connect(master);
  if (o.duration) {
    g.gain.setValueAtTime(o.gain ?? 1, t + Math.max(0, o.duration - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, t + o.duration);
    src.start(t, o.offset ?? 0, o.duration + 0.02);
  } else src.start(t, o.offset ?? 0);
}

const vary = (base: number, spread: number) => base * (1 + (Math.random() - 0.5) * spread);

/** Kepçeden akan baharat: tane serpme kaydı; taneli baharatlarda tıkırtılı çakıl kaydı eklenir. */
export function sfxPour(texture: Texture, seconds: number) {
  const rate = texture === 'leaf' ? 0.85 : texture === 'powder' ? 0.95 : 1.05;
  play('pour', { gain: 0.9, rate: vary(rate, 0.08), duration: Math.min(1, seconds + 0.1) });
  if (texture === 'seed' || texture === 'flakes')
    play('pourSeed', { gain: 0.6, rate: vary(1.1, 0.1), delay: 0.05 });
}

/** Cam kavanoza hafif dokunuş (seçim). */
export function sfxTink(pitch = 1) {
  play('tink', { gain: 0.55, rate: vary(pitch, 0.04) });
}

/** Geçersiz döküm: tahtaya tok vuruş. */
export function sfxThud() {
  play('thud', { gain: 0.8, rate: vary(0.9, 0.06) });
}

/** Mantar kapağın oturması. */
export function sfxCork() {
  play('cork', { gain: 1, rate: vary(1, 0.06), delay: 0.1 });
}

/** Altın kazanınca. */
export function sfxCoins() {
  play('coins', { gain: 0.8 });
}

/** Kazanma: sakin, kısa bir ezgi; çalarken arka plan kısılır. */
export function sfxWin() {
  play('win', { gain: 0.6 });
  if (ambience && ctx) {
    const g = ambience.gain.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.04, t + 0.4);
    g.setValueAtTime(0.04, t + 5.4);
    g.linearRampToValueAtTime(AMBIENCE_GAIN, t + 8);
  }
}

/** Kedi: miyav + mırlama. */
export function sfxPurr() {
  play('meow', { gain: 0.8, rate: vary(1, 0.06) });
}

/** Arka plan: yumuşak, sakin bir ses halısı; döngüde, kısık. */
function startAmbience(c: AudioContext, b: AudioBuffer): { stop: () => void; gain: GainNode } {
  const src = c.createBufferSource();
  src.buffer = b;
  src.loop = true;
  // mp3 kodlayıcısının baştaki/sondaki sessizliği döngüde tık yapmasın.
  src.loopStart = 0.05;
  src.loopEnd = b.duration - 0.05;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(AMBIENCE_GAIN, c.currentTime + 3);
  src.connect(g).connect(master!);
  src.start(0, 0.05);
  return { stop: () => src.stop(), gain: g };
}

export function syncAmbience() {
  const want = audio.music && audio.sound;
  const b = buffers.calm;
  if (want && !ambience && ctx && master && b) ambience = startAmbience(ctx, b);
  if (!want && ambience) {
    ambience.stop();
    ambience = null;
  }
}

export function vibrate(pattern: number | number[]) {
  // iPhone'da navigator.vibrate yok: uygulamada titreşimi telefon yapar (expo-haptics).
  if (inApp) return postHost({ type: 'haptic', pattern });
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // titreşim yok
  }
}
