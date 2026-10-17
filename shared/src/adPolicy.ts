import type { AdsConfig } from './config';

/**
 * Interstitial sıklık kuralları (saf, test edilebilir). Uygulama da denge simülasyonu da bunu kullanır.
 *
 * Interstitial yalnızca seviye KAZANILDIKTAN sonra, ödül ekranı kapanırken sorulur:
 *  - ilk `interstitialMinLevel - 1` seviyede ve ilk oyun oturumunda asla,
 *  - son interstitial'dan beri en az `interstitialEveryLevels` seviye kazanılmış olmalı,
 *  - son interstitial'dan beri en az `interstitialMinIntervalSec` saniye geçmiş olmalı,
 *  - son `rewardedGraceSec` saniyede ödüllü reklam izlendiyse atlanır ("ödüllü izleyene ikram"),
 *  - son 1 saatte en fazla `interstitialMaxPerHour`.
 */

export interface AdCounters {
  /** Son interstitial'dan bu yana kazanılan seviye. */
  levelsSinceLast: number;
  /** Son interstitial zamanı (ms). */
  lastInterstitialAt: number | null;
  /** Son 1 saatteki interstitial zamanları (ms). */
  recentInterstitials: number[];
  /** Son ödüllü reklamın tamamlandığı zaman (ms). */
  lastRewardedAt: number | null;
  /** Kaçıncı oyun oturumu (ilk açılış = 1). */
  session: number;
}

export const DEFAULT_AD_COUNTERS: AdCounters = {
  levelsSinceLast: 0,
  lastInterstitialAt: null,
  recentInterstitials: [],
  lastRewardedAt: null,
  session: 1,
};

export type InterstitialDecision =
  | { show: true }
  | {
      show: false;
      reason:
        | 'early-level'
        | 'first-session'
        | 'level-gap'
        | 'cooldown'
        | 'rewarded-grace'
        | 'hourly-cap';
    };

const HOUR = 3600_000;

/** Kazanılan seviye sayacını ilerletir (her kazanışta, karar sorulmadan önce çağrılır). */
export function onLevelWon(c: AdCounters): AdCounters {
  return { ...c, levelsSinceLast: c.levelsSinceLast + 1 };
}

export function decideInterstitial(
  cfg: AdsConfig,
  c: AdCounters,
  levelNumber: number,
  now: number,
): InterstitialDecision {
  if (levelNumber < cfg.interstitialMinLevel) return { show: false, reason: 'early-level' };
  if (cfg.skipFirstSession && c.session <= 1) return { show: false, reason: 'first-session' };
  if (c.levelsSinceLast < cfg.interstitialEveryLevels) return { show: false, reason: 'level-gap' };
  if (
    c.lastInterstitialAt !== null &&
    now - c.lastInterstitialAt < cfg.interstitialMinIntervalSec * 1000
  )
    return { show: false, reason: 'cooldown' };
  if (c.lastRewardedAt !== null && now - c.lastRewardedAt < cfg.rewardedGraceSec * 1000)
    return { show: false, reason: 'rewarded-grace' };
  const lastHour = c.recentInterstitials.filter((t) => now - t < HOUR);
  if (lastHour.length >= cfg.interstitialMaxPerHour) return { show: false, reason: 'hourly-cap' };
  return { show: true };
}

/** Interstitial gerçekten gösterildi: sayaçlar sıfırlanır. */
export function onInterstitialShown(c: AdCounters, now: number): AdCounters {
  return {
    ...c,
    levelsSinceLast: 0,
    lastInterstitialAt: now,
    recentInterstitials: [...c.recentInterstitials.filter((t) => now - t < HOUR), now],
  };
}

/**
 * "Ödüllü izleyene ikram" ile atlanan interstitial: seviye sayacı sıfırlanır ki ikram bitince hemen
 * arka arkaya reklam gelmesin.
 */
export function onInterstitialSkipped(c: AdCounters): AdCounters {
  return { ...c, levelsSinceLast: 0 };
}

export function onRewardedWatched(c: AdCounters, now: number): AdCounters {
  return { ...c, lastRewardedAt: now };
}

export function onNewSession(c: AdCounters): AdCounters {
  return { ...c, session: c.session + 1 };
}

export function parseAdCounters(raw: unknown): AdCounters {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<AdCounters>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return {
    levelsSinceLast: Math.max(0, num(v.levelsSinceLast) ?? 0),
    lastInterstitialAt: num(v.lastInterstitialAt),
    recentInterstitials: Array.isArray(v.recentInterstitials)
      ? v.recentInterstitials.filter((t): t is number => typeof t === 'number').slice(-20)
      : [],
    lastRewardedAt: num(v.lastRewardedAt),
    session: Math.max(1, num(v.session) ?? 1),
  };
}
