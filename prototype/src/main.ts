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
  sessionStuck,
  sessionUndo,
  sessionWon,
  type Session,
} from '../../shared/src/session';
import { checkPour } from '../../shared/src/rules';
import { SPICES } from '../../shared/src/spices';
import type { Feature, LevelDef } from '../../shared/src/types';
import { CORK_ROOM, JAR_W, jarHeight, jarSVG, LAYER_H, MOUTH_Y, patternDefs, TOP } from './art';
import {
  audio,
  sfxCork,
  sfxPour,
  sfxPurr,
  sfxThud,
  sfxTink,
  sfxWin,
  syncAmbience,
  unlock,
  vibrate,
} from './audio';
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
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
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
  showInfo: true,
  adFail: false,
  ...saved.settings,
};
let ads: AdCounters = saved.ads ? onNewSession(parseAdCounters(saved.ads)) : DEFAULT_AD_COUNTERS;
let lastDecision = '–';
function persist() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ progress: JSON.stringify(progress), settings, ads, level: levelN }),
    );
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
  $('foot').textContent = t('foot');
  $('btnLevels').setAttribute('aria-label', t('levels'));
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
      el.addEventListener('click', onJarTap);
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

function drawJar(i: number, extra: { grown?: number; corkDrop?: boolean } = {}) {
  const el = jarEls[i];
  const jar = session.state.jars[i];
  if (!el || !jar) return;
  el.innerHTML = jarSVG(jar, session.state.cap, {
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
  el.classList.toggle('lifted', selected === i);
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

function onJarTap(e: Event) {
  unlock();
  if (busy || ended) return;
  const i = Number((e.currentTarget as HTMLElement).dataset.i);
  const jar = session.state.jars[i]!;
  if (selected === null) {
    if (jar.layers.length === 0 || jar.capped || jar.lock !== null) {
      shake(jarEls[i]!);
      sfxThud();
      if (settings.haptics) vibrate(30);
      return;
    }
    selected = i;
    jarEls[i]!.classList.add('lifted');
    sfxTink(1 + (jar.layers.length % 4) * 0.06);
    if (settings.haptics) vibrate(8);
    return;
  }
  if (selected === i) {
    jarEls[i]!.classList.remove('lifted');
    selected = null;
    return;
  }
  const from = selected;
  const check = checkPour(session.state, from, i);
  if (!check.ok) {
    shake(jarEls[i]!);
    jarEls[from]!.classList.remove('lifted');
    selected = null;
    sfxThud();
    if (settings.haptics) vibrate([20, 30, 20]);
    return;
  }
  void doPour(from, i);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function doPour(from: number, to: number) {
  busy = true;
  selected = null;
  clearHint();
  const srcEl = jarEls[from]!;
  const dstEl = jarEls[to]!;
  const prevState = session.state;
  const { session: next, result } = sessionPour(session, from, to);
  if (!result.ok) {
    busy = false;
    return;
  }
  session = next;
  const spice = SPICES[result.color]!;
  if (tutorialStep === 1) tutorialStep = 2;
  else if (tutorialStep === 2) tutorialStep = 0;

  // Kepçe yolu: kaynak kavanoz hedefin üstüne gelip eğilir.
  const appR = app.getBoundingClientRect();
  const sR = srcEl.getBoundingClientRect();
  const dR = dstEl.getBoundingClientRect();
  const scale = sR.width / JAR_W;
  const totalH = jarHeight(prevState.cap) + CORK_ROOM;
  const dir = dR.left + dR.width / 2 >= sR.left + sR.width / 2 ? 1 : -1;
  const theta = (dir * 72 * Math.PI) / 180;
  const liftPx = srcEl.classList.contains('lifted') ? 14 : 0;
  const centerS = { x: sR.left + sR.width / 2, y: sR.top + sR.height / 2 + liftPx };
  const mouthD = (totalH / 2 - MOUTH_Y) * scale; // ağızın merkeze uzaklığı
  const dstMouth = { x: dR.left + dR.width / 2, y: dR.top + MOUTH_Y * scale };
  const pourPoint = { x: dstMouth.x - dir * dR.width * 0.12, y: dstMouth.y - 22 * scale - 14 };
  const newCenter = {
    x: pourPoint.x - Math.sin(theta) * mouthD,
    y: pourPoint.y + Math.cos(theta) * mouthD,
  };
  const dx = newCenter.x - centerS.x;
  const dy = newCenter.y - centerS.y;
  srcEl.classList.remove('lifted');
  srcEl.style.zIndex = '5';
  const T1 = reduced ? 1 : 240;
  const anim = srcEl.animate(
    [
      { transform: 'translate(0,-14px) rotate(0deg)' },
      { transform: `translate(${dx}px, ${dy}px) rotate(${dir * 72}deg)` },
    ],
    { duration: T1, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' },
  );
  await anim.finished.catch(() => {});

  // Akış + toz bulutu + katmanların değişmesi.
  const pourMs = reduced ? 1 : 220 + result.amount * 90;
  sfxPour(spice.texture, pourMs / 1000 + 0.1);
  if (settings.haptics) vibrate(12);
  const surfaceY =
    dR.top +
    (CORK_ROOM + TOP + (prevState.cap - prevState.jars[to]!.layers.length) * LAYER_H) * scale;
  stream(
    pourPoint.x - appR.left,
    pourPoint.y - appR.top + 2,
    surfaceY - appR.top,
    spice.id,
    pourMs,
    scale,
  );
  drawJar(from);
  drawJar(to, { grown: result.amount, corkDrop: result.capped });
  await wait(pourMs);
  puff(dstMouth.x - appR.left, dstMouth.y - appR.top, spice.light, scale);

  const back = srcEl.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) rotate(${dir * 72}deg)` },
      { transform: 'translate(0,0) rotate(0deg)' },
    ],
    { duration: reduced ? 1 : 220, easing: 'cubic-bezier(.4,0,.2,1)' },
  );
  anim.cancel();
  await back.finished.catch(() => {});
  srcEl.style.zIndex = '';

  for (const i of result.unlocked) {
    drawJar(i);
    jarEls[i]!.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], {
      duration: 500,
    });
    sfxTink(1.4);
  }
  if (result.capped) {
    sfxCork();
    if (settings.haptics) vibrate([10, 40, 25]);
    sparkle(dR.left + dR.width / 2 - appR.left, dR.top + MOUTH_Y * scale - appR.top, spice.color);
  }
  if (tutorialStep) caption(t('tutorial2'));
  else caption('');
  renderBoosters();
  busy = false;

  if (sessionWon(session)) return win();
  if (levelN <= 2 && tutorialStep) showHint(true);
  if (sessionStuck(session)) {
    await wait(350);
    stuck();
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

function stream(x: number, y0: number, y1: number, spice: number, ms: number, scale: number) {
  if (reduced) return;
  const s = SPICES[spice]!;
  const w = Math.max(3, 6 * scale);
  const line = el('path', {
    d: `M${x} ${y0} Q${x + 1} ${(y0 + y1) / 2} ${x} ${y1}`,
    stroke: s.color,
    'stroke-width': w,
    'stroke-linecap': 'round',
    fill: 'none',
    opacity: 0.95,
  });
  const len = Math.max(10, y1 - y0);
  line.style.strokeDasharray = `${len}`;
  line.animate(
    [
      { strokeDashoffset: len, opacity: 1 },
      { strokeDashoffset: 0, opacity: 1, offset: 0.25 },
      { strokeDashoffset: 0, opacity: 1, offset: 0.8 },
      { strokeDashoffset: -len, opacity: 0.6 },
    ],
    { duration: ms, easing: 'linear' },
  ).onfinish = () => line.remove();
  // Taneler: akışın etrafında düşen küçük parçacıklar.
  for (let k = 0; k < 16; k++) {
    const d = el('circle', {
      cx: x,
      cy: y0,
      r: (s.texture === 'seed' ? 1.6 : 1.1) * Math.max(0.8, scale),
      fill: k % 3 ? s.color : s.light,
    });
    const delay = (k / 16) * ms * 0.8;
    const jitter = (Math.random() - 0.5) * 10 * scale;
    d.animate(
      [
        { transform: 'translate(0,0)', opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { transform: `translate(${jitter}px, ${y1 - y0}px)`, opacity: 0.9 },
      ],
      {
        duration: Math.max(160, (y1 - y0) * 2.2),
        delay,
        easing: 'cubic-bezier(.5,0,1,1)',
        fill: 'both',
      },
    ).onfinish = () => d.remove();
  }
}

function puff(x: number, y: number, color: string, scale: number) {
  if (reduced) return;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI - Math.PI;
    const c = el('circle', { cx: x, cy: y, r: 3 * scale + 2, fill: color, opacity: 0.5 });
    c.animate(
      [
        { transform: 'translate(0,0) scale(0.6)', opacity: 0.55 },
        {
          transform: `translate(${Math.cos(a) * 22 * scale}px, ${Math.sin(a) * 14 * scale - 6}px) scale(1.8)`,
          opacity: 0,
        },
      ],
      { duration: 520 + k * 20, easing: 'ease-out' },
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

/** Hakkı varsa kullanır; yoksa akçe / reklam seçeneği. Uygulanırsa true. */
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
        <button class="btn ad" id="bAd">${t('buyAd')}</button>
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
    v.querySelector('#bAd')!.addEventListener('click', async () => {
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
  setTimeout(
    () => {
      let doubled = false;
      const lines = r.first
        ? `<div><span>${t('reward')}</span><span>+${r.base}</span></div>${r.bonus ? `<div><span>${t('bonus')}</span><span>+${r.bonus}</span></div>` : ''}<div class="total"><span>${t('total')}</span><span id="wTotal">+${r.base + r.bonus}</span></div>`
        : `<div><span>${t('replay')}</span><span>+0</span></div>`;
      const v = veil(`<div class="card">
      <h2>${t('winTitle')}</h2><p>${t('winBody')}</p>
      <div class="lines">${lines}</div>
      <div class="stack">
        ${r.first && r.base > 0 ? `<button class="btn ad" id="wAd">${t('doubleAd')}</button>` : ''}
        <button class="btn primary" id="wNext">${t('next')}</button>
      </div></div>`);
      bumpCoins();
      v.querySelector('#wAd')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        if (doubled) return;
        const res = await rewardedAd();
        if (res === 'rewarded') {
          doubled = true;
          progress = doubleReward(progress, cfg, r.base);
          persist();
          bumpCoins();
          btn.disabled = true;
          const tot = v.querySelector('#wTotal');
          if (tot) tot.textContent = `+${r.base * cfg.economy.adRewardMultiplier + r.bonus}`;
        } else if (res === 'unavailable') toast(t('noAdPlain'));
      });
      v.querySelector('#wNext')!.addEventListener('click', async () => {
        closeVeil();
        // Interstitial yalnızca burada: seviye kazanıldı, ödül ekranı kapanıyor.
        const d = decideInterstitial(cfg.ads, ads, levelN, Date.now());
        lastDecision = d.show ? 'göster' : d.reason;
        if (d.show) {
          if (await interstitialAd()) ads = onInterstitialShown(ads, Date.now());
        } else if (d.reason === 'rewarded-grace') {
          ads = onInterstitialSkipped(ads);
          toast(t('interSkipped'));
        }
        persist();
        startLevel(Math.min(BUILTIN_LEVELS.length, levelN + 1));
      });
    },
    reduced ? 200 : 900,
  );
}

function stuck() {
  if (ended) return;
  ended = true;
  progress = recordStuck(progress, cfg, levelN);
  persist();
  renderBoosters();
  if (settings.haptics) vibrate([30, 50, 30]);
  const sh = progress.boosters.shuffle;
  const v = veil(`<div class="card">
    <h2>${t('stuckTitle')}</h2><p>${t('stuckBody')}</p>
    <div class="stack">
      <button class="btn ad" id="sAd">${t('stuckAd')}</button>
      <button class="btn primary" id="sShuffle">${t('stuckShuffle')} <small>· ${sh > 0 ? sh : `${cfg.economy.boosterPrice.shuffle} akçe`}</small></button>
      <button class="btn plain" id="sUndo" ${canUndo(session) ? '' : 'disabled'}>${t('stuckUndo')} <small>· ${progress.boosters.undo > 0 ? progress.boosters.undo : `${cfg.economy.boosterPrice.undo} akçe`}</small></button>
      <button class="btn plain" id="sRestart">${t('restart')}</button>
    </div></div>`);
  v.querySelector('#sAd')!.addEventListener('click', async () => {
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

function rewardedAd(): Promise<RewardedResult> {
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

function interstitialAd(): Promise<boolean> {
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
    <h3>${t('dev')}</h3>
    ${tog('showInfo', t('showInfo'))}${tog('adFail', t('adFail'))}
    <div class="dev">${t('devCounters', { s: ads.session, l: ads.levelsSinceLast, h: hour, d: lastDecision })}</div>
    <div class="stack">
      <button class="btn plain" id="dSession">${t('newSession')}</button>
      <button class="btn plain" id="dAds">${t('resetAds')}</button>
      <button class="btn plain" id="dReset">${t('resetAll')}</button>
      <button class="btn primary" id="dClose">${t('close')}</button>
    </div></div>`);
  for (const id of ['sound', 'music', 'haptics', 'colorblind', 'showInfo', 'adFail'] as const) {
    v.querySelector<HTMLInputElement>(`#s_${id}`)!.addEventListener('change', (e) => {
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
  v.querySelector('#dSession')!.addEventListener('click', () => {
    ads = onNewSession(ads);
    persist();
    openSettings();
  });
  v.querySelector('#dAds')!.addEventListener('click', () => {
    ads = { ...DEFAULT_AD_COUNTERS, session: ads.session };
    lastDecision = '–';
    persist();
    openSettings();
  });
  v.querySelector('#dReset')!.addEventListener('click', (e) => {
    if (!resetArmed) {
      resetArmed = true;
      (e.currentTarget as HTMLElement).textContent = t('confirmReset');
      return;
    }
    resetArmed = false;
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
  const items = BUILTIN_LEVELS.map((l) => {
    const cls = [
      'lv',
      l.n < progress.unlocked ? 'done' : '',
      l.n === levelN ? 'cur' : '',
      l.kind === 'hard' || l.kind === 'veryHard' ? l.kind : '',
    ].join(' ');
    return `<button class="${cls}" data-n="${l.n}" aria-label="${t('level', { n: l.n })}">${l.n}</button>`;
  }).join('');
  const v = veil(`<div class="card sheet"><h2>${t('levels')}</h2><p>${t('levelsNote')}</p>
    <div class="grid" id="lvGrid">${items}</div>
    <button class="btn primary" id="lvClose">${t('close')}</button></div>`);
  v.querySelector('#lvGrid')!.addEventListener('click', (e) => {
    const n = Number((e.target as HTMLElement).closest<HTMLElement>('[data-n]')?.dataset.n);
    if (n) startLevel(n);
  });
  v.querySelector('#lvClose')!.addEventListener('click', closeVeil);
  const grid = v.querySelector<HTMLElement>('#lvGrid')!;
  const cur = v.querySelector<HTMLElement>('.cur');
  if (cur) grid.scrollTop = cur.offsetTop - grid.offsetTop - grid.clientHeight / 2;
}

// --- Açılış --------------------------------------------------------------------------------------

document.getElementById('patterns')!.innerHTML = patternDefs();
$('btnSettings').addEventListener('click', () => {
  unlock();
  openSettings();
});
$('btnLevels').addEventListener('click', () => {
  unlock();
  openLevels();
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
  const d = data as { level?: number } | undefined;
  startLevel(d?.level ?? levelN);
}
hot?.snapshot?.(() => ({ level: levelN }));
if (hot?.ready) hot.ready(boot);
else boot(hot?.data);
