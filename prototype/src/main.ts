import {
  decideInterstitial,
  DEFAULT_AD_COUNTERS,
  onInterstitialShown,
  onInterstitialSkipped,
  onLevelWon,
  onNewSession,
  onRewardedWatched,
  parseAdCounters,
  type AdCounters,
} from '../../shared/src/adPolicy';
import { DEFAULT_CONFIG, type BoosterKind } from '../../shared/src/config';
import {
  buyDecoration,
  buyStyle,
  claimDailyGift,
  coinAdsLeft,
  isShopComplete,
  isShopUnlocked,
  itemKey,
  nextGiftDay,
  noteCoinAd,
  addCoins,
  selectStyle,
  stylePrice,
  topUpShortfall,
  completeLevel,
  consumeFreeHint,
  doubleReward,
  giveIntroGift,
  parseProgress,
  payBooster,
  recordStuck,
  useBooster,
  type Progress,
} from '../../shared/src/economy';
import { BUILTIN_LEVELS } from '../../shared/src/levels/builtin';
import {
  canUndo,
  createSession,
  sessionAddJar,
  sessionHint,
  sessionPour,
  sessionShuffle,
  sessionNoMoves,
  sessionStuck,
  sessionUndo,
  sessionWon,
  type Session,
} from '../../shared/src/session';
import { checkPour } from '../../shared/src/rules';
import { SPICES } from '../../shared/src/spices';
import type { Feature, GameState, Jar, LevelDef } from '../../shared/src/types';
import {
  CORK_ROOM,
  JAR_W,
  jarHeight,
  type JarDrawOpts,
  jarSVG,
  LAYER_H,
  MOUTH_Y,
  patternDefs,
  TOP,
} from './art';
import { hostAd, hostCaps, hostSaved, inApp, postHost } from './host';

/**
 * Reklamlar: prototipte simülasyon, uygulamada gerçek AdMob (uygulama tarafı, köprü üzerinden).
 * Uygulamada reklam modülü yoksa (Expo Go) reklam düğmeleri, banner ve geçiş reklamı hiç görünmez.
 */
const ADS = !inApp || hostCaps.ads;
import {
  audio,
  sfxCoins,
  sfxCork,
  sfxPour,
  sfxPurr,
  sfxThud,
  sfxTink,
  sfxWin,
  pauseAudio,
  resumeAudio,
  syncAmbience,
  unlock,
  vibrate,
} from './audio';
import { mapHTML } from './map';
import { propsSVG } from './scene';
import { productName, productStyleName } from './products';
import { ANCHORS, ITEM_ORDER, stallSVG, styleSwatch, type ItemId } from './stall';
import { getLang, setLang, t, type Lang } from './strings';

const cfg = DEFAULT_CONFIG;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
const stage = $('stage');
const fx = document.getElementById('fx') as unknown as SVGSVGElement;

// --- Kalıcı durum (localStorage yoksa bellekte) --------------------------------------------------

interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  colorblind: boolean;
  lang: Lang;
  showInfo: boolean;
  adFail: boolean;
}
const KEY = 'baharatsort.proto.v1';
interface Saved {
  progress: string;
  settings: Settings;
  ads: AdCounters;
  level: number;
}
function load(): Partial<Saved> {
  try {
    // Uygulamada kayıt telefonda durur (WebView deposu silinebilir); tarayıcıda localStorage.
    return JSON.parse(hostSaved() ?? localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
  } catch {
    return {};
  }
}
const saved = load();
let progress: Progress = parseProgress(saved.progress, cfg);
let settings: Settings = {
  sound: true,
  music: true,
  haptics: true,
  colorblind: false,
  lang: navigator.language?.toLowerCase().startsWith('tr') === false ? 'en' : 'tr',
  showInfo: !inApp,
  adFail: false,
  ...saved.settings,
};
let ads: AdCounters = saved.ads ? onNewSession(parseAdCounters(saved.ads)) : DEFAULT_AD_COUNTERS;
let lastDecision = '–';
/** Ayarlar'dan bilerek sıfırlandı: uygulama bu kaydı eskisinin üstüne yazabilir (bir kez). */
let resetPending = false;
function persist() {
  const data = JSON.stringify({ progress: JSON.stringify(progress), settings, ads, level: levelN });
  if (inApp) postHost(resetPending ? { type: 'save', data, reset: true } : { type: 'save', data });
  resetPending = false;
  try {
    localStorage.setItem(KEY, data);
  } catch {
    // depolama kapalı: oyun yine oynanır
  }
}
setLang(settings.lang);
audio.sound = settings.sound;
audio.music = settings.music;

// --- Oyun durumu -------------------------------------------------------------------------------

const hot = (window as unknown as { claude?: { hot?: HotApi } }).claude?.hot;
interface HotApi {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (d: unknown) => void) => void;
  data?: unknown;
}

let levelN = Math.min(BUILTIN_LEVELS.length, Math.max(1, saved.level ?? progress.unlocked));
let session: Session;
let selected: number | null = null;
let busy = false;
let tutorialStep = 0;
let ended = false;

function level(n: number): LevelDef {
  return BUILTIN_LEVELS[n - 1]!;
}

function startLevel(n: number) {
  // Kilitli seviyeye hiçbir yoldan girilmez.
  n = Math.max(1, Math.min(n, progress.unlocked, BUILTIN_LEVELS.length));
  pourGen++;
  pending.length = 0;
  running.clear();
  busy = false;
  deadEndMoves = 0;
  deadEndRecorded = false;
  if (document.getElementById('home') && inApp) postHost({ type: 'banner', visible: false });
  document.getElementById('home')?.remove();
  app.scrollLeft = 0;
  app.scrollTop = 0;
  levelN = n;
  const lv = level(n);
  session = createSession(lv);
  selected = null;
  ended = false;
  tutorialStep = n <= 2 ? 1 : 0;
  closeVeil();
  renderHeader();
  renderBoard();
  renderBoosters();
  persist();
  if (n <= 2) showHint(true);
  if (lv.introduces) showIntro(lv.introduces);
  if (progress.freeHint) toast(t('freeHintToast'));
}

// --- Başlık ve bilgi satırı ---------------------------------------------------------------------

function renderHeader() {
  const lv = level(levelN);
  $('levelTitle').textContent = t('level', { n: levelN });
  const b = $('levelBadge');
  b.innerHTML =
    lv.kind === 'hard' || lv.kind === 'veryHard' || lv.kind === 'relief'
      ? `<span class="badge ${lv.kind}">${t(lv.kind)}</span>`
      : '';
  $('coinCount').textContent = String(progress.coins);
  $('info').textContent = settings.showInfo
    ? t('info', { d: lv.stats.difficulty, m: lv.stats.minMoves, j: lv.jars.length })
    : '';
  $('btnLevels').setAttribute('aria-label', t('home'));
  $('btnSettings').setAttribute('aria-label', t('settings'));
  $('btnRestart').setAttribute('aria-label', t('restart'));
}

function bumpCoins() {
  $('coinCount').textContent = String(progress.coins);
  $('coins').animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], {
    duration: 300,
    easing: 'ease-out',
  });
}

// --- Tezgâh: kavanozları raflara yerleştir -------------------------------------------------------

let jarEls: HTMLButtonElement[] = [];
let jarPx = 60;

function layout(n: number, cap: number): number[] {
  const W = stage.clientWidth - 16;
  const H = stage.clientHeight - 96;
  const gap = 14;
  const ratio = (jarHeight(cap) + CORK_ROOM) / JAR_W;
  let best: { rows: number[]; w: number } | null = null;
  for (let rowsN = 1; rowsN <= 4; rowsN++) {
    const per = Math.ceil(n / rowsN);
    const wByWidth = (W - gap * (per - 1)) / per;
    const wByHeight = (H - (rowsN - 1) * 30) / rowsN / ratio;
    const w = Math.min(84, wByWidth, wByHeight);
    if (!best || w > best.w + 0.5) {
      const rows: number[] = [];
      let left = n;
      for (let r = 0; r < rowsN; r++) {
        const k = Math.ceil(left / (rowsN - r));
        rows.push(k);
        left -= k;
      }
      best = { rows, w };
    }
  }
  jarPx = Math.max(38, Math.floor(best!.w));
  return best!.rows;
}

