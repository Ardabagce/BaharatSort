import type { ItemId } from './stall';

/**
 * Dükkâna özgü ürünler (Arda, 18 Ekim 2026: "tüm dükkânlarda hep aynı ürünler var, farklı olsun").
 * Her dükkânda aynı 9 yer (kayıttaki parça kimlikleri değişmesin diye: `kapali.scale` …), ama her yerde o
 * dükkâna özgü, adı ve çizimi farklı bir ürün. Mısır Çarşısı ilk tasarımı (stall.ts › ART) kullanır.
 * Koordinatlar stall.ts'teki 400×450 dükkân çizimiyle aynı: tabela üstte, tavan ışıkları 66–130,
 * raflar y=150/210, sol cam 72–176×236–294, tezgâh üstü sağ 240–336×226–292, tezgâh 42–358×292–404,
 * tezgâh önü 122–218×306–388, köşe 14–110×396–436.
 */
export interface Product {
  name: [tr: string, en: string];
  styles: [[string, string], [string, string], [string, string]];
  draw: (style: number, ctx: { name: string }) => string;
  /** Kedi bu ürünün üstünde/içinde uyur. */
  catOn?: boolean;
}

const WOOD = 'url(#stWood)';
const WOOD2 = 'url(#stCounter)';
const pick = <T>(arr: readonly T[], s: number): T => arr[Math.max(0, Math.min(arr.length - 1, s))]!;
const text = (t: string, y: number, color: string, size: number, font = 'Rakkas, Georgia, serif') =>
  `<text x="200" y="${y}" text-anchor="middle" font-family="${font}" font-size="${size}" fill="${color}">${t}</text>`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const hooks = '<path d="M110 52v14M290 52v14" stroke="#2a170d" stroke-width="2"/>';

// --- Ortak çizim parçaları --------------------------------------------------------------------

function shelfRows(fill: string, edge: string, extra = '') {
  return [150, 210]
    .map(
      (y) =>
        `<rect x="58" y="${y}" width="284" height="9" fill="${fill}"/><rect x="58" y="${y}" width="284" height="2" fill="${edge}"/><rect x="58" y="${y + 9}" width="284" height="5" fill="#000" opacity=".3"/>${extra.replaceAll('$Y', String(y))}`,
    )
    .join('');
}
function onShelves(per: number, item: (x: number, base: number, k: number, row: number) => string) {
  let out = '';
  [150, 210].forEach((base, row) => {
    const step = 268 / per;
    for (let k = 0; k < per; k++) out += item(66 + step * k + step / 2, base, k, row);
  });
  return out;
}
function counterBody(top: string, body: string, extra = '') {
  return `<rect x="42" y="294" width="316" height="14" rx="3" fill="${top}"/><rect x="48" y="306" width="304" height="98" fill="${body}"/>${extra}`;
}

// --- Kapalıçarşı ------------------------------------------------------------------------------

