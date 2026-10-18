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
2. `shared`: kural motoru, üretici, çözücü, testler, 300 seviye → `docs/levels.md` ✅
3. Ekonomi config'i + denge simülasyonu → `docs/balance-report.md` ✅ (Arda'nın onayını bekliyor)
4. `app`: oynanabilir çekirdek (döküm animasyonu, ses, titreşim, kazanma/kilitlenme, renk körü, reklam simülatörü)
5. Seviye haritası, dükkân/dekorasyon, günlük hediye, güçlendiriciler
6. `server`: API, DB, events, admin stats, Dockerfile, statik sayfalar
7. Gerçek reklamlar + ATT + UMP + yayın hattı → ilk TestFlight
8. Günün bulmacası, cilalama, hata durumları
9. Mağaza hazırlığı

Web prototipi (revize için): `prototype/` → `pnpm prototype` tek dosyalık HTML üretir (`prototype/dist/baharat-sort.html`, aynı `shared` motoru, aynı 300 seviye). Yayımlanmış hali: https://claude.ai/artifact/BchsrPEw85FfRRVW3fhP9f (aynı dosya yolundan yeniden yayımlanır). Prototipte tüm seviyeler açık, reklamlar simülasyon; dükkân/harita henüz yok. Çizim ölçüleri (`prototype/src/art.ts`) uygulamadaki Skia çizimine taşınacak.

## Yapı

| Klasör     | Paket                   | Görev                                                        |
| ---------- | ----------------------- | ------------------------------------------------------------ |
| `app/`     | `@baharat-sort/app`     | iOS istemcisi (Expo SDK 58, expo-router, Skia, Reanimated)   |
| `server/`  | `@baharat-sort/server`  | Fastify + Drizzle/PostgreSQL + zod, Coolify'da Docker ile    |
| `shared/`  | `@baharat-sort/shared`  | Kurallar, çözücü, üretici, config, ekonomi, reklam kuralları |
| `scripts/` | `@baharat-sort/scripts` | Denge simülasyonu (`scripts/balance`)                        |
| `docs/`    |                         | VapurJam notları, seviye ve denge raporları                  |

## Komutlar

```bash
pnpm install
pnpm check        # format + lint + typecheck + test (CI ile aynı)
pnpm test         # yalnızca vitest
pnpm levels       # gömülü 300 seviyeyi ve docs/levels.md'yi yeniden üret (~80 sn)
pnpm balance      # denge simülasyonu → docs/balance-report.md
```

## Oyun kuralları (`shared/src/rules.ts`)

