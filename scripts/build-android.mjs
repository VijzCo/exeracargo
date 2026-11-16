// Web build for the Android app + Capacitor sync.
// Push notifications are only compiled in when android/app/google-services.json exists
// (without it Firebase isn't initialised natively and registering for push would crash).
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const push = existsSync('android/app/google-services.json');
const env = { ...process.env, VITE_ANDROID_PUSH: push ? '1' : '0' };
if (!push) console.warn('[build:android] android/app/google-services.json not found — push notifications disabled in this build.');
const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });
run('node scripts/copy-ocr-assets.mjs');
run('npx tsc -b');
run('npx vite build --mode android');
run('npx cap sync android');
