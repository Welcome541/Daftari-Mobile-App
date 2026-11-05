#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Daftari · preview restore
# ---------------------------------------------------------------------
# The sandbox may be re-created between sessions. Everything that is
# git-ignored is lost with it: web/dist (the built bundle) and
# web/node_modules (the tool chain). This script puts the preview
# back on its feet in one command.
#
#   ./web/tools/restore-preview.sh [--port 8080] [--host 0.0.0.0]
#
# It is safe to run at any time: it never overwrites the working tree
# with anything but the branch's own tip, and it is idempotent.
# ---------------------------------------------------------------------
set -euo pipefail

PORT=8080
HOST=0.0.0.0
BRANCH="${DAFTARI_BRANCH:-arena/9f1e6164-daftari-mobile-app}"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

echo "Daftari preview restore"
echo "  root   : $ROOT"
echo "  branch : $BRANCH"
echo "  listen : http://$HOST:$PORT/"
echo

# --- 1. put the branch pointer back where it belongs -----------------
# The sandbox re-clones from origin/main, which leaves HEAD on the old
# monolithic commit. The work is never lost - it is on the branch - but
# the pointer has to be moved back. --mixed keeps every local file.
echo "[1/4] restoring the branch pointer"
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git reset --mixed "$BRANCH"
else
  git fetch origin "$BRANCH" || true
  git reset --mixed "FETCH_HEAD" 2>/dev/null || git reset --mixed "origin/$BRANCH"
fi
git log --oneline -1

# --- 2. the tool chain -----------------------------------------------
echo
echo "[2/4] installing the tool chain"
if [ ! -d "web/node_modules" ] || [ ! -d "web/node_modules/jsdom" ]; then
  (cd web && npm install --no-audit --no-fund)
else
  echo "  already present"
fi

# --- 3. the bundle ----------------------------------------------------
echo
echo "[3/4] building the bundle"
if [ ! -f "web/dist/index.html" ]; then
  (cd web && node build.mjs --version 3.0.0 --build 300 --channel stable)
else
  echo "  already built"
fi

# --- 4. serve ---------------------------------------------------------
# serve.mjs resolves --dir against the repository root, so the path
# stays root-relative even though the script lives under web/.
echo
echo "[4/4] starting the preview"
exec node "$ROOT/web/tools/serve.mjs" --dir web/dist --port "$PORT" --host "$HOST"
