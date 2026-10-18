# @baharat-sort/server

Baharat Sort'un sunucusu: Node.js 22 + Fastify 5 + TypeScript. Şimdilik App Store'un istediği sayfalar ve uzak ayar;
veritabanı, olaylar ve seviye paketleri 6. aşamada eklenecek.

## Uç noktalar

| Yol            | Ne yapar                                                      |
| -------------- | ------------------------------------------------------------- |
| `GET /`        | Tanıtım (TR + EN)                                             |
| `GET /privacy` | Gizlilik politikası (TR + EN). App Store'daki gizlilik URL'si |
| `GET /support` | Destek sayfası (TR + EN). App Store'daki destek URL'si        |
| `GET /health`  | Sağlık kontrolü (Coolify healthcheck)                         |
| `GET /config`  | Uzak ayar (`shared/src/config.ts` › `DEFAULT_CONFIG`)         |

## Geliştirme

```bash
pnpm --filter @baharat-sort/server dev    # http://localhost:3000
pnpm --filter @baharat-sort/server test
docker build .                            # repo kökünden (Dockerfile kökte)
```

## Ortam değişkenleri

| Ad                | Varsayılan | Not                                                                                  |
| ----------------- | ---------- | ------------------------------------------------------------------------------------ |
| `PORT`            | `3000`     |                                                                                      |
| `LOG_LEVEL`       | `info`     |                                                                                      |
| `SUPPORT_EMAIL`   | –          | Verilirse gizlilik ve destek sayfalarında gösterilir; yoksa GitHub Issues bağlantısı |
| `MIN_APP_VERSION` | `0.0.0`    | Bundan eski uygulamalar güncellemeye yönlendirilir (`/config`)                       |

## Coolify

1. **Application → GitHub App** ile `Ardabagce/BaharatSort`, dal **`claude/sweet-sagan-r89olv`** (şimdilik varsayılan dal).
2. **Build Pack: Dockerfile**, **Base Directory: `/`**, **Dockerfile Location: `/Dockerfile`**.
   Build bağlamı repo kökü olmalı; sunucu `shared` paketini kullanır.
3. **Ports Exposes: `3000`**.
4. **Domain: `https://baharat.bagce.dev`**.
5. **Healthcheck:** yol `/health`, port `3000` (Dockerfile'da da tanımlı).
6. **Watch Paths** (isteğe bağlı): `server/**`, `shared/**`, `Dockerfile`; uygulama değişikliklerinde yeniden deploy olmasın.
7. Bellek: ~60–100 MB; `128m`–`192m` sınır yeterli. Veritabanı henüz gerekmiyor.
