import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { hapticFor, injectSaved, parseHostMessage, type Haptic } from './game/bridge';
import { GAME_HTML } from './game/game.gen';

/**
 * Baharat Sort: oyunun tamamı (kurallar, 1000 seviye, dükkân, sesler, görseller) prototiple aynı
 * kodla, çevrimdışı bir WebView'da çalışır. Uygulama kaydı telefonda tutar ve titreşimi iPhone'un
 * dokunsal motoruna bağlar. Reklamlar, ATT ve UMP 7. aşamada buradan bağlanacak.
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

  useEffect(() => {
    AsyncStorage.getItem(SAVE_KEY).then(
      (v) => setSaved(v),
      () => setSaved(null),
    );
  }, []);

  const hideSplash = useCallback(() => {
    if (hidden.current) return;
    hidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const msg = parseHostMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'save') AsyncStorage.setItem(SAVE_KEY, msg.data).catch(() => {});
    else if (msg.type === 'haptic') HAPTICS[hapticFor(msg.pattern)]().catch(() => {});
  }, []);

  if (saved === undefined) return <View style={styles.root} />;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <WebView
        style={styles.web}
        source={{ html: GAME_HTML, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injectSaved(saved)}
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
