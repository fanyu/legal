// Pages Functions + D1, with no runtime packages. Sending is a separate,
// explicitly confirmed operator action; collecting an address sends no email.
export const APPS = Object.freeze({ flow: 'Flow', odo: 'Odo', pastetrail: 'PasteTrail' });
export const CONSENT_VERSION = 'launch-notice-v1';
const SECOND = 1000;
const HOUR = 3600 * SECOND;
const DAY = 24 * HOUR;
const IDEMPOTENCY_WINDOW = 23 * HOUR; // Resend retains keys for 24 hours; leave margin.
const MAX_ATTEMPTS = 3;
const encoder = new TextEncoder();

class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function response(status, code, extra = {}) {
  return new Response(JSON.stringify(code === 'ok' ? { ok: true, ...extra } : { ok: false, error: code }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(status === 429 ? { 'Retry-After': '3600' } : {}),
    },
  });
}

async function guarded(operation) {
  try { return await operation(); }
  catch (error) {
    // Never put emails, tokens, provider payloads, or exception text in public output.
    return response(error instanceof HttpError ? error.status : 503,
      error instanceof HttpError ? error.code : 'unavailable');
  }
}

function requirePost(request) {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
}

function siteOrigin(env) {
  try {
    const url = new URL(env.SITE_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw 0;
    return url.origin;
  } catch { throw new HttpError(503, 'unavailable'); }
}

function requireOrigin(request, env) {
  if (request.headers.get('Origin') !== siteOrigin(env)) throw new HttpError(403, 'forbidden');
}

function requireSecret(value) {
  if (typeof value !== 'string' || value.length < 32) throw new HttpError(503, 'unavailable');
  return value;
}

function requireDb(env) {
  if (!env.WAITLIST_DB?.prepare || !env.WAITLIST_DB?.batch) throw new HttpError(503, 'unavailable');
  return env.WAITLIST_DB;
}

async function readBody(request, limit) {
  const length = request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new HttpError(413, 'request_too_large');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, 'request_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new HttpError(400, 'invalid_request'); }
}

async function readJson(request, limit = 1024) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new HttpError(415, 'invalid_content_type');
  let value;
  try { value = JSON.parse(await readBody(request, limit)); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'invalid_request'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid_request');
  return value;
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) return null;
  const [local, domain] = email.split('@');
  if (local.length > 64 || domain.split('.').some(label => label.length > 63)) return null;
  return email;
}

function base64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function unbase64(value) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
function base64url(bytes) { return base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function randomNonce() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }

async function hmac(secret, value) {
  const bytes = typeof secret === 'string' ? encoder.encode(secret) : secret;
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function equalSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(left)), crypto.subtle.digest('SHA-256', encoder.encode(right))]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}

async function rateLimit(db, request, env, now) {
  const secret = requireSecret(env.RATE_LIMIT_SECRET);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 128) throw new HttpError(503, 'unavailable');
  const window = Math.floor(now / HOUR);
  const key = `${window}:${base64url(await hmac(secret, ip))}`;
  // The 10,000 live-key bound prevents arbitrary IP churn growing this table.
  // Expired counters, unlike subscriber/archive records, are intentionally removed.
  await db.prepare('DELETE FROM waitlist_rate_limits WHERE expires_at <= ?').bind(now).run();
  const row = await db.prepare(`INSERT INTO waitlist_rate_limits(key, count, expires_at)
    SELECT ?, 1, ? WHERE (SELECT COUNT(*) FROM waitlist_rate_limits) < 10000
      OR EXISTS (SELECT 1 FROM waitlist_rate_limits WHERE key = ?)
    ON CONFLICT(key) DO UPDATE SET count = MIN(count + 1, 6)
    RETURNING count`).bind(key, (window + 1) * HOUR, key).first();
  if (!row || row.count > 5) throw new HttpError(429, 'rate_limited');
}

