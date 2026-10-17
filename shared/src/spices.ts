/**
 * Baharat paleti: en fazla 10 renk. Her baharatın rengi, dokusu ve renk körü modu için sembolü var.
 * Katmanlar bu dizinin indeksini (SpiceId) taşır.
 */
export type Texture = 'powder' | 'flakes' | 'leaf' | 'seed';
export type SpiceSymbol =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'diamond'
  | 'star'
  | 'cross'
  | 'moon'
  | 'hexagon'
  | 'drop'
  | 'heart';

export interface Spice {
  id: number;
  key: string;
  name: { tr: string; en: string };
  /** Ana renk ve dokunun koyu/açık tonları. */
  color: string;
  shade: string;
  light: string;
  texture: Texture;
  symbol: SpiceSymbol;
}

export const SPICES: readonly Spice[] = [
  {
    id: 0,
    key: 'chili',
    name: { tr: 'Pul biber', en: 'Chili flakes' },
    color: '#D3352B',
    shade: '#9E1F17',
    light: '#F06A4F',
    texture: 'flakes',
    symbol: 'triangle',
  },
  {
    id: 1,
    key: 'turmeric',
    name: { tr: 'Zerdeçal', en: 'Turmeric' },
    color: '#F2C12E',
    shade: '#C9930F',
    light: '#FFE07A',
    texture: 'powder',
    symbol: 'circle',
  },
  {
    id: 2,
    key: 'sumac',
    name: { tr: 'Sumak', en: 'Sumac' },
    color: '#7A1E3C',
    shade: '#4E0F24',
    light: '#A8406A',
    texture: 'powder',
    symbol: 'heart',
  },
  {
    id: 3,
    key: 'thyme',
    name: { tr: 'Kekik', en: 'Thyme' },
    color: '#3D6A2C',
    shade: '#244319',
    light: '#5E8E45',
    texture: 'leaf',
    symbol: 'diamond',
  },
  {
    id: 4,
    key: 'saffron',
    name: { tr: 'Safran', en: 'Saffron' },
    color: '#F07A16',
    shade: '#B8520A',
    light: '#FFA552',
    texture: 'flakes',
    symbol: 'star',
  },
  {
    id: 5,
    key: 'cinnamon',
    name: { tr: 'Tarçın', en: 'Cinnamon' },
    color: '#8B5330',
    shade: '#5C341C',
    light: '#B57A4F',
    texture: 'powder',
    symbol: 'square',
  },
  {
    id: 6,
    key: 'nigella',
    name: { tr: 'Çörekotu', en: 'Nigella seeds' },
    color: '#262220',
    shade: '#0E0C0B',
    light: '#57504B',
    texture: 'seed',
    symbol: 'moon',
  },
  {
    id: 7,
    key: 'salt',
    name: { tr: 'Tuz', en: 'Salt' },
    color: '#F3EFE6',
    shade: '#CFC7B7',
    light: '#FFFFFF',
    texture: 'seed',
    symbol: 'hexagon',
  },
  {
    id: 8,
    key: 'lavender',
    name: { tr: 'Lavanta', en: 'Lavender' },
    color: '#8D69C2',
    shade: '#5F4291',
    light: '#B79AE6',
    texture: 'seed',
    symbol: 'cross',
  },
  {
    id: 9,
    key: 'mint',
    name: { tr: 'Nane', en: 'Mint' },
    color: '#8FCC69',
    shade: '#5E9C3C',
    light: '#BDEB9C',
    texture: 'leaf',
    symbol: 'drop',
  },
];

export const SPICE_COUNT = SPICES.length;

/** Az renkli seviyelerde yan yana gelmemesi gereken, birbirine benzeyen çiftler. */
export const CONFUSABLE_PAIRS: readonly (readonly [number, number])[] = [
  [0, 2], // pul biber / sumak
  [3, 9], // kekik / nane
  [0, 4], // pul biber / safran
  [2, 5], // sumak / tarçın
];

export function getSpice(id: number): Spice {
  const s = SPICES[id];
  if (!s) throw new Error(`Bilinmeyen baharat: ${id}`);
  return s;
}
