**English** · [日本語](SU-0013-renderer-visual-regression-testing-ja.md)

# SU-0013 — Visual regression testing for the renderers

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0013](SU-0013-renderer-visual-regression-testing.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **In progress** |
| Topic | Client SDK |
| Related | [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md), [SU-0009](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) |
<!-- /SU-METADATA -->

## Introduction

This item adds visual regression testing (VRT) to both renderers. One is the Jetpack Compose
renderer on Android. The other is the SwiftUI renderer on iOS.

A VRT suite renders a fixed set of user-interface definition documents to images. It compares each
image against a reference image committed alongside the code. That reference image is a *golden*. A
change that alters how a screen looks fails the comparison. The suite then publishes the rendered
image and the pixel difference as a build artifact.

Both platforms read one case list, `spec/vrt/cases.json`. It sits under `spec/`, beside the
conformance corpus. The goldens themselves stay per-platform. Compose and SwiftUI draw a screen
differently by design, so their images cannot match. The shared case list guarantees something
narrower. Both platforms cover the same screens, under the same conditions.

## Motivation

Spectre UI already pins one half of rendering. The conformance corpus lives under
`spec/conformance/`. It feeds a document and a set of client capabilities to three runtimes. Those
runtimes are the Swift, Kotlin, and TypeScript ones. The corpus compares the resolved render tree
each runtime produces. The three implementations agree on what to draw as a result. The corpus
stops at that tree.

Below the tree sits the step that turns a `RenderNode` into pixels. That step spans the modifier
chain and the token maps for spacing and palette. It also maps each component onto Compose and
SwiftUI. No check compares the output of that step against anything.

The checks that cover the renderers today verify weaker properties. On Android,
`:spectre-ui:testDebugUnitTest` covers property extraction and the token maps. On iOS,
`SpectreUITests` covers the same two layers. Neither one builds a view tree.
`:spectre-ui:assembleDebug` and the `xcodebuild build` step prove that the renderer compiles.
Neither says anything about what the renderer draws. Three changes show the gap. A modifier moves
within the chain. A token points at the wrong step of the scale. A version bump shifts a Material
or SwiftUI default. Any of the three can change every screen the library renders. Every check
named above stays green throughout.

The gap matters more here than in an application that owns its screens. An application embeds
Spectre UI and hands it documents. That application's own engineers never read those documents as
code. A rendering regression reaches screens the delivery platform already published. It needs no
recompile on the application's side. Milestone M1 (SU-0002) listed snapshot testing as a
deliverable for that reason. The box stayed unticked. That box is the one unticked item in M1
guarding the renderer.

A reader might expect the device mirror (SU-0009) to close the gap. The device mirror puts a real
device's rendering in front of an author. That sounds like the same job. It answers a different
question. It shows an author what one document looks like right now, on demand. It also needs a
person to look at the result. A regression check must run unattended on every pull request. It must
fail on a change nobody thought to inspect.

## Detailed design

1. **A shared fixture set and case list**, `spec/vrt/`. `spec/vrt/screens/` holds the documents to
   render, and `spec/vrt/cases.json` lists the cases. A case names its document and its rendering
   condition. That condition covers the viewport width and height in density-independent pixels.
   It also covers the theme (`light` or `dark`) and the font scale. Both platforms read that one
   file, the way both read `spec/conformance/` today. The fixtures serve VRT rather than borrowing
   from `examples/screens/`. A fixture must stay pixel-stable, so it carries no remote image. Such
   an image could load on one run and fail on the next. A fixture changes when someone intends to
   change a golden, and at no other time.
2. **The Android suite**, in `:spectre-ui`'s existing unit-test source set. Roborazzi renders the
   Compose tree through Robolectric on the Java virtual machine (JVM). The suite runs on the same
   Ubuntu continuous-integration (CI) runner as the existing Android job. It needs no emulator and
   no connected device. Each case applies the Robolectric qualifiers and the font scale it
   declares. It then renders `SpectreScreen` and captures a portable network graphics (PNG) image.
3. **The iOS suite**, a new `SpectreUISnapshotTests` target. It depends on swift-snapshot-testing.
   That library puts a SwiftUI view inside a `UIHostingController` and captures the result. The
   dependency sits on the test target alone. An application that consumes the `SpectreUI` package
   never resolves it. The suite compiles for iOS alone and runs on the iOS Simulator under
   `xcodebuild test`. The SwiftUI an application ships is the iOS one. A macOS rendering of the
   same view would pin the wrong thing.
4. **Golden storage and the two run modes.** A golden lives beside the suite that produces it.
   Android keeps its goldens under `clients/android/spectre-ui/src/test/snapshots/`. iOS keeps its
   own under `clients/ios/Tests/SpectreUISnapshotTests/__Snapshots__/`. Verify mode compares each
   image and fails on a difference. Record mode overwrites the goldens. Record mode is also how
   someone accepts an intended visual change. Rerun in record mode, then review the image diff in
   the resulting commit.
5. **Two CI jobs**, `android-vrt` and `ios-vrt`. Each job runs verify mode once its platform's
   goldens exist. It runs record mode when they do not, and uploads what it recorded as an
   artifact. Committing that artifact establishes the first set. A `workflow_dispatch` input forces
   record mode. That input is how the goldens get refreshed after an intended change.
6. **A fixture-coverage check**, in `:spectre-core`'s tests. It reads the manifest and the
   fixtures. It fails when a catalog component appears in no fixture. Without that check, a
   component added to the catalog later would ship with no golden. Nothing would say so. The check
   reads JSON alone, so it runs in the existing `core` job without an Android SDK.

## Alternatives considered

- **Instrumented tests on an emulator or a device.** Rejected. An emulator in CI costs minutes per
  run. It also brings back flakiness that an off-device renderer avoids. Boot races, animation
  timing, and system dialogs all return. A comparison against a committed image needs determinism.
  Robolectric gives that from a fixed Android jar.
- **Paparazzi instead of Roborazzi on Android.** Rejected. Paparazzi is a Gradle plugin bound to
  the Android Gradle Plugin's internals. An Android Gradle Plugin upgrade can wait on a Paparazzi
  release as a result. Roborazzi's capture functions are an ordinary library on the test classpath.
  This item uses them that way, so the build gains no plugin.
- **Comparing an iOS image against the Android image of the same case.** Rejected. ADR-0001 chose
  two native renderers so that each one looks native on its platform. A pixel difference between
  the two is the intended outcome rather than a defect. Agreement across platforms belongs to the
  conformance corpus. The corpus enforces it one layer up, on the resolved tree.
- **Rendering SwiftUI through `ImageRenderer` instead of taking a package dependency.** Rejected.
  `ImageRenderer` draws a view outside the UIKit view hierarchy. Scrolling content, safe areas, and
  toolbars resolve differently there than in a running application. `SpectreScreen` uses all three.
  A golden that pins the wrong rendering is worse than no golden.
- **Generating the first goldens by hand, outside CI.** Rejected as the primary path. A golden
  means something when it comes from the environment that later compares against it. CI is the one
  environment every contributor shares. A developer with Xcode and the Android SDK can still record
  locally, and produces the same files.

## Progress

> Keep this current as work proceeds. The checklist mirrors the *Detailed design* breakdown. The
> log records what changed and when, oldest first.

- [x] A shared fixture set and case list, `spec/vrt/`
- [x] The Android suite (Roborazzi and Robolectric)
- [x] The iOS suite (swift-snapshot-testing)
- [ ] Golden storage and the two run modes
- [x] Two CI jobs, `android-vrt` and `ios-vrt`
- [x] A fixture-coverage check

**Log**

- 2026-08-02: Item authored, and every part of it built except the goldens themselves. This change
  lands `spec/vrt/`, whose two fixtures cover all 26 catalog components. It lands the Roborazzi
  suite in `:spectre-ui` and the `SpectreUISnapshotTests` target on iOS. It also lands the
  `android-vrt` and `ios-vrt` jobs, plus `VrtFixtureCoverageTest` in `:spectre-core`.
- 2026-08-02: The golden box stays unticked, because no golden image exists yet. Each suite skips
  itself while its golden directory stays empty. Neither one asserts anything today. The first
  `android-vrt` and `ios-vrt` runs record the goldens and publish them as build artifacts.
  Committing those images turns the comparison on and completes this item.

## References

- [SU-0002 — M1, client SDKs](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) — the milestone whose snapshot-testing box this item fills.
- [SU-0007 — The conformance corpus](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) — the check that stops at the resolved render tree.
- [SU-0009 — The device mirror preview](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) — the on-demand preview, contrasted above.
- [ADR-0001 — Client rendering strategy](../../docs/adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md) — why the goldens stay per-platform.
- [`docs/roadmap.md`](../../docs/roadmap.md) — the per-area implementation status and CI job table this item updates.
