import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { handleSignup, handleNotify, handleWebhook, handleUnsubscribe, normalizeEmail, makeUnsubscribeToken, verifyWebhook } from '../waitlist/backend.mjs';

class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec(readFileSync(new URL('../migrations/0001_waitlist.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const db = this.sqlite;
    const statement = { args: [], bind(...args) { this.args = args; return this; },
      async first() { return db.prepare(sql).get(...this.args) || null; },
      async all() { return { results: db.prepare(sql).all(...this.args) }; },
      async run() { const result = db.prepare(sql).run(...this.args); return { meta: { changes: result.changes } }; },
      sql };
    return statement;
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT'); return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  row(sql, ...args) { return this.sqlite.prepare(sql).get(...args); }
  rows(sql, ...args) { return this.sqlite.prepare(sql).all(...args); }
}

const START = Date.parse('2026-10-05T01:00:00Z');
const SECRET = 'local-only-test-secret-with-at-least-32-characters';
const SIGNING = `whsec_${Buffer.alloc(32, 7).toString('base64')}`;
function setup() {
  const db = new D1();
  const env = { WAITLIST_DB: db, SITE_URL: 'https://flowwish.app', RATE_LIMIT_SECRET: SECRET,
    WAITLIST_ADMIN_TOKEN: SECRET, WAITLIST_SIGNING_SECRET: SECRET,
    RESEND_API_KEY: 'local-fake-key', RESEND_FROM: 'Flow Wish <launch@flowwish.app>', RESEND_WEBHOOK_SECRET: SIGNING };
  return { db, env };
}
function jsonRequest(path, body, headers = {}) {
  return new Request(`https://flowwish.app${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://flowwish.app', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(body) });
}
const signup = (env, app = 'flow', email = 'fan@example.com', options = {}, headers = {}) =>
  handleSignup(jsonRequest('/api/waitlist', { app, email, website: '' }, headers), env, { now: () => START, ...options });
function notify(env, options = {}, overrides = {}) {
  return handleNotify(jsonRequest('/api/admin/notify', { app: 'flow', url: 'https://apps.apple.com/app/id123', dryRun: false, confirm: 'SEND flow', limit: 5, ...overrides }, { Authorization: `Bearer ${SECRET}` }), env,
    { now: () => START, delay: async () => {}, fetch: async () => new Response(JSON.stringify({ id: 'provider-1' })), ...options });
}
function signedRequest(type, id = 'provider-1', eventId = 'msg-1', now = START, tags = undefined) {
  const raw = JSON.stringify({ type, created_at: new Date(now).toISOString(), data: { email_id: id, to: ['fan@example.com'], ...(tags ? { tags } : {}) } });
  const timestamp = String(Math.floor(now / 1000));
  const signature = createHmac('sha256', Buffer.alloc(32, 7)).update(`${eventId}.${timestamp}.${raw}`).digest('base64');
  return new Request('https://flowwish.app/api/resend-webhook', { method: 'POST', headers: { 'svix-id': eventId, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` }, body: raw });
}

test('migration has private archive tables and parameterized duplicate/app isolation', async () => {
  const { db, env } = setup();
  assert.equal((await signup(env, 'flow', ' Fan@Example.COM ')).status, 200);
  assert.equal((await signup(env, 'flow', 'fan@example.com')).status, 200);
  assert.equal((await signup(env, 'odo', 'fan@example.com')).status, 200);
  const rows = db.rows('SELECT * FROM waitlist_subscriptions ORDER BY app');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].email, 'fan@example.com');
  assert.equal(rows[0].consent_at, START);
  assert.equal(rows[0].consent_version, 'launch-notice-v1');
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_audit').n, 2);
  assert.equal(db.rows('PRAGMA foreign_key_check').length, 0);
  assert.deepEqual(await (await signup(env, 'flow')).json(), { ok: true });
});

