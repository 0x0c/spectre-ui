**English** · [日本語](ADR-0006-versioning-and-forward-compatibility-ja.md)

# ADR-0006 — Versioning and forward compatibility

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0006](ADR-0006-versioning-and-forward-compatibility.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Compatibility |
| Related | [ADR-0003](../ADR-0003-ui-document-format/ADR-0003-ui-document-format.md), [ADR-0007](../ADR-0007-backend-stack/ADR-0007-backend-stack.md), [SU-0008](../../../roadmaps/SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md) |
<!-- /ADR-METADATA -->

## Context

Nearly every failure of a server-driven user interface (SDUI) system happens here. **An installed
application stays at its old version unless the user is forced to update**, so an application built
six months ago will receive a document containing a component added today. The system has to define
what happens then, before it happens.

## Options considered

- **A. Leave unknown nodes to each client's implementation** — typically a `default: break` in a
  switch statement that silently drops the node.
- **B. Version the whole document and refuse to render anything the client does not fully
  understand.**
- **C. Make degradation part of the document language itself**, so an author can express what an
  older application should show.

## Decision

We adopt **option C**, in three layers. The full mechanism is specified in
[`docs/compatibility.md`](../../compatibility.md).

1. **Capability negotiation.** The client declares, in request headers, the schema version it
   supports and a hash of the component set it can render. The server returns a tree compatible with
   that declaration.
2. **Per-node fallback.** Any node may carry `fallback`, an alternative node, and `optional`, which
   permits omitting the node when it is unknown. A client that meets an unknown `type` degrades in a
   fixed order: fallback, then omission, then a placeholder. **It never crashes.**
3. **Additive-only schema evolution.** A minor version may only add properties. Removing a property
   or changing its meaning requires a major version, and both versions are served in parallel
   through the migration period.

## Rationale

Option A makes degradation an implementation detail, which guarantees that it differs between iOS
and Android — the same document degrades one way on one platform and another way on the other, and
neither behavior is written down anywhere an author can consult.

Making fallback part of the language instead gives the author control: they can decide what an older
application shows, and the editor can warn them at authoring time about the version floor a given
screen implies. Option B avoids inconsistency but at an unacceptable price, since refusing to render
turns every additive change into a blank screen for older applications.

## Consequences

Every component addition has to consider its fallback story, and authors carry a decision they would
not otherwise have. The editor is what makes that tractable, by surfacing the implied version floor
and the adoption rate for the screen being edited.

The server must keep enough version state to answer a negotiation, and documents cannot be treated
as a single global blob; both costs land in the delivery design
([ADR-0007](../ADR-0007-backend-stack/ADR-0007-backend-stack.md)).

## Revisit triggers

We revisit the additive-only rule only alongside a major version, and we revisit the negotiation
mechanism when telemetry shows a material share of requests degrading — a sign the component set has
outrun the installed base rather than a sign the mechanism is wrong.

## References

- [ADR-0003 — The wire format of a user-interface definition](../ADR-0003-ui-document-format/ADR-0003-ui-document-format.md) — the format whose evolution this record governs.
- [ADR-0007 — The backend stack and the shape of delivery](../ADR-0007-backend-stack/ADR-0007-backend-stack.md) — where negotiation is answered.
- [SU-0008 — Capability negotiation and per-node fallback](../../../roadmaps/SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md) — the work that implements all three layers.
- [`docs/compatibility.md`](../../compatibility.md) — versioning, delivery, and rollback in full.
