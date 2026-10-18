import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json'u derleme zamanı ortam değişkenleriyle tamamlar (sır yok).
 *   IOS_BUILD_NUMBER   CI'da 100 + run_number (VapurJam ile aynı)
 * Reklam kimlikleri ve ATT/UMP 7. aşamada eklenecek; şimdilik reklamlar oyunun içinde simülasyon.
 */
const env = (k: string) => process.env[k]?.trim() || undefined;

export default ({ config }: ConfigContext): ExpoConfig => {
  const buildNumber = env('IOS_BUILD_NUMBER');
  return {
    ...config,
    name: config.name ?? 'Baharat Sort',
    slug: config.slug ?? 'baharat-sort',
    ios: { ...config.ios, ...(buildNumber ? { buildNumber } : {}) },
  };
};
