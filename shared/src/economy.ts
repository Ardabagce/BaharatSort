import { BOOSTERS, type BoosterKind, type GameConfig, type RewardKind } from './config';
import type { Feature } from './types';

/**
 * Oyuncunun yerel ilerlemesi ve ekonomi kuralları (saf fonksiyonlar). Uygulama bunu MMKV'ye yazar,
 * denge simülasyonu da aynı fonksiyonlarla oynar. Tüm sayılar `GameConfig`'den gelir.
 */

export interface OwnedItem {
  /** Sahip olunan stiller (0 = parçayla gelen). */
  styles: number[];
  selected: number;
}

export interface Progress {
  schemaVersion: 1;
  /** Oynanabilen en yüksek seviye; ondan küçükler bitmiş sayılır. */
  unlocked: number;
  coins: number;
  boosters: Record<BoosterKind, number>;
  /** Hediyesi verilmiş öğeler. */
  introGifts: Feature[];
  /** `dükkân.parça` → sahip olunan stiller. */
  owned: Record<string, OwnedItem>;
  /** Ana ekranda gösterilen dükkân. */
  activeShop: string;
  dailyGift: { day: number; last: string | null };
  /** Bitirilen günün bulmacaları (YYYY-MM-DD). Son 60 gün tutulur. */
  dailyDone: string[];
  /** Haftalık 7/7 ile kazanılan özel parçalar. */
  specials: string[];
  /** Ödülü alınmış ISO haftaları. */
  weeksClaimed: string[];
  /** Aynı seviyede kilitlenme sayacı (ücretsiz ipucu için). */
  stuck: { level: number; count: number };
  /** Bir sonraki denemede ücretsiz ipucu hazır. */
  freeHint: boolean;
}

export function defaultProgress(cfg: GameConfig): Progress {
  return {
    schemaVersion: 1,
    unlocked: 1,
    coins: cfg.economy.startCoins,
    boosters: { ...cfg.economy.startBoosters },
    introGifts: [],
    owned: {},
    activeShop: cfg.economy.shops[0]?.id ?? 'misir',
    dailyGift: { day: 0, last: null },
    dailyDone: [],
    specials: [],
    weeksClaimed: [],
    stuck: { level: 0, count: 0 },
    freeHint: false,
  };
}

// --- Seviyeler ----------------------------------------------------------------------------------

export function levelReward(
  cfg: GameConfig,
  kind: RewardKind,
  first: boolean,
  usedUndo: boolean,
): { base: number; bonus: number } {
  if (!first) return { base: cfg.economy.replayReward, bonus: 0 };
  return { base: cfg.economy.levelReward[kind], bonus: usedUndo ? 0 : cfg.economy.noUndoBonus };
}

export function completeLevel(
  p: Progress,
  cfg: GameConfig,
  n: number,
  kind: RewardKind,
  usedUndo: boolean,
): { progress: Progress; base: number; bonus: number; first: boolean } {
  const first = n >= p.unlocked;
  const { base, bonus } = levelReward(cfg, kind, first, usedUndo);
  return {
    first,
    base,
    bonus,
    progress: {
      ...p,
      unlocked: Math.max(p.unlocked, n + 1),
      coins: p.coins + base + bonus,
      stuck: p.stuck.level === n ? { level: 0, count: 0 } : p.stuck,
      freeHint: p.stuck.level === n ? false : p.freeHint,
    },
  };
}

/** "2x al" ödüllü reklamı izlendi: taban ödül (bonus hariç) çarpanla tamamlanır. */
export function doubleReward(p: Progress, cfg: GameConfig, base: number): Progress {
  return addCoins(p, base * (cfg.economy.adRewardMultiplier - 1));
}

/** Seviyede kilitlenildi. Eşiğe ulaşınca bir sonraki denemede ücretsiz ipucu. */
export function recordStuck(p: Progress, cfg: GameConfig, n: number): Progress {
  const count = p.stuck.level === n ? p.stuck.count + 1 : 1;
  return {
    ...p,
    stuck: { level: n, count },
    freeHint: p.freeHint || count >= cfg.difficulty.stuckHintAfter,
  };
}

export function consumeFreeHint(p: Progress): Progress {
  return { ...p, freeHint: false, stuck: { ...p.stuck, count: 0 } };
}

// --- Akçe ve güçlendiriciler -------------------------------------------------------------------

export function addCoins(p: Progress, amount: number): Progress {
  return { ...p, coins: p.coins + Math.max(0, Math.floor(amount)) };
}

export function spendCoins(p: Progress, amount: number): Progress | null {
  return p.coins >= amount ? { ...p, coins: p.coins - amount } : null;
}

export function grantBooster(p: Progress, kind: BoosterKind, count = 1): Progress {
  return { ...p, boosters: { ...p.boosters, [kind]: p.boosters[kind] + count } };
}