const kapali: Partial<Record<ItemId, Product>> = {
  sign: {
    name: ['Hat levhası', 'Calligraphy plaque'],
    styles: [
      ['Yeşil-altın', 'Green & gold'],
      ['Lacivert-altın', 'Navy & gold'],
      ['Bordo-gümüş', 'Burgundy & silver'],
    ],
    draw: (s, c) => {
      const [bg, ink] = pick(
        [
          ['#1f4f3e', '#e6b85a'],
          ['#1c2f5a', '#e6b85a'],
          ['#6b1f2a', '#dfe3e8'],
        ],
        s,
      );
      return `<path d="M70 52V22q0-14 14-14h232q14 0 14 14v30z" fill="${bg}" stroke="${ink}" stroke-width="3"/><path d="M80 48V24q0-8 8-8h224q8 0 8 8v24" fill="none" stroke="${ink}" stroke-width="1"/>${range(
        2,
      )
        .map((k) => `<path d="M${92 + k * 216} 32l6-8 6 8-6 8z" fill="${ink}"/>`)
        .join('')}${text(c.name, 40, ink, 21)}${hooks}`;
    },
  },
  lamps: {
    name: ['Pirinç avize', 'Brass chandelier'],
    styles: [
      ['Pirinç', 'Brass'],
      ['Bakır', 'Copper'],
      ['Gümüş', 'Silver'],
    ],
    draw: (s) => {
      const m = pick(['#d6a24a', '#c06a33', '#c9ced4'], s);
      const d = pick(['#8d6220', '#7a3f18', '#6f7378'], s);
      const arms = range(5)
        .map((k) => {
          const x = 146 + k * 27;
          return `<path d="M200 98Q${x} 100 ${x} 112" stroke="${m}" stroke-width="3" fill="none"/><rect x="${x - 4}" y="110" width="8" height="6" fill="${d}"/><path d="M${x} 110q-4-8 0-14 4 6 0 14z" fill="#ffd27a"/><circle cx="${x}" cy="104" r="14" fill="url(#stGlow)"/>`;
        })
        .join('');
      return `<line x1="200" y1="66" x2="200" y2="90" stroke="#2a170d" stroke-width="1.6"/><circle cx="200" cy="112" r="50" fill="url(#stGlow)"/><path d="M190 90h20l4 12h-28z" fill="${m}" stroke="${d}"/>${arms}<circle cx="200" cy="108" r="6" fill="${m}"/><path d="M196 114h8l-4 10z" fill="${d}"/>`;
    },
  },
  shelves: {
    name: ['Oymalı raflar', 'Carved shelves'],
    styles: [
      ['Ceviz', 'Walnut'],
      ['Sedef', 'Mother-of-pearl'],
      ['Kızıl ağaç', 'Red cedar'],
    ],
    draw: (s) => {
      const fill = pick([WOOD, '#e8e1d2', '#8a3b22'], s);
      const edge = pick(['#a8713f', '#b9a98a', '#c06a33'], s);
      const arch = range(7)
        .map(
          (k) =>
            `<path d="M${62 + k * 40} $Y q20 -14 40 0" stroke="${edge}" stroke-width="2" fill="none" opacity=".8"/>`,
        )
        .join('');
      return shelfRows(fill, edge, arch);
    },
  },
  jarSet: {
    name: ['Bakır cezveler', 'Copper coffee pots'],
    styles: [
      ['Bakır', 'Copper'],
      ['Pirinç', 'Brass'],
      ['Kalaylı', 'Tinned'],
    ],
    draw: (s) => {
      const m = pick(['#c06a33', '#d6a24a', '#c9ced4'], s);
      const d = pick(['#7a3f18', '#8d6220', '#6f7378'], s);
      return onShelves(7, (x, b, k) => {
        const big = (k % 2) * 4;
        return `<path d="M${x - 9 - big / 2} ${b}l3-${20 + big}h${12 + big}l3 ${20 + big}z" fill="${m}" stroke="${d}"/><path d="M${x - 6 - big / 2} ${b - 20 - big}h${12 + big}" stroke="${d}" stroke-width="2"/><path d="M${x + 7 + big / 2} ${b - 12}h12" stroke="${d}" stroke-width="2.5" stroke-linecap="round"/><path d="M${x - 9} ${b - 22 - big}l-4-4" stroke="${d}" stroke-width="2"/><path d="M${x - 6} ${b - 6}h12" stroke="#fff" stroke-opacity=".35"/>`;
      });
    },
  },
  vitrine: {
    name: ['Mücevher vitrini', 'Jewellery case'],
    styles: [
      ['Altın', 'Gold'],
      ['Gümüş', 'Silver'],
      ['Firuze', 'Turquoise'],
    ],
    draw: (s) => {
      const frame = pick(['#c9953b', '#9aa2aa', '#2f8a83'], s);
      const gem = pick(['#e6b85a', '#dfe3e8', '#46c2c0'], s);
      const items = range(4)
        .map(
          (k) =>
            `<ellipse cx="${92 + k * 23}" cy="276" rx="8" ry="5" fill="none" stroke="${gem}" stroke-width="2.5"/><circle cx="${92 + k * 23}" cy="271" r="2.2" fill="${pick(['#c8443a', '#2f7fb8', '#3d8a5a', '#8d69c2'], k)}"/>`,
        )
        .join('');
      return `<rect x="72" y="236" width="104" height="58" rx="4" fill="#3a1e14"/><rect x="72" y="236" width="104" height="58" rx="4" fill="rgba(255,240,215,.12)" stroke="${frame}" stroke-width="4"/><rect x="80" y="262" width="88" height="24" fill="#5c1f24"/>${items}<path d="M78 248l20-8" stroke="#fff" stroke-opacity=".45" stroke-width="3"/><rect x="72" y="288" width="104" height="6" fill="${frame}"/>`;
    },
  },
  scale: {
    name: ['Nargile', 'Hookah'],
    styles: [
      ['Lacivert cam', 'Blue glass'],
      ['Yeşil cam', 'Green glass'],
      ['Kırmızı cam', 'Red glass'],
    ],
    draw: (s) => {
      const g = pick(['#2457a0', '#2f8a5a', '#a8322a'], s);
      return `<g><path d="M288 292c-16 0-22-10-22-20 0-12 10-18 22-18s22 6 22 18c0 10-6 20-22 20z" fill="${g}" opacity=".85" stroke="#d6a24a" stroke-width="1.5"/><path d="M276 266q12-6 24 0" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/><rect x="285" y="214" width="6" height="42" fill="#d6a24a"/><path d="M278 222h20M280 236h16" stroke="#8d6220" stroke-width="3"/><path d="M280 206h16l-3 8h-10z" fill="#5b391f"/><circle cx="288" cy="203" r="3" fill="#e0602a"/><path d="M291 246q30 4 32 30" stroke="#5b391f" stroke-width="2.5" fill="none"/><rect x="319" y="274" width="6" height="12" rx="2" fill="#d6a24a"/></g>`;
    },
  },
  counter: {
    name: ['Sedef kakma tezgâh', 'Inlaid counter'],
    styles: [
      ['Ceviz-sedef', 'Walnut & pearl'],
      ['Abanoz', 'Ebony'],
      ['Gül ağacı', 'Rosewood'],
    ],
    draw: (s) => {
      const body = pick([WOOD2, '#2b1a14', '#6b2f22'], s);
      const inlay = range(5)
        .map((k) => {
          const x = 78 + k * 61;
          return `<path d="M${x} 330l14 14-14 14-14-14z" fill="none" stroke="#efe6d6" stroke-width="2"/><circle cx="${x}" cy="344" r="4" fill="#efe6d6"/><path d="M${x - 22} 384h44" stroke="#efe6d6" stroke-width="1.5" stroke-dasharray="3 3"/>`;
        })
        .join('');
      return counterBody(
        '#5b391f',
        body,
        `<rect x="48" y="306" width="304" height="98" fill="#1b0f08" opacity=".15"/>${inlay}`,
      );
    },
  },
  rug: {
    name: ['Bakır tepsi', 'Copper tray'],
    styles: [
      ['Bakır', 'Copper'],
      ['Pirinç', 'Brass'],
      ['Kalaylı', 'Tinned'],
    ],
    draw: (s) => {
      const m = pick(['#c06a33', '#d6a24a', '#c9ced4'], s);
      const d = pick(['#7a3f18', '#8d6220', '#6f7378'], s);
      return `<circle cx="170" cy="346" r="40" fill="${m}" stroke="${d}" stroke-width="3"/><circle cx="170" cy="346" r="30" fill="none" stroke="${d}" stroke-width="1.5"/>${range(
        8,
      )
        .map((k) => {
          const a = (k / 8) * Math.PI * 2;
          return `<path d="M${(170 + Math.cos(a) * 12).toFixed(1)} ${(346 + Math.sin(a) * 12).toFixed(1)}L${(170 + Math.cos(a) * 26).toFixed(1)} ${(346 + Math.sin(a) * 26).toFixed(1)}" stroke="${d}" stroke-width="2"/>`;
        })
        .join(
          '',
        )}<circle cx="170" cy="346" r="8" fill="${d}"/><path d="M150 316q20-10 40 0" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/>`;
    },
  },
  catBed: {
    name: ['Pirinç mangal', 'Brass brazier'],
    styles: [
      ['Pirinç', 'Brass'],
      ['Bakır', 'Copper'],
      ['Dövme demir', 'Wrought iron'],
    ],
    draw: (s) => {
      const m = pick(['#d6a24a', '#c06a33', '#4d5156'], s);
      const d = pick(['#8d6220', '#7a3f18', '#25282b'], s);
      return `<path d="M30 434l8-14M94 434l-8-14" stroke="${d}" stroke-width="4"/><path d="M24 404h76l-8 18H32z" fill="${m}" stroke="${d}" stroke-width="2"/><ellipse cx="62" cy="404" rx="38" ry="7" fill="${d}"/><g fill="#e0602a">${range(
        5,
      )
        .map((k) => `<circle cx="${40 + k * 11}" cy="402" r="4"/>`)
        .join('')}</g><g fill="#ffd27a" opacity=".8">${range(3)
        .map((k) => `<circle cx="${46 + k * 16}" cy="400" r="2"/>`)
        .join('')}</g><circle cx="62" cy="396" r="30" fill="url(#stGlow)"/>`;
    },
  },
};

