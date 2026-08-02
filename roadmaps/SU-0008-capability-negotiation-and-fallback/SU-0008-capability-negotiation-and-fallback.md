**English** · [日本語](SU-0008-capability-negotiation-and-fallback-ja.md)

# SU-0008 — Capability negotiation and per-node fallback

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0008](SU-0008-capability-negotiation-and-fallback.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **In progress** |
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

- [x] 1. Client capability declaration
- [x] 2. Server-side tree shaping
- [x] 3. The `fallback` and `optional` node fields
- [x] 4. The fixed degradation order, including the placeholder tier
- [x] 5. The additive-only evolution rule, enforced in CI
- [ ] 6. Editor warnings
- [x] 7. `compat/` corpus cases

**Log**

- 2026-08-02: Landed points 3, 4, 5, and 7. The `fallback` and `optional` fields were already
  honored by both `Resolver` implementations. This change adds the missing third degradation tier —
  a generic placeholder — for a required node with no `fallback`. ADR-0006's fixed order (fallback,
  then omission, then placeholder) now holds on both platforms without ever crashing.
  `Model.kt`/`Model.swift` gained `DegradedTo.PLACEHOLDER` and a synthetic
  `Spectre.UnsupportedComponent` node type outside the manifest's namespace; `Resolver.kt`/
  `Resolver.swift`'s `degrade()` now falls through to it, threading the `repeat` element's stable
  key through fallback and placeholder results alike (a related, previously untested gap: a
  `fallback` resolved inside a `repeat` lost its element's key). `SpectreNodeView`
  (Compose/SwiftUI) renders it as a bordered box with a warning icon and an accessibility label,
  carrying the original unknown `type` in a `componentType` prop for diagnosis. `docs/compatibility.md`
  §3 is rewritten to match ADR-0006's three-tier order (it previously described only two tiers, with
  a placeholder mentioned as a debug-build aside — that text had drifted from the already-accepted
  ADR). Point 5's additive-only rule is enforced by a new script,
  `packages/codegen/check-additive-evolution.mjs`, wired into the CI `codegen` job: it diffs
  `spec/component-manifest.json` against the merge base with `origin/main` and fails a minor
  `schemaVersion` bump that removes a component/prop/action/enum value, changes a `default`, or adds
  a `required` property to an existing component; it skips (not passes) when the base version can't
  be resolved, and does nothing when the major version changes. Point 7 adds
  `spec/conformance/compat/degradation.json` (8 cases covering each tier, recursive fallback,
  mixed trees, and `repeat` interaction) plus a generic directory-reading harness on both platforms
  (`ConformanceCompatTest.kt`, `ConformanceCompatTests` in `ConformanceTests.swift`) instead of the
  single-file pattern the `resolve/` harness used; the existing `resolve/resolver.json` case for the
  no-`fallback`/non-`optional` path was updated to expect a placeholder, since that is precisely the
  behavior this change replaces.

  Points 1 and 2 landed in a follow-up change, once
  [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md)'s `DocumentLoader` and
  [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md)'s delivery service
  merged into this branch (the change above predates both, and named this as a real prerequisite
  gap rather than an omission). `DocumentLoader.load()` now computes a `SpectreCapabilities` value
  (`GeneratedCatalog.SCHEMA_VERSION` / `GeneratedCatalog.capabilityHash()`, matching the constructor's
  `supportedComponents`) and passes it to `SpectreDocumentTransport.fetch()` on every request, on
  both platforms; the transport implementation the host application supplies carries it onward as
  `Spectre-Schema` and `Spectre-Components` headers, per `docs/compatibility.md` §2.
  `packages/manifest` gained `degradeDocumentTree()`: a hash match against the current manifest
  skips tree-walking entirely; otherwise it estimates conservatively from `Spectre-Schema` against
  each component's `since` field, replacing an unsupported node with its (recursively resolved)
  `fallback` or dropping it if `optional`. Both branches mirror `Resolver.degrade()`'s first two
  branches on the client, rather than inventing new behavior. The third branch (a required node with
  no fallback) stays untouched on purpose: the server does not manufacture its own placeholder, so
  as not to duplicate the client's one implementation of it, and the client's own `Resolver` still
  catches it as the documented last line of defense.
  `packages/server`'s delivery route calls this on every `GET /screens/:screenId`, and folds the
  declared capability into the `ETag` so a CDN cannot serve a response shaped for one client to
  another. Point 6 stays blocked: there is still no editor
  ([SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md)) to surface a version-floor
  warning in.

## References

- [ADR-0006 — Versioning and forward compatibility](../../docs/adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) — the decision this item implements.
- [`docs/compatibility.md`](../../docs/compatibility.md) — the mechanism in full, including the rollback strategy.
- [SU-0007 — The conformance corpus](../SU-0007-conformance-corpus/SU-0007-conformance-corpus.md) — the `compat/` cases that hold the two runtimes to the same degradation.
- [SU-0005 — M4, operational maturity](../SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity.md) — the adoption-rate feedback built on this telemetry.
