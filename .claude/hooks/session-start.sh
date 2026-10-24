#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs Node dependencies so tests, linters, and the dev server work in a
# fresh remote session.
#
# Why --ignore-scripts: this repo pulls `sharp` (via the @capacitor/assets
# mobile-icon tool) which downloads a libvips binary from github.com during its
# postinstall. In the web sandbox github release downloads are blocked, so a
# plain `npm install` aborts and rolls back the whole tree. Skipping install
# scripts avoids that fetch; everything needed to run/build/test the web app
# (esbuild, SWC, the Supabase CLI) ships its binary as an npm optionalDependency
# that resolves at runtime without a script, so nothing needed breaks. On a
# normal laptop you can run a plain `npm install` instead — see LOCAL_DEVELOPMENT.md.
set -euo pipefail

# Only run inside Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

echo "[session-start] Installing npm dependencies (--ignore-scripts)…"
npm install --ignore-scripts --no-audit --no-fund

echo "[session-start] Done. Node dependencies installed."
