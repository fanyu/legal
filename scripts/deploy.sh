#!/bin/bash
# Usage: scripts/deploy.sh [preview|production]
# Requires CLOUDFLARE_API_TOKEN, plus CLOUDFLARE_ACCOUNT_ID for account-owned tokens.
# Preview deployments get no D1 binding (env.preview in wrangler.jsonc).
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-preview}" in
  preview) branch=preview ;;
  production) branch=main ;;
  *) echo "usage: $0 [preview|production]" >&2; exit 2 ;;
esac
: "${CLOUDFLARE_API_TOKEN:?export CLOUDFLARE_API_TOKEN first}"

scripts/build.sh
# Project name, output directory, D1 binding and vars come from wrangler.jsonc.
npx --yes wrangler@4.147.0 pages deploy --branch "$branch" --commit-dirty=true