// --- Kadıköy Çarşısı ---------------------------------------------------------------------------

const kadikoy: Partial<Record<ItemId, Product>> = {
  sign: {
    name: ['Emaye tabela', 'Enamel sign'],
    styles: [
      ['Kırmızı', 'Red'],
      ['Yeşil', 'Green'],
      ['Sarı', 'Yellow'],
    ],
    draw: (s, c) => {
      const [bg, ink] = pick(
        [
          ['#b8312a', '#fff6e2'],
          ['#2f6b4f', '#fff6e2'],
          ['#e9b93a', '#2a170d'],
        ],
        s,
      );
      return `<rect x="70" y="8" width="260" height="44" rx="10" fill="#f4efe4"/><rect x="74" y="12" width="252" height="36" rx="8" fill="${bg}"/>${range(
        4,
      )
        .map(
          (k) => `<circle cx="${k < 2 ? 80 : 320}" cy="${k % 2 ? 42 : 18}" r="2" fill="#9aa2aa"/>`,
        )
        .join('')}${text(c.name, 38, ink, 20, 'Alegreya Sans, sans-serif')}${hooks}`;
    },
  },
  lamps: {
    name: ['Ampul zinciri', 'Bulb string'],
    styles: [
      ['Sıcak beyaz', 'Warm white'],
      ['Renkli', 'Colourful'],
      ['Kehribar', 'Amber'],
    ],
    draw: (s) => {
      const cols = pick(
        [['#fff1c6'], ['#e8463a', '#f2c12e', '#3d9a5a', '#2f7fb8'], ['#f0a33a']],
        s,
      );
      const pts = range(9).map((k) => {
        const x = 64 + k * 34;
        const y = 76 + Math.sin((k / 8) * Math.PI) * 26;
        return [x, y] as const;
      });
      return `<path d="M${pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join('L')}" stroke="#2a170d" stroke-width="1.6" fill="none"/>${pts
        .map(
          ([x, y], k) =>
            `<circle cx="${x}" cy="${(y + 12).toFixed(1)}" r="14" fill="url(#stGlow)"/><rect x="${x - 2.5}" y="${y.toFixed(1)}" width="5" height="5" fill="#3a3a3a"/><ellipse cx="${x}" cy="${(y + 10).toFixed(1)}" rx="4.5" ry="6" fill="${cols[k % cols.length]}"/>`,
        )
        .join('')}`;
    },
  },
  shelves: {
    name: ['Kasa raflar', 'Crate shelves'],
    styles: [
      ['Ham tahta', 'Raw wood'],
      ['Yeşil boyalı', 'Green painted'],
      ['Mavi boyalı', 'Blue painted'],
    ],
    draw: (s) => {
      const f = pick(['#b88a55', '#4e7d55', '#3f6f96'], s);
      const e = pick(['#d8b07a', '#76a77c', '#6b9cc4'], s);
      return [150, 210]
        .map((y) =>
          range(4)
            .map(
              (k) =>
                `<rect x="${60 + k * 71}" y="${y - 4}" width="67" height="17" fill="${f}" stroke="#3a2416" stroke-width="1.2"/><path d="M${60 + k * 71} ${y + 4}h67" stroke="${e}" stroke-width="2"/><rect x="${80 + k * 71}" y="${y + 1}" width="26" height="7" fill="#f4efe4" opacity=".8"/>`,
            )
            .join(''),
        )
        .join('');
    },
  },
  jarSet: {
    name: ['Turşu kavanozları', 'Pickle jars'],
    styles: [
      ['Karışık', 'Mixed'],
      ['Kırmızı biber', 'Red pepper'],
      ['Salatalık', 'Cucumber'],
    ],
    draw: (s) => {
      const sets = [
        ['#5d8a2e', '#d3352b', '#e9b93a', '#7a1e3c'],
        ['#d3352b', '#b8312a', '#e0602a', '#c8443a'],
        ['#5d8a2e', '#7aa23a', '#4c7a26', '#93b04a'],
      ];
      const cols = pick(sets, s);
      return onShelves(6, (x, b, k, row) => {
        const c = cols[(k + row) % cols.length]!;
        return `<rect x="${x - 15}" y="${b - 38}" width="30" height="38" rx="6" fill="rgba(220,235,200,.25)" stroke="rgba(255,250,235,.7)" stroke-width="1.4"/><rect x="${x - 12}" y="${b - 26}" width="24" height="24" rx="4" fill="#c9c28a" opacity=".5"/>${range(
          4,
        )
          .map(
            (j) =>
              `<ellipse cx="${x - 7 + (j % 2) * 14}" cy="${b - 20 + Math.floor(j / 2) * 10}" rx="5" ry="${j % 2 ? 4 : 6}" fill="${c}"/>`,
          )
          .join(
            '',
          )}<rect x="${x - 11}" y="${b - 44}" width="22" height="7" rx="2" fill="#c8443a"/>`;
      });
    },
  },
  vitrine: {
    name: ['Peynir vitrini', 'Cheese counter'],
    styles: [
      ['Krom', 'Chrome'],
      ['Ahşap', 'Wood'],
      ['Turkuaz', 'Turquoise'],
    ],
    draw: (s) => {
      const frame = pick(['#aeb5bc', '#7a5230', '#2f8a83'], s);
      return `<rect x="72" y="236" width="104" height="58" rx="4" fill="#e9f2f2" opacity=".25" stroke="${frame}" stroke-width="4"/><rect x="80" y="270" width="26" height="14" rx="2" fill="#f7f1df"/><path d="M80 270l26 0-6-6h-14z" fill="#efe4c4"/><path d="M112 284l14-14 14 14z" fill="#f2c46b"/><circle cx="122" cy="279" r="1.6" fill="#d8a640"/><rect x="144" y="268" width="26" height="16" rx="3" fill="#f7f1df"/><circle cx="152" cy="276" r="2" fill="#e6dcc0"/><circle cx="162" cy="273" r="1.5" fill="#e6dcc0"/><path d="M78 248l20-8" stroke="#fff" stroke-opacity=".5" stroke-width="3"/><rect x="72" y="288" width="104" height="6" fill="${frame}"/>`;
    },
  },
  scale: {
    name: ['Kantar', 'Dial scale'],
    styles: [
      ['Kırmızı', 'Red'],
      ['Krem', 'Cream'],
      ['Yeşil', 'Green'],
    ],
    draw: (s) => {
      const b = pick(['#b8312a', '#e9dcc3', '#2f6b4f'], s);
      return `<g><path d="M262 292h52l-6-28h-40z" fill="${b}" stroke="#2a170d" stroke-width="1.5"/><circle cx="288" cy="250" r="22" fill="${b}" stroke="#2a170d" stroke-width="1.5"/><circle cx="288" cy="250" r="16" fill="#fbf6ea"/>${range(
        9,
      )
        .map((k) => {
          const a = Math.PI * (1 + k / 8);
          return `<path d="M${(288 + Math.cos(a) * 13).toFixed(1)} ${(250 + Math.sin(a) * 13).toFixed(1)}L${(288 + Math.cos(a) * 15).toFixed(1)} ${(250 + Math.sin(a) * 15).toFixed(1)}" stroke="#2a170d" stroke-width="1"/>`;
        })
        .join(
          '',
        )}<path d="M288 250l8-8" stroke="#c8443a" stroke-width="1.6"/><ellipse cx="288" cy="226" rx="26" ry="4" fill="#c9ced4" stroke="#6f7378"/><rect x="286" y="226" width="4" height="4" fill="#6f7378"/></g>`;
    },
  },
  counter: {
    name: ['Şarküteri tezgâhı', 'Deli counter'],
    styles: [
      ['Beyaz mermer', 'White marble'],
      ['Yeşil mermer', 'Green marble'],
      ['Siyah granit', 'Black granite'],
    ],
    draw: (s) => {
      const top = pick(['#e9e4da', '#6f9a83', '#2d2d30'], s);
      return `<rect x="40" y="292" width="320" height="16" rx="3" fill="${top}"/><rect x="48" y="308" width="304" height="96" fill="${WOOD2}"/><rect x="58" y="314" width="284" height="48" rx="3" fill="rgba(220,240,245,.25)" stroke="#aeb5bc" stroke-width="2"/>${range(
        6,
      )
        .map(
          (k) =>
            `<rect x="${66 + k * 46}" y="340" width="38" height="16" rx="3" fill="${pick(['#e9a6a0', '#f2c46b', '#f7f1df', '#c8443a', '#e9a6a0', '#9cd08a'], k)}"/>`,
        )
        .join('')}<path d="M64 320l40-4" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`;
    },
  },
  rug: {
    name: ['Meyve kasası', 'Fruit crate'],
    styles: [
      ['Portakal', 'Oranges'],
      ['Elma', 'Apples'],
      ['Nar', 'Pomegranates'],
    ],
    draw: (s) => {
      const f = pick(['#f08a24', '#c8303a', '#9e1d2c'], s);
      const fruit = range(7)
        .map(
          (k) =>
            `<circle cx="${132 + (k % 4) * 23 + (k > 3 ? 11 : 0)}" cy="${k > 3 ? 332 : 342}" r="10" fill="${f}"/><circle cx="${129 + (k % 4) * 23 + (k > 3 ? 11 : 0)}" cy="${k > 3 ? 329 : 339}" r="3" fill="#fff" opacity=".3"/>`,
        )
        .join('');
      return `${fruit}<rect x="122" y="342" width="96" height="40" fill="#c99a63" stroke="#5b391f" stroke-width="2"/><path d="M122 356h96M122 370h96" stroke="#8a6238" stroke-width="2"/><rect x="146" y="352" width="48" height="16" fill="#f4efe4"/>`;
    },
  },
  catBed: {
    name: ['Kedi kulübesi', 'Cat house'],
    styles: [
      ['Ahşap', 'Wood'],
      ['Mavi', 'Blue'],
      ['Pembe', 'Pink'],
    ],
    catOn: true,
    draw: (s) => {
      const c = pick([WOOD, '#3f6f96', '#c97a8a'], s);
      return `<path d="M14 434V404l48-26 48 26v30z" fill="${c}" stroke="#3a2416" stroke-width="2"/><path d="M8 408l54-32 54 32" stroke="#7a3f18" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="42" y="416" width="40" height="18" rx="9" fill="#1b0f08" opacity=".55"/>`;
    },
  },
};

