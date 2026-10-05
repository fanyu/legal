#!/usr/bin/env node
// Dry-run is the default. Secrets are read from the environment, never flags.
// Example: node scripts/notify-launch.mjs flow https://apps.apple.com/app/id123
// Actual send (only after owner authorization): append --send --confirm 'SEND flow'.
const [app, url, ...args] = process.argv.slice(2);
const allowed = new Set(['flow', 'odo', 'pastetrail']);
function fail(message) { console.error(message); process.exit(1); }
if (!allowed.has(app) || !url) fail('Usage: node scripts/notify-launch.mjs <flow|odo|pastetrail> <launch-url> [--send --confirm "SEND app"] [--limit 1..5]');
const send = args.includes('--send');
const confirmIndex = args.indexOf('--confirm');
const confirm = confirmIndex === -1 ? null : args[confirmIndex + 1];
const limitIndex = args.indexOf('--limit');
const limit = limitIndex === -1 ? 5 : Number(args[limitIndex + 1]);
if (!Number.isInteger(limit) || limit < 1 || limit > 5) fail('Limit must be an integer from 1 to 5.');
if (send && confirm !== `SEND ${app}`) fail(`Actual sending requires --confirm 'SEND ${app}'.`);
const token = process.env.WAITLIST_ADMIN_TOKEN;
if (!token || token.length < 32) fail('Set WAITLIST_ADMIN_TOKEN securely in the environment.');
const site = new URL(process.env.SITE_URL || 'https://flowwish.app');
if (site.protocol !== 'https:' && !(site.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname))) fail('SITE_URL must use HTTPS (localhost may use HTTP).');
if (site.username || site.password || site.pathname !== '/' || site.search || site.hash) fail('SITE_URL must be an origin without credentials or a path.');
let response;
try {
  response = await fetch(new URL('/api/admin/notify', site), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ app, url, limit, dryRun: !send, ...(send ? { confirm } : {}) }),
    signal: AbortSignal.timeout(60000),
  });
} catch { fail('The request did not complete. Inspect status before another confirmed batch; do not blindly repeat a timed-out send.'); }
let result;
try { result = await response.json(); } catch { fail('The server returned an invalid response.'); }
if (!response.ok || result.ok !== true) fail(`Request failed: HTTP ${response.status}, ${result.error || 'unavailable'}.`);
// The server returns counts only. Private addresses are never listed here.
console.log(JSON.stringify(result, null, 2));
if (send) console.log('Provider acceptance is not delivery. Signed delivery webhooks archive completed notifications. Run a dry-run before the next batch.');
