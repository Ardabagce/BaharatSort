import { createRng, type Rng } from '../../shared/src/rng';
import { SPICES } from '../../shared/src/spices';

/**
 * Dükkânın içi (arka plan): Mısır Çarşısı'nda bir baharatçı. Biz ön tezgâhta kavanozları ayıklıyoruz;
 * arkada raflar, tavandan sarkan kuru biber/patlıcan dizileri, tepsilerde baharat yığınları,
 * çarşı koridoruna açılan kemerli kapı. Seed'li, her açılışta aynı. viewBox 400×860, "slice".
 *
 * Oyun alanının ortası koyulaştırılır ki kavanozlar arka plandan net ayrılsın.
 */

const W = 400;
const H = 860;

const muted = (hex: string, k = 0.72) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Sıcak, loş ışık: renkleri kahveye doğru kır.
  const mix = (c: number, w: number) => Math.round(c * k + w * (1 - k));
  return `rgb(${mix(r, 70)},${mix(g, 40)},${mix(b, 24)})`;
};

function tileBand(y: number): string {
  let s = `<rect x="0" y="${y}" width="${W}" height="22" fill="#1f5f63"/><rect x="0" y="${y}" width="${W}" height="2" fill="#c9953b"/><rect x="0" y="${y + 20}" width="${W}" height="2" fill="#c9953b"/>`;
  for (let x = 0; x < W; x += 22) {
    s += `<path d="M${x + 11} ${y + 5}c3 3 3 7 0 12c-3-5-3-9 0-12z" fill="#e8dcc2"/><path d="M${x + 11} ${y + 12}c-4-1-6 1-7 4c3 1 5 0 7-4zM${x + 11} ${y + 12}c4-1 6 1 7 4c-3 1-5 0-7-4z" fill="#c8443a"/><circle cx="${x}" cy="${y + 11}" r="2" fill="#2b86c4"/>`;
  }
  return s;
}

/** Kuru biber dizisi, patlıcan dizisi, sarımsak örgüsü, lif kabağı. */
function garland(x: number, top: number, len: number, kind: number, rng: Rng): string {
  let s = `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + len}" stroke="#2a170d" stroke-width="1"/>`;
  const step = kind === 3 ? 26 : 9;
  for (let y = top + 6; y < top + len; y += step) {
    const sway = (rng() - 0.5) * 4;
    if (kind === 0)
      s += `<path d="M${x + sway} ${y}q4 2 2 10q-1 4-3 0q-3-6 1-10z" fill="${rng() < 0.2 ? '#7a1b16' : '#b8281f'}" transform="rotate(${(rng() - 0.5) * 70} ${x} ${y})"/>`;
    else if (kind === 1)
      s += `<ellipse cx="${x + sway}" cy="${y + 4}" rx="3.2" ry="5" fill="#4b2347"/><path d="M${x + sway - 2} ${y - 1}h4l-2 3z" fill="#5c6b2e"/>`;
    else if (kind === 2)
      s += `<circle cx="${x + sway - 2}" cy="${y + 3}" r="4" fill="#e9dcc3"/><circle cx="${x + sway + 3}" cy="${y + 6}" r="3.6" fill="#d8c8aa"/>`;
    else
      s += `<rect x="${x - 4}" y="${y}" width="8" height="22" rx="4" fill="#b99a62"/><path d="M${x - 3} ${y + 5}h6M${x - 3} ${y + 11}h6M${x - 3} ${y + 17}h6" stroke="#8f7443" stroke-width="1"/>`;
  }
  return s;
}

function shelfItem(x: number, base: number, rng: Rng): { svg: string; w: number } {
  const t = rng();
  const sp = SPICES[Math.floor(rng() * SPICES.length)]!;
  if (t < 0.45) {
    // küçük kavanoz
    const w = 14 + Math.floor(rng() * 6);
    const h = 18 + Math.floor(rng() * 10);
    const fill = Math.floor(h * (0.5 + rng() * 0.4));
    return {
      w,
      svg: `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" rx="3" fill="rgba(255,240,215,0.10)" stroke="rgba(255,240,215,0.35)" stroke-width="1"/><rect x="${x + 1.5}" y="${base - fill}" width="${w - 3}" height="${fill - 1.5}" rx="2" fill="${muted(sp.color)}"/><rect x="${x + 2}" y="${base - h - 3}" width="${w - 4}" height="4" rx="1" fill="#8a6038"/>`,
    };
  }
  if (t < 0.7) {
    // teneke kutu
    const w = 16 + Math.floor(rng() * 6);
    const h = 16 + Math.floor(rng() * 8);
    const c = ['#7d2a22', '#24524f', '#8a6a20', '#3e3a63'][Math.floor(rng() * 4)]!;
    return {
      w,
      svg: `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" rx="2" fill="${c}"/><rect x="${x + 2}" y="${base - h * 0.65}" width="${w - 4}" height="${h * 0.35}" fill="#d9c49a" opacity="0.8"/><rect x="${x}" y="${base - h}" width="${w}" height="2.5" fill="#c9953b"/>`,
    };
  }
  if (t < 0.85) {
    // lokum kutuları
    const w = 24;
    return {
      w,
      svg: `<rect x="${x}" y="${base - 10}" width="${w}" height="10" fill="#9c2f45"/><rect x="${x + 2}" y="${base - 19}" width="${w - 4}" height="9" fill="#d6a24a"/><rect x="${x + 4}" y="${base - 26}" width="${w - 8}" height="7" fill="#2f6b62"/>`,
    };
  }
  // küçük çuval
  const w = 20;
  return {
    w,
    svg: `<path d="M${x} ${base}q-1-14 3-20h14q4 6 3 20z" fill="#a98756"/><ellipse cx="${x + 10}" cy="${base - 20}" rx="8" ry="3" fill="${muted(sp.color, 0.85)}"/>`,
  };
}