function renderBoard() {
  const { state } = session;
  const rows = layout(state.jars.length, state.cap);
  stage.innerHTML = '';
  jarEls = [];
  let i = 0;
  const gap = Math.max(6, Math.min(14, jarPx * 0.18));
  for (const k of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.gap = `${gap}px`;
    row.innerHTML = '<div class="plank"></div>';
    for (let j = 0; j < k; j++, i++) {
      const el = document.createElement('button');
      el.className = 'jar';
      el.style.width = `${jarPx}px`;
      el.dataset.i = String(i);
      row.appendChild(el);
      jarEls.push(el);
      drawJar(i);
    }
    stage.appendChild(row);
  }
  stage.style.gap = `${Math.max(22, jarPx * 0.42)}px`;
  if (tutorialStep) caption(t(tutorialStep === 1 ? 'tutorial1' : 'tutorial2'));
  else caption('');
}

function drawJar(
  i: number,
  extra: Partial<
    Pick<JarDrawOpts, 'grown' | 'drained' | 'flowMs' | 'flowDelay' | 'corkDrop' | 'unseal'>
  > = {},
  state: GameState = session.state,
) {
  const el = jarEls[i];
  const jar = state.jars[i];
  if (!el || !jar) return;
  el.innerHTML = jarSVG(jar, state.cap, {
    uid: `${levelN}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    colorblind: settings.colorblind,
    ...extra,
  });
  const name = jar.layers.length
    ? jar.layers
        .slice()
        .reverse()
        .map((c, k) => (jar.layers.length - 1 - k < jar.hidden ? '?' : SPICES[c]!.name[getLang()]))
        .join(', ')
    : '–';
  el.setAttribute('aria-label', `${i + 1}: ${name}${jar.capped ? ' ✓' : ''}`);
  el.classList.toggle('lifted', selected === i && !running.has(i));
}

function caption(text: string) {
  let el = document.getElementById('caption');
  if (!text) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'caption';
    stage.appendChild(el);
  }
  el.textContent = text;
}

// --- Dokunma ve döküm ---------------------------------------------------------------------------

function shake(el: HTMLElement) {
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px) rotate(-3deg)' },
      { transform: 'translateX(5px) rotate(2deg)' },
      { transform: 'translateX(-3px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 300, easing: 'ease-out' },
  );
}

function clearHint() {
  for (const el of jarEls) el.classList.remove('hint-src', 'hint-dst');
}

// Dokunuşlar kavanozların raftaki asıl yerine göre çözülür: dökerken eğilip başka
// kavanozların üstüne gelen kavanoz, hızlı oynarken alttakine yapılan dokunuşu çalmasın.
stage.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('.jar');
  // Klavye (Enter/Boşluk) doğrudan düğmeye gelir.
  if (target && e.detail === 0) return onJarTap(Number(target.dataset.i));
  for (const el of jarEls) {
    const row = el.parentElement!.getBoundingClientRect();
    const left = row.left + el.offsetLeft;
    const top = row.top + el.offsetTop;
    const pad = 4;
    if (
      e.clientX >= left - pad &&
      e.clientX <= left + el.offsetWidth + pad &&
      e.clientY >= top - 18 &&
      e.clientY <= top + el.offsetHeight + pad
    )
      return onJarTap(Number(el.dataset.i));
  }
});

function onJarTap(i: number) {
  unlock();
  if (ended) return;
  const jar = session.state.jars[i]!;
  if (selected === null) {
    if (jar.layers.length === 0 || jar.capped || jar.lock !== null) {
      shake(jarEls[i]!);
      sfxThud();
      if (settings.haptics) vibrate(30);
      return;
    }
    selected = i;
    markSelected();
    sfxTink(1 + (jar.layers.length % 4) * 0.06);
    if (settings.haptics) vibrate(8);
    return;
  }
  if (selected === i) {
    selected = null;
    markSelected();
    return;
  }
  const from = selected;
  const check = checkPour(session.state, from, i);
  selected = null;
  markSelected();
  if (!check.ok) {
    if (!running.has(i)) shake(jarEls[i]!);
    sfxThud();
    if (settings.haptics) vibrate([20, 30, 20]);
    return;
  }
  queuePour(from, i);
}

/** Seçili kavanoz: animasyonda değilse kalkar, animasyondaysa yalnızca camı parlar. */
function markSelected() {
  jarEls.forEach((el, k) => {
    el.classList.toggle('lifted', selected === k && !running.has(k));
    el.classList.toggle('picked', selected === k && running.has(k));
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Döküm mantığı dokunulduğu anda uygulanır (oyuncu beklemeden sıradaki dökümü seçebilir);
 * animasyonlar sıraya girer. Farklı kavanozları ilgilendiren dökümler aynı anda oynar, aynı kavanozu
 * ilgilendirenler sırayla. Sıra birikirse animasyonlar hızlanır.
 */
interface PourJob {
  from: number;
  to: number;
  prev: GameState;
  after: GameState;
  amount: number;
  color: number;
  capped: boolean;
  unlocked: number[];
}
const running = new Set<number>();
const pending: PourJob[] = [];
let pourGen = 0;

function queuePour(from: number, to: number) {
  const prev = session.state;
  const { session: next, result } = sessionPour(session, from, to);
  if (!result.ok) return;
  session = next;
  clearHint();
  if (tutorialStep === 1) tutorialStep = 2;
  else if (tutorialStep === 2) tutorialStep = 0;
  if (sessionWon(session)) ended = true;
  pending.push({
    from,
    to,
    prev,
    after: result.state,
    amount: result.amount,
    color: result.color,
    capped: result.capped,
    unlocked: result.unlocked,
  });
  busy = true;
  pumpPours();
}

function pumpPours() {
  const blocked = new Set(running);
  for (let k = 0; k < pending.length; k++) {
    const job = pending[k]!;
    if (blocked.has(job.from) || blocked.has(job.to)) {
      blocked.add(job.from);
      blocked.add(job.to);
      continue;
    }
    pending.splice(k, 1);
    k--;
    running.add(job.from);
    running.add(job.to);
    blocked.add(job.from);
    blocked.add(job.to);
    const gen = pourGen;
    void animatePour(job)
      .catch((err) => console.error('pour animation', err))
      .then(() => {
        if (gen !== pourGen) return;
        running.delete(job.from);
        running.delete(job.to);
        markSelected();
        pumpPours();
        if (running.size === 0 && pending.length === 0)
          onPoursIdle().catch((err) => console.error('idle', err));
      });
  }
}

async function onPoursIdle() {
  busy = false;
  if (tutorialStep) caption(t('tutorial2'));
  else caption('');
  renderBoosters();
  markSelected();
  if (sessionWon(session)) return win();
  if (levelN <= 2 && tutorialStep) showHint(true);
  if (sessionNoMoves(session)) {
    // Gerçekten dökülecek yer kalmadı: "Son bir şans".
    await wait(300);
    if (running.size === 0 && pending.length === 0 && !ended) stuck();
  } else if (sessionStuck(session)) {
    // Çıkmaz ama hamle var: oyun kesilmez (oyuncu gizli katmanları bilmeden denemeye devam edebilir).
    // Karıştır açılır ve parlar; birkaç hamle sonra küçük bir not çıkar.
    if (!deadEndRecorded) {
      deadEndRecorded = true;
      progress = recordStuck(progress, cfg, levelN);
      persist();
    }
    deadEndMoves++;
    if (deadEndMoves >= DEAD_END_NOTE_AFTER) caption(t('deadEnd'));
  } else deadEndMoves = 0;
}

/** Çıkmazda notu göstermeden önce oyuncunun deneyebileceği hamle sayısı. */
const DEAD_END_NOTE_AFTER = 6;
let deadEndMoves = 0;
let deadEndRecorded = false;

async function animatePour(job: PourJob) {
  const { from, to, prev } = job;
  const srcEl = jarEls[from]!;
  const dstEl = jarEls[to]!;
  const spice = SPICES[job.color]!;
  // Sıra birikmişse daha hızlı.
  const speed = pending.length > 2 ? 0.28 : pending.length > 0 ? 0.45 : 1;

  const appR = app.getBoundingClientRect();
  srcEl.classList.remove('lifted', 'picked');
  const sR = srcEl.getBoundingClientRect();
  const dR = dstEl.getBoundingClientRect();
  const scale = dR.width / JAR_W;
  const W = srcEl.offsetWidth;
  const H = srcEl.offsetHeight;
  const natural = dR.left + dR.width / 2 >= sR.left + sR.width / 2 ? 1 : -1;
  const centerS = { x: sR.left + sR.width / 2, y: sR.top + sR.height / 2 };
  // Ağız aşağı bakacak kadar eğilir (ağız en alt nokta olur) ve hedefin boğazının hemen
  // üstüne gelir; gövde yana, komşu kavanozların üstüne uzanır, hiçbirine girmez.
  // Yanda yer yoksa öbür taraftan döker, o da olmazsa daha az eğilir.
  const fit = (dir: number, deg: number) => {
    const t = (dir * deg * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const lipLocal = { x: dir * W * 0.3, y: -H / 2 + (CORK_ROOM + 1) * scale };
    const lip = { x: dR.left + dR.width / 2 - dir * dR.width * 0.06, y: dR.top + 2 * scale };
    const center = {
      x: lip.x - (lipLocal.x * c - lipLocal.y * s),
      y: lip.y - (lipLocal.x * s + lipLocal.y * c),
    };
    // Kavanoz silüeti: boğaz, omuz ve dip köşeleri.
    const shoulder = -H / 2 + (CORK_ROOM + TOP - 6) * scale;
    const pts = [-1, 1].flatMap((k) => [
      [k * W * 0.3, lipLocal.y],
      [k * W * 0.5, shoulder],
      [k * W * 0.5, H / 2],
    ]);
    const xs = pts.map(([px, py]) => center.x + px! * c - py! * s);
    const low = Math.max(...pts.map(([px, py]) => center.y + px! * s + py! * c));
    const up = Math.max(0, low - (dR.top + 4 * scale));
    lip.y -= up;
    center.y -= up;
    const fits = Math.min(...xs) >= appR.left + 2 && Math.max(...xs) <= appR.right - 2;
    return { dir, deg, lip, center, fits };
  };
  const tries: [number, number][] = [
    [natural, 104],
    [natural, 92],
    [-natural, 104],
    [-natural, 92],
    [natural, 80],
    [-natural, 80],
    [natural, 66],
  ];
  let pose = fit(natural, 66);
  for (const [d, g] of tries) {
    const f = fit(d, g);
    if (f.fits) {
      pose = f;
      break;
    }
  }
  const { dir, deg, lip, center } = pose;
  const dx = center.x - centerS.x;
  const dy = center.y - centerS.y;
  const tilted = `translate(${dx}px, ${dy}px) rotate(${dir * deg}deg)`;
  srcEl.style.zIndex = '5';
  const anim = srcEl.animate(
    [
      { transform: 'translate(0,-10px) rotate(0deg)' },
      {
        transform: `translate(${dx * 0.85}px, ${dy * 0.85 - 6}px) rotate(${dir * deg * 0.4}deg)`,
        offset: 0.6,
      },
      { transform: tilted },
    ],
    { duration: reduced ? 1 : 200 * speed, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' },
  );
  await anim.finished.catch(() => {});

  const pourMs = reduced ? 1 : (180 + job.amount * 80) * speed;
  sfxPour(spice.texture, pourMs / 1000 + 0.1);
  if (settings.haptics) vibrate(12);
  const surfaceY =
    dR.top + (CORK_ROOM + TOP + (prev.cap - prev.jars[to]!.layers.length) * LAYER_H) * scale;
  const newSurfaceY =
    dR.top + (CORK_ROOM + TOP + (prev.cap - job.after.jars[to]!.layers.length) * LAYER_H) * scale;
  const fall = streamFall(surfaceY - lip.y, pourMs);
  stream(
    lip.x - appR.left,
    lip.y - appR.top,
    surfaceY - appR.top,
    newSurfaceY - appR.top,
    spice.id,
    pourMs,
    scale,
  );
  // Kaynak, ağızdan tek parça boşalır; hedef, akış yüzeye varınca tek parça dolar.
  drawJar(from, { drained: job.amount, flowMs: pourMs * 0.8 }, prev);
  drawJar(
    to,
    { grown: job.amount, flowMs: Math.max(60, pourMs - fall * 0.6), flowDelay: fall },
    // Kapak, dolma bitince düşer.
    job.capped ? withJar(job.after, to, { capped: false }) : job.after,
  );
  await wait(pourMs);
  drawJar(from, {}, job.after);
  if (job.capped) drawJar(to, { corkDrop: true }, job.after);
  // Toz, dolan baharatın yeni yüzeyinde kalkar.
  puff(lip.x - appR.left, newSurfaceY - appR.top, spice.light, scale);

  const back = srcEl.animate(
    [{ transform: tilted }, { transform: 'translate(0,0) rotate(0deg)' }],
    {
      duration: reduced ? 1 : 190 * speed,
      easing: 'cubic-bezier(.4,0,.2,1)',
    },
  );
  anim.cancel();
  await back.finished.catch(() => {});
  srcEl.style.zIndex = '';

  for (const i of job.unlocked) {
    const was = prev.jars[i]!.lock;
    drawJar(i, was === null ? {} : { unseal: was }, job.after);
    jarEls[i]!.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], {
      duration: 500,
    });
    sfxTink(1.4);
  }
  if (job.capped) {
    sfxCork();
    if (settings.haptics) vibrate([10, 40, 25]);
    sparkle(dR.left + dR.width / 2 - appR.left, dR.top + MOUTH_Y * scale - appR.top, spice.color);
  }
}

// --- Efektler (SVG katmanı) ---------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  fx.appendChild(e);
  return e;
}

function withJar(state: GameState, i: number, patch: Partial<Jar>): GameState {
  return { ...state, jars: state.jars.map((j, k) => (k === i ? { ...j, ...patch } : j)) };
}

/** Akışın başının ağızdan yüzeye varma süresi (ms). */
function streamFall(len: number, ms: number) {
  return Math.min(ms * 0.4, 60 + Math.max(8, len) * 0.9);
}

/** Ağızdan yüzeye düşen baharat: ince, taneli bir akış; baştan düşer, sonda kopar. */
function stream(
  x: number,
  y0: number,
  y1: number,
  /** Döküm bitince yüzey (dolum yükseldikçe taneler daha yukarıda durur). */
  y1End: number,
  spice: number,
  ms: number,
  scale: number,
) {
  if (reduced) return;
  const s = SPICES[spice]!;
  const len = Math.max(8, y1 - y0);
  const fall = streamFall(len, ms);
  // Akışın ucu, hedef doldukça yükselen yüzeyi izler.
  const riseEnd = (e: SVGElement, attr: string) => {
    if (y1End >= y1) return;
    const a = document.createElementNS(NS, 'animate');
    a.setAttribute('attributeName', attr);
    a.setAttribute('from', String(y1));
    a.setAttribute('to', String(y1End));
    // SMIL zamanı belgenin başından sayılır: şimdiki zamana göre başlat.
    const now = (fx as unknown as SVGSVGElement).getCurrentTime();
    a.setAttribute('begin', `${(now + fall / 1000).toFixed(3)}s`);
    a.setAttribute('dur', `${(Math.max(1, ms - fall) / 1000).toFixed(3)}s`);
    a.setAttribute('fill', 'freeze');
    e.appendChild(a);
  };
  const w = Math.max(2.5, 3.4 * scale);
  const strands = [
    { dx: 0, w, color: s.color, op: 0.85, dash: '' },
    { dx: -w * 0.35, w: w * 0.45, color: s.light, op: 0.7, dash: `${2 * scale} ${3 * scale}` },
    { dx: w * 0.4, w: w * 0.35, color: s.color, op: 0.8, dash: `${1.5 * scale} ${4 * scale}` },
  ];
  for (const st of strands) {
    const line = el('line', {
      x1: x + st.dx,
      y1: y0,
      x2: x + st.dx * 1.4,
      y2: y1,
      stroke: st.color,
      'stroke-width': st.w,
      'stroke-linecap': 'round',
      opacity: st.op,
    });
    riseEnd(line, 'y2');
    // Baş: 0 → len düşer; kuyruk: sonda yukarıdan aşağı kopar.
    line.style.strokeDasharray = `${len} ${len * 2}`;
    const head = fall / ms;
    line.animate(
      [
        { strokeDashoffset: len },
        { strokeDashoffset: 0, offset: head },
        { strokeDashoffset: 0, offset: Math.max(head, 1 - head * 0.8) },
        { strokeDashoffset: -len },
      ],
      { duration: ms, easing: 'linear' },
    ).onfinish = () => line.remove();
    if (st.dash) {
      // Taneli doku: kısa çizgiler aşağı akar.
      const g = el('line', {
        x1: x + st.dx,
        y1: y0,
        x2: x + st.dx,
        y2: y1,
        stroke: st.color,
        'stroke-width': st.w * 0.9,
        'stroke-dasharray': st.dash,
        opacity: 0,
      });
      riseEnd(g, 'y2');
      g.animate(
        [
          { strokeDashoffset: 0, opacity: 0 },
          { opacity: 0.9, offset: head },
          { opacity: 0.9, offset: 0.85 },
          { strokeDashoffset: -len, opacity: 0 },
        ],
        { duration: ms, easing: 'linear' },
      ).onfinish = () => g.remove();
    }
  }
  // Ağızdan saçılan birkaç tane.
  const n = 22;
  for (let k = 0; k < n; k++) {
    const d = el('circle', {
      cx: 0,
      cy: 0,
      r: (s.texture === 'seed' ? 1.5 : 1.1) * Math.max(0.8, scale),
      fill: k % 3 ? s.color : s.light,
    });
    const jitter = (Math.random() - 0.5) * 7 * scale;
    const delay = (k / n) * ms * 0.75;
    const dur = fall * (0.9 + Math.random() * 0.3);
    // Tane, düştüğü anda yüzey ne kadar yükseldiyse orada durur.
    const p = Math.min(1, Math.max(0, (delay + dur - fall) / Math.max(1, ms - fall)));
    const yLand = y1 + (y1End - y1) * p;
    d.animate(
      [
        { transform: `translate(${x}px, ${y0}px)`, opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { transform: `translate(${x + jitter}px, ${yLand - 2}px)`, opacity: 0.85 },
      ],
      {
        duration: dur,
        delay,
        easing: 'cubic-bezier(.5,0,1,1)',
        fill: 'both',
      },
    ).onfinish = () => d.remove();
  }
}

/** Yüzeye düşerken kalkan hafif toz. */
function puff(x: number, y: number, color: string, scale: number) {
  if (reduced) return;
  for (let k = 0; k < 7; k++) {
    const a = (k / 6) * Math.PI - Math.PI;
    const c = el('circle', { cx: 0, cy: 0, r: 2.2 * scale + 1, fill: color, opacity: 0 });
    c.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.5)`, opacity: 0.45 },
        {
          transform: `translate(${x + Math.cos(a) * 16 * scale}px, ${y + Math.sin(a) * 9 * scale}px) scale(1.5)`,
          opacity: 0,
        },
      ],
      { duration: 420 + k * 20, easing: 'ease-out' },
    ).onfinish = () => c.remove();
  }
}