test('validation rejects incorrect origin, app, content type, oversized streams and emails', async () => {
  const { db, env } = setup();
  assert.equal(normalizeEmail('x\r\n@example.com'), null);
  assert.equal(normalizeEmail('x@localhost'), null);
  assert.equal(normalizeEmail('a..b@example.com'), null);
  assert.equal((await signup(env, 'wrong')).status, 400);
  assert.equal((await signup(env, 'flow', 'x@localhost')).status, 400);
  assert.equal((await signup(env, 'flow', 'fan@example.com', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await signup(env, 'flow', 'fan@example.com', {}, { 'Content-Type': 'text/plain' })).status, 415);
  const large = jsonRequest('/api/waitlist', { app: 'flow', email: 'fan@example.com', website: 'x'.repeat(2000) });
  assert.equal((await handleSignup(large, env)).status, 413);
  assert.equal((await handleSignup(new Request('https://flowwish.app/api/waitlist'), env)).status, 405);
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_subscriptions').n, 0);
});

test('rate limits hashed IPs, expires counters and never stores a plain IP', async () => {
  const { db, env } = setup();
  for (let i = 0; i < 5; i++) assert.equal((await signup(env, 'flow', `fan${i}@example.com`)).status, 200);
  const blocked = await signup(env, 'odo');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '3600');
  assert.ok(!JSON.stringify(db.rows('SELECT * FROM waitlist_rate_limits')).includes('192.0.2.1'));
  assert.equal((await signup(env, 'flow', 'next@example.com', { now: () => START + 3600001 })).status, 200);
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_rate_limits').n, 1);
});

test('honeypot success does not save a subscriber or send an email', async () => {
  const { db, env } = setup();
  const result = await handleSignup(jsonRequest('/api/waitlist', { app: 'flow', email: 'fan@example.com', website: 'spam' }), env, { now: () => START });
  assert.equal(result.status, 200);
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_subscriptions').n, 0);
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_attempts').n, 0);
});

test('missing configured services and missing/wrong admin bearer fail closed', async () => {
  const { db, env } = setup();
  assert.equal((await signup({ ...env, WAITLIST_DB: undefined })).status, 503);
  assert.equal((await notify({ ...env, WAITLIST_ADMIN_TOKEN: undefined })).status, 503);
  assert.equal((await handleNotify(jsonRequest('/api/admin/notify', {}), env)).status, 401);
  assert.equal((await handleNotify(jsonRequest('/api/admin/notify', {}, { Authorization: 'Bearer wrong' }), env)).status, 401);
  assert.equal((await notify({ ...env, RESEND_API_KEY: undefined })).status, 503);
  assert.equal((await notify(env, {}, { confirm: undefined })).status, 400);
  assert.equal((await notify(env, {}, { limit: 6 })).status, 400);
  assert.equal((await notify(env, {}, { url: 'https://evil.example/phish' })).status, 400);
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_attempts').n, 0);
});

test('dry run never claims records, locks a launch URL or exposes private addresses', async () => {
  const { db, env } = setup(); await signup(env);
  const result = await (await notify(env, {}, { dryRun: true })).json();
  assert.equal(result.subscriptions.active, 1);
  assert.equal(result.dryRun, true);
  assert.ok(!JSON.stringify(result).includes('fan@example.com'));
  assert.equal(db.row("SELECT launch_url FROM waitlist_apps WHERE app='flow'").launch_url, null);
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_notifications').n, 0);
});

test('accepted is not delivered; accepted messages are never resent', async () => {
  const { db, env } = setup(); await signup(env);
  let calls = 0;
  const send = async (_url, init) => { calls++; assert.ok(init.headers['Idempotency-Key'].startsWith('flowwish-launch/')); return new Response('{"id":"provider-1"}'); };
  assert.equal((await notify(env, { fetch: send })).status, 200);
  const row = db.row('SELECT * FROM waitlist_subscriptions');
  assert.equal(row.status, 'accepted'); assert.equal(row.archived_at, null);
  assert.equal(db.row('SELECT * FROM waitlist_notifications').accepted_at, START);
  assert.equal(db.row('SELECT * FROM waitlist_attempts').outcome, 'accepted');
  assert.equal((await notify(env, { fetch: send })).status, 200);
  assert.equal(calls, 1);
  assert.equal((await notify(env, {}, { url: 'https://apps.apple.com/app/id456' })).status, 409);
});

