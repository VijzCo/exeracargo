// Generates the Android launcher icon (adaptive), splash screens and notification icon
// from public/driver-icon.svg, then runs @capacitor/assets. Run: npm run android:assets
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const BG = '#0A0F1C';
const ACCENT = '#F5A524';
const svg = await readFile('public/driver-icon.svg', 'utf8');
// truck glyph only (no rounded tile) for adaptive foreground + splash
const glyph = svg.replace(/<rect[^>]*\/>/, '');

await mkdir('assets', { recursive: true });
await sharp(Buffer.from(svg.replace('rx="112"', 'rx="0"'))).resize(1024, 1024).png().toFile('assets/icon-only.png');
// adaptive foreground: glyph within the 66% safe zone of a transparent 1024 canvas
const fg = await sharp(Buffer.from(glyph)).resize(600, 600).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fg, gravity: 'center' }])
  .png()
  .toFile('assets/icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#111827' } }).png().toFile('assets/icon-background.png');
const splashGlyph = await sharp(Buffer.from(glyph)).resize(700, 700).png().toBuffer();
for (const f of ['splash.png', 'splash-dark.png'])
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
    .composite([{ input: splashGlyph, gravity: 'center' }])
    .png()
    .toFile(`assets/${f}`);

execSync('npx capacitor-assets generate --android --iconBackgroundColor "#111827" --iconBackgroundColorDark "#111827" --splashBackgroundColor "' + BG + '" --splashBackgroundColorDark "' + BG + '"', {
  stdio: 'inherit',
});

// status-bar notification icon must be a white silhouette (vector drawable) + accent colour
const res = 'android/app/src/main/res';
await mkdir(`${res}/drawable`, { recursive: true });
await writeFile(
  `${res}/drawable/ic_stat_notify.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<!-- Exera Cargo truck silhouette for the notification bar (must be white on transparent) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="512" android:viewportHeight="512">
    <path android:strokeColor="#FFFFFFFF" android:strokeWidth="32" android:strokeLineCap="round" android:strokeLineJoin="round"
        android:fillColor="#00000000" android:pathData="M96,168h200v156H96zM296,216h64l56,56v52H296" />
    <path android:fillColor="#FFFFFFFF" android:pathData="M160,352m-40,0a40,40 0,1 1,80 0a40,40 0,1 1,-80 0" />
    <path android:fillColor="#FFFFFFFF" android:pathData="M352,352m-40,0a40,40 0,1 1,80 0a40,40 0,1 1,-80 0" />
</vector>
`,
);
await mkdir(`${res}/values`, { recursive: true });
await writeFile(
  `${res}/values/notify_colors.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="notify_accent">${ACCENT}</color>
</resources>
`,
);
console.log('Android icons, splash and notification icon generated.');