function sparkle(x: number, y: number, color: string) {
  if (reduced) return;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const c = el('path', {
      d: 'M0-4L1 -1 4 0 1 1 0 4-1 1-4 0-1-1z',
      fill: k % 2 ? '#ffd98a' : color,
      transform: `translate(${x} ${y})`,
    });
    c.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.4)`, opacity: 1 },
        {
          transform: `translate(${x + Math.cos(a) * 34}px, ${y + Math.sin(a) * 26}px) scale(1.2) rotate(90deg)`,
          opacity: 0,
        },
      ],
      { duration: 650, delay: 120, easing: 'ease-out', fill: 'both' },
    ).onfinish = () => c.remove();
  }
}

function confetti() {
  if (reduced) return;
  const w = app.clientWidth;
  const colors = session.level.jars.flatMap((j) => j.layers).map((c) => SPICES[c]!.color);
  for (let k = 0; k < 60; k++) {
    const x = Math.random() * w;
    const c = el('rect', {
      x,
      y: -10,
      width: 4 + Math.random() * 4,
      height: 3 + Math.random() * 3,
      fill: colors[k % colors.length] ?? '#ffc46b',
    });
    c.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${(Math.random() - 0.5) * 80}px, ${app.clientHeight * (0.6 + Math.random() * 0.4)}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0.2,
        },
      ],
      {
        duration: 1500 + Math.random() * 1200,
        delay: Math.random() * 400,
        easing: 'ease-in',
        fill: 'both',
      },
    ).onfinish = () => c.remove();
  }
}

// --- Güçlendiriciler ------------------------------------------------------------------------------

const ICONS: Record<BoosterKind, string> = {
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)"/></svg>',
  extraJar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3h8M9 3v3c-3 1-4 3-4 5v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8c0-2-1-4-4-5V3"/><path d="M12 11v6M9 14h6"/></svg>',
  hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  shuffle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c1.6 0 2.8-1.6 3.8-3.4M14 9.4C15 7.6 16.2 7 17 7h4M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
};
const ORDER: BoosterKind[] = ['undo', 'extraJar', 'hint', 'shuffle'];

function renderBoosters() {
  const nav = $('boosters');
  const isStuck = !ended && sessionStuck(session);
  nav.innerHTML = '';
  for (const k of ORDER) {
    const b = document.createElement('button');
    b.className = 'boost';
    const charges = progress.boosters[k];
    const freeHint = k === 'hint' && progress.freeHint;
    const label = freeHint
      ? `<span class="count">${t('free')}</span>`
      : charges > 0
        ? `<span class="count">${charges}</span>`
        : `<span class="count price">${cfg.economy.boosterPrice[k]}</span>`;
    b.innerHTML = `${ICONS[k]}<span>${t(k)}</span>${label}`;
    if (k === 'shuffle' && !isStuck) b.setAttribute('disabled', '');
    if (k === 'undo' && !canUndo(session)) b.setAttribute('disabled', '');
    if (freeHint || (k === 'shuffle' && isStuck)) b.classList.add('glow');
    b.addEventListener('click', () => {
      unlock();
      if (b.hasAttribute('disabled')) {
        toast(t(k === 'undo' ? 'noUndo' : 'onlyStuck'));
        return;
      }
      void tryBooster(k);
    });
    nav.appendChild(b);
  }
}

/** Hakkı varsa kullanır; yoksa altın / reklam seçeneği. Uygulanırsa true. */
async function tryBooster(k: BoosterKind): Promise<boolean> {
  if (busy) return false;
  if (k === 'hint' && progress.freeHint) {
    progress = consumeFreeHint(progress);
    persist();
    return applyBooster(k);
  }
  const used = useBooster(progress, k);
  if (used) {
    if (!(await applyBooster(k))) return false;
    progress = used;
    persist();
    renderBoosters();
    return true;
  }
  return buySheet(k);
}

async function applyBooster(k: BoosterKind): Promise<boolean> {
  clearHint();
  if (selected !== null) {
    jarEls[selected]?.classList.remove('lifted');
    selected = null;
  }
  if (k === 'undo') {
    if (!canUndo(session)) return false;
    session = sessionUndo(session, cfg.economy.undoSteps);
    ended = false;
    renderBoard();
  } else if (k === 'extraJar') {
    session = sessionAddJar(session);
    ended = false;
    renderBoard();
    const last = jarEls[jarEls.length - 1];
    last?.animate(
      [
        { transform: 'translateY(-40px)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      {
        duration: 380,
        easing: 'cubic-bezier(.2,1.4,.4,1)',
      },
    );
    sfxTink(0.8);
  } else if (k === 'hint') {
    if (!showHint(false)) {
      toast(t('noHint'));
      return false;
    }
  } else if (k === 'shuffle') {
    const s = sessionShuffle(session);
    if (!s) {
      toast(t('shuffleFail'));
      return false;
    }
    session = s;
    ended = false;
    renderBoard();
    for (const e of jarEls)
      e.animate(
        [{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }, { transform: 'none' }],
        {
          duration: 320,
        },
      );
    sfxPour('seed', 0.35);
  }
  renderBoosters();
  return true;
}

function showHint(silent: boolean): boolean {
  const m = sessionHint(session);
  if (!m) return false;
  clearHint();
  jarEls[m.from]?.classList.add('hint-src');
  jarEls[m.to]?.classList.add('hint-dst');
  if (!silent) sfxTink(1.2);
  return true;
}

function boosterName(k: BoosterKind) {
  return t(k).replace('+', '');
}

function buySheet(k: BoosterKind): Promise<boolean> {
  return new Promise((resolve) => {
    const price = cfg.economy.boosterPrice[k];
    const short = price - progress.coins;
    const v = veil(`<div class="card">
      <h2>${t('buyTitle', { name: boosterName(k) })}</h2>
      <p>${t('buyBody')}</p>
      <div class="stack">
        ${ADS ? `<button class="btn ad" id="bAd">${t('buyAd')}</button>` : ''}
        <button class="btn primary" id="bCoins" ${short > 0 ? 'disabled' : ''}>${t('buyCoins', { p: price })}${short > 0 ? ` <small>· ${t('buyShort', { s: short })}</small>` : ''}</button>
        <button class="btn plain" id="bNo">${t('cancel')}</button>
      </div></div>`);
    v.querySelector('#bNo')!.addEventListener('click', () => {
      closeVeil();
      resolve(false);
    });
    v.querySelector('#bCoins')!.addEventListener('click', async () => {
      const paid = payBooster(progress, cfg, k);
      if (!paid) return;
      closeVeil();
      if (await applyBooster(k)) {
        progress = paid;
        bumpCoins();
        persist();
        renderBoosters();
        resolve(true);
      } else resolve(false);
    });
    v.querySelector('#bAd')?.addEventListener('click', async () => {
      closeVeil();
      const r = await rewardedAd();
      if (r === 'rewarded') resolve(await applyBooster(k));
      else {
        if (r === 'unavailable') toast(t('noAd'));
        resolve(false);
      }
    });
  });
}

// --- Kazanma, kilitlenme, tanıtım --------------------------------------------------------------

function win() {
  ended = true;
  const lv = level(levelN);
  ads = onLevelWon(ads);
  const r = completeLevel(progress, cfg, levelN, lv.kind, session.usedUndo);
  progress = r.progress;
  persist();
  sfxWin();
  if (settings.haptics) vibrate([20, 60, 20, 60, 40]);
  confetti();
  setTimeout(() => showWinCard(r), reduced ? 200 : 700);
}

/** Ödül ekranı kapanırken: interstitial kuralı, sonra sonraki seviye. */
async function goNextLevel() {
  closeVeil();
  const d = decideInterstitial(cfg.ads, ads, levelN, Date.now());
  lastDecision = d.show ? 'göster' : d.reason;
  if (!ADS) {
    // reklam yok
  } else if (d.show) {
    if (await interstitialAd()) ads = onInterstitialShown(ads, Date.now());
  } else if (d.reason === 'rewarded-grace') {
    ads = onInterstitialSkipped(ads);
    toast(t('interSkipped'));
  }
  persist();
  startLevel(Math.min(BUILTIN_LEVELS.length, levelN + 1));
}

function showWinCard(r: { first: boolean; base: number; bonus: number }) {
  const lines = r.first
    ? `<div><span>${t('reward')}</span><span>+${r.base}</span></div>${r.bonus ? `<div><span>${t('bonus')}</span><span>+${r.bonus}</span></div>` : ''}<div class="total"><span>${t('total')}</span><span>+${r.base + r.bonus}</span></div>`
    : `<div><span>${t('replay')}</span><span>+0</span></div>`;
  const v = veil(`<div class="card">
      <h2>${t('winTitle')}</h2><p>${t('winBody')}</p>
      <div class="lines">${lines}</div>
      <div class="stack">
        ${ADS && r.first && r.base > 0 ? `<button class="btn ad" id="wAd">${t('doubleAd')}</button>` : ''}
        <button class="btn primary" id="wNext">${t('next')}</button>
        <button class="btn plain" id="wShop">${t('toShop')}</button>
      </div></div>`);
  bumpCoins();
  v.querySelector('#wShop')!.addEventListener('click', () => {
    startLevel(Math.min(BUILTIN_LEVELS.length, levelN + 1));
    openHome();
  });
  v.querySelector('#wAd')?.addEventListener('click', async () => {
    // Reklam penceresi kartın yerini alır; sonuca göre ya sonraki seviyeye geçilir ya kart geri gelir.
    const res = await rewardedAd();
    if (res === 'rewarded') {
      progress = doubleReward(progress, cfg, r.base);
      persist();
      bumpCoins();
      toast(t('doubled', { n: r.base * (cfg.economy.adRewardMultiplier - 1) }));
      await goNextLevel();
      return;
    }
    showWinCard(r);
    if (res === 'unavailable') toast(t('noAdPlain'));
  });
  v.querySelector('#wNext')!.addEventListener('click', () => void goNextLevel());
}

function stuck() {
  if (ended) return;
  ended = true;
  if (!deadEndRecorded) progress = recordStuck(progress, cfg, levelN);
  deadEndRecorded = true;
  persist();
  renderBoosters();
  if (settings.haptics) vibrate([30, 50, 30]);
  const sh = progress.boosters.shuffle;
  const v = veil(`<div class="card">
    <h2>${t('stuckTitle')}</h2><p>${t('stuckBody')}</p>
    <div class="stack">
      ${ADS ? `<button class="btn ad" id="sAd">${t('stuckAd')}</button>` : ''}
      <button class="btn primary" id="sShuffle">${t('stuckShuffle')} <small>· ${sh > 0 ? sh : `${cfg.economy.boosterPrice.shuffle} ${t('gold')}`}</small></button>
      <button class="btn plain" id="sUndo" ${canUndo(session) ? '' : 'disabled'}>${t('stuckUndo')} <small>· ${progress.boosters.undo > 0 ? progress.boosters.undo : `${cfg.economy.boosterPrice.undo} ${t('gold')}`}</small></button>
      <button class="btn plain" id="sRestart">${t('restart')}</button>
    </div></div>`);
  v.querySelector('#sAd')?.addEventListener('click', async () => {
    closeVeil();
    const r = await rewardedAd();
    if (r === 'rewarded') {
      ended = false;
      await applyBooster('extraJar');
    } else {
      if (r === 'unavailable') toast(t('noAd'));
      ended = false;
      stuck();
    }
  });
  const viaBooster = (k: BoosterKind) => async () => {
    closeVeil();
    ended = false;
    if (!(await tryBooster(k))) stuck();
  };
  v.querySelector('#sShuffle')!.addEventListener('click', viaBooster('shuffle'));
  v.querySelector('#sUndo')!.addEventListener('click', viaBooster('undo'));
  v.querySelector('#sRestart')!.addEventListener('click', () => startLevel(levelN));
}

const INTRO: Record<Feature, ['introHidden' | 'introLock' | 'introTall' | 'introNarrow', string]> =
  {
    hidden: ['introHidden', 'introHiddenBody'],
    lock: ['introLock', 'introLockBody'],
    tall: ['introTall', 'introTallBody'],
    narrow: ['introNarrow', 'introNarrowBody'],
  };

function showIntro(f: Feature) {
  const g = giveIntroGift(progress, cfg, f);
  if (g) {
    progress = g.progress;
    persist();
    renderBoosters();
  }
  const [title, body] = INTRO[f];
  const chips = g
    ? Object.entries(g.gift)
        .map(([k, n]) => `<span class="chip">+${n} ${boosterName(k as BoosterKind)}</span>`)
        .join('')
    : '';
  const v = veil(`<div class="card"><h2>${t(title)}</h2><p>${t(body as never)}</p>
    ${chips ? `<p><strong>${t('gift')}</strong></p><div class="gift">${chips}</div>` : ''}
    <button class="btn primary" id="iGo">${t('letsGo')}</button></div>`);
  v.querySelector('#iGo')!.addEventListener('click', closeVeil);
}

// --- Reklam simülatörü ---------------------------------------------------------------------------

type RewardedResult = 'rewarded' | 'dismissed' | 'unavailable';

async function rewardedAd(): Promise<RewardedResult> {
  if (inApp) {
    pauseAudio();
    const r = await hostAd('rewarded');
    resumeAudio();
    if (!r.shown) return 'unavailable';
    if (!r.rewarded) return 'dismissed';
    ads = onRewardedWatched(ads, Date.now());
    persist();
    return 'rewarded';
  }
  if (settings.adFail) return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    const v = veil(`<div class="card adsim"><span class="kind">${t('adRewarded')}</span>
      <div class="fake">${t('adFake')}</div>
      <button class="btn ad" id="aClaim" disabled>${t('adCloseIn', { s: 2 })}</button>
      <button class="btn plain" id="aSkip">${t('adSkip')}</button></div>`);
    const claim = v.querySelector<HTMLButtonElement>('#aClaim')!;
    let s = 2;
    const timer = setInterval(() => {
      s--;
      if (s <= 0) {
        clearInterval(timer);
        claim.disabled = false;
        claim.textContent = t('adClaim');
      } else claim.textContent = t('adCloseIn', { s });
    }, 800);
    claim.addEventListener('click', () => {
      clearInterval(timer);
      closeVeil();
      ads = onRewardedWatched(ads, Date.now());
      persist();
      resolve('rewarded');
    });
    v.querySelector('#aSkip')!.addEventListener('click', () => {
      clearInterval(timer);
      closeVeil();
      resolve('dismissed');
    });
  });
}

async function interstitialAd(): Promise<boolean> {
  if (inApp) {
    pauseAudio();
    const r = await hostAd('interstitial');
    resumeAudio();
    return r.shown;
  }
  if (settings.adFail) return Promise.resolve(false);
  return new Promise((resolve) => {
    const v = veil(`<div class="card adsim"><span class="kind">${t('adInter')}</span>
      <div class="fake">${t('adFake')}</div>
      <button class="btn plain" id="aClose">${t('close')}</button></div>`);
    v.querySelector('#aClose')!.addEventListener('click', () => {
      closeVeil();
      resolve(true);
    });
  });
}

// --- Katman yardımcıları ----------------------------------------------------------------------

function veil(html: string): HTMLElement {
  closeVeil();
  const v = document.createElement('div');
  v.className = 'veil';
  v.id = 'veil';
  v.innerHTML = html;
  app.appendChild(v);
  (v.querySelector('button:not([disabled])') as HTMLElement | null)?.focus({ preventScroll: true });
  return v;
}
function closeVeil() {
  document.getElementById('veil')?.remove();
}

let toastTimer = 0;
function toast(text: string) {
  document.getElementById('toast')?.remove();
  const d = document.createElement('div');
  d.id = 'toast';
  d.textContent = text;
  app.appendChild(d);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => d.remove(), 2600);
}

// --- Ayarlar ve seviye listesi -------------------------------------------------------------------

let resetArmed = false;
function openSettings() {
  const hour = ads.recentInterstitials.filter((x) => Date.now() - x < 3600_000).length;
  const tog = (id: keyof Settings, label: string) =>
    `<label class="toggle"><span>${label}</span><input type="checkbox" id="s_${id}" ${settings[id] ? 'checked' : ''}/></label>`;
  const v = veil(`<div class="card sheet">
    <h2>${t('settings')}</h2>
    ${tog('sound', t('sound'))}${tog('music', t('music'))}${tog('haptics', t('haptics'))}${tog('colorblind', t('colorblind'))}
    <div class="toggle"><span>${t('language')}</span><div class="seg"><button id="lTr" aria-pressed="${settings.lang === 'tr'}">TR</button><button id="lEn" aria-pressed="${settings.lang === 'en'}">EN</button></div></div>
    ${
      inApp
        ? ''
        : `<h3>${t('dev')}</h3><p>${t('foot')}</p>
    ${tog('showInfo', t('showInfo'))}${tog('adFail', t('adFail'))}
    <div class="dev">${t('devCounters', { s: ads.session, l: ads.levelsSinceLast, h: hour, d: lastDecision })}</div>`
    }
    <div class="stack">
      ${inApp && hostCaps.privacyOptions ? `<button class="btn plain" id="dPrivacy">${t('privacyOptions')}</button>` : ''}
      ${inApp ? '' : `<button class="btn plain" id="dSession">${t('newSession')}</button>`}
      ${inApp ? '' : `<button class="btn plain" id="dAds">${t('resetAds')}</button>`}
      <button class="btn plain" id="dReset">${t('resetAll')}</button>
      <button class="btn primary" id="dClose">${t('close')}</button>
    </div></div>`);
  for (const id of ['sound', 'music', 'haptics', 'colorblind', 'showInfo', 'adFail'] as const) {
    v.querySelector<HTMLInputElement>(`#s_${id}`)?.addEventListener('change', (e) => {
      settings = { ...settings, [id]: (e.target as HTMLInputElement).checked };
      audio.sound = settings.sound;
      audio.music = settings.music;
      unlock();
      syncAmbience();
      persist();
      if (id === 'colorblind') renderBoard();
      if (id === 'showInfo') renderHeader();
    });
  }
  const setL = (l: Lang) => () => {
    settings = { ...settings, lang: l };
    setLang(l);
    persist();
    renderHeader();
    renderBoard();
    renderBoosters();
    openSettings();
  };
  v.querySelector('#lTr')!.addEventListener('click', setL('tr'));
  v.querySelector('#lEn')!.addEventListener('click', setL('en'));
  v.querySelector('#dSession')?.addEventListener('click', () => {
    ads = onNewSession(ads);
    persist();
    openSettings();
  });
  v.querySelector('#dAds')?.addEventListener('click', () => {
    ads = { ...DEFAULT_AD_COUNTERS, session: ads.session };
    lastDecision = '–';
    persist();
    openSettings();
  });
  v.querySelector('#dPrivacy')?.addEventListener('click', () =>
    postHost({ type: 'privacyOptions' }),
  );
  v.querySelector('#dReset')!.addEventListener('click', (e) => {
    if (!resetArmed) {
      resetArmed = true;
      (e.currentTarget as HTMLElement).textContent = t('confirmReset');
      return;
    }
    resetArmed = false;
    resetPending = true;
    progress = parseProgress(null, cfg);
    ads = DEFAULT_AD_COUNTERS;
    startLevel(1);
  });
  v.querySelector('#dClose')!.addEventListener('click', () => {
    resetArmed = false;
    closeVeil();
  });
}

