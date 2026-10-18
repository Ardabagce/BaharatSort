// Salt okunur keşif: neyin API ile yapılabildiğini ölçer, hiçbir şeyi değiştirmez.
import { asc, findApp } from './asc.mjs';

const app = await findApp('dev.bagce.baharatsort');
console.log(
  `Uygulama: ${app.attributes.name} (${app.id}) ana dil ${app.attributes.primaryLocale}, içerik hakları: ${app.attributes.contentRightsDeclaration}`,
);
const show = async (label, path, opts) => {
  const r = await asc('GET', path, null, { quiet: true, ...opts });
  const n = Array.isArray(r.json?.data) ? r.json.data.length : r.json?.data ? 1 : 0;
  console.log(
    `${r.ok ? '✓' : '✗'} ${label}: ${r.status} (${n} kayıt)${r.ok ? '' : ' ' + (r.json?.errors?.[0]?.detail ?? '').slice(0, 160)}`,
  );
  return r;
};
const infos = await show('appInfos', `/v1/apps/${app.id}/appInfos`);
for (const i of infos.json?.data ?? [])
  console.log(`   appInfo ${i.id} durum ${i.attributes.appStoreState ?? i.attributes.state}`);
const vers = await show('appStoreVersions', `/v1/apps/${app.id}/appStoreVersions`);
for (const v of vers.json?.data ?? [])
  console.log(
    `   sürüm ${v.attributes.versionString} ${v.attributes.appStoreState ?? v.attributes.appVersionState} ${v.id}`,
  );
const info = infos.json?.data?.[0];
if (info) {
  await show('appInfoLocalizations', `/v1/appInfos/${info.id}/appInfoLocalizations`);
  await show('ageRatingDeclaration (appInfo)', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
  await show('primaryCategory', `/v1/appInfos/${info.id}/primaryCategory`);
}
await show(
  'builds',
  `/v1/builds?filter[app]=${app.id}&limit=5&fields[builds]=version,processingState,uploadedDate`,
);
await show('appPriceSchedule', `/v1/apps/${app.id}/appPriceSchedule`);
await show('appAvailabilityV2', `/v1/apps/${app.id}/appAvailabilityV2`);
await show(
  'reviewDetail',
  vers.json?.data?.[0]
    ? `/v1/appStoreVersions/${vers.json.data[0].id}/appStoreReviewDetail`
    : '/v1/apps',
);
// Gizlilik (App Privacy) için olası uçlar
await show('privacy: /v1/apps/{id}/dataUsages', `/v1/apps/${app.id}/dataUsages`);
await show('privacy: /v1/appDataUsages', `/v1/appDataUsages?filter[app]=${app.id}`);
await show('privacy: /v1/apps/{id}/appDataUsages', `/v1/apps/${app.id}/appDataUsages`);
await show(
  'privacy: /v1/apps/{id}/dataUsagePublishState',
  `/v1/apps/${app.id}/dataUsagePublishState`,
);
await show(
  'privacy: iris dataUsages',
  `https://appstoreconnect.apple.com/iris/v1/apps/${app.id}/dataUsages`,
);
await show(
  'privacy: iris appDataUsagesPublishState',
  `https://appstoreconnect.apple.com/iris/v1/apps/${app.id}/dataUsagePublishState`,
);
