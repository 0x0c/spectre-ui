#!/usr/bin/env bash
# Entry point for the four demos under scripts/demo/. See docs/demo.md for what each one
# shows and what it needs installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/demo.sh <target>

  editor    The web WYSIWYG editor, standalone (needs Node.js + pnpm only)
  server    The authoring and delivery API, walked through with curl
            (needs Node.js + pnpm, and PostgreSQL — via Docker if nothing
            is running locally)
  ios       The iOS sample app (needs macOS, Xcode, and XcodeGen)
  android   The Android sample app (needs the Android SDK and a device
            or emulator)

Details, screenshots, and troubleshooting: docs/demo.md
EOF
}

case "${1:-}" in
  editor|server|ios|android)
    exec "$SCRIPT_DIR/demo/$1.sh"
    ;;
  -h|--help|help|"")
    usage
    [ -z "${1:-}" ] && exit 1
    exit 0
    ;;
  *)
    echo "Unknown target: $1" >&2
    usage
    exit 1
    ;;
esac
