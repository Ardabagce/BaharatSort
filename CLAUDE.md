# Baharat Sort: proje kuralları ve kararlar

Mısır Çarşısı'nda bir baharat tezgâhında geçen, kavanozdan kavanoza baharat döktüğün iOS hybrid-casual
sıralama bulmacası ve kendi sunucumuzda çalışan backend'i. Altyapı VapurJam'den kopyalanıp uyarlandı
(`docs/from-vapurjam.md`); oyun içeriği tamamen yeni.

## Çalışma kuralları

- Kullanıcıyla (Arda) Türkçe konuş. Kod, değişken ve commit mesajları İngilizce olabilir; kullanıcıya görünen metinler TR + EN.
- Aşamalarla ilerle. Her aşama sonunda çalışır durumda commit + push ve kısa bir "ne test etmeliyim" notu.
- Belirsiz kararlarda mantıklı varsayılanı seç, aşağıdaki **Kararlar** bölümüne yaz, devam et. Yalnızca geri dönüşü zor kararlarda sor.
- API anahtarı, sertifika, `.p8`/`.p12`, provisioning profile, şifre ya da `.env` **asla** repoya girmez. Değer istenmez; yalnızca secret **isimleri** yazılır. **Repo public**: bu kural iki kat önemli.
- Telifli asset yok. **Ücretsiz lisanslı asset kullanılabilir** (Arda, 17 Ekim 2026: "ücretsiz güzel assetler bul, daha otantik olsun, baharatlar daha gerçekçi"): önce CC0 / kamu malı, gerekirse CC-BY (oyun içinde ve `docs/assets.md`'de atıfla). Her dosyanın kaynağı, yazarı ve lisansı `docs/assets.md`'ye yazılır. Kalanı Skia/SVG ile kodla çizilir, sesler koddan sentezlenir.
- Kişisel veri yok: login yok, yalnızca cihazda üretilen anonim UUID.
- Kodda sabit ekonomi/reklam/zorluk sayısı yok: hepsi `shared/src/config.ts` › `DEFAULT_CONFIG`, sunucu `/config` ile ezer.
- Push öncesi `pnpm check` temiz geçmeli.

## Aşamalar

0. VapurJam incelemesi → `docs/from-vapurjam.md` ✅
1. Monorepo iskeleti (pnpm: app, server, shared, scripts), lint/format, vitest, CI ✅
2. `shared`: kural motoru, üretici, çözücü, testler, 1000 seviye → `docs/levels.md` ✅
3. Ekonomi config'i + denge simülasyonu → `docs/balance-report.md` ✅ (Arda'nın onayını bekliyor)
4. `app`: oynanabilir çekirdek (döküm animasyonu, ses, titreşim, kazanma/kilitlenme, renk körü, reklam simülatörü) — iOS kabuğu + GitHub Actions → TestFlight hattı kuruldu (ilk build)
5. Seviye haritası, dükkân/dekorasyon, günlük hediye, güçlendiriciler
6. `server`: API, DB, events, admin stats, Dockerfile, statik sayfalar
7. Gerçek reklamlar + ATT + UMP + yayın hattı → ilk TestFlight ✅ (kod; cihazda test bekliyor)
8. Günün bulmacası, cilalama, hata durumları
9. Mağaza hazırlığı

Web prototipi (revize için): `prototype/` → `pnpm prototype` tek dosyalık HTML üretir (`prototype/dist/baharat-sort.html`, aynı `shared` motoru, aynı 1000 seviye). Yayımlanmış hali: https://claude.ai/artifact/BchsrPEw85FfRRVW3fhP9f (aynı dosya yolundan yeniden yayımlanır). Prototipte seviyeler sırayla açılır (geçilmemiş olanlar haritada asma kilitli), reklamlar simülasyon. Çizim ölçüleri (`prototype/src/art.ts`) uygulamadaki Skia çizimine taşınacak.

## Yapı

