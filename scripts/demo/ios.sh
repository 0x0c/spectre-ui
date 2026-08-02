#!/usr/bin/env bash
# Demo 3: the iOS sample app, rendering examples/screens/product-detail.json with SpectreUI.
#
# Needs macOS, Xcode, and XcodeGen. Generates the Xcode project (the project itself is not
# committed; project.yml is the source of truth) and opens it. Press Run in Xcode from there.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
ROOT="$(demo_repo_root)"

[ "$(uname -s)" = "Darwin" ] || demo_die "The iOS sample needs macOS and Xcode."
demo_require_cmd xcodegen "Install XcodeGen: brew install xcodegen"
demo_require_cmd xcodebuild "Install Xcode from the App Store, then run 'xcodebuild -runFirstLaunch'."

cd "$ROOT/clients/ios/SampleApp"
demo_log "Generating the Xcode project (xcodegen)"
xcodegen generate

demo_log "Opening SpectreSample.xcodeproj — press Run (⌘R) once Xcode finishes indexing"
open SpectreSample.xcodeproj
