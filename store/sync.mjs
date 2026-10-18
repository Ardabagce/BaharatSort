// Mağaza bilgilerini App Store Connect'e yazar (store/metadata.json + store/screenshots). Tekrar çalıştırılabilir:
// var olanı günceller, yoksa oluşturur. İncelemeye GÖNDERMEZ.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { asc, findApp } from './asc.mjs';

const here = (p) => new URL(p, import.meta.url);
const meta = JSON.parse(readFileSync(here('metadata.json'), 'utf8'));
const step = (s) => console.log(`\n▶ ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);
let failures = 0;
const must = (r, what) => {
  if (r.ok) ok(what);
  else failures++;
  return r;
};

const app = await findApp(meta.bundleId);
console.log(`Uygulama ${app.attributes.name} (${app.id})`);

step('İçerik hakları');
must(
  await asc('PATCH', `/v1/apps/${app.id}`, {
    data: {
      type: 'apps',
      id: app.id,
      attributes: { contentRightsDeclaration: meta.contentRights },
    },
  }),
  meta.contentRights,
);

step('Kategori');
const info =
  (await asc('GET', `/v1/apps/${app.id}/appInfos`)).json.data.find(
    (i) => (i.attributes.appStoreState ?? i.attributes.state) !== 'READY_FOR_SALE',
  ) ?? (await asc('GET', `/v1/apps/${app.id}/appInfos`)).json.data[0];
const cat = (id) => (id ? { data: { type: 'appCategories', id } } : { data: null });
must(
  await asc('PATCH', `/v1/appInfos/${info.id}`, {
    data: {
      type: 'appInfos',
      id: info.id,
      relationships: {
        primaryCategory: cat(meta.category.primary),
        primarySubcategoryOne: cat(meta.category.sub1),
        primarySubcategoryTwo: cat(meta.category.sub2),
      },
    },
  }),
  `${meta.category.primary} › ${meta.category.sub1}, ${meta.category.sub2}`,
);

step('Uygulama bilgileri (ad, alt başlık, gizlilik URL)');
const infoLocs = (await asc('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).json.data;
for (const [locale, L] of Object.entries(meta.locales)) {
  const attributes = { name: L.name, subtitle: L.subtitle, privacyPolicyUrl: meta.urls.privacy };
  const have = infoLocs.find((x) => x.attributes.locale === locale);
  must(
    have
      ? await asc('PATCH', `/v1/appInfoLocalizations/${have.id}`, {
          data: { type: 'appInfoLocalizations', id: have.id, attributes },
        })
      : await asc('POST', '/v1/appInfoLocalizations', {
          data: {
            type: 'appInfoLocalizations',
            attributes: { locale, ...attributes },
            relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } },
          },
        }),
    `${locale}: ${L.name} — ${L.subtitle}`,
  );
}

step('Yaş derecesi (her şey Yok/Hayır; reklam var)');
const ageR = await asc('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
const age = ageR.json?.data;
if (age) {
  const ENUM_NONE = new Set([
    'alcoholTobaccoOrDrugUseOrReferences',
    'contests',
    'gamblingSimulated',
    'gunsOrOtherWeapons',
    'horrorOrFearThemes',
    'matureOrSuggestiveThemes',
    'medicalOrTreatmentInformation',
    'profanityOrCrudeHumor',
    'sexualContentGraphicAndNudity',
    'sexualContentOrNudity',
    'violenceCartoonOrFantasy',
    'violenceRealistic',
    'violenceRealisticProlongedGraphicOrSadistic',
  ]);
  const FALSE = new Set([
    'gambling',
    'unrestrictedWebAccess',
    'lootBox',
    'messagingAndChat',
    'parentalControls',
    'ageAssurance',
    'userGeneratedContent',
    'healthOrWellnessTopics',
    'seventeenPlus',
  ]);
  let attrs = {};
  for (const k of Object.keys(age.attributes)) {
    if (ENUM_NONE.has(k)) attrs[k] = 'NONE';
    else if (FALSE.has(k)) attrs[k] = false;
    else if (k === 'advertising') attrs[k] = true;
    else console.log(`  · ${k} = ${JSON.stringify(age.attributes[k])} (dokunulmadı)`);
  }
  for (let tries = 0; tries < 6; tries++) {
    const r = await asc('PATCH', `/v1/ageRatingDeclarations/${age.id}`, {
      data: { type: 'ageRatingDeclarations', id: age.id, attributes: attrs },
    });
    if (r.ok) {
      ok(`${Object.keys(attrs).length} soru cevaplandı`);
      break;
    }
    const bad = (r.json?.errors ?? [])
      .map((e) => e.source?.pointer?.split('/').pop())
      .filter((k) => k && k in attrs);
    if (!bad.length) {
      failures++;
      break;
    }
    for (const k of bad) delete attrs[k];
    attrs = { ...attrs };
  }
}

step('Sürüm 1.0: telif, açıklamalar, anahtar kelimeler');
const versions = (await asc('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS`)).json
  .data;