// --- Eminönü İskele Tezgâhı ---------------------------------------------------------------------

const eminonu: Partial<Record<ItemId, Product>> = {
  sign: {
    name: ['İskele tabelası', 'Pier sign'],
    styles: [
      ['Lacivert', 'Navy'],
      ['Beyaz', 'White'],
      ['Turuncu', 'Orange'],
    ],
    draw: (s, c) => {
      const [bg, ink] = pick(
        [
          ['#1f3f8b', '#ffffff'],
          ['#f4f1ea', '#1f3f8b'],
          ['#e0602a', '#ffffff'],
        ],
        s,
      );
      return `<rect x="70" y="8" width="260" height="44" rx="4" fill="${bg}" stroke="${ink}" stroke-width="3"/><rect x="76" y="14" width="248" height="32" rx="3" fill="none" stroke="${ink}" stroke-width="1.2"/><path d="M88 30l8-6v12zM312 30l-8-6v12z" fill="${ink}"/>${text(c.name, 38, ink, 20, 'Alegreya Sans, sans-serif')}${hooks}`;
    },
  },
  lamps: {
    name: ['Gemi fenerleri', 'Ship lanterns'],
    styles: [
      ['Pirinç', 'Brass'],
      ['Kırmızı-yeşil', 'Port & starboard'],
      ['Siyah', 'Black'],
    ],
    draw: (s) => {
      const body = pick(['#c9953b', '#c9953b', '#2d2f33'], s);
      return [130, 270]
        .map((x, i) => {
          const glass = s === 1 ? (i ? '#3d9a5a' : '#c8443a') : '#ffe6a3';
          return `<line x1="${x}" y1="66" x2="${x}" y2="88" stroke="#2a170d" stroke-width="1.6"/><circle cx="${x}" cy="108" r="34" fill="url(#stGlow)"/><circle cx="${x}" cy="88" r="5" fill="none" stroke="${body}" stroke-width="2.5"/><path d="M${x - 12} 94h24l-4 6h-16z" fill="${body}"/><rect x="${x - 10}" y="100" width="20" height="22" rx="3" fill="${glass}" opacity=".9"/><path d="M${x - 10} 106h20M${x - 10} 114h20M${x} 100v22" stroke="${body}" stroke-width="2"/><path d="M${x - 12} 122h24l-3 5h-18z" fill="${body}"/>`;
        })
        .join('');
    },
  },
  shelves: {
    name: ['Kayık tahtası raflar', 'Boat-plank shelves'],
    styles: [
      ['Mavi', 'Blue'],
      ['Beyaz', 'White'],
      ['Kırmızı', 'Red'],
    ],
    draw: (s) => {
      const f = pick(['#2f6f9a', '#e9e6dc', '#a8322a'], s);
      const e = pick(['#79b1d4', '#ffffff', '#d96a5c'], s);
      return shelfRows(
        f,
        e,
        '<path d="M64 $Yq-6 10 0 16M336 $Yq6 10 0 16" stroke="#c9b58a" stroke-width="2.5" fill="none"/>',
      );
    },
  },
  jarSet: {
    name: ['Çay bardakları', 'Tea glasses'],
    styles: [
      ['Ince belli', 'Tulip glasses'],
      ['Altın yaldız', 'Gilded'],
      ['Firuze', 'Turquoise'],
    ],
    draw: (s) => {
      const rim = pick(['#d0d4d8', '#d6a24a', '#2f8a83'], s);
      return onShelves(
        8,
        (x, b) =>
          `<ellipse cx="${x}" cy="${b - 1}" rx="10" ry="3" fill="${rim}"/><path d="M${x - 6} ${b - 22}q-1 6 3 10q-4 4-3 10h12q1-6-3-10q4-4 3-10z" fill="rgba(255,250,240,.25)" stroke="rgba(255,250,240,.75)" stroke-width="1.2"/><path d="M${x - 4} ${b - 10}q4 -3 8 0v8h-8z" fill="#b5401c" opacity=".85"/><path d="M${x - 6} ${b - 22}h12" stroke="${rim}" stroke-width="1.6"/>`,
      );
    },
  },
  vitrine: {
    name: ['Simit camekânı', 'Simit cart'],
    styles: [
      ['Kırmızı', 'Red'],
      ['Mavi', 'Blue'],
      ['Ahşap', 'Wood'],
    ],
    draw: (s) => {
      const frame = pick(['#b8312a', '#2457a0', '#7a5230'], s);
      const simit = (x: number, y: number) =>
        `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#b5651d" stroke-width="6"/><circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#f2d9a8" stroke-width="1.5" stroke-dasharray="1.5 2"/>`;
      return `<path d="M72 294V244q52-22 104 0v50z" fill="rgba(255,240,215,.16)" stroke="${frame}" stroke-width="4"/>${simit(96, 278)}${simit(124, 278)}${simit(152, 278)}${simit(110, 260)}${simit(138, 260)}<rect x="72" y="288" width="104" height="6" fill="${frame}"/><path d="M84 252l14-6" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>`;
    },
  },
  scale: {
    name: ['Semaver', 'Samovar'],
    styles: [
      ['Pirinç', 'Brass'],
      ['Bakır', 'Copper'],
      ['Krom', 'Chrome'],
    ],
    draw: (s) => {
      const m = pick(['#d6a24a', '#c06a33', '#c9ced4'], s);
      const d = pick(['#8d6220', '#7a3f18', '#6f7378'], s);
      return `<g><path d="M272 292l6-10h20l6 10z" fill="${d}"/><path d="M270 282c-4-20 0-40 18-44 18 4 22 24 18 44z" fill="${m}" stroke="${d}" stroke-width="1.5"/><path d="M276 252q12-6 24 0" stroke="#fff" stroke-opacity=".4" stroke-width="2" fill="none"/><path d="M270 262h-8v6h8" stroke="${d}" stroke-width="2.5" fill="none"/><rect x="282" y="226" width="12" height="12" rx="2" fill="${d}"/><path d="M278 222c0-12 20-12 20 0z" fill="#f4f1ea" stroke="#9aa2aa"/><path d="M280 214q8-6 16 0" stroke="#c8443a" stroke-width="2" fill="none"/><path d="M296 196q4 6-1 12M284 198q-3 6 2 10" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none"/></g>`;
    },
  },
  counter: {
    name: ['Kayık tezgâh', 'Boat counter'],
    styles: [
      ['Mavi-beyaz', 'Blue & white'],
      ['Yeşil-sarı', 'Green & yellow'],
      ['Kırmızı-beyaz', 'Red & white'],
    ],
    draw: (s) => {
      const [hull, stripe] = pick(
        [
          ['#2f6f9a', '#f4f1ea'],
          ['#3d7a4e', '#e9b93a'],
          ['#a8322a', '#f4f1ea'],
        ],
        s,
      );
      return `<rect x="42" y="292" width="316" height="12" rx="3" fill="#c9b58a"/><path d="M36 304h328l-26 100H62z" fill="${hull}" stroke="#1b2a33" stroke-width="2"/><path d="M42 322h316" stroke="${stripe}" stroke-width="6"/><path d="M48 340h304" stroke="${stripe}" stroke-width="2"/>${range(
        3,
      )
        .map(
          (k) =>
            `<circle cx="${140 + k * 60}" cy="372" r="7" fill="#1b2a33" stroke="${stripe}" stroke-width="2"/>`,
        )
        .join('')}`;
    },
  },
  rug: {
    name: ['Can simidi', 'Lifebuoy'],
    styles: [
      ['Kırmızı-beyaz', 'Red & white'],
      ['Turuncu', 'Orange'],
      ['Lacivert-beyaz', 'Navy & white'],
    ],
    draw: (s) => {
      const [a, b] = pick(
        [
          ['#d3352b', '#f4f1ea'],
          ['#f07a16', '#f4f1ea'],
          ['#1f3f8b', '#f4f1ea'],
        ],
        s,
      );
      return `<circle cx="170" cy="348" r="30" fill="none" stroke="${a}" stroke-width="16"/><circle cx="170" cy="348" r="30" fill="none" stroke="${b}" stroke-width="16" stroke-dasharray="23.6 23.6"/><circle cx="170" cy="348" r="38" fill="none" stroke="#c9b58a" stroke-width="2" stroke-dasharray="4 6"/>`;
    },
  },
  catBed: {
    name: ['İskele babası ve martı', 'Bollard & gull'],
    styles: [
      ['Siyah', 'Black'],
      ['Yeşil', 'Green'],
      ['Gri', 'Grey'],
    ],
    draw: (s) => {
      const m = pick(['#2d2f33', '#2f5a45', '#6f7378'], s);
      return `<rect x="72" y="408" width="34" height="26" rx="4" fill="${m}"/><ellipse cx="89" cy="408" rx="20" ry="6" fill="${m}"/><path d="M78 420h22" stroke="#c9b58a" stroke-width="3"/><g transform="translate(86 382)"><ellipse cx="0" cy="12" rx="12" ry="8" fill="#f4f4f2"/><path d="M-6 8q-4-10 6-12 10 2 6 12z" fill="#f4f4f2"/><path d="M-10 12q6-6 20-2" fill="#9aa2aa"/><path d="M6 -1l7 2-7 2z" fill="#f2c12e"/><circle cx="3" cy="-1" r="1.2" fill="#1b0f08"/><path d="M-3 20v6M3 20v6" stroke="#f2a33a" stroke-width="1.6"/></g>`;
    },
  },
};