export async function handleSignup(request, env, options = {}) {
  return guarded(async () => {
    requirePost(request);
    requireOrigin(request, env);
    const db = requireDb(env);
    requireSecret(env.RATE_LIMIT_SECRET);
    const data = await readJson(request);
    if (!Object.hasOwn(APPS, data.app) || typeof data.website !== 'string' || data.website.length > 200) throw new HttpError(400, 'invalid_request');
    const email = normalizeEmail(data.email);
    if (!email) throw new HttpError(400, 'invalid_email');
    const now = options.now?.() ?? Date.now();
    await rateLimit(db, request, env, now);
    if (data.website) return response(200, 'ok');
    const app = await db.prepare('SELECT launch_url FROM waitlist_apps WHERE app = ?').bind(data.app).first();
    if (!app) throw new HttpError(503, 'unavailable');
    if (app.launch_url) throw new HttpError(409, 'app_available');
    const id = crypto.randomUUID();
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO waitlist_subscriptions
        (id, app, email, consent_at, consent_version, unsubscribe_nonce, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, data.app, email, now, CONSENT_VERSION, randomNonce(), now, now),
      db.prepare(`INSERT INTO waitlist_audit(id, subscription_id, action, occurred_at)
        SELECT ?, ?, 'subscribed', ? WHERE EXISTS (SELECT 1 FROM waitlist_subscriptions WHERE id = ?)`)
        .bind(crypto.randomUUID(), id, now, id),
    ]);
    // Existing/archived/cancelled addresses return the same success; they are never
    // implicitly reactivated, and subscriptions to other apps remain untouched.
    return response(200, 'ok');
  });
}

export async function makeUnsubscribeToken(nonce, secret) {
  return `${nonce}.${base64url(await hmac(requireSecret(secret), `unsubscribe-v1:${nonce}`))}`;
}

async function subscriptionForToken(db, token, secret) {
  requireSecret(secret);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(400, 'invalid_link');
  const [nonce] = token.split('.');
  if (!await equalSecret(token, await makeUnsubscribeToken(nonce, secret))) throw new HttpError(400, 'invalid_link');
  const subscription = await db.prepare('SELECT id, app, status FROM waitlist_subscriptions WHERE unsubscribe_nonce = ?').bind(nonce).first();
  if (!subscription) throw new HttpError(400, 'invalid_link');
  return subscription;
}

function htmlEscape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }

export async function handleUnsubscribe(request, env, options = {}) {
  return guarded(async () => {
    const db = requireDb(env);
    let token;
    if (request.method === 'GET') token = new URL(request.url).searchParams.get('token');
    else if (request.method === 'POST') {
      requireOrigin(request, env);
      if (/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
        const form = new URLSearchParams(await readBody(request, 512));
        token = form.get('token');
        if (form.get('confirm') !== 'unsubscribe') throw new HttpError(400, 'invalid_request');
      } else {
        const data = await readJson(request, 512);
        token = data.token;
        if (data.confirm !== 'unsubscribe') throw new HttpError(400, 'invalid_request');
      }
    } else throw new HttpError(405, 'method_not_allowed');
    const subscription = await subscriptionForToken(db, token, env.WAITLIST_SIGNING_SECRET);
    if (request.method === 'GET') {
      // Email scanners may visit this URL. GET is strictly read-only.
      const name = APPS[subscription.app];
      return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe · Flowwish</title><style>body{font:16px/1.6 system-ui;color:#222;background:#fafafa;margin:0;padding:64px 24px}main{max-width:420px;margin:auto}h1{font-size:25px;font-weight:500}button{font:inherit;color:#fff;background:#222;border:0;border-radius:10px;padding:10px 18px;cursor:pointer}a{color:inherit}</style><main><h1>Unsubscribe from ${htmlEscape(name)}</h1><p>Stop the launch notification for this app.</p><form method="post" action="/api/unsubscribe"><input type="hidden" name="token" value="${htmlEscape(token)}"><input type="hidden" name="confirm" value="unsubscribe"><button>Unsubscribe</button></form><p><a href="/">Back to Flowwish</a></p></main></html>`, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
      });
    }
    const now = options.now?.() ?? Date.now();
    await db.batch([
      db.prepare(`INSERT INTO waitlist_audit(id, subscription_id, action, occurred_at)
        SELECT ?, id, 'unsubscribed', ? FROM waitlist_subscriptions WHERE id = ? AND status != 'cancelled'`)
        .bind(crypto.randomUUID(), now, subscription.id),
      db.prepare(`UPDATE waitlist_subscriptions SET status = 'cancelled', archived_at = COALESCE(archived_at, ?), updated_at = ? WHERE id = ?`)
        .bind(now, now, subscription.id),
      db.prepare(`UPDATE waitlist_notifications SET status = 'cancelled', archived_at = COALESCE(archived_at, ?), lease_until = NULL
        WHERE subscription_id = ? AND status NOT IN ('delivered', 'bounced', 'cancelled')`).bind(now, subscription.id),
    ]);
    if (/^application\/x-www-form-urlencoded/i.test(request.headers.get('Content-Type') || '')) {
      return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed · Flowwish</title><body style="font:16px/1.6 system-ui;padding:64px 24px"><main style="max-width:420px;margin:auto"><h1 style="font-size:25px;font-weight:500">You\'re unsubscribed.</h1><p><a href="/" style="color:inherit">Back to Flowwish</a></p></main></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }
    return response(200, 'ok');
  });
}

