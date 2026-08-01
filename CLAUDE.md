# Working in this repository

Spectre UI is a cross-platform library for server-driven user interfaces (SDUI). The repository
holds specifications, architecture decision records, and a roadmap, and it is in its
**client-implementation phase**: real product code lives under `clients/`, `packages/`, and `spec/`.
See [`docs/roadmap.md`](docs/roadmap.md) for exactly what exists today per area — it can run ahead
of a roadmap item's own `Status` field when a change lands code without also flipping the metadata.

This file is the short form. Each rule below names the one document that states it in full — go
there before acting, rather than working from the summary.

## Documents come in pairs

Everything under `docs/adr/` and `roadmaps/`, along with the repository's own `README.md`, exists in
two languages: `X.md` in English and `X-ja.md` in Japanese. English leads and Japanese mirrors it. A
change to one side updates the other in the same change. The Japanese side is written as natural
Japanese in 敬体 (the polite *desu/masu* style), not as a transliteration of the English — including
the title.

The other documents under `docs/` are Japanese-only today; leave that as it is unless asked.

## Numbering is permanent

- **Roadmap items** live in `roadmaps/SU-NNNN-<slug>/`. The rules — allocating the next ID, both
  language files, the metadata block, the section list, and the `Status` values — are in
  [`roadmaps/README.md`](roadmaps/README.md).
- **Architecture decision records** live in `docs/adr/ADR-NNNN-<slug>/`. Their rules are in
  [`docs/adr/README.md`](docs/adr/README.md).

Never reuse, skip, guess, or renumber an ID. Never rewrite an accepted decision record in place —
supersede it with a new record, so what was believed at the time survives.

## The code decides a roadmap item's status

An item's `Status` tracks whether its implementation exists, not a preference to keep it reading as
a forward-looking proposal. The change that ships an item's code sets its `Status`, ticks its
`Progress` boxes, and records the pull request in the same change — a `Status` that still reads
`Proposal` after its code has landed is a bug in that change, not a fact about the item.

## Prose has a norm, and it shapes the draft

Before writing or revising any document here, read
[`.agent-workflows/document-writing/workflow.md`](.agent-workflows/document-writing/workflow.md) —
it is the authoritative norm for both languages, and it is a drafting guide, not a proofreading
pass. Apply the English layer
([`english-document-writing`](.agent-workflows/english-document-writing/workflow.md)) or the Japanese
layer ([`japanese-document-writing`](.agent-workflows/japanese-document-writing/workflow.md))
alongside it. Run textlint over what you wrote and revise until no finding remains.

## The workflows

[`.agent-workflows/`](.agent-workflows/README.md) holds the shared procedures; `.claude/skills/`
holds the Claude adapters that load them. Use `roadmap-item` to author a proposal, `adr` to record a
decision, `roadmap-filter` to survey what already exists, and `implement` to ship a proposal's code.
