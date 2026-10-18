# Baharat Sort: App Store

Her şey repoda durur ve **App Store** iş akışıyla (`.github/workflows/store.yml`, elle) App Store Connect API'ye yazılır.
Sırlar `Appstore` ortamında (Settings › Environments › Appstore): `APPSTORE_API_KEY_P8`, `APPSTORE_KEY_ID`,
`APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`. İş akışı kayıtları herkese açık olduğundan betikler yalnızca kimlik ve durum yazdırır.

| Görev                            | Nasıl                                                  |
| -------------------------------- | ------------------------------------------------------ |
| Neyin ayarlı olduğunu oku        | Actions › App Store › Run workflow › `probe`           |
| Mağaza sayfasını yaz/güncelle    | `sync` (tekrar çalıştırılabilir; incelemeye göndermez) |
| Sırlar görünüyor mu (evet/hayır) | `where`                                                |

## `sync` neleri yazar

| Alan                                                                  | Kaynak                                      |
| --------------------------------------------------------------------- | ------------------------------------------- |
| Ad, alt başlık, gizlilik URL'si (TR + EN)                             | `metadata.json` › `locales`, `urls.privacy` |
| Açıklama, tanıtım metni, anahtar kelimeler, destek URL'si             | `metadata.json`                             |
| Kategori: Oyunlar › Bulmaca, Gündelik                                 | `metadata.json` › `category`                |
| Telif: 2026 Arda Bağce, içerik hakları (lisanslı üçüncü taraf içerik) | `metadata.json`                             |
| Yaş derecesi: tüm sorular Yok/Hayır, reklam Evet → 4+                 | `sync.mjs`                                  |
| Fiyat: ücretsiz, 175 ülke + yeni ülkeler                              | `sync.mjs`                                  |
| Ekran görüntüleri 6,9" (1320×2868), 5 × TR/EN                         | `screenshots/<tr                            | en>/1..5.jpg` |
| İnceleme notları                                                      | `metadata.json` › `review.notes`            |

Ekran görüntüleri oyunun web derlemesinden (aynı oyun) Playwright ile alınıp başlıkla birleştirildi:
1 oyun (seviye 26, mühürlü kavanoz), 2 döküm anı (seviye 36), 3 süslenmiş Mısır Çarşısı dükkânı, 4 harita, 5 kazanma kartı.

## API'nin yapamadıkları

- **App Gizliliği (App Privacy) formu:** App Store Connect API'de API anahtarıyla erişilebilen bir uç yok (18 Ekim 2026'da
  denendi: `/v1/apps/{id}/dataUsages`, `/v1/appDataUsages` → 404; `iris` uçları → 401, yalnızca Apple ID oturumu).
  Cevaplar aşağıda; reklamlar (7. aşama) eklendikten sonra, incelemeye göndermeden önce girilir.
- **İnceleme iletişim bilgisi** (ad, soyad, telefon, e-posta): kişisel veri olduğu için repoda tutulmaz.
  App Store Connect › Dağıtım › 1.0 › Uygulama İncelemesi'ne bir kez elle girilir.
- **İncelemeye gönderme:** API yapabilir ama yalnızca Arda onay verdiğinde yapılır.

## App Gizliliği cevapları (reklamlar eklendikten sonraki hâl)

_Veri topluyor musunuz?_ **Evet** (Google AdMob ve anonim oyun istatistikleri). Hiçbiri kimliğe bağlı değil.

| Veri türü                                                                               | Amaç                              | Kullanıcıya bağlı | İzleme |
| --------------------------------------------------------------------------------------- | --------------------------------- | ----------------- | ------ |
| Tanımlayıcılar › Cihaz Kimliği (IDFA, AdMob)                                            | Üçüncü taraf reklamcılığı         | Hayır             | Evet   |
| Tanımlayıcılar › Kullanıcı Kimliği (cihazda üretilen rastgele UUID)                     | Analiz, Uygulama İşlevselliği     | Hayır             | Hayır  |
| Kullanım Verileri › Ürün Etkileşimi (seviye başlat/bitir, takılma; AdMob etkileşimleri) | Analiz, Üçüncü taraf reklamcılığı | Hayır             | Hayır  |
| Kullanım Verileri › Reklam Verileri (AdMob)                                             | Üçüncü taraf reklamcılığı, Analiz | Hayır             | Evet   |
| Teşhis › Kilitlenme Verileri, Performans Verileri (AdMob SDK)                           | Analiz                            | Hayır             | Hayır  |
| Konum › Yaklaşık Konum (AdMob, IP'den)                                                  | Üçüncü taraf reklamcılığı         | Hayır             | Hayır  |

Reklamsız bir sürüm gönderilirse cevap: **Veri toplamıyoruz**.