function shelves(rng: Rng): string {
  let s = '';
  const rows = [262, 342, 422, 502];
  for (const y of rows) {
    // raf tahtası ve altındaki gölge
    let x = 4 + rng() * 8;
    while (x < W - 24) {
      const it = shelfItem(x, y, rng);
      s += it.svg;
      x += it.w + 3 + rng() * 6;
    }
    s += `<rect x="0" y="${y}" width="${W}" height="7" fill="#6b4226"/><rect x="0" y="${y}" width="${W}" height="1.5" fill="#a8713f"/><rect x="0" y="${y + 7}" width="${W}" height="6" fill="#000" opacity="0.25"/>`;
  }
  // dikmeler
  for (const x of [0, 132, 266, 394])
    s += `<rect x="${x}" y="190" width="7" height="330" fill="#55331d"/><rect x="${x}" y="190" width="2" height="330" fill="#7d5130"/>`;
  return s;
}

/** Çarşı koridoruna açılan kemerli kapı: aydınlık, uzakta kemerler ve gelip geçenler. */
function doorway(): string {
  const x = 300;
  const y = 300;
  const w = 86;
  const h = 300;
  return `<defs>
<linearGradient id="corr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a05a"/><stop offset="1" stop-color="#7a4628"/></linearGradient>
<clipPath id="doorClip"><path d="M${x} ${y + h}V${y + 40}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}z"/></clipPath>
</defs>
<g clip-path="url(#doorClip)">
<rect x="${x}" y="${y - 10}" width="${w}" height="${h + 10}" fill="url(#corr)" opacity="0.8"/>
${[0, 1, 2, 3]
  .map((k) => {
    const sc = 1 - k * 0.2;
    const cx = x + w / 2;
    const aw = w * sc * 0.8;
    const top = y + 50 + k * 26;
    return `<path d="M${cx - aw / 2} ${y + h}V${top + aw / 2}a${aw / 2} ${aw / 2} 0 0 1 ${aw} 0V${y + h}" fill="none" stroke="#a8693a" stroke-width="${4 * sc}" opacity="${0.8 - k * 0.15}"/>`;
  })
  .join('')}
<g class="walker" fill="#6b3d22" opacity="0.75"><circle cx="${x + 20}" cy="${y + 196}" r="6"/><path d="M${x + 13} ${y + 204}h14l3 40h-20z"/></g>
<g class="walker w2" fill="#5a3320" opacity="0.6"><circle cx="${x + 60}" cy="${y + 206}" r="5"/><path d="M${x + 54} ${y + 213}h12l2 32h-16z"/></g>
<rect x="${x}" y="${y + h - 30}" width="${w}" height="30" fill="#8a5432" opacity="0.6"/>
</g>
<path d="M${x - 6} ${y + h}V${y + 40}a${w / 2 + 6} ${w / 2 + 6} 0 0 1 ${w + 12} 0V${y + h}" fill="none" stroke="#c9953b" stroke-width="5"/>
<path d="M${x - 6} ${y + 40}a${w / 2 + 6} ${w / 2 + 6} 0 0 1 ${w + 12} 0" fill="none" stroke="#2a170d" stroke-width="1.5" opacity="0.5"/>`;
}

/** Arka tezgâh: tepsilerde konik baharat yığınları ve fiyat çubukları. */
function mounds(rng: Rng): string {
  const base = 652;
  let s = `<rect x="0" y="${base}" width="${W}" height="16" fill="#5b391f"/><rect x="0" y="${base}" width="${W}" height="2" fill="#a8713f"/>`;
  const order = [0, 1, 4, 5, 2, 3, 8, 9, 6, 7];
  let x = 6;
  let i = 0;
  while (x < W - 30) {
    const sp = SPICES[order[i % order.length]!]!;
    const w = 44 + rng() * 10;
    const h = 30 + rng() * 22;
    s += `<ellipse cx="${x + w / 2}" cy="${base}" rx="${w / 2 + 3}" ry="5" fill="#8a6038"/>`;
    s += `<path d="M${x} ${base - 1}Q${x + w * 0.3} ${base - h * 0.55} ${x + w / 2} ${base - h}Q${x + w * 0.7} ${base - h * 0.55} ${x + w} ${base - 1}z" fill="${muted(sp.color, 0.8)}"/>`;
    s += `<path d="M${x + w * 0.3} ${base - h * 0.45}Q${x + w * 0.45} ${base - h * 0.85} ${x + w / 2} ${base - h}" stroke="${muted(sp.light, 0.8)}" stroke-width="2" fill="none" opacity="0.6"/>`;
    // fiyat çubuğu
    const px = x + w * (0.2 + rng() * 0.6);
    s += `<line x1="${px}" y1="${base - h * 0.4}" x2="${px}" y2="${base - h * 0.4 - 18}" stroke="#d9c49a" stroke-width="1"/><rect x="${px - 7}" y="${base - h * 0.4 - 26}" width="14" height="9" rx="1" fill="#efe2c4"/><path d="M${px - 4} ${base - h * 0.4 - 22}h8" stroke="#7a1e3c" stroke-width="1.2"/>`;
    x += w + 4;
    i++;
  }
  return s;
}