test('verified delivery archives a complete email and history, repeated webhook is idempotent', async () => {
  const { db, env } = setup(); await signup(env); await notify(env);
  assert.equal((await handleWebhook(signedRequest('email.delivered'), env, { now: () => START })).status, 200);
  assert.equal((await handleWebhook(signedRequest('email.delivered'), env, { now: () => START })).status, 200);
  const row = db.row('SELECT * FROM waitlist_subscriptions');
  assert.equal(row.email, 'fan@example.com'); assert.equal(row.status, 'delivered'); assert.equal(row.archived_at, START);
  const notification = db.row('SELECT * FROM waitlist_notifications');
  assert.equal(notification.status, 'delivered'); assert.equal(notification.delivered_at, START);
  assert.ok(notification.payload_json.includes('fan@example.com'));
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_webhook_events').n, 1);
  assert.equal(db.row("SELECT COUNT(*) AS n FROM waitlist_audit WHERE action='email.delivered'").n, 1);
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_attempts').n, 1);
});

test('raw body signatures, timestamps and signature version checks reject forgeries', async () => {
  const { env } = setup();
  const original = signedRequest('email.delivered');
  const raw = await original.text();
  assert.equal(await verifyWebhook(raw, original.headers, SIGNING, START), true);
  assert.equal(await verifyWebhook(`${raw} `, original.headers, SIGNING, START), false);
  assert.equal(await verifyWebhook(raw, original.headers, SIGNING, START + 301000), false);
  assert.equal(await verifyWebhook(raw, original.headers, `whsec_${Buffer.alloc(32, 8).toString('base64')}`, START), false);
  const rotating = new Headers(original.headers);
  rotating.set('svix-signature', `v2,ignored v1,wrong ${original.headers.get('svix-signature')}`);
  assert.equal(await verifyWebhook(raw, rotating, SIGNING, START), true);
  const bad = new Request('https://flowwish.app/api/resend-webhook', { method: 'POST', headers: original.headers, body: `${raw} ` });
  assert.equal((await handleWebhook(bad, env, { now: () => START })).status, 400);
});

test('a signed webhook arriving before send acceptance is retained and applied', async () => {
  const { db, env } = setup(); await signup(env);
  await notify(env, { fetch: async () => {
    assert.equal((await handleWebhook(signedRequest('email.delivered'), env, { now: () => START })).status, 200);
    assert.equal(db.row('SELECT processed_at FROM waitlist_webhook_events').processed_at, null);
    return new Response('{"id":"provider-1"}');
  } });
  assert.equal(db.row('SELECT status FROM waitlist_subscriptions').status, 'delivered');
  assert.equal(db.row('SELECT processed_at FROM waitlist_webhook_events').processed_at, START);
});

test('signed notification tag correlates a delivery when the sending API response is lost', async () => {
  const { db, env } = setup(); await signup(env);
  await notify(env, { fetch: async (_url, init) => {
    const tags = Object.fromEntries(JSON.parse(init.body).tags.map(tag => [tag.name, tag.value]));
    await handleWebhook(signedRequest('email.delivered', 'provider-1', 'tagged-delivery', START, tags), env, { now: () => START });
    throw new Error('lost API response');
  } });
  assert.equal(db.row('SELECT status FROM waitlist_subscriptions').status, 'delivered');
  assert.equal(db.row('SELECT status FROM waitlist_notifications').status, 'delivered');
  assert.equal(db.row('SELECT provider_id FROM waitlist_notifications').provider_id, 'provider-1');
  let calls = 0; await notify(env, { fetch: async () => { calls++; return new Response('{"id":"new"}'); } });
  assert.equal(calls, 0);
});