/** Hakkı varsa kullanır; yoksa null (çağıran akçe ya da reklam teklif eder). */
export function useBooster(p: Progress, kind: BoosterKind): Progress | null {
  if (p.boosters[kind] <= 0) return null;
  return { ...p, boosters: { ...p.boosters, [kind]: p.boosters[kind] - 1 } };
}

/** Akçeyle doğrudan kullanım (hak bitince): fiyat düşer, hak eklenmez. */
export function payBooster(p: Progress, cfg: GameConfig, kind: BoosterKind): Progress | null {
  return spendCoins(p, cfg.economy.boosterPrice[kind]);
}

/** Yeni öğe tanıtılırken ilgili güçlendirici hediyesi (bir kez). */
export function giveIntroGift(
  p: Progress,
  cfg: GameConfig,
  feature: Feature,
): { progress: Progress; gift: Partial<Record<BoosterKind, number>> } | null {
  if (p.introGifts.includes(feature)) return null;
  const gift = cfg.economy.introGift[feature] ?? {};
  let next: Progress = { ...p, introGifts: [...p.introGifts, feature] };
  for (const k of BOOSTERS) if (gift[k]) next = grantBooster(next, k, gift[k]);
  return { progress: next, gift };
}

// --- Günlük hediye ------------------------------------------------------------------------------

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Bugün alınacak hediye günü (1..7); bugün alındıysa null. Gün kaçarsa 1'e döner. */
export function nextGiftDay(p: Progress, cfg: GameConfig, today: string): number | null {
  const { last, day } = p.dailyGift;
  if (last === today) return null;
  const cycle = cfg.economy.dailyGift.length;
  if (last && daysBetween(last, today) === 1) return (day % cycle) + 1;
  return 1;
}

export function claimDailyGift(
  p: Progress,
  cfg: GameConfig,
  today: string,
): { progress: Progress; reward: number; day: number } | null {
  const day = nextGiftDay(p, cfg, today);
  if (day === null) return null;
  const reward = cfg.economy.dailyGift[day - 1] ?? 0;
  return {
    day,
    reward,
    progress: { ...addCoins(p, reward), dailyGift: { day, last: today } },
  };
}

// --- Dükkânlar ve dekorasyon --------------------------------------------------------------------

export const itemKey = (shop: string, item: string) => `${shop}.${item}`;

export function shopIndex(cfg: GameConfig, shop: string): number {
  return cfg.economy.shops.findIndex((s) => s.id === shop);
}

export function isShopComplete(p: Progress, cfg: GameConfig, shop: string): boolean {
  const s = cfg.economy.shops.find((x) => x.id === shop);
  return !!s && s.items.every((it) => p.owned[itemKey(shop, it.id)]);
}

/** Dükkân açık mı: ilki hep açık, sonraki bir öncekinin tüm parçaları alınınca açılır. */
export function isShopUnlocked(p: Progress, cfg: GameConfig, shop: string): boolean {
  const i = shopIndex(cfg, shop);
  if (i < 0) return false;
  if (i === 0) return true;
  return isShopComplete(p, cfg, cfg.economy.shops[i - 1]!.id);
}

export function itemPrice(cfg: GameConfig, shop: string, item: string): number | null {
  const it = cfg.economy.shops.find((s) => s.id === shop)?.items.find((x) => x.id === item);
  return it ? it.price : null;
}

export function stylePrice(cfg: GameConfig, shop: string, item: string): number | null {
  const base = itemPrice(cfg, shop, item);
  return base === null ? null : Math.round(base * cfg.economy.extraStyleRatio);
}

export function buyDecoration(
  p: Progress,
  cfg: GameConfig,
  shop: string,
  item: string,
): Progress | null {
  const price = itemPrice(cfg, shop, item);
  const key = itemKey(shop, item);
  if (price === null || p.owned[key] || !isShopUnlocked(p, cfg, shop)) return null;
  const paid = spendCoins(p, price);
  if (!paid) return null;
  const next: Progress = { ...paid, owned: { ...paid.owned, [key]: { styles: [0], selected: 0 } } };
  // Dükkân tamamlanınca bir sonraki ana ekrana gelir.
  if (isShopComplete(next, cfg, shop)) {
    const after = cfg.economy.shops[shopIndex(cfg, shop) + 1];
    if (after) next.activeShop = after.id;
  }
  return next;
}

export function buyStyle(
  p: Progress,
  cfg: GameConfig,
  shop: string,
  item: string,
  style: number,
): Progress | null {
  const key = itemKey(shop, item);
  const owned = p.owned[key];
  const it = cfg.economy.shops.find((s) => s.id === shop)?.items.find((x) => x.id === item);
  const price = stylePrice(cfg, shop, item);
  if (!owned || !it || price === null || style < 0 || style >= it.styles) return null;
  if (owned.styles.includes(style)) return null;
  const paid = spendCoins(p, price);
  if (!paid) return null;
  return {
    ...paid,
    owned: { ...paid.owned, [key]: { styles: [...owned.styles, style], selected: style } },
  };
}