// --- Adalar Bakkalı ----------------------------------------------------------------------------

const adalar: Partial<Record<ItemId, Product>> = {
  sign: {
    name: ['Çiçekli tabela', 'Flower sign'],
    styles: [
      ['Begonvil', 'Bougainvillea'],
      ['Mimoza', 'Mimosa'],
      ['Lavanta', 'Lavender'],
    ],
    draw: (s, c) => {
      const fl = pick(['#d0368a', '#f2c12e', '#8d69c2'], s);
      const flowers = range(12)
        .map(
          (k) =>
            `<circle cx="${74 + k * 23}" cy="${k % 2 ? 9 : 52}" r="5" fill="${fl}"/><circle cx="${80 + k * 23}" cy="${k % 2 ? 53 : 8}" r="3.5" fill="#4c8a3a"/>`,
        )
        .join('');
      return `<rect x="74" y="10" width="252" height="40" rx="6" fill="#f4efe4" stroke="#6b8e5a" stroke-width="3"/>${text(c.name, 37, '#3f5f33', 21)}${flowers}${hooks}`;
    },
  },
  lamps: {
    name: ['Bahçe ışıkları', 'Garden lights'],
    styles: [
      ['Sıcak', 'Warm'],
      ['Yeşil yapraklı', 'Leafy'],
      ['Fener kâğıdı', 'Paper lanterns'],
    ],
    draw: (s) => {
      const pts = range(7).map((k) => {
        const x = 70 + k * 43;
        const y = 74 + Math.sin((k / 6) * Math.PI) * 30;
        return [x, y] as const;
      });
      const path = `<path d="M${pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join('L')}" stroke="#3d5a2c" stroke-width="2" fill="none"/>`;
      return (
        path +
        pts
          .map(([x, y], k) => {
            const leaf =
              s === 1
                ? `<path d="M${x + 6} ${(y - 2).toFixed(1)}q8-6 12 2q-8 4-12-2z" fill="#4c8a3a"/>`
                : '';
            const bulb =
              s === 2
                ? `<ellipse cx="${x}" cy="${(y + 12).toFixed(1)}" rx="8" ry="10" fill="${pick(['#f2c12e', '#e8463a', '#f4f1ea'], k % 3)}"/><path d="M${x - 8} ${(y + 12).toFixed(1)}h16" stroke="#000" stroke-opacity=".15"/>`
                : `<circle cx="${x}" cy="${(y + 9).toFixed(1)}" r="5" fill="#fff1c6"/>`;
            return `<circle cx="${x}" cy="${(y + 10).toFixed(1)}" r="16" fill="url(#stGlow)"/>${leaf}${bulb}`;
          })
          .join('')
      );
    },
  },
  shelves: {
    name: ['Bakkal rafları', 'Grocer shelves'],
    styles: [
      ['Beyaz', 'White'],
      ['Nane yeşili', 'Mint'],
      ['Gök mavisi', 'Sky blue'],
    ],
    draw: (s) => {
      const f = pick(['#f1ece2', '#a9d6c2', '#9cc6e4'], s);
      const scallop = range(14)
        .map(
          (k) =>
            `<path d="M${58 + k * 20.3} $Y q10 12 20.3 0" fill="${f}" stroke="#9a8c72" stroke-width=".8"/>`,
        )
        .join('');
      return shelfRows(f, '#ffffff', scallop);
    },
  },
  jarSet: {
    name: ['Reçel kavanozları', 'Jam jars'],
    styles: [
      ['Kareli bez', 'Gingham'],
      ['Puantiyeli', 'Polka dots'],
      ['Hasır ip', 'Twine'],
    ],
    draw: (s) => {
      const jams = ['#a8322a', '#f08a24', '#6b1f4a', '#c8303a', '#e9b93a', '#5c2a6b'];
      return onShelves(8, (x, b, k, row) => {
        const jam = jams[(k + row * 2) % jams.length]!;
        const lid =
          s === 0
            ? `<rect x="${x - 11}" y="${b - 32}" width="22" height="7" fill="#c8443a"/><path d="M${x - 11} ${b - 30}h22M${x - 6} ${b - 32}v7M${x + 2} ${b - 32}v7" stroke="#fff" stroke-width="1.2"/>`
            : s === 1
              ? `<rect x="${x - 11}" y="${b - 32}" width="22" height="7" fill="#2457a0"/><circle cx="${x - 5}" cy="${b - 29}" r="1.3" fill="#fff"/><circle cx="${x + 4}" cy="${b - 29}" r="1.3" fill="#fff"/>`
              : `<rect x="${x - 11}" y="${b - 32}" width="22" height="7" fill="#e6d6b4"/><path d="M${x - 11} ${b - 27}h22" stroke="#9b6c35" stroke-width="1.6"/>`;
        return `<rect x="${x - 10}" y="${b - 26}" width="20" height="26" rx="4" fill="${jam}" opacity=".9"/><rect x="${x - 10}" y="${b - 26}" width="20" height="26" rx="4" fill="none" stroke="rgba(255,250,240,.7)"/><rect x="${x - 6}" y="${b - 16}" width="12" height="7" fill="#f4efe4"/>${lid}`;
      });
    },
  },
  vitrine: {
    name: ['Dondurma dolabı', 'Ice-cream freezer'],
    styles: [
      ['Pembe', 'Pink'],
      ['Nane', 'Mint'],
      ['Sarı', 'Yellow'],
    ],
    draw: (s) => {
      const b = pick(['#f2a7b8', '#9fd8c4', '#f2d06b'], s);
      const scoops = range(4)
        .map(
          (k) =>
            `<ellipse cx="${88 + k * 24}" cy="262" rx="10" ry="7" fill="${pick(['#f7f1df', '#f2a7b8', '#7a4a2a', '#9cd08a'], k)}"/>`,
        )
        .join('');
      return `<rect x="72" y="244" width="104" height="50" rx="8" fill="${b}" stroke="#7a6a5a" stroke-width="2"/><rect x="78" y="250" width="92" height="22" rx="4" fill="rgba(230,245,250,.6)"/>${scoops}<rect x="78" y="250" width="92" height="22" rx="4" fill="none" stroke="#fff" stroke-opacity=".6"/><path d="M86 284h76" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;
    },
  },
  scale: {
    name: ['Yazar kasa', 'Cash register'],
    styles: [
      ['Pirinç', 'Brass'],
      ['Kırmızı', 'Red'],
      ['Siyah', 'Black'],
    ],
    draw: (s) => {
      const m = pick(['#c9953b', '#b8312a', '#2d2f33'], s);
      return `<g><path d="M262 292l6-30h44l6 30z" fill="${m}" stroke="#2a170d" stroke-width="1.5"/><rect x="272" y="236" width="36" height="22" rx="3" fill="${m}" stroke="#2a170d"/><rect x="278" y="240" width="24" height="10" fill="#f4efe4"/><text x="290" y="248" text-anchor="middle" font-size="8" font-family="Alegreya Sans, sans-serif" fill="#2a170d">₺ 25</text>${range(
        8,
      )
        .map(
          (k) =>
            `<circle cx="${274 + (k % 4) * 11}" cy="${270 + Math.floor(k / 4) * 9}" r="3" fill="#f4efe4"/>`,
        )
        .join('')}<rect x="266" y="286" width="48" height="6" fill="#1b0f08" opacity=".35"/></g>`;
    },
  },
  counter: {
    name: ['Bakkal tezgâhı', 'Grocer counter'],
    styles: [
      ['Beyaz boyalı', 'White painted'],
      ['Yeşil boyalı', 'Green painted'],
      ['Ham meşe', 'Raw oak'],
    ],
    draw: (s) => {
      const body = pick(['#ece6da', '#6f9a83', WOOD2], s);
      const panels = range(3)
        .map(
          (k) =>
            `<rect x="${62 + k * 96}" y="320" width="84" height="70" rx="4" fill="none" stroke="#7a6a5a" stroke-width="2"/><rect x="${70 + k * 96}" y="328" width="68" height="54" rx="3" fill="none" stroke="#7a6a5a" stroke-width="1"/>`,
        )
        .join('');
      return counterBody('#9b7a52', body, panels);
    },
  },
  rug: {
    name: ['Çiçek saksıları', 'Flower pots'],
    styles: [
      ['Sardunya', 'Geranium'],
      ['Begonvil', 'Bougainvillea'],
      ['Fesleğen', 'Basil'],
    ],
    draw: (s) => {
      const fl = pick(['#d3352b', '#d0368a', '#4c8a3a'], s);
      return range(3)
        .map((k) => {
          const x = 140 + k * 30;
          return `<path d="M${x - 11} 360h22l-4 22h-14z" fill="#c0622f" stroke="#7a3f18"/><rect x="${x - 13}" y="356" width="26" height="6" rx="2" fill="#a8532a"/>${range(
            5,
          )
            .map(
              (j) =>
                `<circle cx="${x - 9 + j * 4.5}" cy="${346 - (j % 2) * 6}" r="${s === 2 ? 4 : 3.5}" fill="${s === 2 ? '#5d9a3a' : fl}"/>`,
            )
            .join(
              '',
            )}<path d="M${x} 356v-8M${x - 5} 356l-3-8M${x + 5} 356l3-8" stroke="#3d6a2c" stroke-width="1.5"/>`;
        })
        .join('');
    },
  },
  catBed: {
    name: ['Bisiklet', 'Bicycle'],
    styles: [
      ['Kırmızı', 'Red'],
      ['Nane', 'Mint'],
      ['Siyah', 'Black'],
    ],
    draw: (s) => {
      const f = pick(['#c8303a', '#5fb79a', '#2d2f33'], s);
      return `<circle cx="34" cy="418" r="15" fill="none" stroke="#2a2a2a" stroke-width="3"/><circle cx="92" cy="418" r="15" fill="none" stroke="#2a2a2a" stroke-width="3"/><path d="M34 418l20-22h26l12 22M54 396l10 22h18M80 396l-4-10h-8M54 396l-4-8h-8" stroke="${f}" stroke-width="3.5" fill="none" stroke-linejoin="round"/><path d="M84 386h10" stroke="#2a2a2a" stroke-width="3" stroke-linecap="round"/><path d="M84 380h14v6H84z" fill="#c99a63"/>`;
    },
  },
};

export const PRODUCTS: Record<string, Partial<Record<ItemId, Product>>> = {
  kapali,
  kadikoy,
  eminonu,
  adalar,
};

export function productOf(shop: string, id: ItemId): Product | undefined {
  return PRODUCTS[shop]?.[id];
}

/** Ürün adı (dükkâna özgü ürün yoksa null: Mısır Çarşısı'nın genel adları kullanılır). */
export function productName(shop: string, id: ItemId, lang: 'tr' | 'en'): string | null {
  const p = productOf(shop, id);
  return p ? p.name[lang === 'tr' ? 0 : 1] : null;
}
export function productStyleName(shop: string, id: ItemId, style: number, lang: 'tr' | 'en') {
  const p = productOf(shop, id);
  return p ? (p.styles[style] ?? p.styles[0])[lang === 'tr' ? 0 : 1] : null;
}
