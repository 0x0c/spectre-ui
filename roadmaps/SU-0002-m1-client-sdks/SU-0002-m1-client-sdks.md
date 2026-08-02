**English** · [日本語](SU-0002-m1-client-sdks-ja.md)

# SU-0002 — M1, client SDKs for iOS and Android

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0002](SU-0002-m1-client-sdks.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **In progress** |
| Topic | Client SDK |
| Related | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md), [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md), [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md), [SU-0009](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md), [SU-0012](../SU-0012-apns-sdui-sample-app/SU-0012-apns-sdui-sample-app.md) |
<!-- /SU-METADATA -->

## Introduction

Milestone M1 builds the two native software development kits (SDKs) that render a user-interface
definition document: one in Swift with SwiftUI for iOS 16 and later, one in Kotlin with Jetpack
Compose for Android with a minimum SDK level of 24. The two are built in parallel by one engineer
each, estimated at six to eight full-time-equivalent person-weeks.

M1 ends when three real screens render on both operating systems from hand-written JSON, when the
difference against the existing native implementation is judged acceptable side by side, and when
the conformance corpus passes at one hundred percent on both.

## Motivation

The SDKs are where server-driven user interfaces (SDUI) either earn trust or lose it. A rendering
that is nearly right is worse than no rendering at all, because a team that sees a screen degrade in
an unfamiliar way stops shipping through the system and returns to native implementation — at which
point everything else built here has no consumer.

Two properties therefore matter more than feature count. Rendering must be indistinguishable enough
from hand-written native code that a product engineer accepts it, and a document containing anything
the SDK does not understand must degrade predictably instead of crashing.

## Detailed design

1. **The runtime**: `DocumentLoader`, the state `Store`, the property `Resolver`, and the
   `ActionDispatcher`.
2. **The `SpectreExpr` parser and evaluator**, passing the conformance corpus in both languages.
3. **The renderer**, covering every component in catalog version 0.1.
4. **`ThemeProvider` and the host delegate**, through which the host application supplies tokens and
   handles native actions.
5. **A three-tier cache** with stale-while-revalidate.
6. **Compatibility degradation**: fallback, optional omission, and enforcement of the declared
   limits.
7. **Fuzzing and snapshot tests**, the former against malformed documents, the latter for
   within-platform regression.
8. **A sample application** on each platform.

## Alternatives considered

- **Ship iOS first, then Android.** Rejected: divergence is cheapest to catch while both
  implementations are being written, and a corpus failure found six weeks later is a redesign rather
  than a fix.
- **Render through a shared Kotlin Multiplatform core.** Rejected in
  [ADR-0001](../../docs/adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md),
  which weighs the binary and build costs against the drift the corpus already prevents.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [x] The runtime: `DocumentLoader`, `Store`, `Resolver`, `ActionDispatcher`
- [x] The `SpectreExpr` parser and evaluator, passing the conformance corpus in both languages
- [x] The renderer, covering every component in catalog version 0.1
- [x] `ThemeProvider` and the host delegate
- [x] A three-tier cache with stale-while-revalidate
- [x] Compatibility degradation: fallback, optional omission, and enforcement of the declared limits
- [ ] Fuzzing and snapshot tests
- [x] A sample application on each platform

**Log**

- This repository entered its client-implementation phase with most of the above already built.
- `Store`, `Resolver`, `ActionDispatcher`, and the `SpectreExpr` pipeline existed already.
- So did the Compose and SwiftUI renderers, `SpectreTheme`, and both sample apps.
- This item's `Status` field never caught up to that work.
- `docs/roadmap.md`'s implementation-status table tracked the gap instead.
- This change adds `DocumentLoader` (item 1): a three-tier cache with stale-while-revalidate
  (item 5).
- It also connects differential re-resolve inside `Resolver`.
- The `Expr.dependencies()` machinery existed already, but nothing wired it in until now.
- An unaffected subtree now reuses its prior `RenderNode`s instead of a fresh walk.
- This change wires up `focus`, `scrollTo`, and `applyPatch`.
- All three used to dispatch but stop at an `onUnimplementedEffect` stub on both platforms.
- Both sample apps load through `DocumentLoader` now, not a bundled JSON file directly.
- Fuzzing and snapshot testing (item 7) stay open.
- Every other Detailed design item now has a working, tested implementation on both platforms.

## References

- [ADR-0001 — Client rendering strategy](../../docs/adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md) — why the two SDKs are separate native implementations.
- [SU-0001 — M0, freeze the specification](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) — the specification and generated types this milestone consumes.
- [SU-0007 — The conformance corpus](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) — the acceptance gate for cross-runtime agreement.
- [SU-0008 — Capability negotiation and per-node fallback](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md) — the degradation behavior implemented here.
- [`docs/architecture.md`](../../docs/architecture.md) — the runtime layering.
