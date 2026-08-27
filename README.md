# legal

Privacy policies for my App Store apps, served by GitHub Pages.

Each app's policy is a standalone page. There is deliberately **no index page and
no cross-links between apps** — a user opening one app's policy should not be
shown the rest of my catalog. The root URL is intentionally blank.

| App | Privacy Policy URL |
| --- | --- |
| Flow | https://fanyu.github.io/legal/flow/ |
| Lull | https://fanyu.github.io/legal/lull/ |
| Odo | https://fanyu.github.io/legal/odo/ |
| PasteFlow | https://fanyu.github.io/legal/pasteflow/ |
| SignatureFlow | https://fanyu.github.io/legal/signatureflow/ |
| VoiceFlow | https://fanyu.github.io/legal/voiceflow/ |

## Adding an app

1. `cp -r flow newapp` and edit `newapp/index.html`.
2. Add a row to the table above.
3. Commit and push — Pages rebuilds automatically.

Styling lives in `style.css`; every page links it, so a design change is one file.
