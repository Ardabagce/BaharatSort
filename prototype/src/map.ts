import type { LevelDef } from '../../shared/src/types';

/**
 * Seviye haritası: çarşı içinden aşağıdan yukarı kıvrılan bir yol. Her 30 seviye gerçek bir
 * İstanbul çarşı sokağı; başında mavi emaye sokak tabelası (İstanbul'un gerçek tabela stili).
 */

export const STREETS = [
  { name: 'Hasırcılar Caddesi', district: 'Eminönü' },
  { name: 'Tahtakale Caddesi', district: 'Eminönü' },
  { name: 'Uzunçarşı Caddesi', district: 'Fatih' },
  { name: 'Mahmutpaşa Yokuşu', district: 'Fatih' },
  { name: 'Çakmakçılar Yokuşu', district: 'Fatih' },
  { name: 'Kalpakçılar Caddesi', district: 'Kapalıçarşı' },
  { name: 'Kuyumcular Caddesi', district: 'Kapalıçarşı' },
  { name: 'Sandal Bedesteni Sokağı', district: 'Kapalıçarşı' },
  { name: 'Yağlıkçılar Caddesi', district: 'Kapalıçarşı' },
  { name: 'Fesçiler Caddesi', district: 'Kapalıçarşı' },
];
export const STREET_LEN = 30;

const STEP = 78;
const SIGN = 136;
const PAD_TOP = 60;
const PAD_BOTTOM = 70;

export interface MapLayout {
  height: number;
  nodes: { n: number; x: number; y: number }[];
  signs: { street: number; y: number }[];
}

/** Seviye 1 en altta; yol yukarı doğru kıvrılır. */
export function mapLayout(count: number, width: number): MapLayout {
  const streets = Math.ceil(count / STREET_LEN);
  const height = PAD_TOP + PAD_BOTTOM + count * STEP + streets * SIGN;
  const amp = Math.min(130, width * 0.3);
  const nodes: MapLayout['nodes'] = [];
  const signs: MapLayout['signs'] = [];
  let y = height - PAD_BOTTOM;
  for (let n = 1; n <= count; n++) {
    if ((n - 1) % STREET_LEN === 0) {
      y -= SIGN;
      signs.push({ street: (n - 1) / STREET_LEN, y: y + SIGN / 2 });
    }
    nodes.push({ n, x: width / 2 + Math.sin(n * 0.62) * amp, y });
    y -= STEP;
  }
  return { height, nodes, signs };
}

function pathD(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  let d = `M${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const my = (a.y + b.y) / 2;
    d += ` C${a.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

const CHILI =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M14 3c1 0 2 1 1.5 2.2C17 6 17 8 15 10c-3 4-7 6.5-11 7-1 0-1-1 0-1.5 4-2 7-5 8.5-9 .4-1.2 1-2 1.5-2.2C14 4 13.5 3 14 3z" fill="#d3352b"/><path d="M14.2 2.4c.8-.8 2-.8 2.6 0" stroke="#3d6a2c" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M12 7c-1 3-3 5-6 7" stroke="#f06a4f" stroke-width="1" fill="none" opacity=".7"/></svg>';

/** Kilitli düğüm için küçük pirinç asma kilit. */
const PADLOCK = `<svg viewBox="0 0 20 22" aria-hidden="true"><path d="M5.5 10V7a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#c9a15a" stroke-width="2.4"/><rect x="2.5" y="9.5" width="15" height="11" rx="2.5" fill="#d9b25f" stroke="#6b4a17" stroke-width="1.3"/><circle cx="10" cy="14.2" r="1.7" fill="#4a3110"/><path d="M10 15v2.6" stroke="#4a3110" stroke-width="1.6" stroke-linecap="round"/></svg>`;

export function mapHTML(
  levels: readonly LevelDef[],
  width: number,
  unlocked: number,
  current: number,
  lang: 'tr' | 'en',
): string {
  const L = mapLayout(levels.length, width);
  const done = L.nodes.filter((p) => p.n < unlocked);
  const svg = `<svg class="map-path" width="${width}" height="${L.height}" aria-hidden="true">
<path d="${pathD(L.nodes)}" fill="none" stroke="#2a170d" stroke-opacity=".55" stroke-width="30" stroke-linecap="round"/>
<path d="${pathD(L.nodes)}" fill="none" stroke="#7d5a3c" stroke-width="22" stroke-linecap="round"/>
<path d="${pathD(L.nodes)}" fill="none" stroke="#a88760" stroke-width="20" stroke-dasharray="7 9" stroke-linecap="round" opacity=".55"/>
${done.length > 1 ? `<path d="${pathD(done)}" fill="none" stroke="#e6b85a" stroke-width="5" stroke-dasharray="1 9" stroke-linecap="round"/>` : ''}
</svg>`;
  const signs = L.signs
    .map((s) => {
      const st = STREETS[s.street % STREETS.length]!;
      const from = s.street * STREET_LEN + 1;
      const to = Math.min(levels.length, from + STREET_LEN - 1);
      return `<div class="street" style="top:${s.y}px"><span class="district">${st.district.toLocaleUpperCase('tr')}</span><span class="sname">${st.name.toLocaleUpperCase('tr')}</span><span class="range">${lang === 'tr' ? 'Seviye' : 'Levels'} ${from}–${to}</span></div>`;
    })
    .join('');
  const nodes = L.nodes
    .map(({ n, x, y }) => {
      const lv = levels[n - 1]!;
      const cls = ['node', n < unlocked ? 'done' : n === unlocked ? 'next' : 'locked'];
      if (n === current) cls.push('cur');
      if (lv.kind === 'hard' || lv.kind === 'veryHard') cls.push(lv.kind);
      const badge =
        lv.kind === 'veryHard'
          ? `<span class="chili two">${CHILI}${CHILI}</span>`
          : lv.kind === 'hard'
            ? `<span class="chili">${CHILI}</span>`
            : '';
      const locked = n > unlocked;
      const label =
        (lang === 'tr' ? `Seviye ${n}` : `Level ${n}`) +
        (locked ? (lang === 'tr' ? ' (kilitli)' : ' (locked)') : '');
      const lock = locked ? `<span class="padlock">${PADLOCK}</span>` : '';
      return `<button class="${cls.join(' ')}" data-n="${n}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px" aria-label="${label}"${locked ? ' aria-disabled="true"' : ''}><span class="num">${n}</span>${badge}${lock}</button>`;
    })
    .join('');
  return `<div class="map-inner" style="height:${L.height}px">${svg}${signs}${nodes}</div>`;
}
