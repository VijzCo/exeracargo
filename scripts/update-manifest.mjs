// Writes the Android auto-update files into the website build (used by .github/workflows/release.yml).
//
//   node scripts/update-manifest.mjs <android-dist> <site-dist> <version> <origin> <versionCode> <minVersionCode> <apkPath>
//
// Output in <site-dist>/app-update/:
//   latest.json                 manifest read by src/native/updater.ts
//   <version>/…                 the app's web files (one URL per file → delta updates: the app only
//                               downloads files whose SHA-256 differs from what it already has)
//   exera-cargo-driver.apk      latest APK (first installs) + exera-cargo-driver-<version>.apk
// The OCR engine (ocr/, ~22 MB) is not copied again: the website already serves identical files at /ocr/.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const [androidDist, siteDist, version, origin, versionCode, minVersionCode, apkPath] = process.argv.slice(2);
if (!apkPath) {
  console.error('usage: update-manifest.mjs <android-dist> <site-dist> <version> <origin> <versionCode> <minVersionCode> <apkPath>');
  process.exit(1);
}
const base = origin.replace(/\/$/, '');
const out = join(siteDist, 'app-update');
const SKIP = [/^\.well-known\//, /^app-update\//];

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

const manifest = [];
let bytes = 0;
for await (const file of walk(androidDist)) {
  const rel = relative(androidDist, file).split(sep).join('/');
  if (SKIP.some((r) => r.test(rel))) continue;
  const buf = await readFile(file);
  const hash = createHash('sha256').update(buf).digest('hex');
  let url;
  if (rel.startsWith('ocr/')) url = `${base}/${rel}`;
  else {
    const dest = join(out, version, rel);
    await mkdir(join(dest, '..'), { recursive: true });
    await copyFile(file, dest);
    url = `${base}/app-update/${version}/${rel}`;
    bytes += buf.length;
  }
  manifest.push({ file_name: rel, file_hash: hash, download_url: url });
}

await mkdir(out, { recursive: true });
await copyFile(apkPath, join(out, 'exera-cargo-driver.apk'));
await copyFile(apkPath, join(out, `exera-cargo-driver-${version}.apk`));
const apkSize = (await stat(apkPath)).size;

const latest = {
  version,
  publishedAt: new Date().toISOString(),
  bundle: { minVersionCode: Number(minVersionCode), manifest },
  apk: {
    url: `/app-update/exera-cargo-driver-${version}.apk`,
    versionCode: Number(versionCode),
    versionName: version,
    minVersionCode: Number(minVersionCode),
    size: apkSize,
  },
};
await writeFile(join(out, 'latest.json'), JSON.stringify(latest, null, 1));
console.log(`app-update ${version}: ${manifest.length} files (${(bytes / 1e6).toFixed(1)} MB hosted), APK ${(apkSize / 1e6).toFixed(1)} MB, minVersionCode ${minVersionCode}`);
