import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json'u derleme zamanı ayarlarıyla tamamlar. Hiçbiri gizli değildir.
 *   IOS_BUILD_NUMBER            CI'da 100 + run_number (VapurJam ile aynı)
 *   ADMOB_IOS_*                 (isteğe bağlı) aşağıdaki AdMob kimliklerini değiştirir
 */

// Baharat Sort'un AdMob kimlikleri (Arda, 18 Ekim 2026). Sır değildir: derlenen uygulamanın içinde açıkça durur.
// Geliştirme derlemesinde (__DEV__) uygulama yine Google test birimlerini kullanır.
const ADMOB = {
  appId: 'ca-app-pub-7675764460364294~4838674880',
  banner: 'ca-app-pub-7675764460364294/9268874482',
  interstitial: 'ca-app-pub-7675764460364294/8948390410',
  rewarded: 'ca-app-pub-7675764460364294/4406510175',
};

// Google'ın herkese açık test uygulama kimliği (Android derlemesi yok; eklenti yine de ister).
const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

// Google'ın önerdiği SKAdNetwork listesi (VapurJam ile aynı).
const SK_AD_NETWORK_ITEMS = [
  'cstr6suwn9.skadnetwork',
  '4fzdc2evr5.skadnetwork',
  '2fnua5tdw4.skadnetwork',
  'ydx93a7ass.skadnetwork',
  'p78axxw29g.skadnetwork',
  'v72qych5uu.skadnetwork',
  'ludvb6z3bs.skadnetwork',
  'cp8zw746q7.skadnetwork',
  '3sh42y64q3.skadnetwork',
  'c6k4g5qg8m.skadnetwork',
  's39g8k73mm.skadnetwork',
  '3qy4746246.skadnetwork',
  'hs6bdukanm.skadnetwork',
  'mlmmfzh3r3.skadnetwork',
  'v4nxqhlyqp.skadnetwork',
  'wzmmz9fp6w.skadnetwork',
  'su67r6k2v3.skadnetwork',
  'yclnxrl5pm.skadnetwork',
  '7ug5zh24hu.skadnetwork',
  'gta9lk7p23.skadnetwork',
  'vutu7akeur.skadnetwork',
  'y5ghdn5j9k.skadnetwork',
  'v9wttpbfk9.skadnetwork',
  'n38lu8286q.skadnetwork',
  '47vhws6wlr.skadnetwork',
  'kbd757ywx3.skadnetwork',
  '9t245vhmpl.skadnetwork',
  'a2p9lx4jpn.skadnetwork',
  '22mmun2rn5.skadnetwork',
  '44jx6755aq.skadnetwork',
  'k674qkevps.skadnetwork',
  '4468km3ulz.skadnetwork',
  '2u9pt9hc89.skadnetwork',
  '8s468mfl3y.skadnetwork',
  'ppxm28t8ap.skadnetwork',
  'uw77j35x4d.skadnetwork',
  'pwa73g5rt2.skadnetwork',
  '578prtvx9j.skadnetwork',
  '4dzt52r2t5.skadnetwork',
  'tl55sbb4fm.skadnetwork',
  'e5fvkxwrpn.skadnetwork',
  '8c4e2ghe7u.skadnetwork',
  '3rd42ekr43.skadnetwork',
  '3qcr597p9d.skadnetwork',
];

const TRACKING_TEXT =
  'Your data is used to show you more relevant ads and keep Baharat Sort free. / ' +
  "Verilerin, sana daha uygun reklamlar göstermek ve Baharat Sort'u ücretsiz tutmak için kullanılır.";

const env = (k: string) => process.env[k]?.trim() || undefined;

export default ({ config }: ConfigContext): ExpoConfig => {
  const buildNumber = env('IOS_BUILD_NUMBER');
  return {
    ...config,
    name: config.name ?? 'Baharat Sort',
    slug: config.slug ?? 'baharat-sort',
    ios: { ...config.ios, ...(buildNumber ? { buildNumber } : {}) },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-tracking-transparency', { userTrackingPermission: TRACKING_TEXT }],
      [
        'react-native-google-mobile-ads',
        {
          iosAppId: env('ADMOB_IOS_APP_ID') ?? ADMOB.appId,
          androidAppId: TEST_ANDROID_APP_ID,
          skAdNetworkItems: SK_AD_NETWORK_ITEMS,
          userTrackingUsageDescription: TRACKING_TEXT,
        },
      ],
    ],
    extra: {
      ...config.extra,
      ads: {
        banner: env('ADMOB_IOS_BANNER_ID') ?? ADMOB.banner,
        interstitial: env('ADMOB_IOS_INTERSTITIAL_ID') ?? ADMOB.interstitial,
        rewarded: env('ADMOB_IOS_REWARDED_ID') ?? ADMOB.rewarded,
      },
    },
  };
};
