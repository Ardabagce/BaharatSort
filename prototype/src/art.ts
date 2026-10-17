import { SPICES, type Spice, type SpiceSymbol } from '../../shared/src/spices';
import type { Jar } from '../../shared/src/types';
import { SPICE_PHOTOS } from './textures.gen';

/** Kavanoz çizimi (SVG). Uygulamadaki Skia çizimi aynı ölçüleri kullanacak. */

export const JAR_W = 64;
export const LAYER_H = 20;
export const TOP = 24; // gövde içinin üstü
export const CORK_ROOM = 16;

export function jarHeight(cap: number): number {
  return TOP + cap * LAYER_H + 9;
}

/** Ağız merkezi, kavanoz kutusunun üstünden aşağı (viewBox birimi, CORK_ROOM dahil). */
export const MOUTH_Y = CORK_ROOM + 4;

const SYMBOLS: Record<SpiceSymbol, string> = {
  circle: 'M0-5a5 5 0 1 0 0.01 0z',
  triangle: 'M0-5.5L5.5 4.5H-5.5z',
  square: 'M-4.5-4.5h9v9h-9z',
  diamond: 'M0-6L5.5 0 0 6-5.5 0z',
  star: 'M0-6l1.8 3.7 4 .6-2.9 2.8.7 4L0 3.2-3.6 5.1l.7-4L-5.8-1.7l4-.6z',
  cross: 'M-1.8-6h3.6v4.2H6v3.6H1.8V6h-3.6V1.8H-6v-3.6h4.2z',
  moon: 'M2-5.6A6 6 0 1 0 5.6 2 4.6 4.6 0 0 1 2-5.6z',
  hexagon: 'M0-6l5.2 3v6L0 6l-5.2-3v-6z',
  drop: 'M0-6.5C3 -2 5 0.5 5 2.5a5 5 0 0 1-10 0C-5 .5-3-2 0-6.5z',
  heart: 'M0 5.5C-6 1-6-4.5-2.8-4.8-1.2-5 0-3.6 0-2.6 0-3.6 1.2-5 2.8-4.8 6-4.5 6 1 0 5.5z',
};

/** Her baharat için doku deseni (toz, pul, yaprak, tane). Belgeye bir kez eklenir. */
export function patternDefs(): string {
  return SPICES.map((s) => {
    const photo = SPICE_PHOTOS[s.key];
    // Gerçek fotoğraf dokusu varsa o; yoksa kodla çizilmiş doku.
    if (photo)
      return `<pattern id="tex${s.id}" patternUnits="userSpaceOnUse" width="40" height="40"><image href="${photo}" width="40" height="40" preserveAspectRatio="xMidYMid slice"/></pattern>`;
    return `<pattern id="tex${s.id}" patternUnits="userSpaceOnUse" width="16" height="16"><rect width="16" height="16" fill="${s.color}"/>${texture(s)}</pattern>`;
  }).join('');
}

function texture(s: Spice): string {
  switch (s.texture) {
    case 'powder':
      return [
        [2, 3],
        [9, 2],
        [14, 7],
        [5, 9],
        [11, 12],
        [3, 14],
        [7, 5],
        [13, 15],
      ]
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 0.9 : 0.6}" fill="${i % 2 ? s.light : s.shade}" opacity="0.7"/>`,
        )
        .join('');
    case 'flakes':
      return `<path d="M1 3l4-1-1 3zM9 6l5-2-2 4zM3 11l4 0-3 3zM11 13l4-1-2 3z" fill="${s.shade}" opacity="0.75"/><path d="M6 1l2 1-2 1zM13 9l2 1-2 1zM7 8l2 0-1 2z" fill="${s.light}" opacity="0.8"/>`;
    case 'leaf':
      return `<g fill="${s.shade}" opacity="0.8"><ellipse cx="4" cy="4" rx="3" ry="1.2" transform="rotate(-30 4 4)"/><ellipse cx="12" cy="9" rx="3" ry="1.2" transform="rotate(25 12 9)"/><ellipse cx="5" cy="13" rx="2.6" ry="1" transform="rotate(10 5 13)"/></g><g fill="${s.light}" opacity="0.7"><ellipse cx="11" cy="3" rx="2" ry=".8" transform="rotate(40 11 3)"/><ellipse cx="14" cy="14" rx="2" ry=".8" transform="rotate(-20 14 14)"/></g>`;
    case 'seed':
      return `<g fill="${s.shade}"><ellipse cx="3" cy="3" rx="1.6" ry="1.1"/><ellipse cx="10" cy="5" rx="1.6" ry="1.1" transform="rotate(30 10 5)"/><ellipse cx="6" cy="11" rx="1.6" ry="1.1" transform="rotate(-20 6 11)"/><ellipse cx="13" cy="13" rx="1.6" ry="1.1"/></g><g fill="${s.light}" opacity="0.8"><circle cx="2.6" cy="2.5" r=".5"/><circle cx="9.6" cy="4.5" r=".5"/><circle cx="5.6" cy="10.5" r=".5"/><circle cx="12.6" cy="12.5" r=".5"/></g>`;
  }
}

export interface JarDrawOpts {
  uid: string;
  colorblind: boolean;
  /** Bu dökümde eklenen üst katman sayısı (büyüme animasyonu). */
  grown?: number;
  /** Kapak bu dökümde kapandı (düşme animasyonu). */
  corkDrop?: boolean;
}

