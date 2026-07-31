**English** · [日本語](ADR-0001-client-rendering-strategy-ja.md)

# ADR-0001 — Client rendering strategy

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0001](ADR-0001-client-rendering-strategy.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Client runtime |
| Related | [ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md), [ADR-0004](../ADR-0004-expression-language/ADR-0004-expression-language.md), [ADR-0008](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md), [SU-0002](../../../roadmaps/SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) |
<!-- /ADR-METADATA -->

## Context

Spectre UI is a library for server-driven user interfaces (SDUI): a server ships a user-interface
definition document, and the client renders it. The same document must render the same way on iOS
and on Android, and the first question the design has to answer is how much of the client
implementation the two platforms share.

The answer is constrained by what this library is. It is embedded into an existing host
application, so binary size and the absence of imposed dependencies outrank features. Its render
targets are native iOS and Android applications; the web is the editing surface, not a render
target.

## Options considered

| Option | Content | Strengths | Weaknesses |
| --- | --- | --- | --- |
| A. Two native implementations | Implement separately in SwiftUI and Jetpack Compose | Best rendering quality, animation, and accessibility. No added dependencies. Mixes naturally with the host application's design system | The same logic is written twice, and the two behaviors drift |
| B. Kotlin Multiplatform core with native rendering | Share parsing, expression evaluation, and state management through Kotlin Multiplatform (KMP); render natively | Logic cannot drift, structurally | Adds roughly 1.5–3 MB of Kotlin/Native runtime to iOS. The Swift-facing application programming interface (API) arrives through Objective-C and needs a wrapper. Forces Gradle and KMP build operations onto the iOS team |
| C. Flutter or React Native | Move rendering itself onto a cross-platform framework | One implementation | Forces a large runtime onto the host application for the sake of one library, and mixes poorly with native screens. Out of the question for an embedded library |
| D. WebView | Render HTML | One implementation, easy to update | Loses the native feel. Scroll performance, accessibility, and font scaling all degrade |

## Decision

We adopt **option A, two native implementations**. What the platforms share is not code but three
things: a machine-readable specification, the types generated from it, and a conformance test
corpus common to every runtime.

The target versions follow from that decision:

- iOS 16 or later, SwiftUI, distributed as a Swift package. A `UIHostingController` wrapper ships
  with it for UIKit-based hosts.
- Android with a minimum software development kit (SDK) level of 24, Jetpack Compose, distributed as
  a Gradle module. An `AbstractComposeView` wrapper ships with it for View-system hosts.

## Rationale

Options C and D are incompatible with the premise of an embedded library. The moment a library
forces a runtime onto its host application, the barrier to adopting it rises sharply, and no
rendering benefit pays that back.

The real contest is therefore between A and B, and it turns on how much logic is genuinely
shareable. Three pieces are: decoding the document from JSON, evaluating expressions, and applying
actions to a state store. Together they come to roughly 2,000 to 3,000 lines. Decoding and the types
it needs are generated from the component manifest, which removes drift by construction
([ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md)).
Expression evaluation takes pure JSON in and produces pure JSON out, so a golden-test corpus pins
the three implementations to each other
([ADR-0008](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md)).

Most of the drift option B prevents is thus prevented more cheaply by A plus generation plus the
corpus, while B's costs — the iOS binary growth and the build-operations burden — cannot be
removed at all. The renderer itself, which turns a node tree into SwiftUI or Compose, is
platform-specific under every option and accounts for most of the implementation anyway.

## Consequences

Every change to the expression or state-transition specification must be made in two places. The
conformance corpus, run in continuous integration on both platforms, is what keeps the two honest;
a specification change that does not extend the corpus is rejected.

## Revisit triggers

We move the core — parsing, expression evaluation, and the state store, but not the renderer — to
Kotlin Multiplatform when either of these holds:

- conformance corpus failures attributable to cross-runtime drift exceed three in a quarter, or
- the shared logic grows beyond 5,000 lines.

The design keeps that migration open: the core is separated from the renderer on both platforms
from the start, so a later partial move to option B does not touch rendering code.

## References

- [ADR-0002 — The component manifest as the single source of truth](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) — how generation removes the decoding half of the drift.
- [ADR-0004 — The expression language and data binding](../ADR-0004-expression-language/ADR-0004-expression-language.md) — why the expression evaluator is small enough to implement three times.
- [ADR-0008 — The conformance testing strategy](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md) — the corpus this decision leans on.
- [SU-0002 — M1, client SDKs for iOS and Android](../../../roadmaps/SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) — the work that carries this decision out.
- [`docs/architecture.md`](../../architecture.md) — the runtime layering this decision assumes.