test('signed sent event resolves uncertainty without claiming delivery or resending', async () => {
  const { db, env } = setup(); await signup(env);
  await notify(env, { fetch: async (_url, init) => {
    const tags = Object.fromEntries(JSON.parse(init.body).tags.map(tag => [tag.name, tag.value]));
    await handleWebhook(signedRequest('email.sent', 'provider-1', 'tagged-sent', START, tags), env, { now: () => START });
    throw new Error('lost API response');
  } });
  assert.equal(db.row('SELECT status FROM waitlist_subscriptions').status, 'accepted');
  assert.equal(db.row('SELECT status FROM waitlist_notifications').status, 'accepted');
  assert.equal(db.row('SELECT archived_at FROM waitlist_subscriptions').archived_at, null);
});

test('calendar-month quota also caps a 31-day month', async () => {
  const { db, env } = setup(); await signup(env); await notify(env, { fetch: async () => new Response('{}', { status: 429 }) });
  const notification = db.row('SELECT id FROM waitlist_notifications');
  const endMonth = Date.parse('2026-10-31T23:59:59Z');
  const earlyMonth = Date.parse('2026-10-01T00:00:01Z');
  for (let i = 0; i < 2999; i++) db.sqlite.prepare('INSERT INTO waitlist_attempts(id, notification_id, started_at, outcome) VALUES (?, ?, ?, ?)').run(`month-${i}`, notification.id, earlyMonth, 'accepted');
  const result = await (await notify(env, { now: () => endMonth }, { dryRun: true })).json();
  assert.equal(result.remainingCalendarMonth, 0);
  assert.equal(result.remaining30Days, 2999);
});

test('uncertain requests retry frozen payload/key inside the safe window, never after expiry', async () => {
  const { db, env } = setup(); await signup(env);
  let original;
  await notify(env, { fetch: async (_url, init) => { original = init; throw new Error('timeout'); } });
  assert.equal(db.row('SELECT status FROM waitlist_notifications').status, 'uncertain');
  await notify(env, { now: () => START + 300001, fetch: async (_url, init) => {
    assert.equal(init.body, original.body); assert.equal(init.headers['Idempotency-Key'], original.headers['Idempotency-Key']);
    return new Response('{"id":"provider-1"}');
  } });
  assert.equal(db.row('SELECT status FROM waitlist_notifications').status, 'accepted');
  assert.equal(db.row('SELECT COUNT(*) AS n FROM waitlist_attempts').n, 2);
  const expired = setup(); await signup(expired.env);
  await notify(expired.env, { fetch: async () => { throw new Error('timeout'); } });
  let calls = 0;
  await notify(expired.env, { now: () => START + 23 * 3600000 + 1, fetch: async () => { calls++; return new Response('{"id":"provider-2"}'); } });
  assert.equal(calls, 0); assert.equal(expired.db.row('SELECT status FROM waitlist_notifications').status, 'needs_review');
  assert.equal(expired.db.row('SELECT status FROM waitlist_subscriptions').status, 'needs_review');
});

test('repeated uncertainties are bounded and an API 429 pauses the batch', async () => {
  const { db, env } = setup(); await signup(env);
  for (let i = 0; i < 3; i++) await notify(env, { now: () => START + i * 300001, fetch: async () => { throw new Error('timeout'); } });
  assert.equal(db.row('SELECT attempts FROM waitlist_notifications').attempts, 3);
  assert.equal(db.row('SELECT status FROM waitlist_notifications').status, 'needs_review');
  const limited = setup(); await signup(limited.env, 'flow', 'a@example.com'); await signup(limited.env, 'flow', 'b@example.com');
  let calls = 0;
  await notify(limited.env, { fetch: async () => { calls++; return new Response('{}', { status: 429 }); } });
  assert.equal(calls, 1); assert.equal(limited.db.row("SELECT COUNT(*) AS n FROM waitlist_notifications WHERE status='retry'").n, 1);
});

