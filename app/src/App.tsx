import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { nativeAds } from './ads';
import type { AdController } from './ads/native';
import {
  hapticFor,
  hostEventJs,
  injectSaved,
  parseHostMessage,
  shouldAcceptSave,
  type Haptic,
} from './game/bridge';
import { GAME_HTML } from './game/game.gen';

/**
 * Baharat Sort: oyunun tamamı (kurallar, 1000 seviye, dükkân, sesler, görseller) prototiple aynı
 * kodla, çevrimdışı bir WebView'da çalışır. Uygulama kaydı telefonda tutar ve titreşimi iPhone'un
 * dokunsal motoruna bağlar. Reklamlar (AdMob, ATT, UMP) uygulama tarafında; oyun köprüden ister.
 */

const SAVE_KEY = 'baharatsort.save.v1';
const BG = '#1D120B';
// Oyun sayfasının kökeni. İnternete çıkmaz; yalnızca localStorage/Web Audio için güvenli bir köken.
const BASE_URL = 'https://baharat.bagce.dev/';

SplashScreen.preventAutoHideAsync().catch(() => {});

const HAPTICS: Record<Haptic, () => Promise<void>> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

function Game() {
  const insets = useSafeAreaInsets();
  // undefined: kayıt henüz okunmadı; null: kayıt yok (ilk açılış).
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const hidden = useRef(false);
  // Telefondaki son kayıt. Okunamadıysa (readFailed) bu oturumda hiçbir şey yazılmaz: eski kayıt korunur.
  const lastSaved = useRef<string | null>(null);
  const readFailed = useRef(false);
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const ads = useRef<AdController | null>(null);
  const [bannerWanted, setBannerWanted] = useState(false);
  const [canRequestAds, setCanRequestAds] = useState(false);

  // Reklamlar: ATT → SDK → UMP, sonra oyuna durum bildirilir. Expo Go'da reklam yok.
  useEffect(() => {
    if (!nativeAds) return;
    const c = new nativeAds.AdController((st) => {
      setCanRequestAds(st.canRequestAds);
      web.current?.injectJavaScript(
        hostEventJs({ type: 'hostState', ads: true, privacyOptions: st.privacyOptions }),
      );
    });
    ads.current = c;
    void c.start();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const v = await AsyncStorage.getItem(SAVE_KEY);
          if (cancelled) return;
          lastSaved.current = v;
          setSaved(v);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      if (cancelled) return;
      readFailed.current = true;
      setSaved(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hideSplash = useCallback(() => {
    if (hidden.current) return;
    hidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const msg = parseHostMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'save') {
      if (readFailed.current) return;
      // Güncelleme ya da hata ne olursa olsun ilerleme geri gitmez (yalnızca bilerek sıfırlama).
      if (!shouldAcceptSave(lastSaved.current, msg.data, msg.reset)) return;
      lastSaved.current = msg.data;
      AsyncStorage.setItem(SAVE_KEY, msg.data).catch(() => {});
    } else if (msg.type === 'haptic') HAPTICS[hapticFor(msg.pattern)]().catch(() => {});
    else if (msg.type === 'banner') setBannerWanted(msg.visible);
    else if (msg.type === 'privacyOptions') void ads.current?.showPrivacyOptions();
    else if (msg.type === 'ad') {
      const c = ads.current;
      const run = c
        ? msg.kind === 'rewarded'
          ? c.showRewarded()
          : c.showInterstitial()
        : Promise.resolve({ shown: false, rewarded: false });
      void run
        .catch(() => ({ shown: false, rewarded: false }))
        .then((r) =>
          web.current?.injectJavaScript(hostEventJs({ type: 'adResult', id: msg.id, ...r })),
        );
    }
  }, []);

  if (saved === undefined) return <View style={styles.root} />;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <WebView
        ref={web}
        style={styles.web}
        source={{ html: GAME_HTML, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injectSaved(saved, { ads: !!nativeAds })}
        onMessage={onMessage}
        onLoadEnd={hideSplash}
        onError={hideSplash}
        // Ses: dokunuşla açılan Web Audio; satır içi, kullanıcı hareketi beklemeden.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Oyun kendi kaydırmasını yapar; sayfa sekmez, büyümez, metin seçilmez.
        bounces={false}
        overScrollMode="never"
        scrollEnabled={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        textInteractionEnabled={false}
        dataDetectorTypes="none"
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        // Oyun dışına gitmeye çalışan bağlantıları engelle (yalnızca kendi sayfası).
        onShouldStartLoadWithRequest={(r) => r.url.startsWith(BASE_URL) || r.url === 'about:blank'}
      />
      {nativeAds && bannerWanted && canRequestAds ? (
        <View style={{ paddingBottom: insets.bottom }}>
          <nativeAds.NativeBanner />
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <Game />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
});
