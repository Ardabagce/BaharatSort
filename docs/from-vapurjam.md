# VapurJam'den alınanlar (0. aşama incelemesi)

Kaynak: `Ardabagce/VapurJam` (private, `main` @ `9e0cae8`). Geçici bir klasöre `--depth 1` ile
klonlandı ve **yalnızca okundu**; o repoya hiçbir şey yazılmadı.

> Not: Görevde repo adı `ardabagce/vapur-jam` olarak geçiyordu; GitHub'daki gerçek adı
> `Ardabagce/VapurJam`. Bu proje de GitHub'da zaten `Ardabagce/BaharatSort` olarak var
> (görevdeki `ardabagce/baharat-sort` yerine bu kullanılacak, yeni repo açılmayacak).

İlke: ortak paket yok, dosyalar **kopyalanıp uyarlanır**. Oyun mekaniği, çizimler, sesler ve
metinler tamamen yeni; VapurJam'den oyun içeriği taşınmaz.

## Özet tablo

| Alan                   | VapurJam'de                                                                                         | Baharat Sort'ta                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Monorepo               | pnpm 10 workspaces (`app`, `server`, `shared`), Node 22, hoisted                                    | Aynı + `scripts` paketi (denge simülasyonu)                                                            |
| Lint/format/test       | ESLint 10 flat + typescript-eslint + Prettier, Vitest `projects`                                    | Aynı dosyalar, aynı `pnpm check`                                                                       |
| TS ayarları            | `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, …)                                        | Birebir                                                                                                |
| Expo                   | SDK 57, RN 0.86, expo-router, Reanimated 4, Skia 2.6                                                | Aynı sürümler                                                                                          |
| Yerel kayıt            | **AsyncStorage** (Expo Go'da çalışsın diye MMKV'den vazgeçilmiş)                                    | **MMKV** (istenen) + Expo Go'da AsyncStorage'a düşen ince bir `kv` katmanı (aşağıda)                   |
| Anonim ID              | `expo-crypto randomUUID()` → `expo-secure-store`                                                    | Birebir, anahtar `baharatsort.playerId`                                                                |
| i18n                   | `strings.ts` (TR/EN tipli anahtarlar), `t()`, `pickLang`, ayardan                                   | Birebir yapı, tüm metinler yeni; baharat adları iki dilde                                              |
| Reklam modülü          | `ads/` : `useAds()`, `mockAds`, `nativeAds`, `units`                                                | Aynı arayüz + **sıklık kuralları shared'de** + dev'de **reklam simülatörü** + banner/ödüllü genişletme |
| ATT → SDK → UMP sırası | ATT (aktif + 900 ms, 1 yeniden deneme) → `setRequestConfiguration` → `initialize` → `gatherConsent` | Birebir                                                                                                |
| Reklam ayarı           | `maxAdContentRating: G`, `tagForChildDirectedTreatment: false`                                      | Birebir                                                                                                |
| Uzak ayar              | `GET /config` + `mergeConfig` (uzak değer interstitial'ı öne çekemez)                               | Aynı desen, çok daha geniş şema (ekonomi, reklam, zorluk, bayraklar)                                   |
| Backend                | Fastify 5 + zod 4 + Drizzle + postgres-js (havuz 5) + PGlite test                                   | Birebir iskelet; yeni tablolar (`events`), yeni uç noktalar                                            |
| Paketleme              | esbuild tek dosya, Docker 2 aşama, `--max-old-space-size=160`                                       | Birebir; bellek sınırı 128 MB'a çekilecek (paket üretimi daha hafif)                                   |
| Statik sayfalar        | `pages.ts` (tanıtım, gizlilik TR+EN, destek), harici varlık yok                                     | Aynı yapı, yeni metin ve görsel dil; gizlilikte "oyun olayları" bölümü eklenecek                       |
| iOS hattı              | `ios.yml` (yalnızca `workflow_dispatch`) + varsayılan yol EAS Build                                 | Birebir: aynı tetikleyici, aynı imzalama, aynı sır adları                                              |
| Sunucu CI              | `server-ci.yml` (yol filtreli: lint + typecheck + test + docker)                                    | Birebir                                                                                                |
| Genel CI               | `ci.yml` (`pnpm check`)                                                                             | Birebir                                                                                                |
| OTA                    | `eas-update.yml`, varsayılan kapalı                                                                 | Birebir (kapalı)                                                                                       |
| `.gitignore`           | `.env*`, `.p8`, `.p12`, `.mobileprovision`, … asla                                                  | Birebir                                                                                                |

## 1. Reklam / ATT / UMP modülü (`app/src/ads/`)

**Alınan:**

- `types.ts`: `Ads` arayüzü (`showRewarded`, `showInterstitial`, `privacyOptionsRequired`,
  `showPrivacyOptions`) ve `useAds()`.
- `index.tsx`: Expo Go'da (`ExecutionEnvironment.StoreClient`) native modülü `require` etmeden mock'a düşme.
- `nativeAds.tsx`: `FullScreenSlot` sınıfı (önceden yükle, göster, kapanınca yenisini yükle),
  `requestTracking()` (uygulama aktif olunca 900 ms bekle, sessizce yok sayılırsa 2 sn sonra bir kez daha),
  başlatma sırası **ATT → `setRequestConfiguration({ maxAdContentRating: G, tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false })` → `initialize()` → `AdsConsent.gatherConsent()`**,
  `canRequestAds` yoksa hiç reklam yüklenmemesi, UMP hatasında önceki onaya düşme,
  `privacyOptionsRequirementStatus === REQUIRED` ise ayarlarda düğme.
- Interstitial `show(0)`: hazır değilse oyuncu bekletilmez. Ödüllü `show(8000)`: en fazla 8 sn bekler.
- `units.ts`: `__DEV__`'de her zaman Google test birimleri, bozuk/eksik birimde teste düşme (+ testi).

**Değişen:**

- **Sıklık kuralları** VapurJam'de `shared/config.ts › shouldShowInterstitial` (min seviye, her N seviye,
  min aralık). Baharat Sort'ta saf bir `adPolicy` modülüne genişliyor: ilk 8 seviye yok, **ilk oturum yok**,
  her 3 seviyede en fazla 1, 120 sn aralık, **saatlik üst sınır 6**, **son 3 dk'da ödüllü izlendiyse atla**.
  Hepsi `/config`'den, hepsi birim testli.
- **Ödüllü reklam sonucu** `boolean` yerine `'rewarded' | 'dismissed' | 'unavailable'`. `unavailable`
  olunca "Şu an reklam yok" + jetonla alma seçeneği gösterilir, ödül verilmez (VapurJam yalnızca Alert gösteriyordu).
- **Reklam simülatörü:** VapurJam'in mock'u yalnızca Expo Go'da devreye giriyordu. Burada `__DEV__`
  derlemelerinde de seçilebilir; sahte tam ekran reklam + "yüklenemedi" senaryosu + sayaç paneli (debug menüsü).
- Ödüllü reklam yerleri genişliyor: 2x akçe, son bir şans, güçlendirici, günlük hediye 2x, eksik akçe.
- Reklam kimlikleri: VapurJam `app.config.ts`'te kendi gerçek birimlerini varsayılan olarak tutuyor.
  Baharat Sort'ta henüz AdMob birimi yok; **varsayılan Google test birimleri**, gerçekleri GitHub
  Variables'tan (aynı adlar: `ADMOB_IOS_APP_ID`, `ADMOB_IOS_BANNER_ID`, `ADMOB_IOS_INTERSTITIAL_ID`,
  `ADMOB_IOS_REWARDED_ID`) gelir. Arda isterse ileride VapurJam'deki gibi koda da yazılabilir (sır değiller).
- SKAdNetwork listesi (44 kimlik) aynen; ATT metni yeni (Baharat Sort adıyla, iki dilli).

## 2. Anonim ID ve yerel kayıt

**Alınan:** `storage/playerId.ts` birebir (yalnızca anahtar adı). `progress.ts`'teki desen:
saf fonksiyonlar (`completeLevel`, `spendCoins`, `buyDecoration`…) + `parseProgress` (bozuk alan
varsayılana döner, eski kayıt okunur) + `AppState.tsx` bağlamı (`progressRef` ile anlık sonuç, `commit`).
Bu desen sayesinde kayıt/yükleme testleri React Native'siz Vitest'te koşuyor.

**Değişen:**

- **MMKV:** Görev MMKV istiyor; VapurJam ise Expo Go'da çalışsın diye AsyncStorage'a geçmiş
  (MMKV, Expo Go'da yok, development build ister). Varsayılan karar: ince bir `kv` arayüzü
  (`getString/setString`), native derlemede `react-native-mmkv`, Expo Go'da AsyncStorage.
  Böylece hem istenen MMKV hem Expo Go'da hızlı deneme korunur. İlerleme şeması yeni
  (akçe, güçlendirici hakları, dükkânlar, dekorasyon stilleri, kilitlenme sayaçları…), `schemaVersion` alanı eklenir.
- Takma ad (`nicknameFor`) alınmıyor: skor tablosu yok.

## 3. i18n

**Alınan:** `i18n/index.ts` (`deviceLang`, `getLang`, `setLang`, `t`), `translate.ts` (`pickLang`,
`{param}` yerleştirme) ve testi, `strings.ts`'teki "TR nesnesi anahtar kaynağı, EN aynı tipte" yapısı,
ayarlarda Telefon dili / Türkçe / English, kök `Stack key={lang}` ile yeniden kurulum,
`CFBundleLocalizations: [tr, en]`.

**Değişen:** tüm metinler yeni. Baharat adları ayrı bir sözlük (`spices.ts`): pul biber / chili flakes, …

## 4. Backend iskeleti (`server/`)

**Alınan:** `package.json` bağımlılıkları, `env.ts` (zod ile ortam), `main.ts` (DATABASE_URL yoksa
bellek içi depo, SIGTERM ile kapanış), `db/connect.ts` (postgres-js `max: 5`, açılışta migration),
Drizzle + `drizzle/` migration klasörü, PGlite ile testler, `build.mjs` (esbuild tek ESM dosya +
`createRequire` banner'ı), `Dockerfile` (repo kökü bağlam, `node-linker=isolated` ile yalnızca
sunucu bağımlılıkları, çalışma imajında node_modules yok, `USER node`, `HEALTHCHECK /health`),
`@fastify/rate-limit`, `@fastify/cors (origin:false)`, `trustProxy`, `bodyLimit`, statik sayfa
yardımcıları, `LevelService` paket üretimi + `setImmediate` ile nefes, `.dockerignore`.

**Değişen:**

- Skor tablosu / haftalık yarışma / `POST /scores` **yok**.
- Yeni: `POST /events` (toplu, cihaz başına günlük limit), `GET /admin/stats` (Bearer token, `ADMIN_TOKEN` env).
- `/config` şeması çok daha geniş: ekonomi, reklam sınırları, zorluk eşikleri, bayraklar, min sürüm.
- Domain `baharatsort.bagce.dev`. README'de Coolify'daki mevcut PostgreSQL'de **ayrı veritabanı + kullanıcı**
  oluşturma adımları (VapurJam ayrı bir Postgres kaynağı öneriyordu; küçük sunucu için mevcut olanı paylaşmak daha hafif).
- `NODE_OPTIONS=--max-old-space-size=128`, Coolify bellek sınırı önerisi 192–256 MB.

## 5. GitHub Actions ve yayın hattı

**Alınan (birebir):**

- `ios.yml`: **tetikleyici yalnızca `workflow_dispatch`** (VapurJam'de Mac dakikası kotası bittiği için
  13 Ekim 2026'da böyle yapılmış; "aynı tetikleyici" kuralı gereği aynen). `macos-26`, Xcode 26 seçimi,
  `expo prebuild --platform ios --clean`, `IOS_BUILD_NUMBER = 100 + run_number`, sırlar yoksa imzasız
  simülatör derlemesi, `.p8`'i PEM olarak yeniden kurup `openssl` ile doğrulama, **otomatik imzalama**
  (`CODE_SIGN_STYLE=Automatic`, `-allowProvisioningUpdates`, App Store Connect API anahtarı),
  `xcodebuild -exportArchive` + `ExportOptions.plist` (`destination=upload`) ile doğrudan TestFlight,
  `environment: APPSTORE_API_KEY_P8` satırı, prebuilt RN çekirdeği bayrakları.
- **Sır adları:** `APPSTORE_API_KEY_P8`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`.
  Variables: `ADMOB_IOS_APP_ID`, `ADMOB_IOS_BANNER_ID`, `ADMOB_IOS_INTERSTITIAL_ID`, `ADMOB_IOS_REWARDED_ID`.
  OTA (kapalı): `EXPO_TOKEN`, `EAS_UPDATE_ENABLED`.
