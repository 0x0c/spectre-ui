**English** · [日本語](README-ja.md)

# Spectre UI roadmap

This directory holds the Spectre UI roadmap: one directory per item, each carrying an English
document and its Japanese mirror. A roadmap item is a proposal in the Swift-Evolution sense — a
self-contained argument for a piece of work, written before the work starts and kept current while
it proceeds. Spectre UI is a cross-platform library for server-driven user interfaces (SDUI), in
which a server ships a user-interface definition document and native software development kits
(SDKs) on iOS and Android render it.

Every item here is currently a `Proposal`, but that field can lag the code: the repository is in its
client-implementation phase, and product code already exists under `clients/`, `packages/`, and
`spec/` for parts of some items whose `Status` has not yet been updated to match. See
[`docs/roadmap.md`](../docs/roadmap.md) for what is actually built per area.

## Items

| ID | Item | Topic |
| --- | --- | --- |
| [SU-0001](SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) | M0 — Freeze the specification | Specification |
| [SU-0002](SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) | M1 — Client SDKs for iOS and Android | Client SDK |
| [SU-0003](SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md) | M2 — The WYSIWYG editor | Editor |
| [SU-0004](SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) | M3 — Authoring and delivery platform | Delivery |
| [SU-0005](SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity.md) | M4 — Operational maturity | Operations |
| [SU-0006](SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md) | Manifest-driven code generation | Tooling |
| [SU-0007](SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) | The conformance corpus | Tooling |
| [SU-0008](SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md) | Capability negotiation and per-node fallback | Compatibility |
| [SU-0009](SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) | The device mirror preview | Editor |
| [SU-0010](SU-0010-narrow-scope-pilot/SU-0010-narrow-scope-pilot.md) | A narrow-scope first pilot | Adoption |
| [SU-0011](SU-0011-english-first-documentation/SU-0011-english-first-documentation.md) | English-first documentation | Documentation |

The table lists every item; an item's `Status` field, not this table, is the single source of truth
for how far along it is.

## Unsorted ideas

Ideas that are not yet shaped enough to be numbered. Promote one to an item once its scope is clear.

- A partial and template mechanism, so a shared header or footer is authored once (a candidate slice
  out of [SU-0005](SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity.md)).
- `HostSlot`, a node type that embeds a native view supplied by the host application.
- An alternative binary encoding (`+cbor`) behind the same document structure, should document size
  ever become a delivery problem.

## Item IDs: the rules

The roadmap is **one directory per item** under `roadmaps/`. Each item lives in
`roadmaps/SU-NNNN-<slug>/`, which holds the English file `SU-NNNN-<slug>.md` and its Japanese
version `SU-NNNN-<slug>-ja.md` (same ID and slug). **SU** stands for *Spectre UI*, and `NNNN` is a
**zero-padded, four-digit, monotonically increasing** ID. Every item lives directly under
`roadmaps/` in a flat layout, so an item's path is fixed the moment its ID is allocated and never
moves.

When you add a roadmap item:

1. **Allocate the next ID** — the highest existing `SU-NNNN` plus one, over every item under
   `roadmaps/`. Find the current maximum with:
   ```bash
   ls -d roadmaps/SU-*/ | sort | tail -1
   ```
   Never reuse, skip, or guess a number.
2. **Create the item directory and both language files** with `Status: Proposal`, because a new item
   is always a proposal first — `roadmaps/SU-NNNN-<slug>/SU-NNNN-<slug>.md` (English) and
   `roadmaps/SU-NNNN-<slug>/SU-NNNN-<slug>-ja.md` (Japanese, same ID and slug).
3. **Add a row to the table above**, in both `README.md` and `README-ja.md`.
4. **IDs are permanent.** Never renumber an existing item — not when its status changes, not when it
   is completed, not when it is dropped. An SU ID, once assigned, refers to that item forever.

## Item format

Each file follows the Swift-Evolution proposal format: a metadata block followed by
`## Introduction`, `## Motivation`, `## Detailed design`, `## Alternatives considered`,
`## Progress`, and `## References`. Fill what you can and mark an unknown `TBD`.

```markdown
**English** · [日本語](SU-NNNN-<slug>-ja.md)

# SU-NNNN — <title>

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-NNNN](SU-NNNN-<slug>.md) |
| Author | [@handle](https://github.com/handle) |
| Status | **Proposal** |
| Topic | <topic> |
| Related | <links to other items, or "None"> |
<!-- /SU-METADATA -->
```

Four rules govern the content:

- **The Japanese file's title is written in Japanese**, not copied verbatim from the English
  heading. Translate it under the same rule the rest of the prose follows: an established term
  (`SDUI`, `manifest`, `fallback`) stays untranslated when translating it would read unnaturally,
  but the title itself is Japanese.
- **`Detailed design` enumerates the work MECE** — mutually exclusive, collectively exhaustive — so
  that the checklist below can mirror it one box per unit of work.
- **`Progress` is a living section**: a checklist mirroring the `Detailed design` breakdown (one
  `- [ ]` box per unit of work, ticked `- [x]` as it lands) plus a short chronological log. A
  not-yet-started proposal carries a single placeholder box.
- **Name the author by GitHub handle** — `| Author | [@handle](https://github.com/handle) |`, the
  account of whoever first authored the item.

`Related` is reciprocal: when one item points at another, the other points back.

## Status values

`Status` is the single source of truth for how far along an item is. It does **not** decide the
item's location, because every item lives in one flat directory whose path is permanent.

| Status | Meaning |
|---|---|
| `Proposal` | Under consideration, not yet started |
| `In progress` | Accepted and actively being built |
| `Implemented` | Shipped |
| `Proposal (deferred)` | Deliberately parked |

**The code decides the status.** An item's `Status` tracks whether its implementation exists, not a
preference to keep the item reading as a forward-looking proposal. An item authored with no code is
`Proposal`; the change that ships its code sets `Status` to `Implemented` — or to `In progress` when
it lands only part of the work — ticks the matching `Progress` boxes, and records the pull request
in the log.

## Related

- [`docs/adr/README.md`](../docs/adr/README.md) — the architecture decision records (ADRs) that fix
  the technical choices these items build on. An ADR records a decision already made; a roadmap item
  proposes work still to do.
- [`docs/roadmap.md`](../docs/roadmap.md) — the milestone overview, estimates, open questions, and
  risk table that the milestone items (SU-0001 through SU-0005) draw from.
- [`.agent-workflows/roadmap-item/workflow.md`](../.agent-workflows/roadmap-item/workflow.md) — the
  procedure for authoring an item, for humans and coding agents alike.
- [`.agent-workflows/implement/workflow.md`](../.agent-workflows/implement/workflow.md) — the
  procedure for shipping an accepted item's code, and the counterpart to authoring it.
