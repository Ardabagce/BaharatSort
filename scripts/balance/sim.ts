import {
  BOOSTERS,
  claimDailyGift,
  completeDaily,
  completeLevel,
  createRng,
  createSession,
  decideInterstitial,
  DEFAULT_AD_COUNTERS,
  defaultProgress,
  doubleReward,
  giveIntroGift,
  isShopComplete,
  isStuck,
  itemKey,
  meaningfulMoves,
  nextAffordableTarget,
  onInterstitialShown,
  onInterstitialSkipped,
  onLevelWon,
  onNewSession,
  onRewardedWatched,
  payBooster,
  recordStuck,
  consumeFreeHint,
  sessionAddJar,
  sessionPour,
  sessionShuffle,
  sessionUndo,
  sessionWon,
  solve,
  stylePrice,
  useBooster,
  buyDecoration,
  buyStyle,
  addCoins,
  coinAdsLeft,
  noteCoinAd,
  type AdCounters,
  type BoosterKind,
  type GameConfig,
  type LevelDef,
  type Move,
  type Progress,
  type Rng,
  type Session,
} from '@baharat-sort/shared';
import type { Profile } from './profiles';

/**
 * 300 seviyelik denge simülasyonu. Oyuncu, çözücü tabanlı bir botla modellenir: her hamlede
 * çözücünün planını izler, `hata` olasılığıyla rastgele anlamlı bir döküm yapar. Hata, seviyenin
 * zorluğuyla artar. Hatadan sonra plan yeniden hesaplanır; çözüm kalmadıysa oyuncu kilitlenmiş sayılır.
 *
 * Kilitlenince sıra: geri al hakkı → boş kavanoz hakkı → karıştır hakkı → (reklam profili kabul
 * ederse) "son bir şans" ödüllü reklamı → akçesi yetiyorsa ve dekorasyon birikimini çok bozmuyorsa
 * akçeyle geri al → seviyeyi baştan dene. Aynı seviyede 3 kilitlenme ücretsiz ipucu açar.
 */

export interface SimOptions {
  /** Hamle başına temel hata olasılığı ve zorluk başına artış. */
  baseError: number;
  errorPerDifficulty: number;
  /** Süre modeli (saniye). */
  secPerMove: number;
  secPerAttempt: number;
  secPerLevelUi: number;
  secRewardedAd: number;
  secInterstitial: number;
  /** Oturum ve gün modeli. */
  sessionMinutes: number;
  sessionsPerDay: number;
  /** Günün bulmacasını bitirme olasılığı (her gün). */
  dailyPuzzleRate: number;
  /** Akçeyle güçlendirici alma eğilimi (kilitlenince, akçe yetiyorsa). */
  buyBoosterRate: number;
  /** Dekorasyon alırken elde bırakılan yedek (güçlendirici için). */
  reserve: number;
}

export const DEFAULT_SIM: SimOptions = {
  baseError: 0.03,
  errorPerDifficulty: 0.035,
  secPerMove: 2.4,
  secPerAttempt: 10,
  secPerLevelUi: 14,
  secRewardedAd: 30,
  secInterstitial: 15,
  sessionMinutes: 18,
  sessionsPerDay: 2,
  dailyPuzzleRate: 0.6,
  buyBoosterRate: 0.6,
  reserve: 60,
};

export type BoosterSource = 'charge' | 'coins' | 'ad';

export interface LevelRecord {
  n: number;
  kind: LevelDef['kind'];
  difficulty: number;
  attempts: number;
  stuck: number;
  earned: number;
  spent: number;
  coinsAfter: number;
  boosters: Record<BoosterSource, number>;
  boostersByKind: Record<BoosterKind, number>;
  rewardedAds: number;
  interstitials: number;
  decorations: number;
  seconds: number;
}

export interface PlayerResult {
  profile: Profile['id'];
  levels: LevelRecord[];
  /** Dükkân id → tamamlandığı seviye. */
  shopDone: Record<string, number>;
  /** Her dekorasyon parçasının alındığı seviye. */
  decorationLevels: number[];
  stylesBought: number;
  totalSeconds: number;
  rewardedAds: number;
  interstitials: number;
  maxCoins: number;
  levelsAbove1000: number;
}

const emptySources = (): Record<BoosterSource, number> => ({ charge: 0, coins: 0, ad: 0 });
const emptyKinds = (): Record<BoosterKind, number> => ({
  undo: 0,
  extraJar: 0,
  hint: 0,
  shuffle: 0,
});

function dateOf(day: number): string {
  return new Date(Date.UTC(2026, 9, 1) + day * 86_400_000).toISOString().slice(0, 10);
}

