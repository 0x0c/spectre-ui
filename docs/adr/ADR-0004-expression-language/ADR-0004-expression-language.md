**English** · [日本語](ADR-0004-expression-language-ja.md)

# ADR-0004 — The expression language and data binding

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0004](ADR-0004-expression-language.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Specification |
| Related | [ADR-0001](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md), [ADR-0008](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md), [SU-0007](../../../roadmaps/SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) |
<!-- /ADR-METADATA -->

## Context

A user-interface definition needs to interpolate values into text ("`${user.name}`, `${state.qty}`
items in your cart"), to branch on a condition through a `visibleWhen` property, and to repeat a
subtree over a list. All three require evaluating an expression on the client against data the
server sent and state the user has changed. The question is how much expressive power to permit.

The answer matters beyond convenience, because an expression arrives from the network. Whatever the
language can do, a compromised server can make every installed application do.

## Options considered

| Option | Strengths | Weaknesses |
| --- | --- | --- |
| A. Embed JavaScript (JavaScriptCore or QuickJS) | Maximum expressive power | Executes arbitrary server-supplied code, which is remote code execution by design. Sits in a grey area of Apple's review guidelines. Requires shipping a separate JavaScript runtime on Android. Makes static validation in the editor impossible |
| B. JsonLogic | Off-the-shelf implementations exist | An expression written as JSON is unreadable in the editor's interface, and the Swift and Kotlin implementations are unmaintained |
| C. Common Expression Language (CEL) | A published specification | No usable Swift implementation, and the specification is larger than this problem needs |
| D. A small bespoke expression language | The grammar can be cut to exactly what is needed, termination can be guaranteed, and the editor can offer completion and type checking | Needs an implementation in each of the three runtimes |

## Decision

We adopt **option D**: a small bespoke expression language named `SpectreExpr`, specified in
[`docs/spec/expression.md`](../../spec/expression.md).

The language is **deliberately not Turing-complete**. It has no loops, no lambdas, no recursion, and
no user-defined functions, and it calls only a whitelist of built-in functions. Every expression
therefore terminates in finite time as a matter of grammar, not of runtime policy.

## Rationale

Option A is ruled out categorically. Expression evaluation is the widest attack surface in an SDUI
system, and no design should create a state in which a compromised server runs arbitrary code on
every device.

Options B and C fall to the same observation: we end up writing the Swift implementation ourselves
either way. Given that, a grammar we define is better than one we inherit — it stays small, and it
lets the editor validate an expression statically and complete it as the author types.

Keeping the grammar narrow has a second payoff. A parser fits in roughly 600 to 900 lines per
language, and because evaluation takes pure JSON in and produces pure JSON out, a golden corpus
verifies that the three implementations agree, mechanically
([ADR-0008](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md)).
That corpus is the premise ADR-0001 leans on when it accepts two native implementations.

## Consequences

Situations where the language is not expressive enough will arrive. The escape route is not to
strengthen the language but to **send a value the server has already computed** in the document's
`data`. Client-side expressions stay confined to presentation logic, which is what keeps the
termination guarantee and the editor's static validation meaningful.

## Revisit triggers

We reopen the grammar — not the decision to keep it non-Turing-complete — when a pattern that
authors need repeatedly cannot be expressed and cannot reasonably be precomputed on the server. Any
such extension is added to the whitelist with a corpus case, never as an escape hatch to arbitrary
evaluation.

## References

- [ADR-0001 — Client rendering strategy](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md) — the decision that makes three implementations acceptable.
- [ADR-0008 — The conformance testing strategy](../ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md) — the corpus that holds the three implementations together.
- [SU-0007 — The conformance corpus](../../../roadmaps/SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) — the work that builds it.
- [`docs/spec/expression.md`](../../spec/expression.md) — the `SpectreExpr` specification.
