/**
 * Ana menüdeki dükkân: kemerli bir çarşı dükkânı ve 9 dekorasyon parçası (her biri 3 stil).
 * Alınmamış parça soluk bir taslak ve fiyat etiketiyle görünür; dokununca satın alınır.
 * viewBox 400×450. Ahşap kısımlarda Poly Haven dokuları (CC0).
 */

export const ITEM_ORDER = [
  'sign',
  'counter',
  'shelves',
  'scale',
  'lamps',
  'rug',
  'catBed',
  'vitrine',
  'jarSet',
] as const;
export type ItemId = (typeof ITEM_ORDER)[number];

/** Parçanın fiyat etiketinin duracağı yer (viewBox koordinatı). */
export const ANCHORS: Record<ItemId, [number, number]> = {
  sign: [200, 30],
  lamps: [200, 112],
  shelves: [92, 170],
  jarSet: [308, 170],
  vitrine: [122, 262],
  scale: [290, 258],
  counter: [262, 376],
  rug: [150, 318],
  catBed: [62, 412],
};

/** Dükkâna göre zemin tonları (her dükkân aynı parçaları farklı havada gösterir). */
const SHOP_TONE: Record<string, { wall: string; arch: string; floor: string }> = {
  misir: { wall: '#6b4a2e', arch: '#c9a36b', floor: '#3a2416' },
  kapali: { wall: '#5d3b2a', arch: '#d8c19a', floor: '#33201a' },
  kadikoy: { wall: '#4f4a3a', arch: '#b9a98a', floor: '#2c2a22' },
  eminonu: { wall: '#3f4c55', arch: '#c7c0ad', floor: '#2a2f33' },
  adalar: { wall: '#5f5640', arch: '#e6dcc4', floor: '#38331f' },
};

type Draw = (style: number) => string;

const WOOD = 'url(#stWood)';
const WOOD2 = 'url(#stCounter)';

function lettering(text: string, y: number, color: string, size: number) {
  return `<text x="200" y="${y}" text-anchor="middle" font-family="Rakkas, Georgia, serif" font-size="${size}" fill="${color}">${text}</text>`;
}