export function jarSVG(jar: Jar, cap: number, o: JarDrawOpts): string {
  const H = jarHeight(cap);
  const yB = TOP + cap * LAYER_H;
  const neckL = jar.narrow ? 23 : 14;
  const neckR = JAR_W - neckL;
  const body = `M${neckL} 10 L${neckL} 16 Q${neckL} 20 ${neckL - 6} 21 L10 22 Q4 23 4 30 L4 ${yB - 2} Q4 ${yB + 6} 14 ${yB + 6} L50 ${yB + 6} Q60 ${yB + 6} 60 ${yB - 2} L60 30 Q60 23 54 22 L${neckR + 6} 21 Q${neckR} 20 ${neckR} 16 L${neckR} 10`;
  const clipId = `cl-${o.uid}`;
  const n = jar.layers.length;
  let layers = '';
  for (let i = 0; i < n; i++) {
    const c = jar.layers[i]!;
    const y = yB - (i + 1) * LAYER_H;
    const hidden = i < jar.hidden;
    const grow = o.grown && i >= n - o.grown ? ' class="grow"' : '';
    if (hidden) {
      layers += `<g${grow}><rect x="6" y="${y}" width="52" height="${LAYER_H + 0.6}" fill="#5a4334"/><path d="M8 ${y + 4}h48M8 ${y + 12}h48" stroke="#6f5443" stroke-width="1"/><text x="32" y="${y + 15}" text-anchor="middle" font-size="14" font-weight="800" fill="#e6d2b0" font-family="Alegreya Sans, sans-serif">?</text></g>`;
      continue;
    }
    const s = SPICES[c]!;
    let g = `<rect x="6" y="${y}" width="52" height="${LAYER_H + 0.6}" fill="url(#tex${c})"/>`;
    // Katman sınırında hafif gölge, en üstte kavisli yüzey.
    g += `<rect x="6" y="${y + LAYER_H - 2}" width="52" height="2" fill="${s.shade}" opacity="0.35"/>`;
    if (i === n - 1)
      g += `<path d="M6 ${y + 2} Q32 ${y - 3} 58 ${y + 2}" stroke="${s.light}" stroke-width="2" fill="none" opacity="0.75"/>`;
    if (o.colorblind) {
      const dark = s.key === 'salt' || s.key === 'turmeric' || s.key === 'mint';
      g += `<path d="${SYMBOLS[s.symbol]}" transform="translate(32 ${y + LAYER_H / 2}) scale(0.95)" fill="${dark ? '#2a170d' : '#fff8ec'}" stroke="${dark ? '#fff8ec' : '#2a170d'}" stroke-width="0.8"/>`;
    }
    layers += `<g${grow}>${g}</g>`;
  }
  const cork = jar.capped
    ? `<g${o.corkDrop ? ' class="cork-drop"' : ''}><rect x="${neckL - 3}" y="2" width="${neckR - neckL + 6}" height="12" rx="3" fill="#b98953"/><rect x="${neckL - 3}" y="2" width="${neckR - neckL + 6}" height="4" rx="2" fill="#d6a874"/><g fill="#8a6038"><circle cx="${neckL + 4}" cy="9" r="1"/><circle cx="32" cy="11" r="1"/><circle cx="${neckR - 5}" cy="8" r="1"/></g></g>`
    : '';
  const lock =
    jar.lock !== null
      ? `<g transform="translate(32 ${TOP + (cap * LAYER_H) / 2})"><rect x="-26" y="${-(cap * LAYER_H) / 2}" width="52" height="${cap * LAYER_H}" fill="#1b0f08" opacity="0.45"/><path d="M-8-6v-6a8 8 0 0 1 16 0v6" stroke="#d6a24a" stroke-width="3.5" fill="none"/><rect x="-12" y="-7" width="24" height="20" rx="4" fill="#d6a24a" stroke="#8d6220" stroke-width="1.5"/><circle cx="0" cy="3" r="6.5" fill="url(#tex${jar.lock})" stroke="#2a170d" stroke-width="1"/>${o.colorblind ? `<path d="${SYMBOLS[SPICES[jar.lock]!.symbol]}" transform="translate(0 3) scale(0.7)" fill="#fff8ec" stroke="#2a170d" stroke-width="0.8"/>` : ''}</g>`
      : '';
  return `<svg viewBox="0 ${-CORK_ROOM} ${JAR_W} ${H + CORK_ROOM}" aria-hidden="true">
<ellipse cx="32" cy="${yB + 6}" rx="27" ry="3.5" fill="#000" opacity="0.35"/>
<defs><clipPath id="${clipId}"><path d="M6 ${TOP - 4} H58 V${yB - 2} Q58 ${yB + 4} 50 ${yB + 4} H14 Q6 ${yB + 4} 6 ${yB - 2}Z"/></clipPath></defs>
<path d="${body}Z" fill="rgba(255,240,215,0.10)"/>
<g clip-path="url(#${clipId})">${layers}</g>
<path class="glass" d="${body}" fill="none" stroke="rgba(255,240,215,0.6)" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M9 32 V${yB - 6}" stroke="rgba(255,255,255,0.32)" stroke-width="3" stroke-linecap="round"/>
<rect x="${neckL - 4}" y="6" width="${neckR - neckL + 8}" height="5" rx="2.5" fill="rgba(255,240,215,0.25)" stroke="rgba(255,240,215,0.6)" stroke-width="1.4"/>
${cork}${lock}</svg>`;
}