function openLevels() {
  closeVeil();
  const v = document.createElement('div');
  v.className = 'map';
  v.id = 'veil';
  v.innerHTML = `<div class="map-head"><button class="iconbtn" id="lvClose" aria-label="${t('close')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="map-title"><span>${t('levels')}</span><small>${t('levelsNote')}</small></div></div><div class="map-scroll" id="lvScroll"></div>`;
  app.appendChild(v);
  const scroll = v.querySelector<HTMLElement>('#lvScroll')!;
  scroll.innerHTML = mapHTML(
    BUILTIN_LEVELS,
    scroll.clientWidth,
    progress.unlocked,
    levelN,
    getLang(),
  );
  scroll.addEventListener('click', (e) => {
    const node = (e.target as HTMLElement).closest<HTMLElement>('[data-n]');
    const n = Number(node?.dataset.n);
    if (!n) return;
    // Yalnızca geçilmiş seviyeler ve sıradaki açık; sonrakiler kilitli.
    if (n > progress.unlocked) {
      shake(node!);
      sfxThud();
      if (settings.haptics) vibrate(30);
      toast(t('levelLocked', { n: progress.unlocked }));
      return;
    }
    startLevel(n);
  });
  v.querySelector('#lvClose')!.addEventListener('click', closeVeil);
  const cur = scroll.querySelector<HTMLElement>('.node.cur');
  if (cur) scroll.scrollTop = cur.offsetTop - scroll.clientHeight / 2;
}

