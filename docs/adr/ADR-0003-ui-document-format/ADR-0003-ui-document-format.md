**English** · [日本語](ADR-0003-ui-document-format-ja.md)

# ADR-0003 — The wire format of a user-interface definition

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0003](ADR-0003-ui-document-format.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Specification |
| Related | [ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md), [ADR-0006](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md), [ADR-0007](../ADR-0007-backend-stack/ADR-0007-backend-stack.md) |
<!-- /ADR-METADATA -->

## Context

A user-interface definition document is what the server ships and the client renders. It is also
what the what-you-see-is-what-you-get (WYSIWYG) editor edits, what a reviewer reads before a
release, and what an engineer opens first when a screen renders wrongly in production. The format
has to serve all four readers.

The expected scale sets the performance budget: tens to hundreds of screens, a few publications a
day, and delivery through a content delivery network (CDN) cache. This is not a low-latency,
millisecond-budget delivery problem.

## Options considered

- **A. JSON, validated by JSON Schema.**
- **B. Protocol Buffers or FlatBuffers.**
- **C. A bespoke textual domain-specific language (DSL).**

## Decision

We adopt **option A, JSON**, compressed on the wire with gzip or brotli, and validated against
JSON Schema draft 2020-12. The schema itself is generated from the component manifest
([ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md)).

## Rationale

The document is the artifact the editor manipulates, so being human-readable and diffable carries
real weight. Version control, review, rollback, and reading a document by eye during an incident
all depend on it, and a binary format gives up every one of them.

Size is not the constraint that would justify that loss. At the expected document size of 5 to 50 KB
per screen, behind a CDN and brotli, the difference between JSON and a binary encoding does not
surface in the latency a user perceives.

Option B additionally makes schema evolution rigid, which collides with the core question of SDUI:
what a client does with a node carrying fields it has never seen
([ADR-0006](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md)).
Option C fails on the round trip through the editor — parse, edit, re-serialize — where comments and
formatting are destroyed, and it puts us in the business of maintaining a parser for three runtimes
before the first screen ships.

## Consequences

We accept a larger payload than a binary encoding would produce, in exchange for a format anyone can
read.

An escape route stays open should size ever become the binding constraint: the document is
negotiated through `Content-Type`, so `application/vnd.spectre.doc+json` can be joined by
`application/vnd.spectre.doc+cbor` later. The structure stays identical, and only the encoding is
swapped, so no other decision has to be reopened to take that route.

## Revisit triggers

We add the binary encoding when measured document transfer, at the ninety-fifth percentile over a
real screen mix, becomes a material share of time-to-first-render — not when a document merely looks
large in isolation.

## References

- [ADR-0002 — The component manifest as the single source of truth](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) — the manifest the JSON Schema is generated from.
- [ADR-0006 — Versioning and forward compatibility](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) — the schema-evolution requirement that ruled option B out.
- [ADR-0007 — The backend stack and the shape of delivery](../ADR-0007-backend-stack/ADR-0007-backend-stack.md) — how documents are cached and served.
- [`docs/spec/schema.md`](../../spec/schema.md) — the document schema itself.
