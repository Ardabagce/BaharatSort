import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AD_COUNTERS,
  decideInterstitial,
  onInterstitialShown,
  onInterstitialSkipped,
  onLevelWon,
  onNewSession,
  onRewardedWatched,
  parseAdCounters,
  type AdCounters,
} from './adPolicy';
import { DEFAULT_CONFIG } from './config';

const cfg = DEFAULT_CONFIG.ads;
const MIN = 60_000;
/** İkinci oturum, 3 seviye kazanılmış, hiç reklam yok: kurala takılmayan taban durum. */
const ready: AdCounters = { ...DEFAULT_AD_COUNTERS, session: 2, levelsSinceLast: 3 };
const T0 = 10 * 3600_000;

describe('interstitial kuralları', () => {
  it('ilk 8 seviyede asla', () => {
    for (let n = 1; n <= 8; n++)
      expect(decideInterstitial(cfg, ready, n, T0)).toEqual({ show: false, reason: 'early-level' });
    expect(decideInterstitial(cfg, ready, 9, T0)).toEqual({ show: true });
  });

  it('ilk oyun oturumunda asla', () => {
    const first = { ...ready, session: 1 };
    expect(decideInterstitial(cfg, first, 30, T0)).toEqual({
      show: false,
      reason: 'first-session',
    });
    expect(decideInterstitial(cfg, onNewSession(first), 30, T0).show).toBe(true);
  });

  it('en fazla her 3 seviyede bir', () => {
    let c: AdCounters = { ...ready, levelsSinceLast: 0 };
    const shown: number[] = [];
    let now = T0;
    for (let n = 20; n < 32; n++) {
      now += 10 * MIN; // süre kuralı devreye girmesin
      c = onLevelWon(c);
      if (decideInterstitial(cfg, c, n, now).show) {
        shown.push(n);
        c = onInterstitialShown(c, now);
      }
    }
    expect(shown).toEqual([22, 25, 28, 31]);
  });

  it('iki interstitial arasında en az 120 saniye', () => {
    const c = onInterstitialShown(ready, T0);
    const again = { ...c, levelsSinceLast: 3 };
    expect(decideInterstitial(cfg, again, 30, T0 + 119_000)).toEqual({
      show: false,
      reason: 'cooldown',
    });
    expect(decideInterstitial(cfg, again, 30, T0 + 120_000).show).toBe(true);
  });

  it('son 3 dakikada ödüllü reklam izlendiyse atlar', () => {
    const c = onRewardedWatched(ready, T0);
    expect(decideInterstitial(cfg, c, 30, T0 + 179_000)).toEqual({
      show: false,
      reason: 'rewarded-grace',
    });
    expect(decideInterstitial(cfg, c, 30, T0 + 180_000).show).toBe(true);
  });

  it('atlanan interstitial seviye sayacını sıfırlar', () => {
    expect(onInterstitialSkipped(ready).levelsSinceLast).toBe(0);
  });

  it('saatte en fazla 6', () => {
    // Kuralı tek başına sınamak için aralık kuralını kapat.
    const loose = { ...cfg, interstitialMinIntervalSec: 0, interstitialEveryLevels: 1 };
    let c: AdCounters = { ...ready };
    let count = 0;
    for (let i = 0; i < 20; i++) {
      const now = T0 + i * 2 * MIN; // 40 dakikada 20 deneme
      c = onLevelWon(c);
      if (decideInterstitial(loose, c, 50, now).show) {
        c = onInterstitialShown(c, now);
        count++;
      }
    }
    expect(count).toBe(6);
    // Bir saat sonra yeniden açılır.
    const later = T0 + 61 * MIN + 20 * 2 * MIN;
    expect(decideInterstitial(loose, { ...c, levelsSinceLast: 5 }, 50, later).show).toBe(true);
  });

  it('gerçekçi oturum: 120 sn ve 3 seviye kuralları birlikte saatlik sınırı aşmaz', () => {
    let c: AdCounters = { ...ready, levelsSinceLast: 0 };
    let shown = 0;
    // Her seviye 40 saniye: saatte 90 seviye.
    for (let i = 0; i < 90; i++) {
      const now = T0 + i * 40_000;
      c = onLevelWon(c);
      if (decideInterstitial(cfg, c, 100 + i, now).show) {
        c = onInterstitialShown(c, now);
        shown++;
      }
    }
    expect(shown).toBeLessThanOrEqual(6);
  });

  it('bozuk kayıtları güvenle okur', () => {
    expect(parseAdCounters(null)).toEqual(DEFAULT_AD_COUNTERS);
    expect(parseAdCounters({ levelsSinceLast: 'x', session: 0 }).session).toBe(1);
  });
});