export function simulatePlayer(
  levels: readonly LevelDef[],
  cfg: GameConfig,
  profile: Profile,
  seed: string,
  opt: SimOptions = DEFAULT_SIM,
): PlayerResult {
  const rng = createRng(`balance:${profile.id}:${seed}`);
  let p: Progress = defaultProgress(cfg);
  let ads: AdCounters = { ...DEFAULT_AD_COUNTERS };
  let clock = 0; // saniye, oyun içi toplam süre
  let sessionStart = 0;
  let day = 0;
  let sessionsToday = 1;
  const records: LevelRecord[] = [];
  const shopDone: Record<string, number> = {};
  const decorationLevels: number[] = [];
  let stylesBought = 0;
  let rewardedTotal = 0;
  let interTotal = 0;
  let maxCoins = p.coins;
  let above1000 = 0;
  const watches = () => rng() < profile.adRate;

  const startDay = () => {
    const today = dateOf(day);
    const g = claimDailyGift(p, cfg, today);
    if (g) {
      p = g.progress;
      if (watches()) {
        p = addCoins(p, g.reward);
        rewardedTotal++;
        clock += opt.secRewardedAd;
        ads = onRewardedWatched(ads, clock * 1000);
      }
    }
    if (rng() < opt.dailyPuzzleRate) {
      p = completeDaily(p, cfg, today).progress;
      clock += 180;
    }
  };
  startDay();

  for (const level of levels) {
    const rec: LevelRecord = {
      n: level.n,
      kind: level.kind,
      difficulty: level.stats.difficulty,
      attempts: 0,
      stuck: 0,
      earned: 0,
      spent: 0,
      coinsAfter: 0,
      boosters: emptySources(),
      boostersByKind: emptyKinds(),
      rewardedAds: 0,
      interstitials: 0,
      decorations: 0,
      seconds: 0,
    };
    const coinsBefore = p.coins;
    let spentHere = 0;
    const t0 = clock;

    // Oturum / gün geçişi
    if (clock - sessionStart > opt.sessionMinutes * 60) {
      sessionStart = clock;
      ads = onNewSession(ads);
      sessionsToday++;
      if (sessionsToday > opt.sessionsPerDay) {
        day++;
        sessionsToday = 1;
        startDay();
      }
    }

    if (level.introduces) {
      const g = giveIntroGift(p, cfg, level.introduces);
      if (g) p = g.progress;
    }

    const err = Math.min(0.35, opt.baseError + opt.errorPerDifficulty * level.stats.difficulty);
    let won = false;
    let usedUndo = false;
    while (!won && rec.attempts < 30) {
      rec.attempts++;
      clock += opt.secPerAttempt;
      let s: Session = createSession(level);
      let plan: Move[] = solvePlan(s) ?? [];
      let freeHint = p.freeHint;
      if (freeHint) p = consumeFreeHint(p);
      let guard = 0;
      while (guard++ < 400) {
        if (sessionWon(s)) {
          won = true;
          break;
        }
        // Hamle: plan ya da hata (ücretsiz ipucu varsa ilk hamle kesin doğru).
        let move: Move | undefined = plan[0];
        const mistake = !freeHint && rng() < err;
        freeHint = false;
        if (mistake || !move) {
          const options = meaningfulMoves(s.state).filter(
            (m) => !move || m.from !== move.from || m.to !== move.to,
          );
          move = options.length ? options[Math.floor(rng() * options.length)] : move;
        }
        if (!move) break;
        const r = sessionPour(s, move.from, move.to);
        clock += opt.secPerMove;
        if (!r.result.ok) break;
        s = r.session;
        if (move === plan[0] && !mistake) plan = plan.slice(1);
        else plan = solvePlan(s) ?? [];
        if (sessionWon(s)) {
          won = true;
          break;
        }
        const doomed = plan.length === 0;
        if (!doomed && !isStuck(s.state, 300)) continue;

        // Kilitlendi (ya da çözümsüz bir duruma düştü).
        rec.stuck++;
        p = recordStuck(p, cfg, level.n);
        const rescued = rescue(s, rec);
        if (rescued) {
          s = rescued.session;
          if (rescued.kind === 'undo') usedUndo = true;
          plan = solvePlan(s) ?? [];
          if (plan.length > 0) continue;
        }
        break; // baştan dene
      }
    }

    function rescue(s: Session, r: LevelRecord): { session: Session; kind: BoosterKind } | null {
      const apply = (k: BoosterKind): Session | null => {
        if (k === 'undo') return s.history.length ? sessionUndo(s, cfg.economy.undoSteps) : null;
        if (k === 'extraJar') return sessionAddJar(s);
        if (k === 'shuffle') return sessionShuffle(s);
        return null;
      };
      // 1) Hak varsa
      for (const k of ['undo', 'extraJar', 'shuffle'] as const) {
        if (p.boosters[k] <= 0) continue;
        const next = apply(k);
        if (!next) continue;
        p = useBooster(p, k)!;
        r.boosters.charge++;
        r.boostersByKind[k]++;
        return { session: next, kind: k };
      }
      // 2) Son bir şans: ödüllü reklam → +1 boş kavanoz
      if (watches()) {
        r.rewardedAds++;
        clock += opt.secRewardedAd;
        ads = onRewardedWatched(ads, clock * 1000);
        r.boosters.ad++;
        r.boostersByKind.extraJar++;
        return { session: sessionAddJar(s), kind: 'extraJar' };
      }
      // 3) Akçeyle geri al (eğilim + akçe yetiyorsa)
      if (s.history.length && rng() < opt.buyBoosterRate) {
        const paid = payBooster(p, cfg, 'undo');
        if (paid) {
          spentHere += cfg.economy.boosterPrice.undo;
          p = paid;
          r.boosters.coins++;
          r.boostersByKind.undo++;
          return { session: sessionUndo(s, cfg.economy.undoSteps), kind: 'undo' };
        }
      }
      return null;
    }

    // Kazanç
    const res = completeLevel(p, cfg, level.n, level.kind, usedUndo);
    p = res.progress;
    clock += opt.secPerLevelUi;
    if (res.base > 0 && coinAdsLeft(p, cfg, dateOf(day)) > 0 && watches()) {
      p = noteCoinAd(doubleReward(p, cfg, res.base), dateOf(day));
      rec.rewardedAds++;
      clock += opt.secRewardedAd;
      ads = onRewardedWatched(ads, clock * 1000);
    }
    // Interstitial (ödül ekranı kapanırken)
    ads = onLevelWon(ads);
    const d = decideInterstitial(cfg.ads, ads, level.n, clock * 1000);
    if (d.show) {
      ads = onInterstitialShown(ads, clock * 1000);
      rec.interstitials++;
      clock += opt.secInterstitial;
    } else if (d.reason === 'rewarded-grace') ads = onInterstitialSkipped(ads);

    // Harcama: en ucuz eksik parça; yetmiyorsa ve eksik küçükse reklamla tamamla.
    for (let k = 0; k < 4; k++) {
      const target = nextAffordableTarget(p, cfg);
      if (!target) {
        // Tüm parçalar alındı: ek stiller.
        const style = nextStyle(p, cfg);
        if (style && p.coins >= style.price) {
          p = buyStyle(p, cfg, style.shop, style.item, style.style)!;
          spentHere += style.price;
          stylesBought++;
          continue;
        }
        break;
      }
      // Yedek yalnızca güçlendirici hakları bittiyse tutulur.
      const reserve = BOOSTERS.some((b) => p.boosters[b] > 0) ? 0 : opt.reserve;
      let short = target.price + reserve - p.coins;
      if (
        short > 0 &&
        short < cfg.economy.topUpAdMax &&
        coinAdsLeft(p, cfg, dateOf(day)) > 0 &&
        watches()
      ) {
        p = noteCoinAd(addCoins(p, short), dateOf(day));
        rec.rewardedAds++;
        clock += opt.secRewardedAd;
        ads = onRewardedWatched(ads, clock * 1000);
        short = 0;
      }
      if (short > 0) break;
      const next = buyDecoration(p, cfg, target.shop, target.item);
      if (!next) break;
      p = next;
      spentHere += target.price;
      rec.decorations++;
      decorationLevels.push(level.n);
      if (isShopComplete(p, cfg, target.shop) && shopDone[target.shop] === undefined)
        shopDone[target.shop] = level.n;
    }

    rec.spent = spentHere;
    rec.earned = p.coins - coinsBefore + spentHere;
    rec.coinsAfter = p.coins;
    rec.seconds = clock - t0;
    rewardedTotal += rec.rewardedAds;
    interTotal += rec.interstitials;
    maxCoins = Math.max(maxCoins, p.coins);
    if (p.coins >= 1000) above1000++;
    records.push(rec);
  }

  return {
    profile: profile.id,
    levels: records,
    shopDone,
    decorationLevels,
    stylesBought,
    totalSeconds: clock,
    rewardedAds: rewardedTotal,
    interstitials: interTotal,
    maxCoins,
    levelsAbove1000: above1000,
  };
}

function solvePlan(s: Session): Move[] | null {
  const r = solve(s.state, { maxNodes: 25_000, weight: 2.5 });
  return r.solved ? r.moves : null;
}

function nextStyle(p: Progress, cfg: GameConfig) {
  for (const shop of cfg.economy.shops)
    for (const it of shop.items) {
      const owned = p.owned[itemKey(shop.id, it.id)];
      if (!owned) continue;
      for (let st = 0; st < it.styles; st++)
        if (!owned.styles.includes(st))
          return { shop: shop.id, item: it.id, style: st, price: stylePrice(cfg, shop.id, it.id)! };
    }
  return null;
}

export { BOOSTERS };
export type { Rng };
