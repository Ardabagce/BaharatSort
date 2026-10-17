import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, mergeConfig } from './config';
import {
  buyDecoration,
  buyStyle,
  claimDailyGift,
  coinAdsLeft,
  noteCoinAd,
  completeDaily,
  completeLevel,
  defaultProgress,
  doubleReward,
  giveIntroGift,
  isShopUnlocked,
  isoWeek,
  itemKey,
  nextGiftDay,
  parseProgress,
  payBooster,
  recordStuck,
  topUpShortfall,
  useBooster,
  type Progress,
} from './economy';

const cfg = DEFAULT_CONFIG;
const fresh = () => defaultProgress(cfg);

describe('seviye ödülleri', () => {
  it('normal 10, zor 25, çok zor 60; geri almasız +5', () => {
    expect(completeLevel(fresh(), cfg, 1, 'normal', false).progress.coins).toBe(50 + 15);
    expect(completeLevel(fresh(), cfg, 1, 'hard', true).progress.coins).toBe(50 + 25);
    expect(completeLevel(fresh(), cfg, 1, 'veryHard', false).progress.coins).toBe(50 + 65);
  });

  it('tekrar oynanan seviye ödül vermez, kilidi geri almaz', () => {
    const p = completeLevel({ ...fresh(), unlocked: 5 }, cfg, 2, 'normal', false);
    expect(p.first).toBe(false);
    expect(p.progress.coins).toBe(50);
    expect(p.progress.unlocked).toBe(5);
  });

  it('2x reklamı taban ödülü bir kez daha verir (bonus hariç)', () => {
    const r = completeLevel(fresh(), cfg, 1, 'hard', false);
    expect(doubleReward(r.progress, cfg, r.base).coins).toBe(50 + 25 + 5 + 25);
  });
});

describe('güçlendiriciler', () => {
  it('başlangıçta her birinden config kadar hak', () => {
    expect(fresh().boosters).toEqual(cfg.economy.startBoosters);
  });

  it('hak bitince null, altınla ödeme fiyatı düşer', () => {
    let p: Progress = { ...fresh(), boosters: { undo: 0, extraJar: 1, hint: 0, shuffle: 0 } };
    expect(useBooster(p, 'undo')).toBeNull();
    p = useBooster(p, 'extraJar')!;
    expect(p.boosters.extraJar).toBe(0);
    expect(payBooster({ ...p, coins: 100 }, cfg, 'extraJar')!.coins).toBe(20);
    expect(payBooster({ ...p, coins: 79 }, cfg, 'extraJar')).toBeNull();
  });

  it('yeni öğe hediyesi yalnızca bir kez', () => {
    const r = giveIntroGift(fresh(), cfg, 'hidden')!;
    expect(r.progress.boosters.hint).toBe(
      cfg.economy.startBoosters.hint + (cfg.economy.introGift.hidden?.hint ?? 0),
    );
    expect(giveIntroGift(r.progress, cfg, 'hidden')).toBeNull();
  });

  it('aynı seviyede 3 kilitlenmeden sonra ücretsiz ipucu', () => {
    let p = fresh();
    p = recordStuck(p, cfg, 12);
    p = recordStuck(p, cfg, 12);
    expect(p.freeHint).toBe(false);
    p = recordStuck(p, cfg, 12);
    expect(p.freeHint).toBe(true);
    // Başka seviyede sayaç baştan başlar.
    expect(recordStuck(fresh(), cfg, 13).stuck.count).toBe(1);
  });
});

describe('altın reklamı sınırı', () => {
  it('günde en fazla coinAdsPerDay, ertesi gün sıfırlanır', () => {
    let p = fresh();
    const cap = cfg.economy.coinAdsPerDay;
    for (let i = 0; i < cap; i++) p = noteCoinAd(p, '2026-10-17');
    expect(coinAdsLeft(p, cfg, '2026-10-17')).toBe(0);
    expect(coinAdsLeft(p, cfg, '2026-10-18')).toBe(cap);
  });
});

describe('günlük hediye', () => {
  it('art arda girişte artar, 7 günde döner, en fazla 50', () => {
    let p = fresh();
    const days = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ];
    const got: number[] = [];
    for (const d of days) {
      const r = claimDailyGift(p, cfg, d)!;
      got.push(r.reward);
      p = r.progress;
    }
    expect(got).toEqual([10, 15, 20, 25, 30, 40, 50, 10]);
    expect(Math.max(...cfg.economy.dailyGift)).toBeLessThanOrEqual(50);
  });

  it('aynı gün ikinci kez alınmaz, gün kaçarsa başa döner', () => {
    const p = claimDailyGift(fresh(), cfg, '2026-10-01')!.progress;
    expect(claimDailyGift(p, cfg, '2026-10-01')).toBeNull();
    const p2 = claimDailyGift(p, cfg, '2026-10-02')!.progress;
    expect(nextGiftDay(p2, cfg, '2026-10-04')).toBe(1);
  });
});

