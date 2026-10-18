import Constants from 'expo-constants';
import {
  PermissionStatus,
  getTrackingPermissionsAsync,
  isAvailable as trackingAvailable,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';
import { resolveAdUnits } from './units';

/**
 * Gerçek reklamlar (AdMob). Sıra VapurJam'deki gibi:
 * 1) ATT izni, uygulama ekrandayken ve reklam SDK'sı başlamadan önce istenir,
 * 2) SDK "G" içerik sınırıyla başlatılır, 3) UMP onay formu gerekiyorsa gösterilir (AB/İngiltere/İsviçre),
 * 4) ancak izin varsa reklam yüklenir.
 */

const units = resolveAdUnits(Constants.expoConfig?.extra?.ads, __DEV__);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, sleep(ms).then(() => fallback)]);

function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      sub.remove();
      resolve();
    });
  });
}

async function requestTracking(): Promise<void> {
  if (Platform.OS !== 'ios' || !trackingAvailable()) return;
  const ask = async () => {
    try {
      let p = await getTrackingPermissionsAsync();
      if (p.status === PermissionStatus.UNDETERMINED) p = await requestTrackingPermissionsAsync();
      return p.status !== PermissionStatus.UNDETERMINED;
    } catch {
      return true;
    }
  };
  // iOS, uygulama tam etkin olmadan gelen isteği sessizce yok sayar: kısa bekle, gerekirse bir kez daha dene.
  await whenActive();
  await sleep(900);
  if (await ask()) return;
  await sleep(2000);
  await whenActive();
  await ask();
}

type AnyEvent = { type: string };
type FullScreenAd = InterstitialAd | RewardedAd;
const onEvents = (ad: FullScreenAd, cb: (e: AnyEvent) => void): (() => void) =>
  (
    ad as unknown as { addAdEventsListener(l: (e: AnyEvent) => void): () => void }
  ).addAdEventsListener(cb);

/** Tek bir tam ekran reklam yuvası: bir reklamı önceden yükler, gösterir, kapanınca yenisini yükler. */
class FullScreenSlot {
  private ad: FullScreenAd | null = null;
  private pending: Promise<boolean> | null = null;

  constructor(
    private readonly kind: 'interstitial' | 'rewarded',
    private readonly unit: string,
  ) {}

  preload(): Promise<boolean> {
    if (this.ad?.loaded) return Promise.resolve(true);
    if (this.pending) return this.pending;
    this.ad?.destroy();
    const ad =
      this.kind === 'rewarded'
        ? RewardedAd.createForAdRequest(this.unit)
        : InterstitialAd.createForAdRequest(this.unit);
    const loaded = this.kind === 'rewarded' ? RewardedAdEventType.LOADED : AdEventType.LOADED;
    this.ad = ad;
    this.pending = new Promise<boolean>((resolve) => {
      const off = onEvents(ad, ({ type }) => {
        if (type === loaded) {
          off();
          resolve(true);
        } else if (type === AdEventType.ERROR) {
          off();
          resolve(false);
        }
      });
      ad.load();
    }).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  async show(waitMs: number): Promise<{ shown: boolean; rewarded: boolean }> {
    const ready = await withTimeout(this.preload(), waitMs, false);
    const ad = this.ad;
    if (!ready || !ad?.loaded) return { shown: false, rewarded: false };
    this.ad = null;
    const result = await new Promise<{ shown: boolean; rewarded: boolean }>((resolve) => {
      let rewarded = false;
      const off = onEvents(ad, ({ type }) => {
        if (type === RewardedAdEventType.EARNED_REWARD) rewarded = true;
        else if (type === AdEventType.CLOSED) {
          off();
          resolve({ shown: true, rewarded });
        } else if (type === AdEventType.ERROR) {
          off();
          resolve({ shown: false, rewarded: false });
        }
      });
      ad.show().catch(() => {
        off();
        resolve({ shown: false, rewarded: false });
      });
    });
    ad.destroy();
    void this.preload();
    return result;
  }
}

export interface AdState {
  canRequestAds: boolean;
  privacyOptions: boolean;
}

/** Uygulama boyunca tek reklam denetleyicisi. */
export class AdController {
  private canRequest = false;
  private readonly interstitial = new FullScreenSlot('interstitial', units.interstitial);
  private readonly rewarded = new FullScreenSlot('rewarded', units.rewarded);

  constructor(private readonly onState: (s: AdState) => void) {}

  async start(): Promise<void> {
    await requestTracking();
    try {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      await mobileAds().initialize();
    } catch {
      // SDK başlatılamadı; reklamsız devam edilir.
    }
    let allowed: boolean;
    let privacyOptions = false;
    try {
      const info = await AdsConsent.gatherConsent();
      allowed = info.canRequestAds;
      privacyOptions =
        info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
    } catch {
      // Onay hizmetine ulaşılamadı: önceki oturumdaki onay geçerliyse onu kullan.
      allowed = await AdsConsent.getConsentInfo()
        .then((i) => i.canRequestAds)
        .catch(() => false);
    }
    this.canRequest = allowed;
    this.onState({ canRequestAds: allowed, privacyOptions });
    if (allowed) {
      void this.rewarded.preload();
      void this.interstitial.preload();
    }
  }

  /** Ödüllü: hazır değilse 8 sn beklenir. */
  showRewarded() {
    if (!this.canRequest) return Promise.resolve({ shown: false, rewarded: false });
    return this.rewarded.show(8000);
  }

  /** Geçiş: hazır değilse oyuncu bekletilmez, bir sonraki sefere yüklenir. */
  showInterstitial() {
    if (!this.canRequest) return Promise.resolve({ shown: false, rewarded: false });
    return this.interstitial.show(0);
  }

  async showPrivacyOptions(): Promise<void> {
    try {
      const info = await AdsConsent.showPrivacyOptionsForm();
      this.canRequest = info.canRequestAds;
      this.onState({ canRequestAds: info.canRequestAds, privacyOptions: true });
    } catch {
      // form açılamadı
    }
  }
}

/** Ana ekranın (dükkân) altındaki banner. Oyun ekranında asla gösterilmez. */
export function NativeBanner() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={styles.banner}>
      <BannerAd
        unitId={units.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { alignSelf: 'stretch', alignItems: 'center' },
});