// --- Ana menü: dükkân ve dekorasyon --------------------------------------------------------------

const WOOD_URI = '__ASSET:wood_shelf.jpg__';
const COUNTER_URI = '__ASSET:wood_counter.jpg__';
const today = () => new Date().toLocaleDateString('sv');
let viewShop = progress.activeShop;
let focusItem: ItemId | null = null;

/** Dükkâna özgü ürün adı (Mısır Çarşısı'nda genel adlar). */
function itemName(shop: string, id: ItemId) {
  return productName(shop, id, getLang()) ?? t(`item_${id}` as never);
}
function styleName(shop: string, id: ItemId, style: number) {
  return productStyleName(shop, id, style, getLang()) ?? t(`style_${id}_${style}` as never);
}

function shopName(id: string) {
  return t(`shop_${id}` as never);
}

function ownedMap(shop: string): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  for (const id of ITEM_ORDER) {
    const o = progress.owned[itemKey(shop, id)];
    if (o) out[id] = o.selected;
  }
  return out;
}

function openHome() {
  closeVeil();
  // Banner yalnızca ana ekranda (dükkân), uygulamanın kendisi altta gösterir.
  if (inApp && ADS) postHost({ type: 'banner', visible: true });
  document.getElementById('home')?.remove();
  const shops = cfg.economy.shops;
  if (!isShopUnlocked(progress, cfg, viewShop)) viewShop = progress.activeShop;
  const shop = shops.find((x) => x.id === viewShop)!;
  const owned = ownedMap(shop.id);
  const focus = focusItem;
  focusItem = null;
  const count = Object.keys(owned).length;
  const idx = shops.findIndex((x) => x.id === shop.id);
  const prev = shops[idx - 1];
  const next = shops[idx + 1];
  const giftDay = nextGiftDay(progress, cfg, today());
  const h = document.createElement('div');
  h.id = 'home';
  h.className = 'home';
  h.innerHTML = `
    <div class="home-top">
      <div class="coins big"><svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#b8862e"/><circle cx="12" cy="12" r="8.5" fill="#e6b85a" stroke="#8d6220"/><path d="M12 6.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7L12 14.6l-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="#8d6220"/></svg><span id="homeCoins">${progress.coins}</span></div>
      ${giftDay ? `<button class="gift-btn" id="hGift"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="2" fill="#c8443a"/><rect x="2" y="7" width="20" height="4" rx="1" fill="#e06a55"/><rect x="11" y="7" width="2.5" height="14" fill="#e6b85a"/><path d="M12 7c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 1z" fill="#e6b85a"/></svg><span>${t('dailyGift')}</span></button>` : ''}
      <button class="iconbtn" id="hSettings" aria-label="${t('settings')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg></button>
    </div>
    <div class="shop-bar">
      <button class="arrow" id="hPrev" ${prev && isShopUnlocked(progress, cfg, prev.id) ? '' : 'disabled'} aria-label="‹">‹</button>
      <div class="shop-name"><span>${shopName(shop.id)}</span><small>${t('decorProgress', { n: count, m: shop.items.length })}${next && !isShopUnlocked(progress, cfg, next.id) ? ` · ${t('nextShopHint', { name: shopName(next.id) })}` : ''}</small></div>
      <button class="arrow" id="hNext" ${next && isShopUnlocked(progress, cfg, next.id) ? '' : 'disabled'} aria-label="›">›</button>
    </div>
    <div class="stall" id="hStall">${stallSVG({ shop: shop.id, shopName: shopName(shop.id), owned, focus }, WOOD_URI, COUNTER_URI)}</div>
    <div class="decor">
      <div class="decor-title">${t('decorate')}</div>
      <div class="decor-row" id="hDecor">${decorCards(shop.id, owned)}</div>
    </div>
    <div class="home-actions">
      <button class="btn primary play" id="hPlay"><span>${t('play')}</span><small>${t('level', { n: Math.min(BUILTIN_LEVELS.length, progress.unlocked) })}</small></button>
      <button class="btn plain" id="hMap">${t('levels')}</button>
    </div>
    ${ADS && !inApp ? `<div class="banner-mock">${t('bannerMock')}</div>` : ''}`;
  app.appendChild(h);
  h.querySelector('#hPlay')!.addEventListener('click', () => {
    unlock();
    h.remove();
    startLevel(Math.min(BUILTIN_LEVELS.length, progress.unlocked));
  });
  h.querySelector('#hMap')!.addEventListener('click', () => {
    unlock();
    openLevels();
  });
  h.querySelector('#hSettings')!.addEventListener('click', () => {
    unlock();
    openSettings();
  });
  h.querySelector('#hGift')?.addEventListener('click', () => {
    unlock();
    openGift();
  });
  h.querySelector('#hPrev')!.addEventListener('click', () => {
    if (prev) viewShop = prev.id;
    openHome();
  });
  h.querySelector('#hNext')!.addEventListener('click', () => {
    if (next) viewShop = next.id;
    openHome();
  });
  h.querySelector('#hStall')!.addEventListener('click', (e) => {
    unlock();
    const item = (e.target as Element)
      .closest('[data-item]')
      ?.getAttribute('data-item') as ItemId | null;
    if (item && owned[item] !== undefined) openStyles(shop.id, item);
  });
  h.querySelector('#hDecor')!.addEventListener('click', (e) => {
    unlock();
    const item = (e.target as Element)
      .closest('[data-item]')
      ?.getAttribute('data-item') as ItemId | null;
    if (!item) return;
    focusItem = item;
    const stall = document.getElementById('hStall');
    if (stall)
      stall.innerHTML = stallSVG(
        { shop: shop.id, shopName: shopName(shop.id), owned, focus: item },
        WOOD_URI,
        COUNTER_URI,
      );
    if (owned[item] !== undefined) openStyles(shop.id, item);
    else void buyItem(shop.id, item);
  });
  const row = h.querySelector<HTMLElement>('#hDecor')!;
  try {
    row.scrollLeft = Number(sessionStorage.getItem('decorScroll') ?? 0);
  } catch {
    // depolama yok
  }
  row.addEventListener('scroll', () => {
    try {
      sessionStorage.setItem('decorScroll', String(row.scrollLeft));
    } catch {
      // depolama yok
    }
  });
}