- Varsayılan ücretsiz yol **EAS Build** (`eas.json`, `pnpm testflight` = `eas build --auto-submit`).
- `ci.yml`, `server-ci.yml`, `eas-update.yml`.

**Değişen:** paket adları `@baharat-sort/*`, bundle ID önerisi `dev.bagce.baharatsort`, EAS slug `baharat-sort`.
Build sırasında 300 seviyenin üretilip JSON'a gömülmesi (VapurJam'de de böyle; JSON repoda, test güncelliğini doğrular).

## 6. Alınmayanlar (oyun içeriği)

Vapur/iskele/yolcu kuralları, ızgara üreticisi ve çözücüsü, tüm çizimler (`art/`), sesler, semt
süsleri, çark, sandık, kedi jetonu, haftalık yarışma, skor tablosu, metinler, renk paleti, mağaza metinleri.
Baharat Sort'un mekaniği (kavanozdan kavanoza döküm), çözücüsü (BFS/A\*), görselleri (çarşı, kavanoz),
paleti (sıcak bakır/ahşap) ve sesleri sıfırdan yazılır. Ana menü düzeni de farklı olacak
(VapurJam: lacivert-pirinç plakalar; Baharat Sort: ahşap tezgâh ve dükkân sahnesi) ki iki uygulama
App Store'da açıkça farklı görünsün.

## Onay bekleyen kararlar

1. **Bundle ID:** `dev.bagce.baharatsort` (Apple'da kaydedilince değişmez).
2. **Kayıt:** MMKV + Expo Go'da AsyncStorage'a düşüş (yukarıda).
3. **Repo:** mevcut `Ardabagce/BaharatSort` kullanılır; geliştirme `claude/sweet-sagan-r89olv` dalında.
4. **iOS tetikleyicisi:** VapurJam gibi yalnızca elle + EAS Build varsayılan.