test('100 rolling-day sends include retries; batch pauses without calling provider', async () => {
  const { db, env } = setup(); await signup(env); await notify(env, { fetch: async () => new Response('{}', { status: 429 }) });
  const notification = db.row('SELECT id FROM waitlist_notifications');
  for (let i = 0; i < 99; i++) db.sqlite.prepare('INSERT INTO waitlist_attempts(id, notification_id, started_at, outcome) VALUES (?, ?, ?, ?)').run(`quota-${i}`, notification.id, START, 'accepted');
  let calls = 0;
  const result = await (await notify(env, { now: () => START + 300001, fetch: async () => { calls++; return new Response('{"id":"provider-1"}'); } })).json();
  assert.equal(calls, 0); assert.equal(result.results.quotaPaused, true); assert.equal(result.remaining24Hours, 0);
});

test('unsubscribe GET is read-only; confirmed POST archives only that app and remains idempotent', async () => {
  const { db, env } = setup(); await signup(env); await signup(env, 'odo');
  const row = db.row("SELECT * FROM waitlist_subscriptions WHERE app='flow'");
  const token = await makeUnsubscribeToken(row.unsubscribe_nonce, SECRET);
  const get = new Request(`https://flowwish.app/api/unsubscribe?token=${token}`);
  assert.equal((await handleUnsubscribe(get, env)).status, 200);
  assert.equal(db.row("SELECT status FROM waitlist_subscriptions WHERE app='flow'").status, 'active');
  const post = () => jsonRequest('/api/unsubscribe', { token, confirm: 'unsubscribe' });
  assert.equal((await handleUnsubscribe(post(), env, { now: () => START })).status, 200);
  assert.equal((await handleUnsubscribe(post(), env, { now: () => START })).status, 200);
  assert.equal(db.row("SELECT status FROM waitlist_subscriptions WHERE app='flow'").status, 'cancelled');
  assert.equal(db.row("SELECT email FROM waitlist_subscriptions WHERE app='flow'").email, 'fan@example.com');
  assert.equal(db.row("SELECT status FROM waitlist_subscriptions WHERE app='odo'").status, 'active');
  assert.equal(db.row("SELECT COUNT(*) AS n FROM waitlist_audit WHERE action='unsubscribed'").n, 1);
  assert.equal((await handleUnsubscribe(jsonRequest('/api/unsubscribe', { token, confirm: 'no' }), env)).status, 400);
  assert.equal((await handleUnsubscribe(new Request('https://flowwish.app/api/unsubscribe?token=invalid'), env)).status, 400);
});

test('bounces/cancellation cannot be revived by delivery or duplicate signup; provider failure never resends', async () => {
  const { db, env } = setup(); await signup(env); await notify(env);
  await handleWebhook(signedRequest('email.bounced', 'provider-1', 'bounce'), env, { now: () => START });
  await handleWebhook(signedRequest('email.delivered', 'provider-1', 'late-delivery'), env, { now: () => START });
  await signup(env);
  assert.equal(db.row('SELECT status FROM waitlist_subscriptions').status, 'bounced');
  assert.equal(db.row('SELECT status FROM waitlist_notifications').status, 'bounced');
  assert.equal(db.row('SELECT email FROM waitlist_subscriptions').email, 'fan@example.com');
  const failed = setup(); await signup(failed.env); await notify(failed.env);
  await handleWebhook(signedRequest('email.failed'), failed.env, { now: () => START });
  let calls = 0; await notify(failed.env, { fetch: async () => { calls++; return new Response('{"id":"new"}'); } });
  assert.equal(calls, 0); assert.equal(failed.db.row('SELECT status FROM waitlist_notifications').status, 'failed');
});

test('localhost HTTP works only for explicit localhost configuration', async () => {
  const { env } = setup();
  env.SITE_URL = 'http://localhost:8788';
  assert.equal((await signup(env, 'flow', 'fan@example.com', {}, { Origin: 'http://localhost:8788' })).status, 200);
  assert.equal((await signup({ ...env, SITE_URL: 'http://flowwish.app' })).status, 503);
});
