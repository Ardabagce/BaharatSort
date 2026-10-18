// Sunucuyu (shared dahil) tek bir ESM dosyasına paketler; Docker imajında node_modules gerekmez.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  // Gömülü 1000 seviye /config için gerekmez; paket küçük kalsın diye dışarıda.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});
