import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Gizlilik ve destek sayfalarında gösterilen iletişim adresi (isteğe bağlı). */
  SUPPORT_EMAIL: z.string().optional(),
  /** Uygulamanın kabul edilen en eski sürümü (/config). */
  MIN_APP_VERSION: z.string().default('0.0.0'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return schema.parse(source);
}