function sacks(): string {
  const one = (x: number, y: number, w: number, color: string) =>
    `<path d="M${x} ${y}q-6 40 4 72h${w - 8}q10-32 4-72z" fill="#a98756"/><path d="M${x - 4} ${y}q${w / 2 + 4} -14 ${w + 8} 0q-4 8-${w / 2 + 4} 8t-${w / 2 + 4}-8z" fill="#c2a06a"/><ellipse cx="${x + w / 2}" cy="${y + 1}" rx="${w / 2 - 2}" ry="6" fill="${color}"/><path d="M${x + 6} ${y + 30}q${w / 2 - 6} 6 ${w - 12} 0" stroke="#8f7443" stroke-width="1.5" fill="none"/>`;
  return (
    one(-8, 690, 70, muted(SPICES[0]!.color, 0.85)) +
    one(338, 694, 66, muted(SPICES[1]!.color, 0.85)) +
    one(48, 712, 54, muted(SPICES[5]!.color, 0.85))
  );
}

export function sceneSVG(): string {
  const rng = createRng('baharat-dukkan');
  let g = '';
  for (let k = 0; k < 15; k++) {
    const x = 10 + k * 27 + (rng() - 0.5) * 6;
    g += garland(x, 128, 60 + rng() * 70, k % 4 === 3 ? 3 : k % 3, rng);
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>
<linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3622"/><stop offset="0.6" stop-color="#3b2418"/><stop offset="1" stop-color="#24150d"/></linearGradient>
<radialGradient id="dim" cx="0.48" cy="0.55" r="0.62"><stop offset="0" stop-color="#1a0d06" stop-opacity="0.66"/><stop offset="0.7" stop-color="#1a0d06" stop-opacity="0.42"/><stop offset="1" stop-color="#1a0d06" stop-opacity="0.15"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#wallG)"/>
${tileBand(96)}
<rect x="0" y="120" width="${W}" height="10" fill="#4a2c18"/><rect x="0" y="120" width="${W}" height="2" fill="#7d5130"/>
${g}
<rect x="0" y="186" width="${W}" height="${520 - 186}" fill="#2e1c13" opacity="0.6"/>
${shelves(rng)}
${doorway()}
${mounds(rng)}
<rect x="0" y="668" width="${W}" height="${H - 668}" fill="#2a170d"/>
${sacks()}
<rect width="${W}" height="${H}" fill="url(#dim)"/>
</svg>`;
}

/** Ön tezgâhtaki eşyalar: bakır terazi ve çay bardağı (buharı tüter). */
export function propsSVG(): string {
  return `<svg viewBox="0 0 130 70" aria-hidden="true">
<ellipse cx="66" cy="66" rx="58" ry="4" fill="#000" opacity="0.25"/>
<g>
<rect x="38" y="20" width="4" height="40" fill="#b07a2a"/>
<path d="M26 60h28l-4-6H30z" fill="#c9953b"/>
<path d="M12 20h56" stroke="#d6a24a" stroke-width="3" stroke-linecap="round"/>
<circle cx="40" cy="18" r="4" fill="#d6a24a"/>
<path d="M14 20l-8 18M14 20l8 18M66 20l-8 18M66 20l8 18" stroke="#8d6220" stroke-width="1"/>
<path d="M2 38q12 8 24 0z" fill="#c9953b"/><path d="M54 38q12 8 24 0z" fill="#c9953b"/>
<ellipse cx="14" cy="37" rx="9" ry="3" fill="#b8281f"/>
</g>
<g transform="translate(96 26)">
<ellipse cx="10" cy="34" rx="15" ry="3.5" fill="#c84a3a"/><ellipse cx="10" cy="33" rx="12" ry="2.5" fill="#e06a55"/>
<path d="M2 2q-2 9 3 15q-5 6-2 16h14q3-10-2-16q5-6 3-15z" fill="rgba(255,235,210,0.25)" stroke="rgba(255,235,210,0.7)" stroke-width="1"/>
<path d="M3.5 12q1 4 3 6q-4 5-2 14h11q2-9-2-14q2-2 3-6z" fill="#9c3412"/>
<path class="steam" d="M7 -2q-3-5 0-9t0-9" stroke="rgba(255,240,220,0.5)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<path class="steam s2" d="M13 -2q-3-5 0-9t0-9" stroke="rgba(255,240,220,0.4)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</g>
</svg>`;
}
