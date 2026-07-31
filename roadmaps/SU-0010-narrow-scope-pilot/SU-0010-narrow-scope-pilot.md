**English** · [日本語](SU-0010-narrow-scope-pilot-ja.md)

# SU-0010 — A narrow-scope first pilot

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0010](SU-0010-narrow-scope-pilot.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Adoption |
| Related | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md), [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) |
<!-- /SU-METADATA -->

## Introduction

This item proposes scoping the first adoption of Spectre UI to a narrow surface — campaign
announcements, notice lists, or onboarding, for instance — instead of aiming at the whole
application. Everything the milestones build is then sized against that surface rather than against
a hypothetical general one.

## Motivation

The size of the component catalog drives every later cost. A catalog aimed at an entire application
has to express layouts nobody has specified yet, which lengthens M0, enlarges both client renderers,
and multiplies the conformance corpus — before a single screen has shipped to a user.

Choosing a narrow surface inverts that. The catalog covers the three real screens the pilot needs,
M0 shortens substantially, and the whole path to production compresses by months. The design's own
open questions say as much: narrowing the scope is the single change with the largest effect on the
schedule.

A pilot also answers questions no design review can. Whether a non-engineer can actually compose a
screen in the editor, whether the approximate preview plus the device mirror is enough to publish
with confidence, and whether the expression language is expressive enough in practice are all
observable only once real people ship real screens.

## Detailed design

1. **Choose the surface**, favoring screens whose failure costs least and whose publication cadence
   is highest — a campaign announcement or a notice list rather than a checkout flow.
2. **Select three real screens** from that surface and express each as hand-written JSON, which is
   the acceptance test for catalog version 0.1
   ([SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md)).
3. **Cut the catalog to what those screens need**, and record what was deliberately left out.
4. **Publish through the pilot surface** once M3 is available, with rollback rehearsed before the
   first real publication.
5. **Review with the actual editors** after a few weeks of use, and feed the findings back into the
   catalog and the editor.

## Alternatives considered

- **Target the whole application from the start.** Rejected: it front-loads the specification cost
  onto screens nobody has committed to moving, and it delays every learning that only real use
  produces.
- **Pilot on a high-value screen such as checkout.** Rejected: the failure cost is the wrong shape
  for a first adoption, and the pressure it creates pushes the team toward reverting to native
  implementation on the first incident.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [`docs/roadmap.md`](../../docs/roadmap.md) — the open questions, of which the scope question is the one this item answers.
- [SU-0001 — M0, freeze the specification](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) — the milestone this scoping shrinks.
- [SU-0004 — M3, authoring and delivery platform](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) — the platform the pilot publishes through.
- [`examples/screens/product-detail.json`](../../examples/screens/product-detail.json) — a worked example of a screen expressed as a document.
