# legal

Privacy policies for my App Store apps, served by GitHub Pages at
<https://fanyu.github.io/legal/>.

## Adding an app

1. `cp -r flow newapp` and edit `newapp/index.html`.
2. Add a row to the `<ul class="apps">` list in `index.html`.
3. Commit and push — Pages rebuilds automatically.

Styling lives in `style.css`; every page links it, so a design change is one file.

## App Store Connect

Paste `https://fanyu.github.io/legal/<app>/` into the app's Privacy Policy URL field.
