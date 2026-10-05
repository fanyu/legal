PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS waitlist_apps (
  app TEXT PRIMARY KEY CHECK (app IN ('flow', 'odo', 'pastetrail')),
  name TEXT NOT NULL,
  launch_url TEXT,
  launched_at INTEGER
);
INSERT OR IGNORE INTO waitlist_apps (app, name) VALUES
  ('flow', 'Flow'), ('odo', 'Odo'), ('pastetrail', 'PasteTrail');

-- Archived subscribers remain here with their original complete email address.
-- Active work is determined by status, never by deleting subscriber rows.
CREATE TABLE IF NOT EXISTS waitlist_subscriptions (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL REFERENCES waitlist_apps(app),
  email TEXT NOT NULL,
  consent_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN
    ('active', 'queued', 'accepted', 'delivered', 'bounced', 'cancelled', 'failed', 'needs_review')),
  unsubscribe_nonce TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER,
  UNIQUE (app, email)
);
CREATE INDEX IF NOT EXISTS waitlist_active ON waitlist_subscriptions(app, status, created_at);

CREATE TABLE IF NOT EXISTS waitlist_notifications (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE REFERENCES waitlist_subscriptions(id),
  app TEXT NOT NULL REFERENCES waitlist_apps(app),
  status TEXT NOT NULL CHECK (status IN
    ('pending', 'attempting', 'retry', 'uncertain', 'accepted', 'delivered', 'bounced', 'cancelled', 'failed', 'needs_review')),
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  provider_id TEXT UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER,
  retry_at INTEGER,
  lease_until INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  accepted_at INTEGER,
  delivered_at INTEGER,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS waitlist_notification_queue ON waitlist_notifications(app, status, retry_at);
CREATE INDEX IF NOT EXISTS waitlist_quota ON waitlist_notifications(first_attempt_at);

CREATE TABLE IF NOT EXISTS waitlist_attempts (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES waitlist_notifications(id),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  outcome TEXT NOT NULL DEFAULT 'started',
  http_status INTEGER,
  provider_id TEXT,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS waitlist_attempt_history ON waitlist_attempts(notification_id, started_at);

-- Store signed provider events independently so a fast webhook can arrive before
-- the send API response has committed its provider_id. No event is dropped.
CREATE TABLE IF NOT EXISTS waitlist_webhook_events (
  event_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  processed_at INTEGER
);
CREATE INDEX IF NOT EXISTS waitlist_webhook_pending ON waitlist_webhook_events(provider_id, processed_at);

CREATE TABLE IF NOT EXISTS waitlist_audit (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES waitlist_subscriptions(id),
  action TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  notification_id TEXT,
  detail TEXT
);

-- These short-lived counters retain salted hashes, never plain IP addresses.
CREATE TABLE IF NOT EXISTS waitlist_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS waitlist_rate_expiry ON waitlist_rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS waitlist_send_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner TEXT,
  expires_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO waitlist_send_lock(id, expires_at) VALUES (1, 0);