export async function verifyWebhook(raw, headers, secret, now = Date.now()) {
  const id = headers.get('svix-id'), timestamp = headers.get('svix-timestamp'), signature = headers.get('svix-signature');
  if (!id || id.length > 200 || !/^\d{1,12}$/.test(timestamp || '') || !signature || signature.length > 2000) return false;
  if (Math.abs(now / SECOND - Number(timestamp)) > 300 || !secret?.startsWith('whsec_')) return false;
  let key;
  try { key = unbase64(secret.slice(6)); } catch { return false; }
  if (key.length < 16) return false;
  const expected = base64(await hmac(key, `${id}.${timestamp}.${raw}`));
  for (const part of signature.split(/\s+/)) {
    if (part.startsWith('v1,') && await equalSecret(part.slice(3), expected)) return true;
  }
  return false;
}

const PROVIDER_EVENTS = new Set(['email.sent', 'email.delivered', 'email.bounced', 'email.complained', 'email.failed', 'email.delivery_delayed', 'email.suppressed']);

async function applyPendingEvents(db, providerId, now) {
  const notification = await db.prepare('SELECT id, subscription_id FROM waitlist_notifications WHERE provider_id = ?').bind(providerId).first();
  if (!notification) return;
  const events = (await db.prepare('SELECT * FROM waitlist_webhook_events WHERE provider_id = ? AND processed_at IS NULL ORDER BY occurred_at, event_id').bind(providerId).all()).results;
  for (const event of events) {
    let statements = [];
    if (event.type === 'email.sent' || event.type === 'email.delivery_delayed') {
      statements = [
        db.prepare(`UPDATE waitlist_notifications SET status = 'accepted', accepted_at = COALESCE(accepted_at, ?), lease_until = NULL
          WHERE id = ? AND status NOT IN ('cancelled','bounced','delivered','failed')`).bind(event.occurred_at, notification.id),
        db.prepare(`UPDATE waitlist_subscriptions SET status = 'accepted', updated_at = ?
          WHERE id = ? AND status NOT IN ('cancelled','bounced','delivered','failed')`).bind(now, notification.subscription_id),
      ];
    } else if (event.type === 'email.delivered') {
      // Terminal cancellation/bounce wins over an out-of-order delivery event.
      statements = [
        db.prepare(`UPDATE waitlist_notifications SET status = 'delivered', delivered_at = COALESCE(delivered_at, ?), archived_at = COALESCE(archived_at, ?), lease_until = NULL
          WHERE id = ? AND status NOT IN ('cancelled', 'bounced')`).bind(event.occurred_at, now, notification.id),
        db.prepare(`UPDATE waitlist_subscriptions SET status = 'delivered', archived_at = COALESCE(archived_at, ?), updated_at = ?
          WHERE id = ? AND status NOT IN ('cancelled', 'bounced')`).bind(now, now, notification.subscription_id),
      ];
    } else if (['email.bounced', 'email.complained', 'email.suppressed'].includes(event.type)) {
      const status = event.type === 'email.complained' ? 'cancelled' : 'bounced';
      statements = [
        db.prepare('UPDATE waitlist_notifications SET status = ?, archived_at = COALESCE(archived_at, ?), lease_until = NULL, last_error = ? WHERE id = ?')
          .bind(status, now, event.type, notification.id),
        db.prepare(`UPDATE waitlist_subscriptions SET status = ?, archived_at = COALESCE(archived_at, ?), updated_at = ? WHERE id = ? AND status != 'cancelled'`)
          .bind(status, now, now, notification.subscription_id),
      ];
    } else if (event.type === 'email.failed') {
      // A provider-accepted message is never sent again. Investigate this delivery failure.
      statements = [
        db.prepare(`UPDATE waitlist_notifications SET status = 'failed', last_error = 'email.failed', lease_until = NULL WHERE id = ? AND status NOT IN ('delivered','cancelled','bounced')`).bind(notification.id),
        db.prepare(`UPDATE waitlist_subscriptions SET status = 'failed', updated_at = ? WHERE id = ? AND status NOT IN ('delivered','cancelled','bounced')`).bind(now, notification.subscription_id),
      ];
    }
    await db.batch([
      ...statements,
      db.prepare(`INSERT INTO waitlist_audit(id, subscription_id, action, occurred_at, notification_id, detail)
        SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM waitlist_webhook_events WHERE event_id = ? AND processed_at IS NULL)`)
        .bind(crypto.randomUUID(), notification.subscription_id, event.type, event.occurred_at, notification.id, event.event_id, event.event_id),
      db.prepare('UPDATE waitlist_webhook_events SET processed_at = ? WHERE event_id = ? AND processed_at IS NULL').bind(now, event.event_id),
    ]);
  }
}

