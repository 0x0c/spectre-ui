**English** · [日本語](SU-0004-m3-delivery-platform-ja.md)

# SU-0004 — M3, authoring and delivery platform

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0004](SU-0004-m3-delivery-platform.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Delivery |
| Related | [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0005](../SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity.md), [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md), [SU-0010](../SU-0010-narrow-scope-pilot/SU-0010-narrow-scope-pilot.md) |
<!-- /SU-METADATA -->

## Introduction

Milestone M3 builds the two services behind the editor: the authoring application programming
interface (API), which holds drafts, validates them, publishes them, and records an audit log; and
the delivery API, which answers a client asking for the current version of a screen. Estimated at
four to five full-time-equivalent person-weeks.

**M3 is the point at which the system can go to production.** The first screens to move should be
the ones whose failure costs least — a campaign announcement, a notice list — rather than a checkout
flow.

## Motivation

Until M3, a document has no way to reach a device except by hand. The value of M1 and M2 is
therefore latent: a renderer with nothing to render, and an editor whose output has nowhere to go.

Publishing to real users also introduces the two operational properties the design has been building
toward. Rollback must be a pointer swap that completes in seconds, because a bad screen reaching
production is a question of when rather than whether. And delivery must answer a client's declared
capability, so an application that predates a component still receives a tree it can render
([SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md)).

## Detailed design

1. **The authoring API**: drafts, validation, publication, rollback, and an audit log.
2. **The delivery API**: capability negotiation, entity tags (`ETag`), and content delivery network
   (CDN) configuration.
3. **Permissions and workflow**, including an approval step before publication.
4. **Registration and management of logical endpoints**, which map a screen identifier to the
   document currently published for it.
5. **Telemetry collection and adoption-rate aggregation**, so the share of users who can render a
   given screen is measurable.

## Alternatives considered

- **Serve documents as static files from object storage, with no delivery service.** Rejected:
  capability negotiation needs a request-time decision, and rollback needs a mutable pointer, so a
  service has to sit in front of the storage regardless.
- **Publish directly from the editor, without an approval step.** Rejected for the production entry
  point: the editors are not engineers, and the first screens go out under a workflow that a second
  person signs off on.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [ADR-0007 — The backend stack and the shape of delivery](../../docs/adr/ADR-0007-backend-stack/ADR-0007-backend-stack.md) — the stack, the immutable-document model, and the pointer swap.
- [ADR-0006 — Versioning and forward compatibility](../../docs/adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) — the negotiation this API answers.
- [`docs/compatibility.md`](../../docs/compatibility.md) — delivery, versioning, and rollback in full.
- [SU-0010 — A narrow-scope first pilot](../SU-0010-narrow-scope-pilot/SU-0010-narrow-scope-pilot.md) — what should be published first.
