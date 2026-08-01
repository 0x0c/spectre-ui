**English** · [日本語](ADR-0007-backend-stack-ja.md)

# ADR-0007 — The backend stack and the shape of delivery

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0007](ADR-0007-backend-stack.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Delivery |
| Related | [ADR-0003](../ADR-0003-ui-document-format/ADR-0003-ui-document-format.md), [ADR-0005](../ADR-0005-editor-stack/ADR-0005-editor-stack.md), [ADR-0006](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md), [SU-0004](../../../roadmaps/SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) |
<!-- /ADR-METADATA -->

## Context

Two services sit behind the editor. The authoring application programming interface (API) stores
drafts, validates them, publishes them, and keeps an audit log. The delivery API answers a client
asking for the current version of a screen. Both need a language, a datastore, and a caching model.

This record assumes an organization without an existing mandate to the contrary; the assumption is
recorded as an open question in [`docs/roadmap.md`](../../roadmap.md).

## Options considered

- **A. TypeScript on Node, sharing code with the editor.**
- **B. Kotlin with Spring, sharing code with the Android client.**
- **C. Go or Rust, chosen for delivery throughput.**

## Decision

We adopt **option A**: TypeScript on Node 22 with Fastify, PostgreSQL with `JSONB` columns, object
storage, and a content delivery network (CDN). The authoring API and the delivery API share one
codebase but deploy as separate units.

Delivery takes this shape:

- A published document is **immutable**. The path `/d/{documentId}/{versionId}` is content-addressed
  and cacheable forever, with `Cache-Control: immutable`.
- A client fetches `/screens/{screenId}`, which resolves the current published pointer and answers
  `200` or `304`. Short time-to-live, plus an entity tag (`ETag`).
- **Rollback is a pointer swap**, and it takes seconds.

## Rationale

Sharing the language with the editor means sharing the manifest-derived types, the validation logic,
and the expression evaluator, not merely the syntax. The server can validate a document and render a
preview with exactly the code the editor uses, which is the difference between one implementation of
the rules and two that drift.

Language performance is not a deciding factor here, because delivery work is fetching a document and
shaping it to a declared capability — neither processor-bound nor algorithmically interesting. The
CDN absorbs the load that would otherwise make throughput a question.

Option B is the reasonable choice for an organization that is uniformly on the Java virtual machine.
It trades the shared expression evaluator for sharing implementation with the Android client, which
is a defensible trade under that constraint but not under ours. Option C optimizes the one dimension
that is not scarce.

## Consequences

The immutable-document plus mutable-pointer split is what makes rollback fast, and it also means the
system stores every published version rather than overwriting. Storage grows monotonically with
publications, which at a few publications a day is a cost worth paying for a rollback measured in
seconds.

## Revisit triggers

We revisit the language choice if the organization turns out to be uniformly on the Java virtual
machine, in which case option B's trade changes sign. We revisit the delivery shape when a screen's
resolution latency, measured behind the CDN, stops being dominated by network time.

## References

- [ADR-0003 — The wire format of a user-interface definition](../ADR-0003-ui-document-format/ADR-0003-ui-document-format.md) — the format being stored and served.
- [ADR-0005 — The WYSIWYG editor's technology stack](../ADR-0005-editor-stack/ADR-0005-editor-stack.md) — the editor this backend shares code with.
- [ADR-0006 — Versioning and forward compatibility](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) — the negotiation the delivery API answers.
- [SU-0004 — M3, authoring and delivery platform](../../../roadmaps/SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) — the work that builds both services.
- [`docs/architecture.md`](../../architecture.md) — the full component and data-flow picture.