export async function handleWebhook(request, env, options = {}) {
  return guarded(async () => {
    requirePost(request);
    const db = requireDb(env);
    if (!env.RESEND_WEBHOOK_SECRET) throw new HttpError(503, 'unavailable');
    const raw = await readBody(request, 32768);
    const now = options.now?.() ?? Date.now();
    if (!await verifyWebhook(raw, request.headers, env.RESEND_WEBHOOK_SECRET, now)) throw new HttpError(400, 'invalid_signature');
    let event;
    try { event = JSON.parse(raw); } catch { throw new HttpError(400, 'invalid_request'); }
    if (!PROVIDER_EVENTS.has(event.type)) return response(200, 'ok');
    const providerId = event.data?.email_id;
    const occurredAt = Date.parse(event.created_at);
    if (typeof providerId !== 'string' || providerId.length > 100 || !Number.isFinite(occurredAt)) throw new HttpError(400, 'invalid_request');
    await db.prepare(`INSERT OR IGNORE INTO waitlist_webhook_events
      (event_id, provider_id, type, occurred_at, received_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(request.headers.get('svix-id'), providerId, event.type, occurredAt, now, raw).run();
    // Resend returns custom tags in signed events. This reconnects a delivered
    // message even if the sending API timed out before returning its email ID.
    const taggedId = event.data?.tags?.flowwish_notification;
    if (typeof taggedId === 'string' && /^[a-f0-9-]{36}$/.test(taggedId)) {
      const tagged = await db.prepare('SELECT id, payload_json FROM waitlist_notifications WHERE id = ? AND first_attempt_at IS NOT NULL').bind(taggedId).first();
      if (tagged && Array.isArray(event.data.to) && event.data.to.length === 1 &&
          normalizeEmail(event.data.to[0]) === JSON.parse(tagged.payload_json).to[0]) {
        await db.prepare('UPDATE waitlist_notifications SET provider_id = ? WHERE id = ? AND (provider_id IS NULL OR provider_id = ?)')
          .bind(providerId, taggedId, providerId).run();
      }
    }
    await applyPendingEvents(db, providerId, now);
    return response(200, 'ok');
  });
}

function launchUrl(value, env) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || value.length > 500) throw 0;
    const allowed = url.hostname === 'apps.apple.com' ||
      (url.hostname === 'github.com' && url.pathname.startsWith('/fanyu/')) || url.origin === siteOrigin(env);
    if (!allowed) throw 0;
    return url.href;
  } catch { throw new HttpError(400, 'invalid_launch_url'); }
}

async function requireAdmin(request, env) {
  const secret = requireSecret(env.WAITLIST_ADMIN_TOKEN);
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ') || !await equalSecret(header.slice(7), secret)) throw new HttpError(401, 'unauthorized');
}

async function counts(db, app, now) {
  const rows = (await db.prepare('SELECT status, COUNT(*) AS count FROM waitlist_subscriptions WHERE app = ? GROUP BY status').bind(app).all()).results;
  const date = new Date(now);
  const calendarMonthStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const quota = await db.prepare(`SELECT
    SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS day_used,
    SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS month_used,
    SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS calendar_month_used
    FROM waitlist_attempts`).bind(now - DAY, now - 30 * DAY, calendarMonthStart).first();
  return { subscriptions: Object.fromEntries(rows.map(row => [row.status, row.count])),
    remaining24Hours: Math.max(0, 100 - (quota.day_used || 0)),
    remaining30Days: Math.max(0, 3000 - (quota.month_used || 0)),
    remainingCalendarMonth: Math.max(0, 3000 - (quota.calendar_month_used || 0)) };
}

async function freezeNotification(db, subscription, app, url, env, now) {
  const id = crypto.randomUUID();
  const unsubscribe = `${siteOrigin(env)}/api/unsubscribe?token=${await makeUnsubscribeToken(subscription.unsubscribe_nonce, env.WAITLIST_SIGNING_SECRET)}`;
  const name = APPS[app];
  const payload = JSON.stringify({
    from: env.RESEND_FROM,
    to: [subscription.email],
    subject: `${name} is now available`,
    tags: [{ name: 'flowwish_notification', value: id }],
    text: `${name} is now available.\n\nTake a look: ${url}\n\nYou asked for one email when ${name} launches.\nUnsubscribe from this app: ${unsubscribe}\n\nFlowwish\nhttps://flowwish.app`,
    html: `<p>${htmlEscape(name)} is now available.</p><p><a href="${htmlEscape(url)}">Take a look</a></p><p style="font-size:12px;color:#666">You asked for one email when ${htmlEscape(name)} launches. <a href="${htmlEscape(unsubscribe)}">Unsubscribe from this app</a>.</p><p>Flowwish</p>`,
  });
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO waitlist_notifications
      (id, subscription_id, app, status, idempotency_key, payload_json, created_at)
      SELECT ?, id, app, 'pending', ?, ?, ? FROM waitlist_subscriptions WHERE id = ? AND status = 'active'`)
      .bind(id, `flowwish-launch/${id}`, payload, now, subscription.id),
    db.prepare(`UPDATE waitlist_subscriptions SET status = 'queued', updated_at = ? WHERE id = ? AND status = 'active'
      AND EXISTS (SELECT 1 FROM waitlist_notifications WHERE subscription_id = ?)`)
      .bind(now, subscription.id, subscription.id),
  ]);
}

async function markReview(db, now) {
  await db.batch([
    db.prepare(`UPDATE waitlist_notifications SET status = 'needs_review', lease_until = NULL, last_error = 'idempotency_window_expired'
      WHERE status IN ('uncertain', 'attempting') AND (first_attempt_at <= ? OR attempts >= ?)
        AND (lease_until IS NULL OR lease_until <= ?)`)
      .bind(now - IDEMPOTENCY_WINDOW, MAX_ATTEMPTS, now),
    db.prepare(`UPDATE waitlist_subscriptions SET status = 'needs_review', updated_at = ? WHERE status = 'queued'
      AND id IN (SELECT subscription_id FROM waitlist_notifications WHERE status = 'needs_review')`).bind(now),
  ]);
}

async function sendOne(db, notification, env, options, now) {
  const attemptId = crypto.randomUUID();
  const claimed = await db.prepare(`UPDATE waitlist_notifications SET status = 'attempting', attempts = attempts + 1,
    first_attempt_at = COALESCE(first_attempt_at, ?), lease_until = ?
    WHERE id = ? AND provider_id IS NULL AND attempts < ? AND status IN ('pending','retry','uncertain','attempting')
      AND (lease_until IS NULL OR lease_until <= ?) AND (retry_at IS NULL OR retry_at <= ?)
      AND EXISTS (SELECT 1 FROM waitlist_subscriptions WHERE id = subscription_id AND status = 'queued')
    RETURNING *`).bind(now, now + 120 * SECOND, notification.id, MAX_ATTEMPTS, now, now).first();
  if (!claimed) return 'skipped';
  await db.prepare('INSERT INTO waitlist_attempts(id, notification_id, started_at) VALUES (?, ?, ?)').bind(attemptId, claimed.id, now).run();
  let httpStatus = null, providerId = null, outcome = 'uncertain', errorCode = 'request_uncertain';
  try {
    const provider = await (options.fetch || fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': claimed.idempotency_key },
      body: claimed.payload_json,
      signal: AbortSignal.timeout(8000),
    });
    httpStatus = provider.status;
    let result = {};
    try { result = await provider.json(); } catch { /* A malformed success is uncertain. */ }
    if (provider.ok && typeof result.id === 'string' && result.id.length <= 100) {
      providerId = result.id; outcome = 'accepted'; errorCode = null;
    } else if (provider.status === 429) {
      // A rejection after an earlier uncertain attempt cannot disprove acceptance.
      outcome = notification.status === 'uncertain' || notification.status === 'attempting' ? 'uncertain' : 'retry';
      errorCode = 'provider_rate_limited';
    } else if ([400, 401, 403, 404, 422].includes(provider.status)) {
      outcome = 'failed'; errorCode = 'provider_rejected';
    } else if (provider.status === 409 && result.name === 'invalid_idempotent_request') {
      outcome = 'needs_review'; errorCode = 'idempotency_payload_mismatch';
    }
  } catch { /* Keep exact original payload and key for a bounded safe retry. */ }
  const finished = options.now?.() ?? Date.now();
  if (claimed.attempts >= MAX_ATTEMPTS && ['retry', 'uncertain'].includes(outcome)) {
    outcome = 'needs_review'; errorCode = 'retry_limit_reached';
  }
  // Preserve terminal states if an unsubscribe or webhook raced the send response.
  await db.batch([
    db.prepare(`UPDATE waitlist_attempts SET finished_at = ?, outcome = ?, http_status = ?, provider_id = ?, error_code = ? WHERE id = ?`)
      .bind(finished, outcome, httpStatus, providerId, errorCode, attemptId),
    db.prepare(`UPDATE waitlist_notifications SET provider_id = COALESCE(provider_id, ?), accepted_at = CASE WHEN ? IS NOT NULL THEN COALESCE(accepted_at, ?) ELSE accepted_at END,
      status = CASE WHEN status IN ('cancelled','bounced','delivered') OR (provider_id IS NOT NULL AND status IN ('accepted','failed')) THEN status ELSE ? END,
      last_error = ?, lease_until = NULL, retry_at = ? WHERE id = ?`)
      .bind(providerId, providerId, finished, outcome, errorCode, finished + 5 * 60 * SECOND, claimed.id),
    db.prepare(`UPDATE waitlist_subscriptions SET status = ?, updated_at = ? WHERE id = ? AND status = 'queued' AND ? IN ('accepted','failed','needs_review')`)
      .bind(outcome, finished, claimed.subscription_id, outcome),
    db.prepare('INSERT INTO waitlist_audit(id, subscription_id, action, occurred_at, notification_id, detail) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), claimed.subscription_id, outcome, finished, claimed.id, errorCode),
  ]);
  if (providerId) await applyPendingEvents(db, providerId, finished);
  return outcome;
}

export async function handleNotify(request, env, options = {}) {
  return guarded(async () => {
    requirePost(request);
    await requireAdmin(request, env);
    const db = requireDb(env);
    const data = await readJson(request, 2048);
    if (!Object.hasOwn(APPS, data.app)) throw new HttpError(400, 'invalid_app');
    const url = launchUrl(data.url, env);
    const limit = data.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > 5 || (data.dryRun !== undefined && typeof data.dryRun !== 'boolean')) throw new HttpError(400, 'invalid_request');
    const now = options.now?.() ?? Date.now();
    const app = await db.prepare('SELECT launch_url FROM waitlist_apps WHERE app = ?').bind(data.app).first();
    if (!app) throw new HttpError(503, 'unavailable');
    if (app.launch_url && app.launch_url !== url) throw new HttpError(409, 'launch_url_locked');
    if (data.dryRun !== false) return response(200, 'ok', { dryRun: true, app: data.app, ...await counts(db, data.app, now) });
    if (data.confirm !== `SEND ${data.app}`) throw new HttpError(400, 'confirmation_required');
    if (!env.RESEND_API_KEY || !env.RESEND_FROM || /[\r\n]/.test(env.RESEND_FROM) || !normalizeEmail(env.RESEND_FROM.match(/<([^<>]+)>$/)?.[1] || env.RESEND_FROM)) throw new HttpError(503, 'unavailable');
    requireSecret(env.WAITLIST_SIGNING_SECRET);
    if (!env.RESEND_WEBHOOK_SECRET?.startsWith('whsec_')) throw new HttpError(503, 'unavailable');
    const owner = crypto.randomUUID();
    const lock = await db.prepare('UPDATE waitlist_send_lock SET owner = ?, expires_at = ? WHERE id = 1 AND expires_at <= ? RETURNING id')
      .bind(owner, now + 120 * SECOND, now).first();
    if (!lock) throw new HttpError(409, 'batch_in_progress');
    try {
      await markReview(db, now);
      await db.prepare('UPDATE waitlist_apps SET launch_url = ?, launched_at = COALESCE(launched_at, ?) WHERE app = ? AND launch_url IS NULL').bind(url, now, data.app).run();
      const active = (await db.prepare(`SELECT id, email, unsubscribe_nonce FROM waitlist_subscriptions WHERE app = ? AND status = 'active' ORDER BY created_at, id LIMIT ?`).bind(data.app, limit).all()).results;
      for (const subscription of active) await freezeNotification(db, subscription, data.app, url, env, now);
      const queue = (await db.prepare(`SELECT * FROM waitlist_notifications WHERE app = ? AND provider_id IS NULL AND status IN ('pending','retry','uncertain','attempting')
        AND attempts < ? AND (lease_until IS NULL OR lease_until <= ?) AND (retry_at IS NULL OR retry_at <= ?)
        ORDER BY CASE WHEN first_attempt_at IS NULL THEN 1 ELSE 0 END, created_at, id LIMIT ?`)
        .bind(data.app, MAX_ATTEMPTS, now, now, limit).all()).results;
      const results = {};
      for (const notification of queue) {
        const tick = options.now?.() ?? Date.now();
        const quota = await counts(db, data.app, tick);
        if (!quota.remaining24Hours || !quota.remaining30Days || !quota.remainingCalendarMonth) { results.quotaPaused = true; break; }
        const result = await sendOne(db, notification, env, options, tick);
        results[result] = (results[result] || 0) + 1;
        if (['retry','uncertain','failed','needs_review'].includes(result)) break;
        if (queue.length > 1) await (options.delay || (ms => new Promise(resolve => setTimeout(resolve, ms))))(600);
      }
      return response(200, 'ok', { dryRun: false, app: data.app, results, ...await counts(db, data.app, options.now?.() ?? Date.now()) });
    } finally {
      await db.prepare('UPDATE waitlist_send_lock SET owner = NULL, expires_at = 0 WHERE id = 1 AND owner = ?').bind(owner).run();
    }
  });
}