/** Dükkânın altındaki parça şeridi: alınmamışlar ucuzdan pahalıya önde, alınanlar sonda. */
function decorCards(shop: string, owned: Partial<Record<ItemId, number>>) {
  const items = cfg.economy.shops.find((x) => x.id === shop)!.items;
  const sorted = [...items].sort((a, b) => {
    const oa = owned[a.id as ItemId] !== undefined ? 1 : 0;
    const ob = owned[b.id as ItemId] !== undefined ? 1 : 0;
    return oa - ob || a.price - b.price;
  });
  return sorted
    .map((it) => {
      const id = it.id as ItemId;
      const has = owned[id] !== undefined;
      const afford = progress.coins >= it.price;
      return `<button class="decor-card${has ? ' owned' : afford ? ' afford' : ''}" data-item="${id}">${styleSwatch(shop, id, has ? owned[id]! : 0, shopName(shop), WOOD_URI, COUNTER_URI)}<span class="dn">${itemName(shop, id)}</span>${has ? `<span class="dp ok">✓</span>` : `<span class="dp"><i></i>${it.price}</span>`}</button>`;
    })
    .join('');
}

function refreshHomeCoins() {
  const c = document.getElementById('homeCoins');
  if (c) c.textContent = String(progress.coins);
  bumpCoins();
}