const ART: Record<ItemId, (style: number, ctx: { name: string }) => string> = {
  sign: (s, c) => {
    const board = [
      `<rect x="70" y="8" width="260" height="44" rx="6" fill="${WOOD}" stroke="#3a2416" stroke-width="3"/>${lettering(c.name, 39, '#f6e7c8', 22)}`,
      `<rect x="70" y="8" width="260" height="44" rx="6" fill="#1f4f3e" stroke="#d6a24a" stroke-width="3"/><rect x="76" y="14" width="248" height="32" rx="4" fill="none" stroke="#d6a24a" stroke-width="1"/>${lettering(c.name, 39, '#e6b85a', 22)}`,
      `<rect x="70" y="8" width="260" height="44" rx="22" fill="#b5652d" stroke="#7a3f18" stroke-width="3"/><rect x="70" y="8" width="260" height="14" rx="7" fill="#e09a5c" opacity=".45"/>${lettering(c.name, 39, '#3a1a08', 22)}`,
    ][s];
    return `<g>${board}<path d="M110 52v14M290 52v14" stroke="#2a170d" stroke-width="2"/></g>`;
  },
  lamps: (s) => {
    const xs = [130, 200, 270];
    return xs
      .map((x, i) => {
        const y = 92 + (i === 1 ? 10 : 0);
        const cord = `<line x1="${x}" y1="66" x2="${x}" y2="${y}" stroke="#2a170d" stroke-width="1.4"/>`;
        const glow = `<circle cx="${x}" cy="${y + 18}" r="34" fill="url(#stGlow)"/>`;
        if (s === 0) {
          const cols = ['#c8443a', '#2f7fb8', '#e0a12e', '#3d8a5a'];
          return `${cord}${glow}<circle cx="${x}" cy="${y + 18}" r="15" fill="${cols[i]}"/><path d="M${x - 15} ${y + 18}a15 15 0 0 0 30 0" fill="${cols[(i + 1) % 4]}" opacity=".8"/><path d="M${x - 9} ${y + 6}l6 8-6 8M${x + 9} ${y + 6}l-6 8 6 8" stroke="#fff3c4" stroke-width="1.4" fill="none" opacity=".7"/><rect x="${x - 5}" y="${y}" width="10" height="5" fill="#c9953b"/><path d="M${x - 4} ${y + 33}h8l-4 7z" fill="#c9953b"/>`;
        }
        if (s === 1)
          return `${cord}${glow}<path d="M${x - 11} ${y + 4}h22l4 26h-30z" fill="#b8862e" stroke="#6b4a16" stroke-width="1.5"/><g fill="#ffd27a">${[
            0, 1, 2,
          ]
            .map(
              (k) =>
                `<circle cx="${x - 6 + k * 6}" cy="${y + 14}" r="1.8"/><circle cx="${x - 3 + k * 6}" cy="${y + 22}" r="1.6"/>`,
            )
            .join('')}</g><path d="M${x - 8} ${y + 4}l8-7 8 7" fill="#8d6220"/>`;
        return `${cord}${glow}<ellipse cx="${x}" cy="${y + 18}" rx="12" ry="15" fill="#fff1d6" opacity=".95"/><rect x="${x - 6}" y="${y}" width="12" height="5" rx="1" fill="#d6a24a"/><circle cx="${x}" cy="${y + 34}" r="2.5" fill="#d6a24a"/>`;
      })
      .join('');
  },
  shelves: (s) => {
    const fill = [WOOD, '#2f8a83', '#c99a63'][s]!;
    const edge = ['#a8713f', '#5fc1b5', '#e6c08a'][s]!;
    return [150, 210]
      .map(
        (y) =>
          `<rect x="58" y="${y}" width="284" height="9" fill="${fill}"/><rect x="58" y="${y}" width="284" height="2" fill="${edge}"/><rect x="58" y="${y + 9}" width="284" height="5" fill="#000" opacity=".3"/><path d="M70 ${y + 9}l8 12M330 ${y + 9}l-8 12" stroke="${fill === WOOD ? '#5b391f' : edge}" stroke-width="3"/>`,
      )
      .join('');
  },
  jarSet: (s) => {
    const spices = [
      '#d3352b',
      '#f2c12e',
      '#7a1e3c',
      '#3d6a2c',
      '#f07a16',
      '#8b5330',
      '#262220',
      '#8d69c2',
    ];
    let out = '';
    [150, 210].forEach((base, row) => {
      for (let k = 0; k < 8; k++) {
        const x = 70 + k * 34;
        const col = spices[(k + row * 3) % spices.length]!;
        if (s === 0)
          out += `<rect x="${x}" y="${base - 30}" width="22" height="30" rx="4" fill="rgba(255,240,215,.14)" stroke="rgba(255,240,215,.6)"/><rect x="${x + 2}" y="${base - 20}" width="18" height="18" rx="2" fill="${col}"/><rect x="${x + 4}" y="${base - 35}" width="14" height="6" rx="2" fill="#b98953"/>`;
        else if (s === 1)
          out += `<rect x="${x}" y="${base - 26}" width="22" height="26" rx="2" fill="#b5652d"/><rect x="${x}" y="${base - 26}" width="22" height="4" fill="#e09a5c"/><rect x="${x + 3}" y="${base - 17}" width="16" height="8" fill="#f3e3c3"/><rect x="${x + 6}" y="${base - 15}" width="10" height="4" fill="${col}"/>`;
        else
          out += `<path d="M${x + 3} ${base}c-4-8-4-20 2-26h12c6 6 6 18 2 26z" fill="#f4f1ea" stroke="#c9c2b2"/><path d="M${x + 4} ${base - 14}q7-6 14 0M${x + 6} ${base - 8}q5 4 10 0" stroke="#2457a0" stroke-width="1.6" fill="none"/><circle cx="${x + 11}" cy="${base - 19}" r="2" fill="#c8443a"/><rect x="${x + 6}" y="${base - 30}" width="10" height="5" rx="2" fill="#2457a0"/>`;
      }
    });
    return out;
  },
  vitrine: (s) => {
    const frame = ['#5b391f', '#c9953b', '#2f6b4f'][s]!;
    return `<rect x="72" y="236" width="104" height="58" rx="4" fill="rgba(255,240,215,.16)" stroke="${frame}" stroke-width="4"/><path d="M78 248l20-8" stroke="#fff" stroke-opacity=".4" stroke-width="3"/><g>${[
      0, 1, 2, 3,
    ]
      .map(
        (k) =>
          `<rect x="${80 + k * 23}" y="270" width="19" height="14" rx="2" fill="${['#e9b7c4', '#f3e3c3', '#9cd08a', '#f2c46b'][k]}"/><path d="M${80 + k * 23} 277h19M${89 + k * 23} 270v14" stroke="#fff" stroke-opacity=".6"/>`,
      )
      .join('')}</g><rect x="72" y="288" width="104" height="6" fill="${frame}"/>`;
  },
  scale: (s) => {
    const metal = ['#d6a24a', '#b5652d', '#6f7378'][s]!;
    const dark = ['#8d6220', '#7a3f18', '#3d4146'][s]!;
    return `<g><rect x="286" y="232" width="5" height="58" fill="${dark}"/><path d="M272 292h34l-5-8h-24z" fill="${metal}"/><path d="M252 234h72" stroke="${metal}" stroke-width="4" stroke-linecap="round"/><circle cx="288" cy="232" r="5" fill="${metal}"/><path d="M256 234l-10 22M256 234l10 22M320 234l-10 22M320 234l10 22" stroke="${dark}" stroke-width="1.2"/><path d="M242 256q14 10 28 0z" fill="${metal}"/><path d="M306 256q14 10 28 0z" fill="${metal}"/><ellipse cx="256" cy="255" rx="10" ry="3.5" fill="#d3352b"/></g>`;
  },
  counter: (s) => {
    if (s === 0)
      return `<rect x="42" y="294" width="316" height="14" rx="3" fill="#a8713f"/><rect x="48" y="306" width="304" height="98" fill="${WOOD2}"/><path d="M48 306h304" stroke="#2a170d" stroke-width="3" opacity=".5"/><g stroke="#2a170d" stroke-opacity=".35" stroke-width="2">${[
        0, 1, 2,
      ]
        .map((k) => `<rect x="${64 + k * 98}" y="320" width="76" height="70" rx="4" fill="none"/>`)
        .join('')}</g>`;
    if (s === 1) {
      let tiles = '';
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 12; k++)
          tiles += `<g transform="translate(${50 + k * 25.3} ${308 + r * 24})"><rect width="25" height="24" fill="#f4f1ea" stroke="#9fb3c8" stroke-width=".5"/><path d="M12.5 3c4 4 4 9 0 13-4-4-4-9 0-13z" fill="#2457a0"/><circle cx="12.5" cy="19" r="2" fill="#c8443a"/><path d="M0 0l5 5M25 0l-5 5M0 24l5-5M25 24l-5-5" stroke="#1f8a8a" stroke-width="1.4"/></g>`;
      return `<rect x="42" y="294" width="316" height="14" rx="3" fill="#5b391f"/>${tiles}<rect x="48" y="400" width="304" height="4" fill="#5b391f"/>`;
    }
    return `<rect x="40" y="292" width="320" height="16" rx="3" fill="#e9e4da"/><path d="M60 296c40 4 60-2 100 3s80-4 120 0 60 3 70 1" stroke="#b9b2a4" stroke-width="1.2" fill="none"/><rect x="48" y="308" width="304" height="96" fill="${WOOD2}"/><rect x="48" y="308" width="304" height="96" fill="#1b0f08" opacity=".25"/>`;
  },
  rug: (s) => {
    const pal = [
      ['#a8322a', '#e6b85a', '#1f3f6b', '#f4f1ea'],
      ['#1f3f6b', '#d6a24a', '#a8322a', '#e9dcc3'],
      ['#7a5a3a', '#c9a36b', '#3d6a2c', '#efe2c4'],
    ][s]!;
    let motifs = '';
    for (let k = 0; k < 3; k++)
      motifs += `<path d="M${132 + k * 26} 330l10-12 10 12-10 12z" fill="${pal[1]}"/><path d="M${136 + k * 26} 330l6-7 6 7-6 7z" fill="${pal[2]}"/>`;
    return `<g><rect x="122" y="306" width="96" height="74" fill="${pal[0]}"/><rect x="126" y="310" width="88" height="66" fill="none" stroke="${pal[3]}" stroke-width="2"/>${motifs}<path d="M126 360h88" stroke="${pal[1]}" stroke-width="3" stroke-dasharray="6 4"/><g stroke="${pal[3]}" stroke-width="1.4">${Array.from({ length: 12 }, (_, k) => `<path d="M${125 + k * 8} 380v8"/>`).join('')}</g></g>`;
  },
  catBed: (s) => {
    if (s === 0)
      return `<ellipse cx="62" cy="422" rx="46" ry="14" fill="#a87d45"/><path d="M18 418q44 -22 88 0" stroke="#7d5a30" stroke-width="6" fill="none"/><path d="M24 424q38 8 76 0" stroke="#c99a5c" stroke-width="2" fill="none" stroke-dasharray="4 3"/>`;
    if (s === 1)
      return `<ellipse cx="62" cy="420" rx="48" ry="15" fill="#a8322a"/><ellipse cx="62" cy="416" rx="38" ry="9" fill="#c8443a"/><circle cx="20" cy="416" r="4" fill="#e6b85a"/><circle cx="104" cy="416" r="4" fill="#e6b85a"/>`;
    return `<rect x="16" y="404" width="92" height="30" rx="3" fill="${WOOD}" stroke="#3a2416" stroke-width="2"/><path d="M22 404q40-10 80 0v8H22z" fill="#2f6b62"/>`;
  },
};

