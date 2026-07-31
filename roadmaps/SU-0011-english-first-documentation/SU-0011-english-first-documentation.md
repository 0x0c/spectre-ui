**English** · [日本語](SU-0011-english-first-documentation-ja.md)

# SU-0011 — English-first documentation

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0011](SU-0011-english-first-documentation.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Documentation |
| Related | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) |
<!-- /SU-METADATA -->

## Introduction

This item proposes that every document here lead in English and carry a Japanese mirror. Spectre UI
is a cross-platform library for server-driven user interfaces (SDUI). A server ships a
user-interface definition document. Native software development kits (SDKs) on iOS and Android
render it. The architecture decision records, the roadmap items, and the README already come in
pairs. The ten pages under `docs/` outside `docs/adr/` do not: each exists in Japanese alone.

## Motivation

The specification is what the platforms share. The client renderers use SwiftUI, Jetpack Compose,
and React, one per platform. What holds them to one behavior is the specification and the
conformance corpus, not shared code. A specification in one language limits the set of people who
can write a conforming renderer.

The pairing rule already exists, and `docs/` is where it stops. An English architecture decision
record cites `docs/spec/schema.md` for the document schema. A reader who follows that citation lands
in Japanese. The prose norm asks each document to stand on its own, defining terms where the
reader meets them. A citation that changes language breaks that promise where the reader wanted the
detail.

The documentation site widens the same gap. MkDocs builds `docs/` into a Japanese site. The English
architecture decision records stay off the navigation. A switcher link at the top of each page
reaches them. A reader who arrives in English meets a navigation tree of pages written in Japanese.

Timing decides the cost. The pages under `docs/spec/` change until milestone M0 freezes the
specification. Translating them now buys a translation of prose that M0 will rewrite. The design
pages carry no such churn.

## Detailed design

1. **Extend the pairing rule to `docs/`**. Record the rule in `CLAUDE.md` and in the prose norm
   under `.agent-workflows/`. A page under `docs/` carries an English `X.md` beside a Japanese
   `X-ja.md`, and a change to one side updates the other in the same change.
2. **Move each Japanese page to its `-ja.md` path**. Add the language switcher line to both files,
   matching the architecture decision record pages.
3. **Write the English page for the four design documents**. The four are `tech-selection.md`,
   `architecture.md`, `editor.md`, and `compatibility.md`. The site home `index.md` joins them. No
   specification churn is pending on those pages, so the translation holds.
4. **Write the English page for the four specification documents once M0 freezes them**. The four
   are `spec/schema.md`, `spec/components.md`, `spec/expression.md`, and `spec/actions.md`.
5. **Write the English page for `roadmap.md`**. The milestone overview belongs beside the roadmap
   items it summarizes.
6. **Repoint every link so a document links within its own language**. The two READMEs, the site
   home, the decision records, and the roadmap items cite `docs/` pages. So do `mkdocs.yml` and
   `scripts/site_links.py`.
7. **Carry the English pages into the site build**. They travel the way the English decision records
   already do. `not_in_nav` keeps them off the navigation tree, and the switcher link reaches them.
8. **Add a mirror check to the Pages workflow**. The build fails when a page under `docs/` has no
   counterpart in the other language. `mkdocs build --strict` catches a broken link. A missing
   mirror is a different defect, and no check reports it today.

## Alternatives considered

- **Leave `docs/` in Japanese and translate a page when asked**. Rejected: a translation asked for
  later arrives after the decision it would have informed. The specification is also the document an
  outside implementer reads first.
- **Generate the English side by machine translation during the site build**. Rejected: the prose
  norm asks each language to read naturally to its own readers. No reviewer owns text that a build
  step produces. A mistranslated normative sentence in a specification becomes a defect every
  runtime inherits.
- **Keep English alone and drop the Japanese pages**. Rejected: the team argues and reviews in
  Japanese. The pairs under `docs/adr/` and `roadmaps/` show the two-language arrangement holding in
  practice.
- **Translate everything at once, `docs/spec/` included**. Rejected: M0 rewrites those four pages,
  and the same work then happens twice for one result.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [`docs/adr/README.md`](../../docs/adr/README.md) — the architecture decision records, whose pairs set the precedent this item extends.
- [`.agent-workflows/document-writing/workflow.md`](../../.agent-workflows/document-writing/workflow.md) — the prose norm both language sides follow.
- [SU-0001 — M0, freeze the specification](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) — the freeze that decides when the specification pages are worth translating.
- [`docs/roadmap.md`](../../docs/roadmap.md) — the milestone overview this item schedules its work against.
