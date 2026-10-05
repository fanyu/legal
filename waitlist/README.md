# Flow Wish launch notifications

The website collects one launch notification subscription per email and app. It
does not send email at signup. The owner's chosen retention policy keeps complete
email addresses and subscription/send/delivery history in private D1 tables.

## Current deployment boundary

The subscription feature is live at https://flowwish.app, deployed from this
repository as `08a9d1da-9bfa-4344-8c96-42896d2240c4` (2026-10-05; the previous
deployment was `1565dbbc-beeb-4e27-9ab4-5a824824fa14`). Production D1 is initialized
and bound to Pages, and the three application secrets are encrypted. Non-writing
checks after the deployment confirmed that cross-origin signups are rejected and
that signup validation, unsubscribe-link validation and admin authorization run
with their D1 binding and secrets present.

Preview deployments (`scripts/deploy.sh preview`) have no D1 binding (`env.preview`
in `wrangler.jsonc`) and no secrets, so the API answers 503 there and previews
never touch production subscribers. Keep secrets out of the preview environment.

Resend DNS verification, its restricted sending key, and the signed webhook are
still pending. Sending remains disabled until that configuration is complete;
signup never sends email. Real email delivery has not been tested.

`wrangler.jsonc` holds the production configuration (D1 binding, public vars,
`pages_build_output_dir=dist`). Pages does not support `--config` or `account_id`;
pass the account ID through `CLOUDFLARE_ACCOUNT_ID` when needed. Deploy with
`scripts/deploy.sh` (see the repository README).

## Local development

Use Node 24 or newer. Put local-only values of at least 32 characters in
`.dev.vars` for `WAITLIST_ADMIN_TOKEN`, `WAITLIST_SIGNING_SECRET`, and
`RATE_LIMIT_SECRET`. Never reuse the supplied dummy values in production.

```sh
scripts/build.sh
npx --yes wrangler@4.147.0 d1 migrations apply WAITLIST_DB --local --persist-to .wrangler/waitlist-local
npx --yes wrangler@4.147.0 pages dev --port 8788 --ip 127.0.0.1 --persist-to .wrangler/waitlist-local
node --test tests/waitlist.test.mjs
```

Signup only accepts requests whose `Origin` matches `SITE_URL`; for local signups
add `SITE_URL=http://localhost:8788` to `.dev.vars`. `.wrangler/` and `.dev.vars` are
git-ignored and excluded from `dist/`. Tests use real SQLite with fake
provider responses; they never send real email.

## Production setup

1. Create a free D1 database named `flowwish-waitlist` in the existing Cloudflare
   account. Apply `migrations/0001_waitlist.sql` to that database and bind it as
   `WAITLIST_DB` for the `flowwish` Pages production environment.
2. Use Resend Free and verify a sending domain. Prefer a dedicated subdomain such
   as `updates.flowwish.app`; add only the DNS records Resend supplies, preserving
   the existing domain and support-email routing. Disable open/click tracking.
3. Configure one webhook endpoint at
   `https://flowwish.app/api/resend-webhook` for `email.sent`, `email.delivered`,
   `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`,
   and `email.suppressed`. Retain its signing secret server-side.
4. Set `SITE_URL=https://flowwish.app` and a verified `RESEND_FROM`, for example
   `Flow Wish <launch@updates.flowwish.app>`. Store `RESEND_API_KEY`,
   `RESEND_WEBHOOK_SECRET`, and separately generated `WAITLIST_ADMIN_TOKEN`,
   `WAITLIST_SIGNING_SECRET`, and `RATE_LIMIT_SECRET` as Pages secrets.
   Restrict the sending API key to the sending domain. Do not put keys in HTML,
   JavaScript assets, deployment artifacts, or chat.
5. Keep the production D1 UUID and variables in `wrangler.jsonc`. Deploy only
   through `scripts/deploy.sh`, which stages the homepage together with **all app
   support, privacy, deep-link, and Apple association files** from this
   repository. Keep `/api/*` as the only Functions include rule.
6. Verify the deployed binding and secret names, HTTPS API routing, the private
   admin's unauthorized response, and all preserved public pages. Real delivery
   still requires an explicitly authorized test recipient or app launch batch.

No Cloudflare Workers Paid upgrade is required for this implementation. Resend
Free currently permits 100 emails per day and 3,000 per month. The sender caps
requests at 100 per rolling 24 hours and 3,000 per both rolling 30 days and UTC
calendar month, including retries. Other sends in the same Resend account also
consume its allowance; provider rate limits pause this sender.

## Announcing an app

App launch is an owner-triggered operation. Nothing monitors App Store Connect or
starts a mailing automatically. The URL must be an HTTPS App Store URL, a
`github.com/fanyu/` URL, or the configured site's own origin.

Set `WAITLIST_ADMIN_TOKEN` securely in the operator's environment. The default
command returns private counts only and performs no writes or sends:

```sh
node scripts/notify-launch.mjs flow https://apps.apple.com/app/id123
```

After the owner has authorized that app's launch announcement and reviewed its
real URL, send a bounded batch of up to five:

```sh
node scripts/notify-launch.mjs flow https://apps.apple.com/app/id123 --send --confirm 'SEND flow' --limit 5
```

Use `odo` or `pastetrail` for those apps. The example `id123` is a placeholder,
not an app launch URL. The first confirmed batch locks the URL and stops new
subscriptions for that app. Repeat the dry-run before each further batch. Records
for other apps remain untouched.

## Delivery, retry, and archive

- `active`: subscribed, no announcement queued yet.
- `queued`: a frozen announcement payload and stable idempotency key exist.
- `accepted`: Resend accepted the email; it will never be sent again.
- `delivered`: a verified delivery event completed the record; the full email
  address and all historical records remain archived.
- `bounced` / `cancelled`: retained terminal records, excluded from sending.
- `failed` / `needs_review`: retained for operator inspection, never silently
  deleted or blindly resent.

Retries reuse the exact original payload and idempotency key, wait at least five
minutes, and stop after three attempts. A request with uncertain acceptance is
not retried once 23 hours have elapsed. A stable notification tag allows signed
provider events to resolve a lost send response. After a timeout, inspect the
dry-run counts, D1 notification/attempt rows, and Resend logs first. Do not reset
IDs, create a fresh payload, or manually set a record back to active to force a
resend. Provider-accepted delivery failures require investigation rather than a
new send. If webhook delivery failed, replay the original event from Resend.

The unsubscribe link is signed and app-specific. GET only displays a confirmation
page so email scanners cannot unsubscribe someone. Confirmed POST records the
cancellation and prevents future sending for that app. Duplicate signup never
reactivates a delivered, bounced, or cancelled record.

The archive is a status-based private database view, not a public endpoint or a
second copy that needs deletion synchronization. Query or export it only through
the owner's authenticated Cloudflare access. Do not add a public email list or
place a CSV export in this repository or `dist/`. A verified
user's deletion request must be handled across subscriptions, notifications,
attempts, audit records, retained webhook payloads, and provider records; there
is no public arbitrary-delete endpoint.

## Sources

- [Resend pricing](https://resend.com/pricing)
- [Domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Webhook signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Pages Functions configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
