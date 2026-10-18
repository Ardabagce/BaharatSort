import { DEFAULT_CONFIG } from '@baharat-sort/shared';
import Fastify, { type FastifyReply, type FastifyServerOptions } from 'fastify';
import type { Env } from './env';
import { landingPage, privacyPage, supportPage } from './pages';

/**
 * Baharat Sort sunucusu. Şimdilik: tanıtım, gizlilik ve destek sayfaları (App Store bağlantıları),
 * sağlık kontrolü ve uzak ayar (/config). Veritabanı, olaylar ve seviye paketleri 6. aşamada.
 */
export interface AppDeps {
  env: Env;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ env, logger = false }: AppDeps) {
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 64 * 1024 });

  const html = (body: string) => (_req: unknown, reply: FastifyReply) =>
    reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'public, max-age=3600')
      .send(body);

  app.get('/', html(landingPage()));
  app.get('/privacy', html(privacyPage(env.SUPPORT_EMAIL)));
  app.get('/support', html(supportPage(env.SUPPORT_EMAIL)));
  app.get('/health', async () => ({ ok: true }));
  app.get('/config', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return { ...DEFAULT_CONFIG, minAppVersion: env.MIN_APP_VERSION };
  });

  return app;
}
