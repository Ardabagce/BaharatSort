import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadEnv } from './env';

describe('sunucu', () => {
  it('sayfalar, sağlık ve uzak ayar', async () => {
    const app = await buildApp({ env: loadEnv({ SUPPORT_EMAIL: 'destek@example.com' }) });
    for (const path of ['/', '/privacy', '/support']) {
      const r = await app.inject({ method: 'GET', url: path });
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toContain('text/html');
      expect(r.body).toContain('Baharat Sort');
    }
    const privacy = await app.inject({ method: 'GET', url: '/privacy' });
    expect(privacy.body).toContain('Gizlilik Politikası');
    expect(privacy.body).toContain('Privacy Policy');
    expect(privacy.body).toContain('destek@example.com');
    expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({ ok: true });
    const cfg = (await app.inject({ method: 'GET', url: '/config' })).json();
    expect(cfg.economy.startCoins).toBeGreaterThan(0);
    expect((await app.inject({ method: 'GET', url: '/yok' })).statusCode).toBe(404);
    await app.close();
  });
});