/**
 * Alınmamış parçanın sade hâli: dükkân başta da eksiksiz ama mütevazı görünsün. Bazı parçaların
 * sade hâli yok (terazi, vitrin, kilim, kedi yatağı): alınana kadar yerleri boş kalır.
 */
const BASIC: Partial<Record<ItemId, (c: { name: string }) => string>> = {
  sign: (c) =>
    `<rect x="96" y="12" width="208" height="38" rx="3" fill="#5c4a38" stroke="#3a2a1c" stroke-width="2"/><text x="200" y="38" text-anchor="middle" font-family="Rakkas, Georgia, serif" font-size="19" fill="#e8dcc4" opacity=".85">${c.name}</text><path d="M130 50v16M270 50v16" stroke="#2a170d" stroke-width="2"/>`,
  shelves: () =>
    [150, 210]
      .map(
        (y) =>
          `<rect x="66" y="${y}" width="268" height="7" fill="#5a4a3c"/><rect x="66" y="${y + 7}" width="268" height="4" fill="#000" opacity=".3"/>`,
      )
      .join(''),
  jarSet: () => {
    const cols = ['#d3352b', '#f2c12e', '#3d6a2c', '#8b5330', '#262220'];
    return cols
      .map(
        (c, k) =>
          `<rect x="${92 + k * 46}" y="122" width="22" height="28" rx="4" fill="rgba(255,240,215,.12)" stroke="rgba(255,240,215,.45)"/><rect x="${94 + k * 46}" y="134" width="18" height="14" rx="2" fill="${c}" opacity=".85"/>`,
      )
      .join('');
  },
  lamps: () =>
    `<line x1="200" y1="66" x2="200" y2="100" stroke="#2a170d" stroke-width="1.4"/><circle cx="200" cy="112" r="26" fill="url(#stGlow)" opacity=".7"/><circle cx="200" cy="108" r="7" fill="#fff3d0"/><rect x="196" y="98" width="8" height="5" fill="#6b5844"/>`,
  counter: () =>
    `<rect x="48" y="300" width="304" height="10" fill="#6b5240"/>${[0, 1, 2]
      .map(
        (k) =>
          `<rect x="${52 + k * 101}" y="310" width="96" height="92" fill="#5b4130" stroke="#3a2a1c" stroke-width="2"/><path d="M${52 + k * 101} 340h96M${52 + k * 101} 372h96" stroke="#3a2a1c" stroke-width="1.5"/>`,
      )
      .join('')}`,
};

