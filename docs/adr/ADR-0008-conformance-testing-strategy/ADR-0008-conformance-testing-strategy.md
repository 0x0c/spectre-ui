**English** · [日本語](ADR-0008-conformance-testing-strategy-ja.md)

# ADR-0008 — The conformance testing strategy

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0008](ADR-0008-conformance-testing-strategy.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Quality |
| Related | [ADR-0001](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md), [ADR-0004](../ADR-0004-expression-language/ADR-0004-expression-language.md), [SU-0007](../../../roadmaps/SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) |
<!-- /ADR-METADATA -->

## Context

Three runtimes — Swift, Kotlin, and TypeScript — each evaluate expressions, resolve bindings, apply
actions, and degrade a document against a declared capability. ADR-0001 accepted two native
renderers on the premise that these behaviors can be held together mechanically. This record is that
premise, made concrete.

## Options considered

- **A. Per-runtime unit tests written independently**, with agreement checked by review.
- **B. A shared, implementation-independent corpus of cases** that every runtime's test suite reads
  and executes.
- **C. Cross-platform screenshot comparison** as the primary agreement check.

## Decision

We adopt **option B**. `spec/conformance/` holds implementation-independent JSON cases:

| Corpus | Input | Expected output |
| --- | --- | --- |
| `expr/` | An expression string and a scope | The evaluated JSON value, or an error code |
| `binding/` | A document and a state | The resolved property values |
| `actions/` | A state and a sequence of actions | The resulting state and the sequence of side effects fired |
| `layout/` | A document | The normalized render node tree, before layout computation |
| `compat/` | A document and a capability declaration | The degraded node tree |

Each client SDK's test suite reads and runs this corpus directly. **Changing the specification
without extending the corpus is prohibited**, and continuous integration enforces that.

Visual verification is deliberately separate: `swift-snapshot-testing` on iOS, Roborazzi on Android,
and Playwright on the web. These do not demand agreement across platforms; they detect regressions
within one.

## Rationale

Option A puts agreement at the mercy of whoever writes the second test, which is exactly the drift
ADR-0001 has to prevent for two native implementations to be affordable. A shared corpus moves
agreement from an intention to a fact a build can check.

Option C conflates two different questions. Whether Swift and Kotlin evaluate `a ?? b` identically
is a semantic question with one right answer, and pixels are a poor way to ask it. Whether a screen
still looks right after a change is a visual question, and it is answered per platform, because
demanding pixel agreement across SwiftUI and Compose is demanding something impossible
([ADR-0005](../ADR-0005-editor-stack/ADR-0005-editor-stack.md) makes the same distinction for the
editor's canvas).

## Consequences

The corpus becomes a maintained artifact with its own review standard, and every specification
change costs more up front than it would without it. That cost is the point: it is paid once, in the
change that alters behavior, instead of repeatedly in production incidents where one platform
degrades differently from the other.

Each runtime needs a harness that reads the corpus, which is three small pieces of test
infrastructure to build and keep working.

## Revisit triggers

We reconsider the corpus boundary — which behaviors it covers — when a class of cross-runtime
disagreement is found in production that no corpus category would have caught. The response is to
add a category, not to abandon the approach.

## References

- [ADR-0001 — Client rendering strategy](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md) — the decision this corpus underwrites.
- [ADR-0004 — The expression language and data binding](../ADR-0004-expression-language/ADR-0004-expression-language.md) — the language whose JSON-in, JSON-out shape makes the corpus possible.
- [ADR-0005 — The WYSIWYG editor's technology stack](../ADR-0005-editor-stack/ADR-0005-editor-stack.md) — the same semantic-versus-visual split, applied to preview.
- [SU-0007 — The conformance corpus](../../../roadmaps/SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) — the work that builds the corpus and its harnesses.
