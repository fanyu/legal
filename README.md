# legal

Source for https://flowwish.app (Cloudflare Pages project `flowwish`): the Flow Wish
homepage, launch notifications, and the privacy, support and deep-link pages for my apps.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `zh/index.html` | Homepage (English, Simplified Chinese) |
| `privacy/`, `zh/privacy/` | Privacy notice for launch notifications |
| `404.html` | Not-found page |
| `assets/` | Homepage styles, scripts, icons and Open Graph images |
| `<app>/` | Per-app privacy policy, support, terms and `link/` fallback pages |
| `style.css` | Shared style for the per-app pages |
| `functions/`, `waitlist/`, `migrations/` | Launch-notification API (Pages Functions + D1), see `waitlist/README.md` |
| `_headers`, `_redirects`, `_routes.json`, `.well-known/` | Pages configuration and Universal Links |

Per-app pages stay standalone: they carry an unlinked Flow Wish letterhead but
**no links to the homepage or to other apps**, so someone opening one app's policy
is not shown the rest of the catalog.

| App | Privacy Policy | Support |
| --- | --- | --- |
| Flow | https://flowwish.app/flow/ | https://flowwish.app/flow/support/ |
| Lull | https://flowwish.app/lull/ | support@flowwish.app |
| Meluva | https://flowwish.app/meluva/ | https://flowwish.app/meluva/support/ |
| Odo | https://flowwish.app/odo/ | https://flowwish.app/odo/support/ |
| PasteTrail | https://flowwish.app/pasteflow/ | https://flowwish.app/pasteflow/support/ |
| Reverie | https://flowwish.app/reverie/ | https://flowwish.app/reverie/support/ |
| SignatureFlow | https://flowwish.app/signatureflow/ | |
| VoiceFlow | https://flowwish.app/voiceflow/ | |

## Adding an app

1. `cp -r flow newapp` and edit the pages.
2. Add a row to the table above. If the app uses Universal Links, add
   `/newapp/link/* /newapp/link/ 200` to `_redirects` and its paths to the AASA file.
3. Commit, then deploy.

## Deploy

`scripts/build.sh` stages the public files into `dist/` (excluding the backend,
tests, scripts and any local configuration) and stamps the CSS/JS references with
a content hash, so a page never pairs with a stylesheet or script from an older
deploy. The flowwish.app zone keeps Browser Cache TTL at "Respect Existing Headers"
(Pages and `_headers` decide caching) and Email Obfuscation off (`mailto:` links are
served as written). `scripts/deploy.sh` builds and runs `wrangler pages deploy`; the
project name, D1 binding and variables come from `wrangler.jsonc`, and secrets
live only in the Pages project. Preview deployments get no database binding.

```sh
export CLOUDFLARE_API_TOKEN=...      # never commit
export CLOUDFLARE_ACCOUNT_ID=...     # required for account-owned tokens
scripts/deploy.sh preview            # https://preview.flowwish.pages.dev
scripts/deploy.sh production         # https://flowwish.app
```

Files removed from the repository can keep being served on flowwish.app from the
Pages cache for up to a week after a deploy.

The repository is also published by GitHub Pages at fanyu.github.io/legal; the
homepage, privacy and 404 pages redirect from there to the same path on flowwish.app.