function celebrateItem(item: ItemId) {
  const svg = document.querySelector<SVGSVGElement>('#hStall svg');
  if (!svg) return;
  const r = svg.getBoundingClientRect();
  const a = app.getBoundingClientRect();
  const [x, y] = ANCHORS[item];
  sparkle(r.left - a.left + (x / 400) * r.width, r.top - a.top + (y / 450) * r.height, '#e6b85a');
}

async function buyItem(shop: string, item: ItemId) {
  focusItem = null;
  const price = cfg.economy.shops
    .find((s) => s.id === shop)!
    .items.find((i) => i.id === item)!.price;
  const name = itemName(shop, item);
  if (progress.coins >= price) {
    const v = veil(`<div class="card"><h2>${name}</h2><p>${t('buyItemBody', { p: price })}</p>
      <div class="stack"><button class="btn primary" id="bBuy">${t('buyItem', { p: price })}</button><button class="btn plain" id="bNo">${t('cancel')}</button></div></div>`);
    v.querySelector('#bNo')!.addEventListener('click', closeVeil);
    v.querySelector('#bBuy')!.addEventListener('click', () => {
      const wasComplete = isShopComplete(progress, cfg, shop);
      const next = buyDecoration(progress, cfg, shop, item);
      if (!next) return;
      progress = next;
      persist();
      sfxCoins();
      closeVeil();
      if (!wasComplete && isShopComplete(progress, cfg, shop)) {
        viewShop = progress.activeShop;
        openHome();
        toast(t('shopDone', { name: shopName(shop) }));
      } else openHome();
      celebrateItem(item);
    });
    return;
  }
  const short = topUpShortfall(progress, cfg, price);
  if (ADS && short !== null && coinAdsLeft(progress, cfg, today()) > 0) {
    const v = veil(`<div class="card"><h2>${name}</h2><p>${t('shortBody', { s: short })}</p>
      <div class="stack"><button class="btn ad" id="bAd">${t('topUpAd', { s: short })}</button><button class="btn plain" id="bNo">${t('cancel')}</button></div></div>`);
    v.querySelector('#bNo')!.addEventListener('click', closeVeil);
    v.querySelector('#bAd')!.addEventListener('click', async () => {
      const r = await rewardedAd();
      if (r === 'rewarded') {
        progress = noteCoinAd(addCoins(progress, short), today());
        persist();
        refreshHomeCoins();
        await buyItem(shop, item);
      } else if (r === 'unavailable') toast(t('noAdPlain'));
    });
    return;
  }
  toast(t('needMore', { s: price - progress.coins }));
}