/** Ana menüdeki uyuyan kedi (yatak varsa üstünde). */
function cat(onBed: boolean) {
  const y = onBed ? 396 : 410;
  return `<g transform="translate(26 ${y}) scale(.62)"><g class="breath"><path d="M18 58c-4-22 14-34 40-34 24 0 40 10 42 26 1 6-3 8-8 8H24c-4 0-6 0-6 0z" fill="#e2a25c"/><path d="M40 30c6 4 8 10 6 16M60 26c5 5 6 12 3 18M78 30c4 5 4 11 1 16" stroke="#b8763a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M96 52c10 0 14-6 10-12" stroke="#e2a25c" stroke-width="7" fill="none" stroke-linecap="round"/></g><path d="M10 58c-6-10 0-24 14-24s18 12 14 24z" fill="#e8ad68"/><path d="M12 38l2-12 8 9zM30 35l6-10 2 12z" fill="#e8ad68"/><path d="M16 46q3 2 6 0M28 46q3 2 6 0" stroke="#5b391f" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
}

export interface StallState {
  shop: string;
  shopName: string;
  /** Parça → seçili stil (alınmamışsa yok). */
  owned: Partial<Record<ItemId, number>>;
  /** Yeri parlatılan parça (şeritte dokunulan). */
  focus?: ItemId | null;
}

export function stallSVG(st: StallState, woodUri: string, counterUri: string): string {
  const tone = SHOP_TONE[st.shop] ?? SHOP_TONE.misir!;
  const has = (id: ItemId) => st.owned[id] !== undefined;
  const part = (id: ItemId) => {
    const style = st.owned[id];
    if (style === undefined) {
      const basic = BASIC[id];
      return basic ? `<g class="basic">${basic({ name: st.shopName })}</g>` : '';
    }
    return `<g class="part" data-item="${id}">${ART[id](style, { name: st.shopName })}</g>`;
  };
  const focus = st.focus
    ? `<g class="focus" transform="translate(${ANCHORS[st.focus][0]} ${ANCHORS[st.focus][1]})"><circle r="34" fill="rgba(255,196,107,.18)" stroke="#ffc46b" stroke-width="2.5" stroke-dasharray="7 5"/></g>`
    : '';
  return `<svg viewBox="0 0 400 450" class="stall-svg" role="img" aria-label="${st.shopName}">
<defs>
<pattern id="stWood" patternUnits="userSpaceOnUse" width="200" height="50"><image href="${woodUri}" width="200" height="50" preserveAspectRatio="none"/></pattern>
<pattern id="stCounter" patternUnits="userSpaceOnUse" width="150" height="150"><image href="${counterUri}" width="150" height="150"/></pattern>
<radialGradient id="stGlow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
<linearGradient id="stWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone.wall}"/><stop offset="1" stop-color="#1b0f08"/></linearGradient>
</defs>
<path d="M38 440V120a162 110 0 0 1 324 0V440z" fill="url(#stWall)"/>
<path d="M38 440V120a162 110 0 0 1 324 0V440" fill="none" stroke="${tone.arch}" stroke-width="10"/>
<path d="M38 440V120a162 110 0 0 1 324 0V440" fill="none" stroke="#2a170d" stroke-width="2" stroke-dasharray="14 10" opacity=".35"/>
<rect x="0" y="430" width="400" height="20" fill="${tone.floor}"/>
${part('shelves')}${part('jarSet')}${part('lamps')}${part('counter')}${part('rug')}${part('vitrine')}${part('scale')}${part('catBed')}${cat(has('catBed'))}${part('sign')}
${focus}
</svg>`;
}

export const STYLE_COUNT = 3;
export function styleSwatch(
  id: ItemId,
  style: number,
  shopName: string,
  woodUri: string,
  counterUri: string,
) {
  // Stil seçicide parçanın küçük önizlemesi: dükkânın ilgili bölgesini kırparak gösterir.
  const [x, y] = ANCHORS[id];
  const w = 170;
  const h = 120;
  return `<svg viewBox="${Math.max(0, x - w / 2)} ${Math.max(0, y - h / 2)} ${w} ${h}" class="swatch-svg"><defs><pattern id="stWood" patternUnits="userSpaceOnUse" width="200" height="50"><image href="${woodUri}" width="200" height="50" preserveAspectRatio="none"/></pattern><pattern id="stCounter" patternUnits="userSpaceOnUse" width="150" height="150"><image href="${counterUri}" width="150" height="150"/></pattern><radialGradient id="stGlow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs><rect x="0" y="0" width="400" height="450" fill="#3a2418"/>${ART[id](style, { name: shopName })}</svg>`;
}

export type { Draw };