describe('dekorasyon', () => {
  it('parça alınır, ikinci kez alınmaz; ek stil parça fiyatı × oran', () => {
    let p: Progress = { ...fresh(), coins: 200 };
    p = buyDecoration(p, cfg, 'misir', 'sign')!;
    expect(p.coins).toBe(200 - 45);
    expect(buyDecoration(p, cfg, 'misir', 'sign')).toBeNull();
    p = buyStyle(p, cfg, 'misir', 'sign', 2)!;
    expect(p.coins).toBe(200 - 45 - Math.round(45 * cfg.economy.extraStyleRatio));
    expect(p.owned[itemKey('misir', 'sign')]).toEqual({ styles: [0, 2], selected: 2 });
  });

  it('sonraki dükkân, öncekinin tüm parçaları alınınca açılır', () => {
    let p: Progress = { ...fresh(), coins: 10_000 };
    expect(isShopUnlocked(p, cfg, 'kapali')).toBe(false);
    for (const it of cfg.economy.shops[0]!.items) p = buyDecoration(p, cfg, 'misir', it.id)!;
    expect(isShopUnlocked(p, cfg, 'kapali')).toBe(true);
    expect(p.activeShop).toBe('kapali');
  });

  it('eksik altın 30dan azsa reklamla tamamlama teklif edilir', () => {
    const p = { ...fresh(), coins: 40 };
    expect(topUpShortfall(p, cfg, 60)).toBe(20);
    expect(topUpShortfall(p, cfg, 80)).toBeNull();
    expect(topUpShortfall(p, cfg, 30)).toBeNull();
  });
});

describe('günün bulmacası', () => {
  it('40 altın, aynı gün bir kez; haftada 7 olunca özel parça', () => {
    let p = fresh();
    const week = [
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ];
    expect(new Set(week.map(isoWeek)).size).toBe(1);
    let special: string | null = null;
    for (const d of week) {
      const r = completeDaily(p, cfg, d);
      expect(r.reward).toBe(40);
      special ??= r.special;
      p = r.progress;
    }
    expect(special).toBe('samovar');
    expect(completeDaily(p, cfg, '2026-10-18').reward).toBe(0);
  });

  it('ISO hafta', () => {
    expect(isoWeek('2026-10-17')).toBe('2026-W42');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
  });
});

describe('kayıt / yükleme', () => {
  it('kaydedilip yeniden açılınca ilerleme aynen geri gelir', () => {
    let p = fresh();
    p = completeLevel(p, cfg, 1, 'normal', false).progress;
    p = completeLevel(p, cfg, 2, 'normal', true).progress;
    p = buyDecoration(p, cfg, 'misir', 'sign')!;
    p = claimDailyGift(p, cfg, '2026-10-17')!.progress;
    p = useBooster(p, 'hint')!;
    p = recordStuck(p, cfg, 3);
    const saved = JSON.stringify(p);
    // "Uygulama kapatılıp açıldı":
    const loaded = parseProgress(saved, cfg);
    expect(loaded).toEqual(p);
  });

  it('bozuk ya da eksik kayıt varsayılana döner, sağlam alanlar korunur', () => {
    expect(parseProgress(null, cfg)).toEqual(fresh());
    expect(parseProgress('{bozuk', cfg)).toEqual(fresh());
    const partial = parseProgress(
      JSON.stringify({ unlocked: 7, coins: -5, boosters: { hint: 9 } }),
      cfg,
    );
    expect(partial.unlocked).toBe(7);
    expect(partial.coins).toBe(cfg.economy.startCoins);
    expect(partial.boosters.hint).toBe(9);
    expect(partial.boosters.undo).toBe(cfg.economy.startBoosters.undo);
  });
});

describe('uzak ayar', () => {
  it('eksik alanlar varsayılanı korur, bozuk tipler atılır', () => {
    const c = mergeConfig({ economy: { boosterPrice: { hint: 55, undo: 'x' } }, junk: 1 });
    expect(c.economy.boosterPrice.hint).toBe(55);
    expect(c.economy.boosterPrice.undo).toBe(30);
    expect(c.economy.levelReward.normal).toBe(10);
  });

  it('reklam kurallarını gevşetemez, sıkılaştırabilir', () => {
    const loose = mergeConfig({
      ads: { interstitialMinLevel: 2, interstitialMaxPerHour: 20, interstitialMinIntervalSec: 10 },
    });
    expect(loose.ads.interstitialMinLevel).toBe(9);
    expect(loose.ads.interstitialMaxPerHour).toBe(6);
    expect(loose.ads.interstitialMinIntervalSec).toBe(120);
    const strict = mergeConfig({ ads: { interstitialMaxPerHour: 3, interstitialEveryLevels: 5 } });
    expect(strict.ads.interstitialMaxPerHour).toBe(3);
    expect(strict.ads.interstitialEveryLevels).toBe(5);
  });
});
