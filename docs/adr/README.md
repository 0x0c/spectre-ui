**English** · [日本語](README-ja.md)

# Architecture decision records

An architecture decision record (ADR) captures one significant technical decision: the context that
forced the choice, the options weighed, the decision itself, the reasoning behind it, and the price
paid. This directory is the canonical home for every such decision in Spectre UI, a cross-platform
library for server-driven user interfaces (SDUI), in which a server ships a user-interface
definition document and native software development kits (SDKs) on iOS and Android render it.

An ADR records a decision already made. A roadmap item under [`roadmaps/`](../../roadmaps/README.md)
proposes work still to do. When a piece of work would change a decision recorded here, it does not
edit the ADR in place: it writes a new ADR that supersedes the old one, so the record of what was
believed, and why, survives.

## Records

| ID | Record | Status | Topic |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md) | Client rendering strategy | Accepted | Client runtime |
| [ADR-0002](ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) | The component manifest as the single source of truth | Accepted | Specification |
| [ADR-0003](ADR-0003-ui-document-format/ADR-0003-ui-document-format.md) | The wire format of a user-interface definition | Accepted | Specification |
| [ADR-0004](ADR-0004-expression-language/ADR-0004-expression-language.md) | The expression language and data binding | Accepted | Specification |
| [ADR-0005](ADR-0005-editor-stack/ADR-0005-editor-stack.md) | The WYSIWYG editor's technology stack | Accepted | Editor |
| [ADR-0006](ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) | Versioning and forward compatibility | Accepted | Compatibility |
| [ADR-0007](ADR-0007-backend-stack/ADR-0007-backend-stack.md) | The backend stack and the shape of delivery | Accepted | Delivery |
| [ADR-0008](ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md) | The conformance testing strategy | Accepted | Quality |

## Record IDs: the rules

Records live **one directory per record** under `docs/adr/`. Each record lives in
`docs/adr/ADR-NNNN-<slug>/`, which holds the English file `ADR-NNNN-<slug>.md` and its Japanese
version `ADR-NNNN-<slug>-ja.md` (same ID and slug). `NNNN` is a **zero-padded, four-digit,
monotonically increasing** ID.

When you add a record:

1. **Allocate the next ID** — the highest existing `ADR-NNNN` plus one. Find the current maximum
   with:
   ```bash
   ls -d docs/adr/ADR-*/ | sort | tail -1
   ```
   Never reuse, skip, or guess a number.
2. **Create the record directory and both language files** with `Status: Proposed`, then move it to
   `Accepted` once the decision is agreed.
3. **Add a row to the table above**, in both `README.md` and `README-ja.md`.
4. **IDs are permanent.** Never renumber a record, and never rewrite an accepted decision into a
   different one — supersede it instead (see below).

## Record format

Each file carries a metadata block followed by `## Context`, `## Options considered`,
`## Decision`, `## Rationale`, `## Consequences`, `## Revisit triggers`, and `## References`.
`Revisit triggers` is what keeps a record honest: it names, in advance, the observation that would
force the decision to be reopened.

```markdown
**English** · [日本語](ADR-NNNN-<slug>-ja.md)

# ADR-NNNN — <title>

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-NNNN](ADR-NNNN-<slug>.md) |
| Author | [@handle](https://github.com/handle) |
| Status | **Accepted** |
| Date | YYYY-MM-DD |
| Topic | <topic> |
| Related | <links to other records and roadmap items, or "None"> |
<!-- /ADR-METADATA -->
```

**The Japanese file's title is written in Japanese**, not copied verbatim from the English heading.
An established term (`SDUI`, `manifest`, `fallback`) stays untranslated where translating it would
read unnaturally, but the title itself is Japanese.

## Status values

| Status | Meaning |
|---|---|
| `Proposed` | Written up, not yet agreed |
| `Accepted` | Agreed and in force |
| `Superseded` | Replaced by a later record, which the `Superseded by` field names |
| `Deprecated` | No longer in force, with nothing replacing it |

Superseding is reciprocal: the new record lists the old one under `Supersedes`, and the old one
names its successor under `Superseded by` while keeping its own text unchanged.

## Related

- [`docs/tech-selection.md`](../tech-selection.md) — the index that introduces the constraints every
  record here assumes.
- [`roadmaps/README.md`](../../roadmaps/README.md) — the roadmap items that carry out the work these
  decisions imply.
- [`.agent-workflows/adr/workflow.md`](../../.agent-workflows/adr/workflow.md) — the procedure for
  authoring a record, for humans and coding agents alike.
