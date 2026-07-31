**English** · [日本語](SU-0008-capability-negotiation-and-fallback-ja.md)

# SU-0008 — Capability negotiation and per-node fallback

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0008](SU-0008-capability-negotiation-and-fallback.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Compatibility |
| Related | [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md), [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md), [SU-0005](../SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) |
<!-- /SU-METADATA -->

## Introduction

This item implements the three layers that keep an old application working against a new document:
capability negotiation on the wire, per-node fallback in the document language, and an additive-only
rule for schema evolution. The work spans the client software development kits (SDKs), the delivery
service, and the editor.

## Motivation

An installed application stays at its old version unless every user is forced to update, so a
document containing a component added today will reach an application built six months ago. What
happens at that moment decides whether a team trusts the system: a crash or a blank screen ends
adoption, and a silent, platform-specific omission is nearly as bad, because nobody can predict it
while authoring.

Making degradation part of the document language moves that outcome into the author's hands. An
author can state what an older application should show instead, and the editor can warn about the
version floor a screen implies before it is published.

## Detailed design

1. **Client capability declaration.** The SDK sends the supported schema version and a hash of the
   component set it can render, in request headers.
2. **Server-side tree shaping.** The delivery service returns a tree compatible with the declared
   capability, resolving what the client cannot render.
3. **The `fallback` and `optional` node fields**, specified in the document schema and honored by
   both renderers.
4. **The fixed degradation order** in the client runtimes: fallback, then omission, then
   placeholder — never a crash.
5. **The additive-only evolution rule**, enforced when the manifest changes: a minor version may
   only add properties.
6. **Editor warnings**, showing the version floor a screen implies as it is edited.
7. **`compat/` corpus cases** covering each degradation path, so both runtimes degrade identically.

## Alternatives considered

- **Leave unknown nodes to each client's implementation.** Rejected: degradation becomes an
  implementation detail, so the same document degrades differently on iOS and Android and no author
  can predict either.
- **Refuse to render a document the client does not fully understand.** Rejected: it turns every
  additive change into a blank screen for older applications, which is a worse failure than a
  degraded one.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [ADR-0006 — Versioning and forward compatibility](../../docs/adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) — the decision this item implements.
- [`docs/compatibility.md`](../../docs/compatibility.md) — the mechanism in full, including the rollback strategy.
- [SU-0007 — The conformance corpus](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) — the `compat/` cases that hold the two runtimes to the same degradation.
- [SU-0005 — M4, operational maturity](../SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity.md) — the adoption-rate feedback built on this telemetry.
