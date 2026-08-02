**English** · [日本語](SU-0007-conformance-corpus-ja.md)

# SU-0007 — The conformance corpus

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0007](SU-0007-conformance-corpus.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **In progress** |
| Topic | Tooling |
| Related | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md), [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md), [SU-0006](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md), [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md) |
<!-- /SU-METADATA -->

## Introduction

This item builds `spec/conformance/`, a corpus of implementation-independent JSON cases, and the
three test harnesses — Swift, Kotlin, and TypeScript — that read and execute it. Each case names an
input and the exact output every runtime must produce.

## Motivation

Spectre UI ships two native renderers rather than one shared implementation, on the explicit premise
that the behaviors underneath rendering can be pinned mechanically
([ADR-0001](../../docs/adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md)).
This corpus is that premise. Without it, the same document evaluating differently on iOS and Android
is a defect nobody can detect until a user reports a screen that looks wrong on one platform only.

Corpus cases are also the cheapest place to settle a specification question. A disagreement about
what `a ?? b` means with a missing binding is resolved once, as a case, instead of twice as two
implementations and a third time as an incident.

## Detailed design

1. **`expr/`** — an expression string and a scope, against the evaluated JSON value or an error
   code.
2. **`binding/`** — a document and a state, against the resolved property values.
3. **`actions/`** — a state and a sequence of actions, against the resulting state and the sequence
   of side effects fired.
4. **`layout/`** — a document, against the normalized render node tree before layout computation.
5. **`compat/`** — a document and a capability declaration, against the degraded node tree.
6. **A harness per runtime**, reading the corpus directly rather than through a generated copy.
7. **The continuous integration rule** that a change to specified behavior must extend the corpus in
   the same change.

## Alternatives considered

- **Per-runtime unit tests, with agreement checked in review.** Rejected: agreement then depends on
  whoever writes the second test remembering what the first one asserted, which is exactly the drift
  this corpus exists to prevent.
- **Screenshot comparison across platforms.** Rejected as the agreement mechanism: whether two
  runtimes evaluate an expression identically is a semantic question, and pixels answer it poorly.
  Screenshots stay in use per platform, for within-platform regression.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [x] `expr/` — an expression string and a scope, against the evaluated value or an error code
- [x] `binding/` — a document and a state, against the resolved property values
- [x] `actions/` — a state and a sequence of actions, against the resulting state and side effects
- [x] `layout/` — a document, against the normalized render node tree before layout computation
- [ ] `compat/` — a document and a capability declaration, against the degraded node tree
- [x] A harness per runtime, reading the corpus directly
- [x] The continuous integration rule tying a specification change to a corpus change

**Log**

- This repository entered its client-implementation phase with `expr/` and `resolve/` already built.
- `resolve/` holds `resolver.json` and `actions.json`, 234 cases total.
- Kotlin and Swift already run them, through `ConformanceExprTest`/`ConformanceResolveTest` and
  `ConformanceTests`.
- `resolve/resolver.json` asserts full `RenderNode` subtrees, beyond single prop values in isolation.
- That makes it the de facto home for both `binding/` and `layout/`.
- The design names them as separate directories, but the split does not hold in practice.
- A resolved property value and the tree shape around it turn out to need the same check.
- This change adds the missing third harness: `packages/core`.
- `packages/core` is a hand-written TypeScript `SpectreExpr` parser and evaluator.
- The port follows the Kotlin implementation line-for-line.
- `docs/spec/expression.md` §6 and §7 require this third parser explicitly.
- It did not exist before this change.
- `packages/core/test/conformance.test.ts` reads `spec/conformance/expr/*.json` directly.
- It runs the same 199 cases Kotlin and Swift already run.
- It passed on the first real run against the ported code.
- This change also adds a continuous-integration step enforcing item 7.
- A pull request can touch `docs/spec/` or the manifest without touching `spec/conformance/`.
- That pull request now fails the `codegen` job.
- `compat/` stays open.
- It needs real capability degradation to assert against.
- That is
  [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md),
  itself still a `Proposal` at the time of this change.
- That is a genuine dependency block, not an omission.
- `packages/core` does not yet cover JSON Patch or dependency-path extraction.
- It covers the parser and evaluator that the `expr/` corpus exercises, and nothing beyond that.
- A fresh-context review found seven places where the port could disagree with Kotlin.
- Today's corpus catches none of them.
- Building an object literal with `out[k] = value` let a key named `__proto__` reach the
  `Object.prototype` accessor.
- It now builds via `Object.create(null)` instead, so that key becomes a normal property.
- `<`/`<=`/`>`/`>=` used raw JavaScript comparison.
- That disagrees with Kotlin's `Double.compareTo` on `NaN` and on signed zero.
- A new `compareNumbers` helper now matches Kotlin's ordering.
- `first`/`last` recorded a spurious `E_TYPE` on a non-array argument.
- Kotlin stays silent there, and this port now matches that.
- `round`'s digit count and `slice`'s bounds left a fractional number untruncated.
- Kotlin's `Double.toInt()` narrows it first; a shared `toIntTruncating` helper now does the same.
- `compareVersions` read a version segment such as `-5` as a negative number.
- Kotlin reads a segment's leading digit run and drops the rest; this port now agrees.
- `toNumber` accepted JavaScript's `0x`/`0o`/`0b` literal syntax.
- Kotlin's parser does not accept that syntax, so this port no longer does either.
- All 199 `expr/` cases still pass after every fix.

## References

- [ADR-0008 — The conformance testing strategy](../../docs/adr/ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md) — the decision this item implements.
- [ADR-0004 — The expression language and data binding](../../docs/adr/ADR-0004-expression-language/ADR-0004-expression-language.md) — the language whose JSON-in, JSON-out shape makes the corpus possible.
- [`docs/spec/expression.md`](../../docs/spec/expression.md) — the behavior `expr/` pins down.
- [SU-0002 — M1, client SDKs for iOS and Android](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) — the SDKs that must pass it at one hundred percent.
