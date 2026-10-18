// App Store Connect API istemcisi (bağımlılıksız, Node 22). Yalnızca GitHub Actions'ta, depo sırlarıyla çalışır:
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (.p8 dosyasının yolu; ios.yml/store.yml kurar)
// Hiçbir sır ya da belirteç yazdırılmaz; kayıtlarda yalnızca kimlikler ve durum kodları görünür (repo public).
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const API = 'https://api.appstoreconnect.apple.com';
let token = '';
let tokenExp = 0;

function jwt() {
  const now = Math.floor(Date.now() / 1000);
  if (token && now < tokenExp - 60) return token;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' });
  const body = b64({
    iss: process.env.ASC_ISSUER_ID,
    iat: now,
    exp: now + 1100,
    aud: 'appstoreconnect-v1',
  });
  const key = createPrivateKey(readFileSync(process.env.ASC_KEY_PATH, 'utf8'));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  token = `${head}.${body}.${sig.toString('base64url')}`;
  tokenExp = now + 1100;
  return token;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** İstek; hata gövdesindeki Apple açıklamaları (sır içermez) yazdırılır. */
export async function asc(method, path, body, { base = API, quiet = false } = {}) {
  const res = await fetch(path.startsWith('http') ? path : base + path, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = parseJson(text);
  if (!res.ok && !quiet) {
    const errs = json?.errors?.map((e) => `${e.code}: ${e.detail ?? e.title}`).join(' | ');
    console.log(`  ✗ ${method} ${path.replace(base, '')} → ${res.status} ${errs ?? ''}`);
  }
  return { status: res.status, ok: res.ok, json };
}

export async function findApp(bundleId) {
  const r = await asc(
    'GET',
    `/v1/apps?filter[bundleId]=${bundleId}&fields[apps]=name,bundleId,primaryLocale,sku,contentRightsDeclaration`,
  );
  const app = r.json?.data?.[0];
  if (!app) throw new Error(`App Store Connect'te ${bundleId} kayıtlı uygulama bulunamadı`);
  return app;
}