- Kavanoz kapasitesi 4 katman; uzun kavanozlu seviyelerde **seviyedeki tüm kavanozlar** 5 ya da 6. Her renkten tam `kapasite` kadar katman var.
- Bir kavanoza, sonra hedefe dokun. Kaynağın en üstündeki **aynı renkli bitişik** katmanlar hedefe **sığdığı kadar** dökülür.
- Geçerli döküm: hedef boş ya da en üst rengi aynı ve yer var. Değilse kavanoz sallanır, titreşir, hamle sayılmaz, durum değişmez.
- Tek renkle tamamen dolan kavanozun mantar kapağı kapanır; artık kaynak ya da hedef olamaz.
- **Kazanma:** her kavanoz ya tek renkle dolu ve kapalı ya da boş.
- **Kilitlenme** (`isStuck`): anlamlı hamle yok **ya da** erişilebilen durumlar küçük, kapalı bir küme ve hiçbiri ilerleme (kapak/kazanma) getirmiyor (yalnızca ileri geri dökülebiliyor). O zaman "Son bir şans" ekranı. Anlamlı hamle: simetrik (durumu değiştirmeyen) dökümler hariç (`meaningfulMoves`).
- Hamle/süre sınırı yok, can/enerji yok; sınırsız yeniden deneme.
- **Gizli katman (11+)** `hidden: k`: alttan k katman "?" görünür. En üst katman asla gizli değildir; üste çıkan katman açılır ve bir daha gizlenmez. Kurallar ve çözücü gerçek rengi bilir (yalnızca görünüm).
- **Kilitli kavanoz (21+)** `lock: renk`: o renkteki bir kavanoz kapanınca açılır; kilitliyken ne verir ne alır. Üretici, kilit rengini kilitli kavanozun içine koymaz (yoksa o renk hiç tamamlanamazdı).
- **Uzun kavanoz (31+)**: seviyenin kapasitesi 5 (ilk 30 seviye) sonra 5 ya da 6.
- **Dar ağızlı kavanoz (41+)** `narrow`: bir dökümde en fazla 1 katman **alır ve verir**.
- 61+: her 20 seviyelik blokta bir öğe birleşimi öne çıkar (`THEMES`: gizli+kilit, uzun+dar, …).
- **Güçlendiriciler:** geri al (son 3 döküm), boş kavanoz +1 (yalnızca o seviye), ipucu (çözücüden sonraki doğru döküm), karıştır (yalnızca kilitlenince; kapalı ve kilitli olmayan kavanozların katmanlarını doluluk aynı kalacak şekilde, çözülebilir bir karışım bulunana kadar seed'li karıştırır).

## Seviye üretimi ve çözücü (`shared/src/generator.ts`, `solver.ts`, `analysis.ts`)

- RNG: mulberry32 (`createRng`), yalnızca tamsayı işlemleri → uygulama/sunucu aynı sonucu üretir. Seviye n'in seed'i `baharat:n:<aday>`, günün bulmacası `daily:YYYY-MM-DD:<aday>`.
- Üretim: şekil (renk sayısı, kapasite, öğeler) → doldurma (1–4. seviyeler çözülmüş durumdan geri dökümlerle karıştırılır, sonrası rastgele) → öğeler → **çözücüyle doğrulama**. Çözülemeyen aday asla seçilmez. 8 aday arasından hedef zorluğa en yakını alınır.
- **Çözücü:** A\* + kanonik durum anahtarı (kavanoz sırası önemsiz; tür ve içerik önemli) + simetri budaması (aynı türden ikinci boş kavanoz, tek renkli kavanozu boşa aktarma). Sezgisel kabul edilebilir ve tutarlı: farklı renk üstündeki her dizi en az bir kez taşınır + birden çok kavanozun dibindeki bir renk için fazlalık. Bu yüzden bulunan çözüm **en kısadır** (testte kaba kuvvet BFS ile doğrulanır). Bütçe aşılırsa ağırlıklı A\* ile en azından çözülebilirlik doğrulanır (`exact: false`). Pratikte 300 seviyenin hepsi kesin çözüldü, toplam üretim ~80 sn.
- **Ölçümler:** en kısa çözüm, çözüm yolu boyunca ortalama anlamlı hamle (dallanma), **çıkmaz oranı** (40 oyunluk "rastgele" bot: anlamlı hamlelerden rastgele, %60 aynı renge dökmeyi tercih eder, son dökümü geri almaz; anlamlı hamle kalmazsa kilitlenmiş sayılır), gizli katman, renk/kavanoz oranı.
- **Zorluk skoru (1–10):** `ham = enKısa × log2(1+dallanma) × (1+2.5·çıkmaz) × (1+1.2·gizliOranı) × (0.6+renk/kavanoz) × (1+öğe ağırlıkları)`, `1 + 9·ham/(ham+140)`.
- **Eğri (testere dişi, `levelKind`, `targetDifficulty`, eşikler `config.difficulty`):** 1–10 eğitici (hedef 1.2→2, 5 ve 10 rozetli ama yumuşak). Normal hedef 3 → 7 (11→300). Her 5. seviye zor (+1.3), her 20. çok zor (+2.5), zordan hemen sonraki rahatlatıcı (−1). Yeni öğeler 11/21/31/41'de tanıtılır; bu seviyeler zaten rahatlatıcıdır ve en fazla 5 renklidir.
- Gömülü 300 seviye `shared/src/levels/builtin.json` (~130 KB), repoda durur (çevrimdışı). Üretici değişince `pnpm levels`. Test: her seviyenin çözümü oynatılıp kazandırdığı, her 23. seviyenin yeniden üretilince birebir aynı olduğu, zor > normal > rahatlatıcı ortalamaları.
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
- **Simülasyon sonucu (reklamsız):** ~5,8 seviyede bir güçlendirici, 3,1 seviyede bir parça, dükkân başına 23–32 seviye, sık izleyen %46 hızlı, en yüksek bakiye 100.

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
- **Güçlendirici hakları (Arda: "yardımcılar çoğunlukla gerekmiyor, çok fazla sayıda"):** başlangıç 3 → 1, tanıtım hediyeleri 1'er. Simülasyonda reklamsız oyuncu artık 7,1 seviyede bir güçlendirici kullanıyor (hedef 4–6 idi; bilinçli sapma). Diğer hedefler tutuyor.

- **Arka plan (Arda, 17 Ekim 2026: "arka plan çok boş, Mısır Çarşısı / Kapalıçarşı dükkânı içi gibi olsun, biz ön tarafta ayırıyormuşuz gibi"):** `prototype/src/scene.ts`. Arkada dükkânın içi: İznik çini şeridi, tavandan sarkan kuru biber/patlıcan/sarımsak/lif kabağı dizileri, kavanoz-teneke-lokum kutusu dolu raflar, çarşı koridoruna açılan kemerli kapı (gelip geçenler), tepsilerde fiyat çubuklu konik baharat yığınları, çuvallar. Ön tezgâhta kedi, bakır terazi, buharı tüten çay bardağı. Oyun alanının ortası koyulaştırılır ki kavanozlar net okunsun. Uygulamada Skia'ya taşınacak; ileride dükkân seçimine (Kapalıçarşı, Kadıköy…) göre sahne değişecek.

- **Repo:** `Ardabagce/BaharatSort` (**public**). Geliştirme dalı `claude/sweet-sagan-r89olv`.
- **Paket yöneticisi:** pnpm 10, Node 22, `node-linker=hoisted` (Expo/Metro monorepo). VapurJam'le aynı.
- **Expo SDK 58** (29 Eylül 2026, "güncel SDK"). VapurJam 57'de.
- **iOS tetikleyicisi (Arda, 17 Ekim 2026: "public repo, build alabilirsin"):** VapurJam'de Mac kotası yüzünden yalnızca elle; public repoda Actions dakikası ücretsiz olduğu için `main`'e `app/**`/`shared/**` değişikliği gelince otomatik + elle. İmzalama, TestFlight yükleme ve sır adları VapurJam'le birebir.
- **Kayıt:** MMKV (native) + Expo Go'da AsyncStorage'a düşen ince `kv` katmanı (Expo Go'da hızlı deneme kalsın diye).
- **Bundle ID:** `dev.bagce.baharatsort` (kayıt Arda'da; Apple'da kaydedilince değişmez).
- **Kapasite:** bir seviyedeki tüm kavanozlar aynı kapasitede (karışık kapasitede "tek renkle dolu" tanımı belirsizleşiyordu).
- **Dar ağız:** hem alırken hem verirken 1 katman.