| Klasör     | Paket                   | Görev                                                        |
| ---------- | ----------------------- | ------------------------------------------------------------ |
| `app/`     | `@baharat-sort/app`     | iOS istemcisi (Expo SDK 58, oyun çevrimdışı WebView'da)      |
| `server/`  | `@baharat-sort/server`  | Fastify + Drizzle/PostgreSQL + zod, Coolify'da Docker ile    |
| `shared/`  | `@baharat-sort/shared`  | Kurallar, çözücü, üretici, config, ekonomi, reklam kuralları |
| `scripts/` | `@baharat-sort/scripts` | Denge simülasyonu (`scripts/balance`)                        |
| `docs/`    |                         | VapurJam notları, seviye ve denge raporları                  |

## Komutlar

```bash
pnpm install
pnpm check        # format + lint + typecheck + test (CI ile aynı)
pnpm test         # yalnızca vitest
pnpm levels       # gömülü 1000 seviyeyi ve docs/levels.md'yi yeniden üret (~7,5 dk)
pnpm balance      # denge simülasyonu → docs/balance-report.md
```

## Oyun kuralları (`shared/src/rules.ts`)

- Kavanoz kapasitesi 4 katman; uzun kavanozlu seviyelerde **seviyedeki tüm kavanozlar** 5 ya da 6. Her renkten tam `kapasite` kadar katman var.
- Bir kavanoza, sonra hedefe dokun. Kaynağın en üstündeki **aynı renkli bitişik** katmanlar hedefe **sığdığı kadar** dökülür.
- Geçerli döküm: hedef boş ya da en üst rengi aynı ve yer var. Değilse kavanoz sallanır, titreşir, hamle sayılmaz, durum değişmez.
- Tek renkle tamamen dolan kavanozun mantar kapağı kapanır; artık kaynak ya da hedef olamaz.
- **Kazanma:** her kavanoz ya tek renkle dolu ve kapalı ya da boş.
- **Kilitlenme** (`isStuck`): anlamlı hamle yok **ya da** erişilebilen durumlar küçük, kapalı bir küme ve hiçbiri ilerleme (kapak/kazanma) getirmiyor (yalnızca ileri geri dökülebiliyor). Bu durumda karıştır açılır; "Son bir şans" ekranı ise yalnızca hiç hamle kalmayınca (bkz. Kararlar › Çıkmaz oyunu kesmez). Anlamlı hamle: simetrik (durumu değiştirmeyen) dökümler hariç (`meaningfulMoves`).
- Hamle/süre sınırı yok, can/enerji yok; sınırsız yeniden deneme.
- **Gizli katman (11+)** `hidden: k`: alttan k katman "?" görünür. En üst katman asla gizli değildir; üste çıkan katman açılır ve bir daha gizlenmez. Kurallar ve çözücü gerçek rengi bilir (yalnızca görünüm).
- **Kilitli kavanoz (21+)** `lock: renk`: o renkteki bir kavanoz kapanınca açılır; kilitliyken ne verir ne alır. Görünüm: ağzı keten bezle örtülü, kınnap iple bağlı, ipte açacak baharatın dokusunda kırmızı mum mühür; içi hafif karartılı (camın kavisli dibi dahil). Açılınca bez havalanıp kaybolur. Üretici, kilit rengini kilitli kavanozun içine koymaz (yoksa o renk hiç tamamlanamazdı).
- **Uzun kavanoz (31+)**: seviyenin kapasitesi 5 (ilk 30 seviye) sonra 5 ya da 6.
- **Dar ağızlı kavanoz (41+)** `narrow`: bir dökümde en fazla 1 katman **alır ve verir**.
- 61+: her 20 seviyelik blokta bir öğe birleşimi öne çıkar (`THEMES`: gizli+kilit, uzun+dar, …).
- **Güçlendiriciler:** geri al (son 3 döküm), boş kavanoz +1 (yalnızca o seviye), ipucu (çözücüden sonraki doğru döküm), karıştır (yalnızca kilitlenince; kapalı ve kilitli olmayan kavanozların katmanlarını doluluk aynı kalacak şekilde, çözülebilir bir karışım bulunana kadar seed'li karıştırır).

## Seviye üretimi ve çözücü (`shared/src/generator.ts`, `solver.ts`, `analysis.ts`)

- RNG: mulberry32 (`createRng`), yalnızca tamsayı işlemleri → uygulama/sunucu aynı sonucu üretir. Seviye n'in seed'i `baharat:n:<aday>`, günün bulmacası `daily:YYYY-MM-DD:<aday>`.
- Üretim: şekil (renk sayısı, kapasite, öğeler) → doldurma (1–4. seviyeler çözülmüş durumdan geri dökümlerle karıştırılır, sonrası rastgele) → öğeler → **çözücüyle doğrulama**. Çözülemeyen aday asla seçilmez. 8 aday arasından hedef zorluğa en yakını alınır.
- **Çözücü:** A\* + kanonik durum anahtarı (kavanoz sırası önemsiz; tür ve içerik önemli) + simetri budaması (aynı türden ikinci boş kavanoz, tek renkli kavanozu boşa aktarma). Sezgisel kabul edilebilir ve tutarlı: farklı renk üstündeki her dizi en az bir kez taşınır + birden çok kavanozun dibindeki bir renk için fazlalık. Bu yüzden bulunan çözüm **en kısadır** (testte kaba kuvvet BFS ile doğrulanır). Bütçe aşılırsa ağırlıklı A\* ile en azından çözülebilirlik doğrulanır (`exact: false`). Pratikte 1000 seviyenin 999'u kesin çözüldü (1'i ağırlıklı A\* ile doğrulandı), toplam üretim ~7,5 dk.
- **Ölçümler:** en kısa çözüm, çözüm yolu boyunca ortalama anlamlı hamle (dallanma), **çıkmaz oranı** (40 oyunluk "rastgele" bot: anlamlı hamlelerden rastgele, %60 aynı renge dökmeyi tercih eder, son dökümü geri almaz; anlamlı hamle kalmazsa kilitlenmiş sayılır), gizli katman, renk/kavanoz oranı.
- **Zorluk skoru (1–10):** `ham = enKısa × log2(1+dallanma) × (1+2.5·çıkmaz) × (1+1.2·gizliOranı) × (0.6+renk/kavanoz) × (1+öğe ağırlıkları)`, `1 + 9·ham/(ham+140)`.
- **Eğri (testere dişi, `levelKind`, `targetDifficulty`, eşikler `config.difficulty`):** 1–10 eğitici (hedef 1.2→2, 5 ve 10 rozetli ama yumuşak). Normal hedef 3,5 → 8 (11→200, sonra 8'de sabit; Arda, 18 Ekim 2026: "seviye seviye daha zorlaştır"). Renk sayısı 5'ten başlar, her 20 seviyede +1 (en fazla 9). Tek boş kavanoz: çok zorlarda (40+) %70, zorlarda (60+) %35 olasılıkla. Her 5. seviye zor (+1.3), her 20. çok zor (+2.5), zordan hemen sonraki rahatlatıcı (−1). Yeni öğeler 11/21/31/41'de tanıtılır; bu seviyeler zaten rahatlatıcıdır ve en fazla 5 renklidir.
- Gömülü **1000 seviye** (Arda, 18 Ekim 2026: "build'den önce bölüm sayısını 1000'e tamamla") `shared/src/levels/builtin.json` (~490 KB), repoda durur (çevrimdışı). Seviye n yalnızca kendi seed'inden üretildiği için sayıyı artırmak önceki seviyeleri değiştirmez (ilk 300 birebir aynı kaldı). 200'den sonra hedef 8'de sabit; çeşitlilik 20'lik tema blokları ve testere dişinden gelir. Haritada 34 gerçek İstanbul çarşı sokağı (her biri 30 seviye, Eminönü'nden Büyükada'ya). Denge simülasyonu ilk 300 seviyede ölçülür (5 dükkân ~140'ta biter). Üretici değişince `pnpm levels`. Test: her seviyenin çözümü oynatılıp kazandırdığı, her 23. seviyenin yeniden üretilince birebir aynı olduğu, zor > normal > rahatlatıcı ortalamaları.
- Zorluk eşikleri config'ten gelir ama gömülü seviyeler build anında üretilir; uzaktan değişiklik yalnızca sunucunun ürettiği yeni paketleri ve günün bulmacasını etkiler. Çalışma anında etkili olan eşik: `stuckHintAfter`.
- **Takılınca:** aynı seviyede 3 kilitlenme → sonraki denemede ipucu düğmesi parlar, bir ipucu ücretsiz. Seviye zorluğu gizlice düşürülmez.

## Ekonomi (`shared/src/config.ts`, `economy.ts`) — simülasyonla ayarlandı, rapor `docs/balance-report.md` (Arda'nın onayını bekliyor)

Para birimi **Altın** (EN: **Gold**). Arda, 17 Ekim 2026: "Akçe ismini değiştirelim, altın olsun". Kodda `coins`. Başlangıç 50 altın + her güçlendiriciden 1 hak.

| Kazanç                     | Altın                                           |
| -------------------------- | ----------------------------------------------- |
| Normal / eğitici / rahat.  | 10                                              |
| Zor (her 5.)               | 25                                              |
| Çok zor (her 20.)          | 60                                              |
| Geri almadan bitirme       | +5                                              |
| Seviye sonu "2x al" (ödl.) | taban ödül bir kez daha (bonus hariç)           |
| Günlük hediye (7 gün)      | 10, 15, 20, 25, 30, 40, 50 (gün kaçarsa başa)   |
| Günlük hediye 2x (ödl.)    | aynı miktar bir kez daha                        |
| Günün bulmacası            | 40 + haftada 7/7 olunca özel dekorasyon parçası |
| Tekrar oynanan seviye      | 0                                               |

| Güçlendirici      | Altın | Not                   |
| ----------------- | ----: | --------------------- |
| Geri al (3 hamle) |    30 |                       |
| Boş kavanoz +1    |    80 | yalnızca o seviye     |
| İpucu             |    40 | çözücüden gelir       |
| Karıştır          |    60 | yalnızca kilitlenince |

Hak bitince: altın **ya da** ödüllü reklam. Öğe tanıtılırken hediye: gizli → 1 ipucu, kilit → 1 boş kavanoz,
uzun → 1 geri al, dar → 1 ipucu.

**Dükkânlar:** Mısır Çarşısı → Kapalıçarşı → Kadıköy Çarşısı → Eminönü İskele Tezgâhı → Adalar Bakkalı.
Her dükkânda 9 parça (tabela, tezgâh, raflar, terazi, lambalar, halı, kedi yatağı, vitrin, kavanoz seti).
Sonraki dükkân, öncekinin 9 parçası alınınca açılır.

| Dükkân  | Parça fiyatları (altın)    | Toplam |
| ------- | -------------------------- | -----: |
| Mısır   | 45 50 50 55 60 60 65 65 70 |    520 |
| Kapalı  | 50 50 55 55 60 65 65 70 70 |    540 |
| Kadıköy | 50 55 60 60 65 70 70 75 75 |    580 |
| Eminönü | 55 60 60 65 70 70 75 80 85 |    625 |
| Adalar  | 60 60 65 70 75 75 80 85 90 |    660 |

- Her parça 3 stil: ilk stil parçayla gelir, diğer ikisi **parça fiyatı × 1,2**. Ek stiller, 5 dükkân bittikten sonra (~140. seviye) altının kalıcı harcama yeri; simülasyonda bu olmadan sık reklam izleyen 3.900 altın biriktiriyordu.
- **Altın reklamı sınırı:** altın veren ödüllü reklamlar ("2x al", "eksiği tamamla") günde en fazla 14. Güçlendirici ve "son bir şans" reklamları sınırsız (altın vermezler). Sınır olmadan sık izleyen %68 hızlanıyordu (hedef %40–60).
- Eksik altın 30'dan azsa "eksiği reklamla tamamla".
- **Simülasyon sonucu (reklamsız, zorlaştırılmış seviyelerle):** 4,1 seviyede bir güçlendirici (hedefte), 3,4 seviyede bir parça, dükkân başına 23 / 26 / 29 / 32 / 43 seviye (5. dükkân uzun), sık izleyen %72 hızlı (hedef %40–60). Zorluk artınca oyuncu güçlendiriciye daha çok altın harcıyor; ekonomi yeniden ayarlanacak (Arda'nın onayı bekleniyor).

## Reklam kuralları (`shared/src/adPolicy.ts`, testli)

- Interstitial yalnızca seviye **kazanıldıktan** sonra, ödül ekranı kapanırken. Seviye ortasında ya da kayıptan sonra asla.
- İlk 8 seviyede ve ilk oyun oturumunda hiç. En fazla her 3 seviyede bir, aralarında en az 120 sn. Son 3 dk'da ödüllü izlendiyse atla (seviye sayacı da sıfırlanır). Saatte en fazla 6.
- Uzak ayar bu kuralları **sıkılaştırabilir ama gevşetemez** (`mergeConfig`): bunlar Arda'nın koyduğu üst sınırlar.
- Ödüllü: 2x altın, son bir şans (+1 boş kavanoz), güçlendirici, günlük hediye 2x, eksik altın. Yüklenemezse "Şu an reklam yok", ödül verilmez, altınla alma seçeneği gösterilir.
- Banner yalnızca ana menü / dükkân altında. App open reklamı yok.

## Kararlar

- **Görsel ve ses yönü (Arda, 17 Ekim 2026: "çok Claude yapımı görünüyor, otantik olsun", "sesler çok yapay"):** arka plan gerçek Mısır Çarşısı fotoğrafı (bulanık, karartılmış), raf/tezgâh Poly Haven ahşabı, baharat katmanları gerçek yakın çekim fotoğraflardan dikişsiz doku (10 baharatın hepsi, `prototype/assets/spice_<anahtar>.jpg`; renk oyun paletine göre tonlanabilir, dosya yoksa kodla çizilmiş dokuya düşer), sesler OpenGameArt CC0 kayıtları. Kaynaklar `docs/assets.md`. Wikimedia bu ortamın IP'sine API ve büyük görsel için 429 dönüyor; arama Special:MediaSearch HTML'inden, lisans `action=raw` wikitext'inden, görsel 250/500 px standart küçük resimlerden alınıyor.
- **Ana menü = dükkân (Arda: "biriken altını harcayacak yer yok", "ana menü olsun"):** açılışta dükkân görünümü; 9 parça dükkânın içinde soluk taslak + fiyat etiketi olarak görünür, dokununca alınır; alınan parçaya dokununca 3 stil seçici. Günlük hediye düğmesi, Oyna (sıradaki seviye), Seviyeler (harita), banner yeri. Oyundaki sol üst düğme dükkâna döner; kazanma kartında "Dükkâna dön".
- **Dükkân ekranı (Arda, 18 Ekim 2026: "havada altınlar duruyor, anlamsız"):** alınmamış parçalar artık soluk taslak + uçan fiyat etiketi değil. Dükkân başta sade ama eksiksiz çizilir (tebeşir tabela, kaba raf, birkaç sade kavanoz, çıplak ampul, sandık tezgâh); terazi/vitrin/kilim/kedi yatağı alınana kadar yok. Altta "Dükkânı süsle" şeridi: önizleme + ad + fiyat, alınmamışlar ucuzdan pahalıya önde; dokununca dükkândaki yeri halkayla parlar, satın alma açılır.
- **Hızlı oynama (Arda: "döküm bitmeden diğer kavanoza tıklayamıyorum"):** döküm mantığı dokununca hemen uygulanır, animasyonlar sıraya girer (`queuePour`/`pumpPours`): farklı kavanozları ilgilendiren dökümler aynı anda, aynı kavanozu ilgilendirenler sırayla oynar; sıra birikince animasyon 0,45×/0,28× hızlanır. Kazanma/kilitlenme animasyonlar bitince gösterilir. Tek döküm ~0,5 sn (önce ~0,8).
- **Döküm animasyonu ve sesler (Arda, 18 Ekim 2026: "döküm animasyonu sorunlu", "arka plan sesi çığlık çığlığa", "bölüm müziği daha sakin"):** kaynak kavanoz ağzı aşağı bakacak kadar (~104°) eğilip ağzı hedefin boğazının hemen üstüne gelir; hiçbir köşesi hedef sırasındaki kavanozlara inmez, yanda yer yoksa öbür taraftan döker, o da olmazsa daha az eğilir. Akış ince, taneli (3 iplik + tane), ağızdan yüzeye düşer ve kopar. Aynı dökümde akan katmanlar (ör. 3 katman) tek parça davranır: kaynakta tek blok hâlinde ağızdan boşalır, hedefte akış yüzeye varınca tek blok hâlinde aşağıdan yukarı dolar (tek kırpma dikdörtgeni; katman başına ayrı büyüme yok). Kapak dolum bitince düşer. Akışın ucu ve taneler yükselen yüzeyde durur; toz döküm bitince yeni yüzeyde kalkar. Aynı renkten bitişik katmanlar tek parça çizilir (Arda: "aradaki çizgiler doğal değil"); gölge çizgisi yalnızca farklı renkler arasında, gizli katmanlar tek tek. Çarşı kalabalığı kaydı çıktı; yerine kısık, yumuşak bir ses halısı (CC0). Bitiş ezgisi sakin "Cozy Puzzle Clear" (CC0); çalarken arka plan kısılır.
- **Güçlendirici hakları (Arda: "yardımcılar çoğunlukla gerekmiyor, çok fazla sayıda"):** başlangıç 3 → 1, tanıtım hediyeleri 1'er. Simülasyonda reklamsız oyuncu artık 7,1 seviyede bir güçlendirici kullanıyor (hedef 4–6 idi; bilinçli sapma). Diğer hedefler tutuyor.

- **Arka plan (Arda, 17 Ekim 2026: "arka plan çok boş, Mısır Çarşısı / Kapalıçarşı dükkânı içi gibi olsun, biz ön tarafta ayırıyormuşuz gibi"):** `prototype/src/scene.ts`. Arkada dükkânın içi: İznik çini şeridi, tavandan sarkan kuru biber/patlıcan/sarımsak/lif kabağı dizileri, kavanoz-teneke-lokum kutusu dolu raflar, çarşı koridoruna açılan kemerli kapı (gelip geçenler), tepsilerde fiyat çubuklu konik baharat yığınları, çuvallar. Ön tezgâhta kedi, bakır terazi, buharı tüten çay bardağı. Oyun alanının ortası koyulaştırılır ki kavanozlar net okunsun. Uygulamada Skia'ya taşınacak; ileride dükkân seçimine (Kapalıçarşı, Kadıköy…) göre sahne değişecek.

- **Uygulama mimarisi (18 Ekim 2026, 4. aşama):** oyun, Arda'nın revizelerle onayladığı prototip koduyla **aynı**; `prototype/build.mjs` tek bir HTML üretir (`app/src/game/game.gen.ts`, gitignore'da; görseller, sesler ve yazı tipleri gömülü) ve uygulama onu çevrimdışı bir `react-native-webview` içinde açar (köken `https://baharat.bagce.dev/`, internete istek yok). Böylece prototipteki her revize uygulamaya birebir geçer; Skia'ya yeniden yazmak ayrı bir iş olarak ertelendi (gerekirse oyun ekranı sonradan taşınır). Köprü (`prototype/src/host.ts` ↔ `app/src/game/bridge.ts`, testli): kayıt telefonda (AsyncStorage; sayfa yüklenmeden `window.__BS_SAVED` ile verilir, her değişiklikte `save` mesajı), titreşim `expo-haptics` (≤15 ms hafif, ≥30 ms uyarı, desen başarı). Reklam/ATT/UMP 7. aşamada aynı köprüden bağlanacak. Uygulamada zorluk bilgisi varsayılan kapalı. MMKV yerine AsyncStorage (tek bir kayıt metni; ek native modül riski yok). Yazı tipleri (Rakkas, Alegreya Sans, OFL) uygulamada gömülü. Simge ve açılış görseli `art.ts` kavanoz çiziminden (gerçek baharat dokularıyla) üretildi.
- **iOS build:** `.github/workflows/ios.yml` (VapurJam'le birebir, + `pnpm prototype` adımı). Varsayılan dal `claude/sweet-sagan-r89olv` olduğu için tetikleyici `main` **ve** bu dal (`app/**`, `shared/**`, `prototype/**`, lockfile) + elle. Derleme numarası `100 + run_number`. App Store Connect kaydı Arda'da oluşturuldu; sırlar `Appstore` ortamında.
- **App Store Connect (18 Ekim 2026; Arda: "bağlantıyı sen yöneteceksin, App Store için gerekli her şeyi yapacaksın"):** uygulama kaydı `6824290070`. Sırlar repo sırları değil, **`Appstore` ortamında** (Settings › Environments); `ios.yml` ve `store.yml` `environment: Appstore` kullanır. Mağaza sayfası repoda (`store/`), `store.yml` › `sync` ile API'den yazılır: TR/EN metinler, kategori, yaş derecesi (4+), ücretsiz, 175 ülke, ekran görüntüleri, inceleme notları (`store/README.md`). Gizlilik/destek sayfaları sunucuda: `https://baharat.bagce.dev/privacy`, `/support` (metinleri `store/privacy.md`, `support.md` ile aynı tutulur). **App Privacy formu API anahtarıyla yazılamıyor** (uçlar 404/401, denendi); cevaplar `store/README.md`'de. İncelemeye gönderme yalnızca Arda'nın onayıyla.
- **Sunucu (18 Ekim 2026, 6. aşamanın ilk parçası):** alan adı **`baharat.bagce.dev`** (Arda; ilk plandaki `baharatsort.bagce.dev` değil). Arda kendi Coolify'ına deploy ediyor. Dockerfile **repo kökünde** (Coolify varsayılanı `/Dockerfile`; build bağlamı kök çünkü sunucu `shared`'ı kullanır). Şimdilik `/`, `/privacy`, `/support` (TR+EN), `/health`, `/config`; veritabanı, `/events`, `/levels/packs`, `/daily`, `/admin/stats` sonra. `SUPPORT_EMAIL` ortam değişkeni verilirse sayfalarda görünür, yoksa GitHub Issues bağlantısı.
- **Kayıt asla kaybolmaz (Arda, 18 Ekim 2026: "güncelleme gelince oyuncuların bölümleri sıfırlanmasın, çok büyük hata olur"):** uygulama kaydı AsyncStorage'da `baharatsort.save.v1` anahtarında (iOS'ta uygulama güncellemesinden etkilenmez); **anahtar ve biçim değiştirilmez, alanlar yalnızca eklenir**. `parseProgress` eski/eksik kayıtları okur, bilinmeyen dükkân parçalarını bile silmez (testli). Uygulama tarafı (`shouldAcceptSave`, testli): açılan seviye ya da alınan parça sayısı azalan bir kayıt eskisinin üstüne yazılmaz; kayıt okunamazsa (3 deneme) o oturumda hiç yazılmaz; tek istisna Ayarlar › Her şeyi sıfırla (`reset: true`). Seviye içerikleri değişse de ilerleme seviye numarasıyla tutulur. Dükkân parça kimlikleri (`misir.sign` …) sabit; yalnızca adları ve çizimleri değişebilir.
- **Gizli katman kapanınca açılır (Arda: "kavanoz tamamen açılmadan oyun bitiyor"):** dolup mantarı kapanan kavanozun tüm "?" katmanları açılır (`hidden = 0`); kapalı kavanozda ve kazanma anında hiç "?" kalmaz. İçerik zaten aynı renk olduğundan çözülebilirlik ve seviyeler değişmez.
- **Gerçek reklamlar (7. aşama, 18 Ekim 2026; Arda: "gerçek reklamları ekleyelim"):** AdMob kimlikleri `app/app.config.ts` › `ADMOB` (sır değil; `ADMOB_IOS_*` ortam değişkeniyle değiştirilebilir; `__DEV__`'de Google test birimleri). `react-native-google-mobile-ads` 17.2.0 + `expo-tracking-transparency`. Sıra VapurJam'deki gibi: ATT (uygulama etkinken, ~1 sn sonra) → SDK (`maxAdContentRating: G`) → UMP `gatherConsent` → yükleme. Reklamlar uygulama tarafında (`app/src/ads/native.tsx`); oyun köprüden ister: `{type:'ad', id, kind}` → `adResult` (`injectJavaScript`), banner `{type:'banner', visible}` yalnızca ana ekranda (dükkân) açılır, oyuna girince kapanır, WebView'in altında (WebView küçülür). Ödüllü 8 sn yüklenmeyi bekler, geçiş beklemez. Reklam sırasında oyun sesi susar. Ayarlar'da AB'de "Gizlilik seçenekleri" (UMP). Simüle reklamlar yalnızca prototipte; uygulamada reklam modülü yoksa (Expo Go) hiçbir reklam düğmesi görünmez; prototip araçları uygulamada gizli. Mağazada yaş derecesi "reklam var", pazarlama URL'si `https://bagce.dev` (app-ads.txt orada aranır).
- **Dükkâna özgü ürünler (Arda, 18 Ekim 2026: "tüm dükkânlarda hep aynı ürünler var, farklı ürünler olsun"):** 9 yer ve kimlikleri (`sign`, `lamps`, `shelves`, `jarSet`, `vitrine`, `scale`, `counter`, `rug`, `catBed`) ve fiyatlar aynı kalır (kayıtlar bozulmasın), ama her dükkânda o yerde farklı bir ürün durur (`prototype/src/products.ts`, her biri 3 stil, TR/EN ad). Mısır Çarşısı ilk tasarım. Kapalıçarşı: hat levhası, pirinç avize, oymalı raflar, bakır cezveler, mücevher vitrini, nargile, sedef kakma tezgâh, bakır tepsi, pirinç mangal. Kadıköy: emaye tabela, ampul zinciri, kasa raflar, turşu kavanozları, peynir vitrini, kantar, şarküteri tezgâhı, meyve kasası, kedi kulübesi. Eminönü: iskele tabelası, gemi fenerleri, kayık tahtası raflar, çay bardakları, simit camekânı, semaver, kayık tezgâh, can simidi, iskele babası ve martı. Adalar: çiçekli tabela, bahçe ışıkları, bakkal rafları, reçel kavanozları, dondurma dolabı, yazar kasa, bakkal tezgâhı, çiçek saksıları, bisiklet. Köşedeki ürün yatak/kulübe değilse kedi zeminin sağında uyur.
- **Çıkmaz oyunu kesmez (Arda, 20 Ekim 2026: "dökmeye yer varken oyun kendiliğinden bitiyor", 75. ve benzeri seviyeler):** `isStuck` doğru (3.300 rastgele oyunda hiç yanlış alarm yok) ama gizli katmanların gerçek rengini bilerek "hiçbir kavanoz artık kapanamaz" diye erkenden karar veriyordu; 75'te kilitlenmelerin %90'ı hamle varken oluyordu. Artık "Son bir şans" yalnızca **hiç anlamlı hamle kalmadığında** (`sessionNoMoves`) açılır. Hamle varken çıkmazda oyun sürer: karıştır açılır ve parlar, 6 hamle sonra altta "geri al ya da karıştır" notu; takılma sayacı (ücretsiz ipucu) deneme başına bir kez sayılır. `isStuck` simülasyon ve karıştır için aynen kalır.
- **Repo:** `Ardabagce/BaharatSort` (**public**). Geliştirme dalı `claude/sweet-sagan-r89olv`.
- **Paket yöneticisi:** pnpm 10, Node 22, `node-linker=hoisted` (Expo/Metro monorepo). VapurJam'le aynı.
- **Expo SDK 58** (29 Eylül 2026, "güncel SDK"). VapurJam 57'de.
- **iOS tetikleyicisi (Arda, 17 Ekim 2026: "public repo, build alabilirsin"):** VapurJam'de Mac kotası yüzünden yalnızca elle; public repoda Actions dakikası ücretsiz olduğu için `main`'e `app/**`/`shared/**` değişikliği gelince otomatik + elle. İmzalama, TestFlight yükleme ve sır adları VapurJam'le birebir.
- **Kayıt:** AsyncStorage (bkz. uygulama mimarisi; ilk plan MMKV idi).
- **Bundle ID:** `dev.bagce.baharatsort` (kayıt Arda'da; Apple'da kaydedilince değişmez).
- **Kapasite:** bir seviyedeki tüm kavanozlar aynı kapasitede (karışık kapasitede "tek renkle dolu" tanımı belirsizleşiyordu).
- **Dar ağız:** hem alırken hem verirken 1 katman.
