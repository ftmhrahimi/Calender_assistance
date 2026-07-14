#!/usr/bin/env bash
# Package the extension into dist/calendar-assistant-<version>.zip for
# upload to the Chrome Web Store or manual distribution.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/extension/manifest.json').version")"
OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/calendar-assistant-$VERSION.zip"

if grep -q "REPLACE_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID" "$ROOT/extension/manifest.json"; then
  echo "WARNING: manifest.json still contains the placeholder OAuth client ID." >&2
  echo "         Google Calendar sign-in will not work until you set a real client ID." >&2
  echo "         See docs/DEPLOYMENT.md, section 'Google OAuth client'." >&2
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT"
(cd "$ROOT/extension" && zip -qr "$OUT" . -x '*.DS_Store')
echo "Packaged: $OUT"
