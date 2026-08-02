**English** · [日本語](SU-0001-m0-specification-freeze-ja.md)

# SU-0001 — M0, freeze the specification

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0001](SU-0001-m0-specification-freeze.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Specification |
| Related | [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md), [SU-0006](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md), [SU-0010](../SU-0010-narrow-scope-pilot/SU-0010-narrow-scope-pilot.md), [SU-0011](../SU-0011-english-first-documentation/SU-0011-english-first-documentation.md), [SU-0014](../SU-0014-overlay-presentation-options/SU-0014-overlay-presentation-options.md) |
<!-- /SU-METADATA -->

## Introduction

Milestone M0 freezes the specification of Spectre UI, a cross-platform library for server-driven
user interfaces (SDUI) in which a server ships a user-interface definition document and native
software development kits (SDKs) on iOS and Android render it. M0 ends when the component manifest,
the component catalog, the design tokens, and the expression language are settled, and when code
generation runs from the manifest. Estimated at three to four full-time-equivalent person-weeks.

## Motivation

Every later milestone spends its budget on top of these decisions. A component catalog that turns
out to be insufficient in M3 is not a small correction: the client renderers, the generated types,
the editor's palette, and every document already authored all move with it.

The acceptance criterion is therefore behavioral rather than nominal. Three real screens — a list, a
detail view, and a form — must be expressible as hand-written JSON, and a review must agree that
what the catalog offers is enough. A catalog frozen without that test is a catalog frozen on
optimism.

## Detailed design

1. **Design the component manifest's meta-schema.** The manifest is the single source of truth for
   types and editor metadata alike, so its own schema comes first.
2. **Settle component catalog version 0.1.** Verify it against three real screens on paper before
   freezing.
3. **Define the design tokens.** Where a design system already exists, copy the tokens from it
   rather than inventing a second vocabulary.
4. **Fix the grammar of `SpectreExpr`** and write the first version of the conformance corpus for
   it.
5. **Build code generation**: manifest to JSON Schema, TypeScript, Swift, and Kotlin.
6. **Build the conformance corpus runner** in all three languages.

## Alternatives considered

- **Start the client SDKs in parallel and let the specification settle as they go.** Rejected: the
  generated types are an input to those SDKs, so parallel work would be built against a moving
  target and rewritten.
- **Freeze a larger catalog up front, to avoid additions later.** Rejected: forward compatibility
  makes additions cheap and removals expensive, so the catalog should start at the smallest set that
  covers the three verification screens.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [`docs/roadmap.md`](../../docs/roadmap.md) — the milestone overview and estimates this item draws from.
- [`docs/spec/components.md`](../../docs/spec/components.md) — component catalog version 0.1 and the design tokens.
- [SU-0006 — Manifest-driven code generation](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md) — the generator this milestone needs working.
- [SU-0007 — The conformance corpus](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) — the corpus whose first version lands here.
- [ADR-0002 — The component manifest as the single source of truth](../../docs/adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) — the decision this milestone carries out.
