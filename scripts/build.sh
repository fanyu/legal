#!/bin/bash
# Stages the public site into dist/ for Cloudflare Pages.
# Pages Functions are compiled separately from ./functions by `wrangler pages deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir dist
rsync -a \
  --exclude /.git --exclude /.github --exclude /.gitignore --exclude /.nojekyll \
  --exclude /.wrangler --exclude /dist --exclude /node_modules \
  --exclude /functions --exclude /waitlist --exclude /migrations --exclude /tests --exclude /scripts --exclude /brand \
  --exclude '/wrangler*.jsonc' --exclude /README.md --exclude '/package*.json' \
  --exclude '.dev.vars*' --exclude '.env*' --exclude .DS_Store \
  ./ dist/

# Never ship configuration, secrets, database dumps or subscriber exports.
leaks=$(find dist \( -name '.dev.vars*' -o -name '.env*' -o -name '*.csv' -o -name '*.sql' -o -name 'wrangler*' -o -name '*.mjs' \) -print)
if [ -n "$leaks" ]; then
  printf 'build: refusing to stage:\n%s\n' "$leaks" >&2
  exit 1
fi
for f in index.html zh/index.html 404.html _redirects _headers _routes.json .well-known/apple-app-site-association; do
  [ -f "dist/$f" ] || { echo "build: missing dist/$f" >&2; exit 1; }
done

# The flowwish.app zone lets browsers cache CSS/JS for hours, so stamp each
# reference with a content hash. The source HTML stays unversioned.
for f in assets/site.css assets/waitlist.js style.css; do
  v=$(shasum "dist/$f" | cut -c1-10)
  n=$(basename "$f" | sed 's/\./\\./g')
  find dist -name '*.html' -exec perl -pi -e "s#((?:href|src)=\"(?:[^\"]*/)?$n)\"#\$1?v=$v\"#g" {} +
done
unstamped=$(grep -rlE '(site\.css|waitlist\.js|style\.css)"' dist --include='*.html' || true)
[ -z "$unstamped" ] || { printf 'build: unversioned asset reference in:\n%s\n' "$unstamped" >&2; exit 1; }

echo "dist: $(find dist -type f | wc -l | tr -d ' ') files"
