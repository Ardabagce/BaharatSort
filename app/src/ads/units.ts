/** Google'ın herkese açık iOS test birimleri (react-native-google-mobile-ads TestIds ile aynı). */
export const TEST_UNITS = {
  banner: 'ca-app-pub-3940256099942544/2435281174',
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
} as const;

export type AdUnits = { [K in keyof typeof TEST_UNITS]: string };

/**
 * Reklam birimlerini seçer. Geliştirmede (ya da birim hiç verilmemişse) her zaman Google test
 * birimleri kullanılır; gerçek birimler yalnızca derleme zamanında ortam değişkeniyle gelir.
 */
export function resolveAdUnits(configured: unknown, useTestUnits: boolean): AdUnits {
  const c = (configured && typeof configured === 'object' ? configured : {}) as Record<
    string,
    unknown
  >;
  const pick = (k: keyof AdUnits) => {
    const v = c[k];
    return !useTestUnits && typeof v === 'string' && v.startsWith('ca-app-pub-')
      ? v
      : TEST_UNITS[k];
  };
  return { banner: pick('banner'), interstitial: pick('interstitial'), rewarded: pick('rewarded') };
}
