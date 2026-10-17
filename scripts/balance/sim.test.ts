import { DEFAULT_CONFIG } from '@baharat-sort/shared';
import { BUILTIN_LEVELS } from '@baharat-sort/shared/levels';
import { describe, expect, it } from 'vitest';
import { PROFILES } from './profiles';
import { simulatePlayer } from './sim';

const first = BUILTIN_LEVELS.slice(0, 40);

describe('denge simülasyonu', () => {
  it('deterministik', () => {
    const a = simulatePlayer(first, DEFAULT_CONFIG, PROFILES[1]!, 'x');
    const b = simulatePlayer(first, DEFAULT_CONFIG, PROFILES[1]!, 'x');
    expect(a).toEqual(b);
  });

  it('reklamsız oyuncu hiç reklam izlemez, interstitial kurallara uyar', () => {
    const r = simulatePlayer(first, DEFAULT_CONFIG, PROFILES[0]!, 'y');
    expect(r.rewardedAds).toBe(0);
    // İlk 8 seviyede interstitial yok.
    expect(r.levels.slice(0, 8).every((l) => l.interstitials === 0)).toBe(true);
    expect(r.interstitials).toBeLessThanOrEqual(
      DEFAULT_CONFIG.ads.interstitialMaxPerHour * Math.ceil(r.totalSeconds / 3600),
    );
  });

  it('altın bakiyesi hiç negatife düşmez, her seviye biter', () => {
    const r = simulatePlayer(first, DEFAULT_CONFIG, PROFILES[2]!, 'z');
    expect(r.levels).toHaveLength(40);
    expect(r.levels.every((l) => l.coinsAfter >= 0)).toBe(true);
  });
});