function openStyles(shop: string, item: ItemId) {
  focusItem = null;
  const key = itemKey(shop, item);
  const own = progress.owned[key]!;
  const price = stylePrice(cfg, shop, item)!;
  const cards = [0, 1, 2]
    .map((st) => {
      const has = own.styles.includes(st);
      const sel = own.selected === st;
      return `<button class="style-card${sel ? ' sel' : ''}" data-style="${st}">${styleSwatch(shop, item, st, shopName(shop), WOOD_URI, COUNTER_URI)}<span>${styleName(shop, item, st)}</span><small>${sel ? t('inUse') : has ? t('use') : `${price} ${t('gold')}`}</small></button>`;
    })
    .join('');
  const v = veil(
    `<div class="card sheet"><h2>${itemName(shop, item)}</h2><p>${t('styleBody')}</p><div class="styles">${cards}</div><button class="btn plain" id="sClose">${t('close')}</button></div>`,
  );
  v.querySelector('#sClose')!.addEventListener('click', () => openHome());
  v.querySelector('.styles')!.addEventListener('click', (e) => {
    const st = Number((e.target as Element).closest('[data-style]')?.getAttribute('data-style'));
    if (Number.isNaN(st)) return;
    if (own.styles.includes(st)) {
      progress = selectStyle(progress, shop, item, st);
      persist();
      openHome();
      return;
    }
    const next = buyStyle(progress, cfg, shop, item, st);
    if (!next) {
      toast(t('needMore', { s: price - progress.coins }));
      return;
    }
    progress = next;
    persist();
    sfxCoins();
    openHome();
    celebrateItem(item);
  });
}

function openGift() {
  const r = claimDailyGift(progress, cfg, today());
  if (!r) return;
  progress = r.progress;
  persist();
  sfxCoins();
  const canAd = coinAdsLeft(progress, cfg, today()) > 0;
  const days = cfg.economy.dailyGift
    .map(
      (g, i) =>
        `<div class="day${i + 1 < r.day ? ' past' : i + 1 === r.day ? ' now' : ''}"><small>${t('day', { n: i + 1 })}</small><b>${g}</b></div>`,
    )
    .join('');
  const v =
    veil(`<div class="card"><h2>${t('dailyGift')}</h2><div class="days">${days}</div><p>${t('giftBody', { n: r.reward })}</p>
    <div class="stack">${ADS && canAd ? `<button class="btn ad" id="gAd">${t('giftAd', { n: r.reward })}</button>` : ''}<button class="btn primary" id="gOk">${t('great')}</button></div></div>`);
  v.querySelector('#gOk')!.addEventListener('click', () => openHome());
  v.querySelector('#gAd')?.addEventListener('click', async () => {
    const res = await rewardedAd();
    if (res === 'rewarded') {
      progress = noteCoinAd(addCoins(progress, r.reward), today());
      persist();
      sfxCoins();
      toast(t('doubled', { n: r.reward }));
    } else if (res === 'unavailable') toast(t('noAdPlain'));
    openHome();
  });
}

// --- Açılış --------------------------------------------------------------------------------------

document.getElementById('patterns')!.innerHTML = patternDefs();
$('props').innerHTML = propsSVG();
$('btnSettings').addEventListener('click', () => {
  unlock();
  openSettings();
});
$('btnLevels').addEventListener('click', () => {
  unlock();
  if (!busy) openHome();
});
$('btnRestart').addEventListener('click', () => {
  unlock();
  if (!busy) startLevel(levelN);
});
$('cat').addEventListener('click', () => {
  unlock();
  sfxPurr();
  const r = $('cat').getBoundingClientRect();
  const a = app.getBoundingClientRect();
  for (let k = 0; k < 3; k++) {
    const h = el('path', {
      d: 'M0 3C-4 0-4-3-2-3.2-1-3.3 0-2.4 0-1.8 0-2.4 1-3.3 2-3.2 4-3 4 0 0 3z',
      fill: '#e0533d',
    });
    const x = r.left - a.left + 30 + k * 10;
    const y = r.top - a.top + 10;
    h.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1.4)`, opacity: 1 },
        { transform: `translate(${x + (k - 1) * 8}px, ${y - 40}px) scale(2)`, opacity: 0 },
      ],
      { duration: 1100, delay: k * 140, fill: 'both' },
    ).onfinish = () => h.remove();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.querySelector('.adsim')) closeVeil();
});
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!busy) renderBoard();
  }, 120);
});

function boot(data: unknown) {
  const d = data as { level?: number; home?: boolean } | undefined;
  startLevel(d?.level ?? levelN);
  if (d?.home !== false) openHome();
}
hot?.snapshot?.(() => ({ level: levelN, home: !!document.getElementById('home') }));
if (hot?.ready) hot.ready(boot);
else boot(hot?.data);