export function selectStyle(p: Progress, shop: string, item: string, style: number): Progress {
  const key = itemKey(shop, item);
  const owned = p.owned[key];
  if (!owned || !owned.styles.includes(style)) return p;
  return { ...p, owned: { ...p.owned, [key]: { ...owned, selected: style } } };
}

/** Eksik akçe `topUpAdMax`'tan azsa "eksiği reklamla tamamla" teklif edilir; miktarı döner. */
export function topUpShortfall(p: Progress, cfg: GameConfig, price: number): number | null {
  const short = price - p.coins;
  return short > 0 && short < cfg.economy.topUpAdMax ? short : null;
}

/** Bir sonraki alınabilir parça (en ucuz, açık dükkânlarda). Simülasyon ve "öneri" için. */
export function nextAffordableTarget(
  p: Progress,
  cfg: GameConfig,
): { shop: string; item: string; price: number } | null {
  for (const s of cfg.economy.shops) {
    if (!isShopUnlocked(p, cfg, s.id)) break;
    const missing = s.items
      .filter((it) => !p.owned[itemKey(s.id, it.id)])
      .sort((a, b) => a.price - b.price);
    const it = missing[0];
    if (it) return { shop: s.id, item: it.id, price: it.price };
  }
  return null;
}

// --- Günün bulmacası ----------------------------------------------------------------------------

/** ISO hafta (Pazartesi başlar, UTC): "2026-W42". */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const SPECIAL_ITEMS = [
  'samovar',
  'nazar',
  'cezve',
  'lokum',
  'geranium',
  'birdcage',
  'lantern',
  'kilim',
] as const;

export function completeDaily(
  p: Progress,
  cfg: GameConfig,
  date: string,
): { progress: Progress; reward: number; special: string | null } {
  if (p.dailyDone.includes(date)) return { progress: p, reward: 0, special: null };
  const dailyDone = [...p.dailyDone, date].sort().slice(-60);
  let next: Progress = { ...addCoins(p, cfg.economy.dailyPuzzleReward), dailyDone };
  const week = isoWeek(date);
  const inWeek = dailyDone.filter((d) => isoWeek(d) === week).length;
  let special: string | null = null;
  if (inWeek >= cfg.economy.dailyPuzzleWeeklyGoal && !p.weeksClaimed.includes(week)) {
    special = SPECIAL_ITEMS[p.specials.length % SPECIAL_ITEMS.length]!;
    next = {
      ...next,
      specials: [...next.specials, special],
      weeksClaimed: [...next.weeksClaimed, week].slice(-20),
    };
  }
  return { progress: next, reward: cfg.economy.dailyPuzzleReward, special };
}

// --- Kayıt ---------------------------------------------------------------------------------------

/** Kaydedilmiş JSON'u doğrular; bozuk alan varsayılana döner. */
export function parseProgress(raw: string | null | undefined, cfg: GameConfig): Progress {
  const d = defaultProgress(cfg);
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Progress>) : null;
    if (!v || typeof v !== 'object' || typeof v.unlocked !== 'number' || v.unlocked < 1) return d;
    const int = (x: unknown, def: number) =>
      typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : def;
    const strs = (x: unknown) =>
      Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];
    const boosters = { ...d.boosters };
    for (const k of BOOSTERS) boosters[k] = int(v.boosters?.[k], d.boosters[k]);
    const owned: Record<string, OwnedItem> = {};
    if (v.owned && typeof v.owned === 'object')
      for (const [k, o] of Object.entries(v.owned))
        if (o && Array.isArray(o.styles) && typeof o.selected === 'number')
          owned[k] = {
            styles: o.styles.filter((s) => typeof s === 'number'),
            selected: o.selected,
          };
    return {
      schemaVersion: 1,
      unlocked: Math.floor(v.unlocked),
      coins: int(v.coins, d.coins),
      boosters,
      introGifts: strs(v.introGifts) as Feature[],
      owned,
      activeShop: typeof v.activeShop === 'string' ? v.activeShop : d.activeShop,
      dailyGift:
        v.dailyGift && typeof v.dailyGift.day === 'number'
          ? {
              day: v.dailyGift.day,
              last: typeof v.dailyGift.last === 'string' ? v.dailyGift.last : null,
            }
          : d.dailyGift,
      dailyDone: strs(v.dailyDone),
      specials: strs(v.specials),
      weeksClaimed: strs(v.weeksClaimed),
      stuck:
        v.stuck && typeof v.stuck.level === 'number' && typeof v.stuck.count === 'number'
          ? v.stuck
          : d.stuck,
      freeHint: v.freeHint === true,
    };
  } catch {
    return d;
  }
}
