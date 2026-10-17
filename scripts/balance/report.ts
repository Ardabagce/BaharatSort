import type { GameConfig, LevelDef } from '@baharat-sort/shared';
import { PROFILES, type Profile } from './profiles';
import type { PlayerResult } from './sim';

/** Profil başına birden çok oyuncunun ortalaması. */
export interface ProfileSummary {
  profile: Profile;
  runs: PlayerResult[];
  hours: number;
  earnPerLevel: number;
  spendPerLevel: number;
  boostersPerLevel: number;
  levelsPerBooster: number;
  coinBoostersPerLevel: number;
  bySource: { charge: number; coins: number; ad: number };
  byKind: { undo: number; extraJar: number; hint: number; shuffle: number };
  shopDone: Record<string, number | null>;
  levelsPerDecoration: number;
  stylesBought: number;
  rewardedPerHour: number;
  interstitialPerHour: number;
  maxCoins: number;
  levelsAbove1000: number;
  firstTryByKind: Record<string, number>;
  attemptsByKind: Record<string, number>;
  blocks: { from: number; to: number; earn: number; spend: number; coins: number }[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarize(profile: Profile, runs: PlayerResult[], cfg: GameConfig): ProfileSummary {
  const n = runs[0]!.levels.length;
  const per = (f: (r: PlayerResult) => number) => mean(runs.map(f));
  const sumL = (r: PlayerResult, f: (l: PlayerResult['levels'][number]) => number) =>
    r.levels.reduce((a, l) => a + f(l), 0);
  const hours = per((r) => r.totalSeconds / 3600);
  const boosters = per((r) => sumL(r, (l) => l.boosters.charge + l.boosters.coins + l.boosters.ad));
  const shopDone: Record<string, number | null> = {};
  for (const s of cfg.economy.shops) {
    const done = runs.map((r) => r.shopDone[s.id]).filter((x): x is number => x !== undefined);
    shopDone[s.id] = done.length === runs.length ? Math.round(mean(done)) : null;
  }
  const kinds = ['tutorial', 'normal', 'relief', 'hard', 'veryHard'];
  const firstTryByKind: Record<string, number> = {};
  const attemptsByKind: Record<string, number> = {};
  for (const k of kinds) {
    firstTryByKind[k] = per((r) => {
      const ls = r.levels.filter((l) => l.kind === k);
      return ls.filter((l) => l.attempts === 1 && l.stuck === 0).length / Math.max(1, ls.length);
    });
    attemptsByKind[k] = per((r) =>
      mean(r.levels.filter((l) => l.kind === k).map((l) => l.attempts)),
    );
  }
  const blocks: ProfileSummary['blocks'] = [];
  for (let a = 1; a <= n; a += 50) {
    const b = Math.min(n, a + 49);
    const slice = (r: PlayerResult) => r.levels.filter((l) => l.n >= a && l.n <= b);
    blocks.push({
      from: a,
      to: b,
      earn: per((r) => mean(slice(r).map((l) => l.earned))),
      spend: per((r) => mean(slice(r).map((l) => l.spent))),
      coins: per((r) => slice(r).at(-1)!.coinsAfter),
    });
  }
  const decoCount = per((r) => r.decorationLevels.length);
  const lastDeco = per((r) => r.decorationLevels.at(-1) ?? n);
  return {
    profile,
    runs,
    hours,
    earnPerLevel: per((r) => sumL(r, (l) => l.earned)) / n,
    spendPerLevel: per((r) => sumL(r, (l) => l.spent)) / n,
    boostersPerLevel: boosters / n,
    levelsPerBooster: boosters ? n / boosters : Infinity,
    coinBoostersPerLevel: per((r) => sumL(r, (l) => l.boosters.coins)) / n,
    bySource: {
      charge: per((r) => sumL(r, (l) => l.boosters.charge)),
      coins: per((r) => sumL(r, (l) => l.boosters.coins)),
      ad: per((r) => sumL(r, (l) => l.boosters.ad)),
    },
    byKind: {
      undo: per((r) => sumL(r, (l) => l.boostersByKind.undo)),
      extraJar: per((r) => sumL(r, (l) => l.boostersByKind.extraJar)),
      hint: per((r) => sumL(r, (l) => l.boostersByKind.hint)),
      shuffle: per((r) => sumL(r, (l) => l.boostersByKind.shuffle)),
    },
    shopDone,
    levelsPerDecoration: decoCount ? lastDeco / decoCount : Infinity,
    stylesBought: per((r) => r.stylesBought),
    rewardedPerHour: per((r) => r.rewardedAds / (r.totalSeconds / 3600)),
    interstitialPerHour: per((r) => r.interstitials / (r.totalSeconds / 3600)),
    maxCoins: Math.max(...runs.map((r) => r.maxCoins)),
    levelsAbove1000: Math.max(...runs.map((r) => r.levelsAbove1000)),
    firstTryByKind,
    attemptsByKind,
    blocks,
  };
}

export interface Check {
  label: string;
  target: string;
  value: string;
  ok: boolean;
}

export function checks(s: ProfileSummary[], cfg: GameConfig): Check[] {
  const [no, , often] = s as [ProfileSummary, ProfileSummary, ProfileSummary];
  const shops = cfg.economy.shops.map((x) => x.id);
  const lastShop = shops.at(-1)!;
  const perShop = shops.map((id, i) => {
    const end = no.shopDone[id];
    const start = i === 0 ? 0 : (no.shopDone[shops[i - 1]!] ?? 0);
    return end === null || end === undefined ? null : end - start;
  });
  const speedup =
    no.shopDone[lastShop] && often.shopDone[lastShop]
      ? no.shopDone[lastShop]! / often.shopDone[lastShop]! - 1
      : 0;
  const maxCoins = Math.max(...s.map((x) => x.maxCoins));
  return [
    {
      label: 'Reklamsız oyuncu güçlendirici sıklığı',
      target: 'her 4–6 seviyede 1',
      value: `her ${no.levelsPerBooster.toFixed(1)} seviyede 1`,
      ok: no.levelsPerBooster >= 4 && no.levelsPerBooster <= 6,
    },
    {
      label: 'Dekorasyon parçası sıklığı (reklamsız)',
      target: '~3 seviyede 1',
      value: `${no.levelsPerDecoration.toFixed(1)} seviyede 1`,
      ok: no.levelsPerDecoration >= 2.5 && no.levelsPerDecoration <= 3.5,
    },
    {
      label: 'Dükkân başına seviye (reklamsız)',
      target: '25–30',
      value: perShop.map((x) => x ?? '–').join(' / '),
      ok: perShop.every((x) => x !== null && x >= 22 && x <= 32),
    },
    {
      label: 'Sık izleyenin hızlanması (5 dükkân)',
      target: '%40–60',
      value: `%${Math.round(speedup * 100)}`,
      ok: speedup >= 0.4 && speedup <= 0.6,
    },
    {
      label: 'En yüksek altın bakiyesi (tüm profiller)',
      target: '< 1000',
      value: String(maxCoins),
      ok: maxCoins < 1000,
    },
    {
      label: 'Saatlik geçiş reklamı (en yüksek)',
      target: `≤ ${cfg.ads.interstitialMaxPerHour}`,
      value: Math.max(...s.map((x) => x.interstitialPerHour)).toFixed(1),
      ok: Math.max(...s.map((x) => x.interstitialPerHour)) <= cfg.ads.interstitialMaxPerHour,
    },
  ];
}

const f1 = (x: number) => x.toFixed(1);
const pct = (x: number) => `%${Math.round(x * 100)}`;

export function renderReport(
  sums: ProfileSummary[],
  cfg: GameConfig,
  levels: readonly LevelDef[],
  meta: { players: number; seconds: number },
): string {
  const L: string[] = [];
  const cs = checks(sums, cfg);
  L.push('# Denge raporu', '');
  L.push(
    `\`pnpm balance\` ile üretilir (scripts/balance). ${levels.length} seviye × 3 profil × ${meta.players} oyuncu, ${meta.seconds} sn. Değerler \`shared/src/config.ts\` › \`DEFAULT_CONFIG\`.`,
    '',
  );
  L.push('## Özet', '');
  L.push('| Hedef | İstenen | Sonuç | |', '| --- | --- | --- | :---: |');
  for (const c of cs) L.push(`| ${c.label} | ${c.target} | ${c.value} | ${c.ok ? '✅' : '❌'} |`);
  L.push('');
  L.push('## Profiller', '');
  L.push(
    '| | ' + sums.map((s) => s.profile.label).join(' | ') + ' |',
    '| --- | ' + sums.map(() => '---:').join(' | ') + ' |',
  );
  const row = (label: string, f: (s: ProfileSummary) => string) =>
    L.push(`| ${label} | ${sums.map(f).join(' | ')} |`);
  row('Oyun süresi (300 seviye)', (s) => `${f1(s.hours)} sa`);
  row('Seviye başına kazanç', (s) => `${f1(s.earnPerLevel)} altın`);
  row('Seviye başına harcama', (s) => `${f1(s.spendPerLevel)} altın`);
  row('Güçlendirici / seviye', (s) => s.boostersPerLevel.toFixed(2));
  row('… haktan', (s) => f1(s.bySource.charge));
  row('… altınla', (s) => f1(s.bySource.coins));
  row('… reklamla', (s) => f1(s.bySource.ad));
  row(
    'Geri al / boş kavanoz / karıştır',
    (s) => `${f1(s.byKind.undo)} / ${f1(s.byKind.extraJar)} / ${f1(s.byKind.shuffle)}`,
  );
  for (const shop of cfg.economy.shops)
    row(`Dükkân tamam: ${shop.id}`, (s) => String(s.shopDone[shop.id] ?? '—'));
  row('Ek stil alınan (90 üzerinden)', (s) => f1(s.stylesBought));
  row('Ödüllü reklam / saat', (s) => f1(s.rewardedPerHour));
  row('Geçiş reklamı / saat', (s) => f1(s.interstitialPerHour));
  row('Toplam reklam / saat', (s) => f1(s.rewardedPerHour + s.interstitialPerHour));
  row('En yüksek bakiye', (s) => String(s.maxCoins));
  L.push('');
  L.push('### İlk denemede bitirme (kilitlenmeden)', '');
  L.push(
    '| Tür | ' + sums.map((s) => s.profile.label).join(' | ') + ' | Ort. deneme (reklamsız) |',
    '| --- | ' + sums.map(() => '---:').join(' | ') + ' | ---: |',
  );
  for (const k of ['tutorial', 'normal', 'relief', 'hard', 'veryHard'])
    L.push(
      `| ${k} | ${sums.map((s) => pct(s.firstTryByKind[k] ?? 0)).join(' | ')} | ${f1(sums[0]!.attemptsByKind[k] ?? 0)} |`,
    );
  L.push('');
  L.push('### 50 seviyelik bloklarda altın (seviye başına ort.)', '');
  L.push(
    '| Seviyeler | ' +
      sums.map((s) => `${s.profile.label}: kazanç / harcama / bakiye`).join(' | ') +
      ' |',
    '| --- | ' + sums.map(() => '---:').join(' | ') + ' |',
  );
  sums[0]!.blocks.forEach((b, i) =>
    L.push(
      `| ${b.from}–${b.to} | ${sums.map((s) => `${f1(s.blocks[i]!.earn)} / ${f1(s.blocks[i]!.spend)} / ${Math.round(s.blocks[i]!.coins)}`).join(' | ')} |`,
    ),
  );
  L.push('');
  L.push('## Zorluk skoru', '');
  L.push('Testere dişi: her 5. seviye zor, her 20. çok zor, ardından rahatlatıcı.', '');
  L.push('```');
  for (const l of levels.slice(0, 60)) {
    const bar = '█'.repeat(Math.round(l.stats.difficulty * 4));
    const tag = l.kind === 'hard' ? ' zor' : l.kind === 'veryHard' ? ' ÇOK ZOR' : '';
    L.push(`${String(l.n).padStart(3)} ${bar.padEnd(40)} ${f1(l.stats.difficulty)}${tag}`);
  }
  L.push('```', '');
  L.push(difficultySvg(levels), '');
  L.push('## Değerler', '');
  L.push(
    `- Seviye ödülü: normal ${cfg.economy.levelReward.normal}, zor ${cfg.economy.levelReward.hard}, çok zor ${cfg.economy.levelReward.veryHard}; geri almadan +${cfg.economy.noUndoBonus}. Başlangıç ${cfg.economy.startCoins} altın.`,
    `- Güçlendiriciler: geri al ${cfg.economy.boosterPrice.undo}, boş kavanoz ${cfg.economy.boosterPrice.extraJar}, ipucu ${cfg.economy.boosterPrice.hint}, karıştır ${cfg.economy.boosterPrice.shuffle}. Başlangıçta her birinden ${cfg.economy.startBoosters.undo} hak.`,
    `- Günlük hediye: ${cfg.economy.dailyGift.join(', ')}. Günün bulmacası ${cfg.economy.dailyPuzzleReward}.`,
    `- Altın veren ödüllü reklam ("2x al", "eksiği tamamla") günde en fazla ${cfg.economy.coinAdsPerDay}. Eksik ${cfg.economy.topUpAdMax} altınden azsa tamamlama teklifi.`,
    `- Dekorasyon: ${cfg.economy.shops.map((s) => `${s.id} ${s.items.reduce((a, i) => a + i.price, 0)}`).join(', ')} altın (9 parça); ek stil = parça fiyatı × ${cfg.economy.extraStyleRatio}.`,
    '',
  );
  L.push('## Varsayımlar', '');
  L.push(
    '- Oyuncu botu çözücünün planını izler; her hamlede `0,03 + 0,035 × zorluk` olasılıkla rastgele anlamlı bir döküm yapar (hata). Hatadan sonra plan yeniden hesaplanır; çözüm kalmadıysa kilitlenmiş sayılır.',
    '- Kilitlenince sıra: geri al / boş kavanoz / karıştır hakkı → (reklam profili kabul ederse) "son bir şans" reklamı → %60 olasılıkla altını yetiyorsa altınla geri al → baştan dene.',
    '- Dekorasyon: her seviye sonunda en ucuz eksik parça alınır; güçlendirici hakları bittiyse 60 altın yedek tutulur. Tüm parçalar bitince ek stiller alınır.',
    "- Süre: hamle 2,4 sn, deneme başına 10 sn, seviye arası 14 sn, ödüllü reklam 30 sn, geçiş reklamı 15 sn. Oturum 18 dk, günde 2 oturum; günün bulmacası günlerin %60'ında.",
    '- "Reklam izleme oranı" her ödüllü fırsat için ayrı ayrı uygulanır (2x, son şans, günlük hediye 2x, eksik altın).',
    '',
  );
  void PROFILES;
  return L.join('\n');
}

function difficultySvg(levels: readonly LevelDef[]): string {
  const w = 900;
  const h = 200;
  const x = (n: number) => 30 + ((n - 1) / (levels.length - 1)) * (w - 40);
  const y = (d: number) => h - 20 - ((d - 1) / 9) * (h - 40);
  const pts = levels
    .map((l) => `${x(l.n).toFixed(1)},${y(l.stats.difficulty).toFixed(1)}`)
    .join(' ');
  const grid = [1, 4, 7, 10]
    .map(
      (d) =>
        `<line x1="30" x2="${w - 10}" y1="${y(d)}" y2="${y(d)}" stroke="#ccc"/><text x="6" y="${y(d) + 4}" font-size="11" fill="#666">${d}</text>`,
    )
    .join('');
  const marks = levels
    .filter((l) => l.kind === 'veryHard')
    .map(
      (l) =>
        `<circle cx="${x(l.n).toFixed(1)}" cy="${y(l.stats.difficulty).toFixed(1)}" r="3" fill="#D3352B"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="sans-serif"><rect width="${w}" height="${h}" fill="#fff"/>${grid}<polyline points="${pts}" fill="none" stroke="#8B5330" stroke-width="1"/>${marks}</svg>`;
}
