# Baharat Sort

Mısır Çarşısı'ndaki baharat tezgâhında karışmış kavanozları ayıkla: bakır kepçeyle baharatı kavanozdan
kavanoza dök, her kavanozu tek baharatla doldur, mantar kapağını kapat. iOS için hybrid-casual sıralama bulmacası.

- `app/`: iOS oyun istemcisi (Expo)
- `server/`: API ve sayfalar (Fastify, Coolify) — `baharat.bagce.dev`
- `shared/`: kurallar, çözücü, seviye üreticisi, ekonomi ve reklam kuralları
- `scripts/`: denge simülasyonu

Kurallar ve kararlar: [CLAUDE.md](CLAUDE.md). Seviye dağılımı: [docs/levels.md](docs/levels.md).

## Başlangıç

```bash
corepack enable
pnpm install
pnpm check
```

Gereken: Node 22+.
