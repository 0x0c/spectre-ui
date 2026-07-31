**English** · [日本語](SU-0005-m4-operational-maturity-ja.md)

# SU-0005 — M4, operational maturity

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0005](SU-0005-m4-operational-maturity.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Operations |
| Related | [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md), [SU-0008](../SU-0008-capability-negotiation-and-fallback/SU-0008-capability-negotiation-and-fallback.md) |
<!-- /SU-METADATA -->

## Introduction

Milestone M4 is continuous rather than fixed-length. It covers the capabilities a team wants once
screens are already being published through Spectre UI, a library for server-driven user interfaces
(SDUI) in which a server ships a user-interface definition document and native software development
kits render it: staged rollout, experimentation, richer feedback in the editor, and the escape
hatches that keep the system usable when a requirement outgrows it.

## Motivation

The value of M4 is not new rendering capability but confidence. Once real screens ship this way, the
questions a team asks change: how many users can render this screen, what happens if this
publication is wrong, and what do we do about the one requirement the catalog cannot express.

Each answer is a distinct capability, and none of them belongs in M3, where the goal is simply to
reach production safely with a small set of low-risk screens.

## Detailed design

1. **Staged rollout, A/B testing, and segmented delivery**, so a publication reaches a fraction of
   users first.
2. **Adoption-rate feedback in the editor**, showing an author, while editing, the share of users
   whose application version can render the screen as designed.
3. **Partials and templates**, so a shared header or footer is authored once and reused.
4. **`HostSlot`**, a node type embedding a native view supplied by the host application, for the
   requirement that SDUI genuinely should not express.
5. **Richer pagination and pull-to-refresh** in the client runtimes.
6. **An emergency kill switch**, which reverts a screen to the application's bundled fallback
   document.

## Alternatives considered

- **Fold staged rollout into M3.** Rejected: M3's entry to production is deliberately scoped to
  low-risk screens, where publishing to everyone at once is acceptable and rollback is the safety
  net. Staged rollout matters once higher-risk screens move.
- **Treat `HostSlot` as an admission of failure and leave it out.** Rejected: the escape hatch is
  what keeps a team from abandoning the system when one requirement does not fit, and designing it
  in from the start costs less than retrofitting it under pressure.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [`docs/roadmap.md`](../../docs/roadmap.md) — the milestone overview and the risk table these capabilities answer.
- [ADR-0006 — Versioning and forward compatibility](../../docs/adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) — the mechanism the adoption-rate feedback reports on.
- [SU-0004 — M3, authoring and delivery platform](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) — the telemetry collection this milestone builds on.
