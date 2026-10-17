/** Katman rengi: `SPICES` dizisindeki baharatın indeksi. */
export type SpiceId = number;

/** Seviye tanımındaki bir kavanoz. `layers` alttan üste. */
export interface JarDef {
  layers: SpiceId[];
  /** Alttan kaç katman gizli ("?"). Üste çıkan katman açılır ve bir daha gizlenmez. */
  hidden?: number;
  /** Kilitli kavanoz: bu renkteki bir kavanoz kapanınca kilit açılır. */
  lock?: SpiceId;
  /** Dar ağızlı: her dökümde en fazla 1 katman alır ve verir. */
  narrow?: boolean;
}

export type LevelKind = 'tutorial' | 'normal' | 'hard' | 'veryHard' | 'relief';
export type Feature = 'hidden' | 'lock' | 'tall' | 'narrow';

export interface LevelStats {
  /** Güçlendiricisiz en kısa çözüm (hamle). `exact` false ise üst sınırdır. */
  minMoves: number;
  exact: boolean;
  /** Çözüm yolu boyunca ortalama anlamlı hamle sayısı. */
  branching: number;
  /** Rastgele botun kilitlenme oranı (0–1). */
  deadEndRate: number;
  hiddenLayers: number;
  /** Renk sayısı / kavanoz sayısı. */
  colorJarRatio: number;
  /** 1–10 zorluk skoru. */
  difficulty: number;
}

export interface LevelDef {
  /** "level-12" ya da "daily-2026-10-17". */
  id: string;
  /** Seviye numarası (günün bulmacasında 0). */
  n: number;
  seed: string;
  kind: LevelKind;
  /** Kavanoz kapasitesi (4; uzun kavanozlu seviyelerde 5–6). Bir seviyedeki tüm kavanozlar aynı. */
  cap: number;
  /** Bu seviyenin tanıttığı yeni öğe (eğitici seviye). */
  introduces?: Feature;
  features: Feature[];
  jars: JarDef[];
  stats: LevelStats;
}

/** Oyun sırasında bir kavanozun durumu. */
export interface Jar {
  layers: SpiceId[];
  hidden: number;
  lock: SpiceId | null;
  narrow: boolean;
  /** Tek renkle dolup kapağı kapandı; artık kullanılamaz. */
  capped: boolean;
}

export interface GameState {
  cap: number;
  jars: Jar[];
}

export interface Move {
  from: number;
  to: number;
}