let version = versions.find((v) => v.attributes.versionString === meta.version);
if (!version) {
  version = (
    await asc('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString: meta.version },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    })
  ).json?.data;
}
must(
  await asc('PATCH', `/v1/appStoreVersions/${version.id}`, {
    data: { type: 'appStoreVersions', id: version.id, attributes: { copyright: meta.copyright } },
  }),
  `telif: ${meta.copyright}`,
);
const vLocs = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`))
  .json.data;
const vLocByLocale = {};
for (const [locale, L] of Object.entries(meta.locales)) {
  const attributes = {
    description: L.description,
    keywords: L.keywords,
    promotionalText: L.promotionalText,
    supportUrl: meta.urls.support,
  };
  const have = vLocs.find((x) => x.attributes.locale === locale);
  const r = have
    ? await asc('PATCH', `/v1/appStoreVersionLocalizations/${have.id}`, {
        data: { type: 'appStoreVersionLocalizations', id: have.id, attributes },
      })
    : await asc('POST', '/v1/appStoreVersionLocalizations', {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale, ...attributes },
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      });
  must(
    r,
    `${locale}: açıklama ${L.description.length} karakter, anahtar kelime ${L.keywords.length}`,
  );
  vLocByLocale[locale] = have?.id ?? r.json?.data?.id;
}

step('İnceleme notları');
const rd = await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`);
const rdAttrs = {
  notes: meta.review.notes,
  demoAccountRequired: false,
  ...(meta.review.contact ?? {}),
};
must(
  rd.json?.data
    ? await asc('PATCH', `/v1/appStoreReviewDetails/${rd.json.data.id}`, {
        data: { type: 'appStoreReviewDetails', id: rd.json.data.id, attributes: rdAttrs },
      })
    : await asc('POST', '/v1/appStoreReviewDetails', {
        data: {
          type: 'appStoreReviewDetails',
          attributes: rdAttrs,
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      }),
  'notlar yazıldı',
);

step('Fiyat: ücretsiz');
const points =
  (await asc('GET', `/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200`)).json
    ?.data ?? [];
const free = points.find((p) => Number(p.attributes.customerPrice) === 0);
if (!free) {
  console.log('  ✗ ücretsiz fiyat noktası bulunamadı');
  failures++;
} else {
  must(
    await asc('POST', '/v1/appPriceSchedules', {
      data: {
        type: 'appPriceSchedules',
        relationships: {
          app: { data: { type: 'apps', id: app.id } },
          baseTerritory: { data: { type: 'territories', id: 'USA' } },
          manualPrices: { data: [{ type: 'appPrices', id: '${free}' }] },
        },
      },
      included: [
        {
          type: 'appPrices',
          id: '${free}',
          attributes: { startDate: null },
          relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } },
        },
      ],
    }),
    'ücretsiz (taban ülke ABD)',
  );
}

step('Dağıtım: tüm ülkeler');
const terr = (await asc('GET', '/v1/territories?limit=200')).json?.data ?? [];
const avail = await asc('GET', `/v1/apps/${app.id}/appAvailabilityV2`, null, { quiet: true });
if (avail.ok) ok('dağıtım zaten ayarlı');
else {
  must(
    await asc('POST', '/v2/appAvailabilities', {
      data: {
        type: 'appAvailabilities',
        attributes: { availableInNewTerritories: true },
        relationships: {
          app: { data: { type: 'apps', id: app.id } },
          territoryAvailabilities: {
            data: terr.map((t) => ({ type: 'territoryAvailabilities', id: `\${${t.id}}` })),
          },
        },
      },
      included: terr.map((t) => ({
        type: 'territoryAvailabilities',
        id: `\${${t.id}}`,
        attributes: { available: true },
        relationships: { territory: { data: { type: 'territories', id: t.id } } },
      })),
    }),
    `${terr.length} ülke`,
  );
}

step('Ekran görüntüleri (6,9" / APP_IPHONE_67)');
const SHOT_LOCALE = { tr: 'tr', 'en-US': 'en' };
for (const [locale, dir] of Object.entries(SHOT_LOCALE)) {
  const locId = vLocByLocale[locale];
  if (!locId) continue;
  const files = readdirSync(here(`screenshots/${dir}/`))
    .filter((f) => /\.(png|jpe?g)$/.test(f))
    .sort();
  const sets =
    (await asc('GET', `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets`)).json?.data ??
    [];
  let set = sets.find((s) => s.attributes.screenshotDisplayType === 'APP_IPHONE_67');
  if (!set) {
    set = (
      await asc('POST', '/v1/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: 'APP_IPHONE_67' },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: locId },
            },
          },
        },
      })
    ).json?.data;
  }
  if (!set) {
    failures++;
    continue;
  }
  // Önceki görüntüleri sil, sırayla yeniden yükle (tekrar çalıştırılabilir olsun).
  const old = (await asc('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`)).json?.data ?? [];
  for (const s of old) await asc('DELETE', `/v1/appScreenshots/${s.id}`);
  for (const f of files) {
    const path = here(`screenshots/${dir}/${f}`);
    const buf = readFileSync(path);
    const res = await asc('POST', '/v1/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName: `${dir}-${f}`, fileSize: statSync(path).size },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } },
      },
    });
    const shot = res.json?.data;
    if (!shot) {
      failures++;
      continue;
    }
    for (const op of shot.attributes.uploadOperations) {
      const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
      const put = await fetch(op.url, {
        method: op.method,
        headers,
        body: buf.subarray(op.offset, op.offset + op.length),
      });
      if (!put.ok) console.log(`  ✗ yükleme parçası ${put.status}`);
    }
    must(
      await asc('PATCH', `/v1/appScreenshots/${shot.id}`, {
        data: {
          type: 'appScreenshots',
          id: shot.id,
          attributes: {
            uploaded: true,
            sourceFileChecksum: createHash('md5').update(buf).digest('hex'),
          },
        },
      }),
      `${locale} ${f}`,
    );
  }
}

console.log(failures ? `\n${failures} adım başarısız (yukarıda ✗).` : '\nTümü tamam.');
if (failures) process.exitCode = 1;
