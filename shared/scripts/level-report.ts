import type { LevelDef, LevelKind } from '../src/types';

const KIND_LABEL: Record<LevelKind, string> = {
  tutorial: 'eğitici',
  normal: 'normal',
  relief: 'rahatlatıcı',
  hard: 'zor',
  veryHard: 'çok zor',
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (x: number) => x.toFixed(1);

/** Zorluk dağılımı ve eğri: docs/levels.md. */
export function levelReport(levels: LevelDef[], target: (n: number) => number): string {
  const lines: string[] = [];
  lines.push('# Gömülü 300 seviye: zorluk dağılımı', '');
  lines.push('`pnpm levels` ile üretilir (shared/scripts/generate-levels.ts). Elle düzenleme.', '');
  lines.push('## Türlere göre', '');
  lines.push(
    '| Tür | Adet | Ort. zorluk | Ort. en kısa çözüm | Ort. dallanma | Ort. çıkmaz oranı |',
  );
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const kind of Object.keys(KIND_LABEL) as LevelKind[]) {
    const ls = levels.filter((l) => l.kind === kind);
    if (!ls.length) continue;
    lines.push(
      `| ${KIND_LABEL[kind]} | ${ls.length} | ${f1(avg(ls.map((l) => l.stats.difficulty)))} | ${f1(avg(ls.map((l) => l.stats.minMoves)))} | ${f1(avg(ls.map((l) => l.stats.branching)))} | ${(avg(ls.map((l) => l.stats.deadEndRate)) * 100).toFixed(0)}% |`,
    );
  }
  lines.push('', '## 30 seviyelik bloklar', '');
  lines.push('| Seviyeler | Normal ort. | Zor ort. | Çok zor | Renk (ort.) | Öğeler |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- |');
  for (let a = 1; a <= levels.length; a += 30) {
    const ls = levels.slice(a - 1, a + 29);
    const by = (k: LevelKind[]) =>
      f1(avg(ls.filter((l) => k.includes(l.kind)).map((l) => l.stats.difficulty)));
    const colors = avg(ls.map((l) => new Set(l.jars.flatMap((j) => j.layers)).size));
    const feats = new Map<string, number>();
    for (const l of ls) for (const f of l.features) feats.set(f, (feats.get(f) ?? 0) + 1);
    lines.push(
      `| ${a}–${a + ls.length - 1} | ${by(['normal', 'relief', 'tutorial'])} | ${by(['hard'])} | ${by(['veryHard'])} | ${f1(colors)} | ${[...feats].map(([f, c]) => `${f} ${c}`).join(', ') || '–'} |`,
    );
  }
  lines.push('', '## Zorluk eğrisi (1–100)', '');
  lines.push(
    '`█` gerçek skor, `·` hedef. Testere dişi: her 5. zor, her 20. çok zor, ardından rahatlatıcı.',
    '',
  );
  lines.push('```');
  for (const l of levels.slice(0, 100)) {
    const bar = Math.round(l.stats.difficulty * 4);
    const t = Math.round(target(l.n) * 4);
    let row = '';
    for (let i = 1; i <= 40; i++) row += i <= bar ? '█' : i === t ? '·' : ' ';
    lines.push(
      `${String(l.n).padStart(3)} ${row} ${f1(l.stats.difficulty)} ${l.kind === 'tutorial' || l.kind === 'normal' ? '' : KIND_LABEL[l.kind]}`,
    );
  }
  lines.push('```', '');
  lines.push('## Tüm seviyeler (SVG)', '');
  lines.push(svgChart(levels));
  lines.push('');
  return lines.join('\n');
}

function svgChart(levels: LevelDef[]): string {
  const w = 900;
  const h = 220;
  const x = (n: number) => 30 + ((n - 1) / (levels.length - 1)) * (w - 40);
  const y = (d: number) => h - 20 - ((d - 1) / 9) * (h - 40);
  const color: Record<LevelKind, string> = {
    tutorial: '#8FCC69',
    normal: '#8B5330',
    relief: '#8FCC69',
    hard: '#F07A16',
    veryHard: '#D3352B',
  };
  const pts = levels
    .map((l) => `${x(l.n).toFixed(1)},${y(l.stats.difficulty).toFixed(1)}`)
    .join(' ');
  const dots = levels
    .filter((l) => l.kind === 'hard' || l.kind === 'veryHard')
    .map(
      (l) =>
        `<circle cx="${x(l.n).toFixed(1)}" cy="${y(l.stats.difficulty).toFixed(1)}" r="${l.kind === 'veryHard' ? 3.5 : 2.2}" fill="${color[l.kind]}"/>`,
    )
    .join('');
  const grid = [2, 4, 6, 8, 10]
    .map(
      (d) =>
        `<line x1="30" x2="${w - 10}" y1="${y(d)}" y2="${y(d)}" stroke="#ddd"/><text x="4" y="${y(d) + 4}" font-size="10">${d}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="sans-serif">${grid}<polyline points="${pts}" fill="none" stroke="#8B5330" stroke-width="1"/>${dots}</svg>`;
}
