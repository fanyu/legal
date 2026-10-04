# legal

Privacy policies for my App Store apps, served at https://flowwish.app (Cloudflare Pages).

Each app's policy is a standalone page. There is deliberately **no index page and
no cross-links between apps** — a user opening one app's policy should not be
shown the rest of my catalog. The root URL is intentionally blank.

| App | Privacy Policy URL |
| --- | --- |
| Flow | https://flowwish.app/flow/ |
| Lull | https://flowwish.app/lull/ |
| Odo | https://flowwish.app/odo/ |
| PasteFlow | https://flowwish.app/pasteflow/ |
| SignatureFlow | https://flowwish.app/signatureflow/ |
| VoiceFlow | https://flowwish.app/voiceflow/ |

## Adding an app

1. `cp -r flow newapp` and edit `newapp/index.html`.
2. Add a row to the table above.
3. Commit, push, then deploy: `npx wrangler pages deploy <dir> --project-name flowwish --branch main` (exclude .git and README.md).

Styling lives in `style.css`; every page links it, so a design change is one file.
