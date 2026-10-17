# Dış kaynaklı görseller

Kural (CLAUDE.md): önce CC0 / kamu malı, gerekirse CC-BY ya da CC-BY-SA (atıfla). Her dosya burada
kaynağı, yazarı ve lisansıyla listelenir; atıf gerektirenler oyunda Ayarlar › Hakkında'da da görünür.
Dosyalar `prototype/assets/` altında (uygulamaya geçince `app/assets/`). Dosyalar kırpılmış,
küçültülmüş, renk/parlaklığı ayarlanmış ve dikişsiz hale getirilmiştir (lisanslar buna izin verir;
CC-BY-SA dosyaların değiştirilmiş hâli de CC-BY-SA'dır).

## Dokular (Poly Haven, CC0)

| Dosya              | Kaynak                                                     | Lisans | Kullanım                      |
| ------------------ | ---------------------------------------------------------- | ------ | ----------------------------- |
| `wood_shelf.jpg`   | [Dark Wood](https://polyhaven.com/a/dark_wood)             | CC0    | Raf tahtaları, harita başlığı |
| `wood_counter.jpg` | [Wood Table Worn](https://polyhaven.com/a/wood_table_worn) | CC0    | Tezgâh                        |
| `plaster.jpg`      | [Yellow Plaster](https://polyhaven.com/a/yellow_plaster)   | CC0    | Seviye haritası duvarı        |

## Baharat fotoğrafları (Wikimedia Commons)

| Dosya                | Kaynak                                                                                           | Yazar            | Lisans       |
| -------------------- | ------------------------------------------------------------------------------------------------ | ---------------- | ------------ |
| `bg_bazaar.jpg`      | [Spice Bazaar, Istanbul 2](https://commons.wikimedia.org/wiki/File:Spice_Bazaar,_Istanbul_2.jpg) | Joseolgon        | CC BY 4.0    |
| `spice_turmeric.jpg` | [Ground yellow turmeric](https://commons.wikimedia.org/wiki/File:Ground_yellow_turmeric.jpg)     | Selimee          | CC BY-SA 4.0 |
| `spice_chili.jpg`    | [Redchiliflakes.jpg](https://commons.wikimedia.org/wiki/File:Redchiliflakes.jpg)                 | Myscha Theriault | CC BY 2.0    |

`bg_bazaar.jpg` kırpıldı, bulanıklaştırıldı, karartıldı. Baharat dokuları kırpılıp 192 px'e küçültüldü ve dikişsiz yapıldı.

## Sesler (OpenGameArt, hepsi CC0)

| Dosya               | Kaynak                                                                                              | Kullanım                              |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `sfx_pour.mp3`      | [Sow seeds](https://opengameart.org/content/sow-seeds)                                              | Baharat dökme                         |
| `sfx_pour_seed.mp3` | [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2) (`stones_02`)                       | Taneli baharatlarda tıkırtı           |
| `sfx_tink.mp3`      | [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2) (`glass_04`)                        | Kavanoz seçme                         |
| `sfx_cork.mp3`      | [Glass bottle open/close](https://opengameart.org/content/glass-bottle-open-close)                  | Mantar kapak                          |
| `sfx_thud.mp3`      | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) (`wooden_02`)                            | Geçersiz döküm                        |
| `sfx_coins.mp3`     | [50 RPG sound effects](https://opengameart.org/content/50-rpg-sound-effects) (Kenney)               | Altın                                 |
| `sfx_win.mp3`       | [Win jingle](https://opengameart.org/content/win-jingle) (fretless)                                 | Seviye bitti                          |
| `sfx_meow.mp3`      | [Cat purr & meow](https://opengameart.org/content/cat-purr-meow)                                    | Kedi                                  |
| `sfx_bazaar.mp3`    | [Crowd shouting/speaking ambience](https://opengameart.org/content/crowd-shoutingspeaking-ambience) | Çarşı uğultusu (alçak geçiren, kısık) |

Sesler mono'ya çevrildi, kırpıldı, ses seviyeleri eşitlendi (ffmpeg `loudnorm`), MP3 64 kbps.
