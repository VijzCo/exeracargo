// Writes public/.well-known/assetlinks.json so Android verifies https://<host>/j/* links for the driver app.
// Usage: ANDROID_SHA256="AB:CD:…[,second fingerprint]" node scripts/assetlinks.mjs
//   Fingerprint: `keytool -list -v -keystore exera-release.jks -alias exera` (SHA256 line), and — if you
//   publish on Google Play — also the "App signing key certificate" SHA-256 from Play Console.
import { mkdir, writeFile } from 'node:fs/promises';

const pkg = process.env.ANDROID_PACKAGE || 'com.exeracargo.driver';
const prints = (process.env.ANDROID_SHA256 || '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
if (!prints.length) {
  console.error('Set ANDROID_SHA256 to the SHA-256 certificate fingerprint(s) of your signing key.');
  process.exit(1);
}
for (const f of prints)
  if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)) {
    console.error(`Not a SHA-256 fingerprint: ${f}`);
    process.exit(1);
  }
const json = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints },
  },
];
await mkdir('public/.well-known', { recursive: true });
await writeFile('public/.well-known/assetlinks.json', JSON.stringify(json, null, 2) + '\n');
console.log(`public/.well-known/assetlinks.json written for ${pkg} (${prints.length} key${prints.length > 1 ? 's' : ''}). Deploy hosting to publish.`);
