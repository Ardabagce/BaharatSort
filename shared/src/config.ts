/**
 * Uzaktan ayarlanabilir oyun ayarı (GET /config). Kodda sabit sayı yok: fiyatlar, ödüller, reklam
 * sınırları ve zorluk eşikleri buradan gelir. Sunucu yoksa uygulama bu varsayılanlarla çalışır.
 * Denge simülasyonu (scripts/balance) da aynı değerleri kullanır; değer değişirse rapor yeniden üretilir.
 */

export type BoosterKind = 'undo' | 'extraJar' | 'hint' | 'shuffle';
export const BOOSTERS: readonly BoosterKind[] = ['undo', 'extraJar', 'hint', 'shuffle'];

export type RewardKind = 'tutorial' | 'normal' | 'hard' | 'veryHard' | 'relief';

export interface DecorationItemConfig {
  id: string;
  price: number;
  /** Seçilebilir stil sayısı (ilk stil parçayla gelir). */
  styles: number;
}

export interface ShopConfig {
  id: string;
  items: DecorationItemConfig[];
}

export interface EconomyConfig {
  startCoins: number;
  levelReward: Record<RewardKind, number>;
  /** Tekrar oynanan (daha önce bitmiş) seviyenin ödülü. */
  replayReward: number;
  /** Hiç geri alma kullanmadan bitirme bonusu. */
  noUndoBonus: number;
  /** "2x al" ödüllü reklamının çarpanı. */
  adRewardMultiplier: number;
  /** 7 günlük hediye döngüsü; art arda girişte artar, gün kaçarsa başa döner. */
  dailyGift: number[];
  dailyPuzzleReward: number;
  /** Haftada bu kadar günün bulmacası bitince özel dekorasyon. */
  dailyPuzzleWeeklyGoal: number;
  boosterPrice: Record<BoosterKind, number>;
  /** Bir "geri al" kaç hamle geri alır. */
  undoSteps: number;
  startBoosters: Record<BoosterKind, number>;
  /** Yeni öğe tanıtılırken hediye edilen güçlendiriciler. */
  introGift: Record<string, Partial<Record<BoosterKind, number>>>;
  /** Eksik altın bu miktardan azsa "reklamla tamamla" teklif edilir. */
  topUpAdMax: number;
  /**
   * Altın veren ödüllü reklamların ("2x al" ve "eksiği tamamla") günlük üst sınırı. Güçlendirici ve
   * "son bir şans" reklamları bu sınıra girmez. Sık reklam izleyenin ekonomiyi kırmaması için.
   */
  coinAdsPerDay: number;
  /** Ek stil fiyatı = parça fiyatı × bu oran. */
  extraStyleRatio: number;
  shops: ShopConfig[];
}

export interface AdsConfig {
  /** Bu seviyeden önce (seviye numarası bundan küçükse) interstitial asla gösterilmez. */
  interstitialMinLevel: number;
  /** İlk oyun oturumunda hiç interstitial yok. */
  skipFirstSession: boolean;
  /** En fazla her N kazanılan seviyede bir. */
  interstitialEveryLevels: number;
  /** İki interstitial arasında en az saniye. */
  interstitialMinIntervalSec: number;
  /** Son N saniyede ödüllü reklam izlendiyse sıradaki interstitial atlanır. */
  rewardedGraceSec: number;
  /** Saatlik üst sınır. */
  interstitialMaxPerHour: number;
  /** Ödüllü reklam yüklenmesi için en fazla bekleme. */
  rewardedLoadTimeoutMs: number;
  bannerOnMenu: boolean;
}

export interface DifficultyConfig {
  tutorialLevels: number;
  hardEvery: number;
  veryHardEvery: number;
  /** Normal seviyelerin hedef zorluğu 1. ve `rampEndLevel`. seviyede (aradaki doğrusal). */
  normalStart: number;
  normalEnd: number;
  rampEndLevel: number;
  hardBonus: number;
  veryHardBonus: number;
  reliefPenalty: number;
  tutorialMax: number;
  /** Yeni öğelerin tanıtıldığı seviyeler. */
  featureStart: { hidden: number; lock: number; tall: number; narrow: number };
  /** Aynı seviyede bu kadar kilitlenmeden sonra ipucu düğmesi parlar ve bir ipucu ücretsiz. */
  stuckHintAfter: number;
}

export interface GameConfig {
  economy: EconomyConfig;
  ads: AdsConfig;
  difficulty: DifficultyConfig;
  features: { daily: boolean; events: boolean };
  /** Bu sürümden eski uygulamalar güncellemeye yönlendirilir. */
  minAppVersion: string;
}

