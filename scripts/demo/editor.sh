#!/usr/bin/env bash
# Demo 1: the web WYSIWYG editor, standalone.
#
# Needs only Node.js and pnpm — no database, no native toolchain. Starts the Vite dev
# server and opens it loaded with examples/screens/product-detail.json, the same sample
# docs/editor.md walks through. See docs/demo.md for what to try once it is open.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
ROOT="$(demo_repo_root)"
cd "$ROOT"

demo_require_cmd node "Install Node.js 22 or newer: https://nodejs.org"
demo_require_cmd pnpm "Install pnpm: https://pnpm.io/installation"

if [ ! -d node_modules ] || [ ! -d packages/editor/node_modules ]; then
  demo_log "Installing dependencies (pnpm install)"
  pnpm install
fi

demo_log "Starting the editor at http://localhost:5173"
echo "  Loaded document : examples/screens/product-detail.json"
echo "  Try             : drag a component from the palette onto the canvas,"
echo "                     select a node to edit it in the inspector,"
echo "                     open the Data tab to edit the sample data,"
echo "                     press Ctrl/Cmd+Z to undo."
echo "  Stop             : Ctrl+C"
echo

exec pnpm --filter @spectre-ui/editor run dev
