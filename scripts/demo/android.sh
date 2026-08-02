#!/usr/bin/env bash
# Demo 4: the Android sample app, rendering examples/screens/product-detail.json with SpectreUI.
#
# Needs the Android SDK and a connected device or a running emulator. Installs the debug
# build via Gradle. Launch it from the device's app drawer once installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
ROOT="$(demo_repo_root)"

[ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ] || [ -f "$ROOT/clients/android/local.properties" ] ||
  demo_die "No Android SDK found (ANDROID_HOME/ANDROID_SDK_ROOT unset, and clients/android/local.properties is missing). Install the Android SDK via Android Studio first."

if command -v adb >/dev/null 2>&1; then
  DEVICE_COUNT="$(adb devices | tail -n +2 | grep -c 'device$' || true)"
  [ "$DEVICE_COUNT" -gt 0 ] || demo_die "No device or emulator is connected (adb devices lists none). Start an emulator, or connect a device with USB debugging on."
else
  demo_warn "adb not found on PATH — skipping the connected-device check; Gradle will fail below if none is attached."
fi

cd "$ROOT/clients/android"
demo_log "Building and installing the debug sample (./gradlew :sample:installDebug)"
./gradlew :sample:installDebug

demo_log "Installed. Open \"Spectre Sample\" on the device to see examples/screens/product-detail.json render."