const items = (prices: number[]): DecorationItemConfig[] =>
  ['sign', 'counter', 'shelves', 'scale', 'lamps', 'rug', 'catBed', 'vitrine', 'jarSet'].map(
    (id, i) => ({ id, price: prices[i]!, styles: 3 }),
  );

export const DEFAULT_CONFIG: GameConfig = {
  economy: {
    startCoins: 50,
    levelReward: { tutorial: 10, normal: 10, relief: 10, hard: 25, veryHard: 60 },
    replayReward: 0,
    noUndoBonus: 5,
    adRewardMultiplier: 2,
    dailyGift: [10, 15, 20, 25, 30, 40, 50],
    dailyPuzzleReward: 40,
    dailyPuzzleWeeklyGoal: 7,
    boosterPrice: { undo: 30, extraJar: 80, hint: 40, shuffle: 60 },
    undoSteps: 3,
    startBoosters: { undo: 1, extraJar: 1, hint: 1, shuffle: 1 },
    introGift: {
      hidden: { hint: 1 },
      lock: { extraJar: 1 },
      tall: { undo: 1 },
      narrow: { hint: 1 },
    },
    topUpAdMax: 30,
    coinAdsPerDay: 14,
    extraStyleRatio: 1.2,
    shops: [
      { id: 'misir', items: items([45, 50, 50, 55, 60, 60, 65, 65, 70]) },
      { id: 'kapali', items: items([50, 50, 55, 55, 60, 65, 65, 70, 70]) },
      { id: 'kadikoy', items: items([50, 55, 60, 60, 65, 70, 70, 75, 75]) },
      { id: 'eminonu', items: items([55, 60, 60, 65, 70, 70, 75, 80, 85]) },
      { id: 'adalar', items: items([60, 60, 65, 70, 75, 75, 80, 85, 90]) },
    ],
  },
  ads: {
    interstitialMinLevel: 9,
    skipFirstSession: true,
    interstitialEveryLevels: 3,
    interstitialMinIntervalSec: 120,
    rewardedGraceSec: 180,
    interstitialMaxPerHour: 6,
    rewardedLoadTimeoutMs: 8000,
    bannerOnMenu: true,
  },
  difficulty: {
    tutorialLevels: 10,
    hardEvery: 5,
    veryHardEvery: 20,
    normalStart: 3.5,
    normalEnd: 8,
    rampEndLevel: 200,
    hardBonus: 1.3,
    veryHardBonus: 2.5,
    reliefPenalty: 1,
    tutorialMax: 2,
    featureStart: { hidden: 11, lock: 21, tall: 31, narrow: 41 },
    stuckHintAfter: 3,
  },
  features: { daily: true, events: true },
  minAppVersion: '0.0.0',
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Varsayılanla aynı tipte olmayan alanlar atılır; diziler ve sayılar türü tutuyorsa alınır. */
function mergeDeep<T>(base: T, patch: unknown): T {
  if (Array.isArray(base)) {
    if (!Array.isArray(patch) || patch.length === 0) return base;
    // Nesne dizileri (dükkânlar) öğe öğe, ilk öğenin şablonuyla birleştirilir.
    if (isObj(base[0])) return patch.filter(isObj).map((p) => mergeDeep(base[0], p)) as T;
    const kind = typeof base[0];
    return (patch.every((x) => typeof x === kind) ? patch : base) as T;
  }
  if (isObj(base)) {
    if (!isObj(patch)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(patch)) {
      const b = (base as Record<string, unknown>)[k];
      out[k] = b === undefined ? patch[k] : mergeDeep(b, patch[k]);
    }
    return out as T;
  }
  if (typeof base === 'number')
    return (typeof patch === 'number' && Number.isFinite(patch) && patch >= 0 ? patch : base) as T;
  return (typeof patch === typeof base ? patch : base) as T;
}

/**
 * Sunucudan gelen (ya da önbellekteki) ayarı varsayılanla birleştirir. Güvenlik için uzak ayar
 * interstitial'ı varsayılan seviyeden öne çekemez, saatlik sınırı ve aralığı gevşetemez.
 */
export function mergeConfig(raw: unknown, base: GameConfig = DEFAULT_CONFIG): GameConfig {
  const c = mergeDeep(base, raw);
  c.ads.interstitialMinLevel = Math.max(base.ads.interstitialMinLevel, c.ads.interstitialMinLevel);
  c.ads.interstitialMaxPerHour = Math.min(
    base.ads.interstitialMaxPerHour,
    c.ads.interstitialMaxPerHour,
  );
  c.ads.interstitialMinIntervalSec = Math.max(
    base.ads.interstitialMinIntervalSec,
    c.ads.interstitialMinIntervalSec,
  );
  c.ads.interstitialEveryLevels = Math.max(
    base.ads.interstitialEveryLevels,
    c.ads.interstitialEveryLevels,
  );
  return c;
}

export type { DeepPartial };
