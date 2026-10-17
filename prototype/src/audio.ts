import type { Texture } from '../../shared/src/spices';

/**
 * Koddan sentezlenen sesler (Web Audio). Harici ses dosyası yok.
 * Tarayıcı, ilk dokunuştan önce ses çalmaya izin vermez; `unlock()` ilk dokunuşta çağrılır.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let ambience: { stop: () => void } | null = null;
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
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlock() {
  ac();
  syncAmbience();
}

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function noiseSrc(c: AudioContext) {
  const s = c.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  return s;
}

/** Kepçeden akan baharat: dokuya göre süzülmüş gürültü + taneli tıkırtılar. */
export function sfxPour(texture: Texture, seconds: number) {
  const c = ac();
  if (!c || !audio.sound || !master) return;
  const t = c.currentTime;
  const src = noiseSrc(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  const hi =
    texture === 'seed' ? 4200 : texture === 'leaf' ? 1800 : texture === 'flakes' ? 3000 : 2400;
  bp.frequency.setValueAtTime(hi, t);
  bp.frequency.exponentialRampToValueAtTime(hi * 0.55, t + seconds);
  bp.Q.value = texture === 'powder' ? 0.7 : 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.06);
  g.gain.setValueAtTime(0.28, t + seconds * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + seconds + 0.05);
  if (texture === 'seed' || texture === 'flakes') {
    for (let i = 0; i < 14; i++) {
      const tt = t + 0.04 + Math.random() * seconds * 0.85;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 2500 + Math.random() * 2500;
      const gg = c.createGain();
      env(gg, tt, 0.002, 0.05, 0.03);
      o.connect(gg).connect(master);
      o.start(tt);
      o.stop(tt + 0.05);
    }
  }
}

/** Cam kavanoza hafif dokunuş (seçim). */
export function sfxTink(pitch = 1) {
  const c = ac();
  if (!c || !audio.sound || !master) return;
  const t = c.currentTime;
  for (const [f, v] of [
    [1760, 0.08],
    [2640, 0.04],
    [3960, 0.02],
  ] as const) {
    const o = c.createOscillator();
    o.frequency.value = f * pitch;
    const g = c.createGain();
    env(g, t, 0.003, v, 0.35);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.4);
  }
}

/** Geçersiz döküm: tok, kısa bir vuruş. */
export function sfxThud() {
  const c = ac();
  if (!c || !audio.sound || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
  const g = c.createGain();
  env(g, t, 0.004, 0.35, 0.16);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.22);
}

/** Mantar kapağın oturması: "pop" + ahşap "tok". */
export function sfxCork() {
  const c = ac();
  if (!c || !audio.sound || !master) return;
  const t = c.currentTime + 0.12;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(190, t + 0.09);
  const g = c.createGain();
  env(g, t, 0.003, 0.4, 0.1);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.15);
  const w = c.createOscillator();
  w.type = 'triangle';
  w.frequency.value = 420;
  const gw = c.createGain();
  env(gw, t + 0.11, 0.002, 0.22, 0.12);
  w.connect(gw).connect(master);
  w.start(t + 0.11);
  w.stop(t + 0.3);
}

/** Kazanma: Hicaz dizisinde ud benzeri çekişler. */
export function sfxWin() {
  const c = ac();
  if (!c || !audio.sound || !master) return;
  const notes = [293.66, 311.13, 369.99, 392, 440, 587.33];
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.11;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    const g = c.createGain();
    env(g, t, 0.004, 0.16, i === notes.length - 1 ? 1.1 : 0.45);
    o.connect(lp).connect(g).connect(master!);
    o.start(t);
    o.stop(t + 1.3);
  });
}

/** Kedi mırlaması. */
export function sfxPurr() {
  const c = ac();
  if (!c || !audio.sound || !master) return;
  const t = c.currentTime;
  const src = noiseSrc(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  const am = c.createGain();
  am.gain.value = 0;
  const lfo = c.createOscillator();
  lfo.frequency.value = 26;
  const lg = c.createGain();
  lg.gain.value = 0.5;
  lfo.connect(lg).connect(am.gain);
  const g = c.createGain();
  env(g, t, 0.1, 0.7, 1.1);
  src.connect(lp).connect(am).connect(g).connect(master);
  src.start(t);
  lfo.start(t);
  src.stop(t + 1.3);
  lfo.stop(t + 1.3);
}

/** Çarşı uğultusu: kısık, yavaşça dalgalanan gürültü + arada uzaktan çay bardağı şıngırtısı. */
function startAmbience(c: AudioContext): { stop: () => void } {
  const src = noiseSrc(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 520;
  bp.Q.value = 0.6;
  const g = c.createGain();
  g.gain.value = 0.045;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.13;
  const lg = c.createGain();
  lg.gain.value = 0.018;
  lfo.connect(lg).connect(g.gain);
  src.connect(bp).connect(g).connect(master!);
  src.start();
  lfo.start();
  const timer = window.setInterval(() => {
    if (Math.random() < 0.5) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.value = 2200 + Math.random() * 1400;
    const gg = c.createGain();
    env(gg, t, 0.002, 0.012, 0.3);
    o.connect(gg).connect(master!);
    o.start(t);
    o.stop(t + 0.35);
  }, 2600);
  return {
    stop: () => {
      window.clearInterval(timer);
      src.stop();
      lfo.stop();
    },
  };
}

export function syncAmbience() {
  const want = audio.music && audio.sound;
  if (want && !ambience && ctx && master) ambience = startAmbience(ctx);
  if (!want && ambience) {
    ambience.stop();
    ambience = null;
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // titreşim yok
  }
}
