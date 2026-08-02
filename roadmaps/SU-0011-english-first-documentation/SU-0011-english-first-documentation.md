**English** · [日本語](SU-0011-english-first-documentation-ja.md)

# SU-0011 — English-first documentation

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0011](SU-0011-english-first-documentation.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **In progress** |
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

- [x] 1. Extend the pairing rule to `docs/`
- [x] 2. Move each existing Japanese page to its `-ja.md` path, with the switcher line on both sides
      (for the six pages that gained an English mirror this pass; see the log)
- [x] 3. Write the English page for the four design documents plus `index.md`
- [ ] 4. Write the English page for the four specification documents once M0 freezes them — deferred
      this pass; see the log
- [x] 5. Write the English page for `roadmap.md`
- [x] 6. Repoint every link so a document links within its own language
- [x] 7. Carry the English pages into the site build
- [x] 8. Add a mirror check to the Pages workflow

**Log**

- 2026-08-02: Landed points 1, 2, 3, 5, 6, 7, and 8; deferred point 4. Detail, in order:

  - **Point 1.** Rewrote `CLAUDE.md`'s "Documents come in pairs" section to cover every page under
    `docs/`, not only `docs/adr/`, and replaced the old blanket "Japanese-only today" carve-out with a
    named exception for `docs/spec/` alone, pointing at this item. Left
    `.agent-workflows/document-writing/workflow.md`'s Scope bullet untouched: it already reads "every
    document under `docs/`, in both languages," so it already stated the target rule; there was
    nothing stale to fix there.
  - **Point 2 and 3.** Moved `index.md`, `tech-selection.md`, `architecture.md`, `editor.md`,
    `compatibility.md`, and `roadmap.md` to their `-ja.md` paths, added the switcher line to each, and
    wrote a new English `X.md` for all six holding a faithful translation of the same content. The
    four pages under `docs/spec/` were left exactly where they are (see point 4) rather than moved to
    an `-ja.md` path with no English counterpart yet, which would have failed the new mirror check
    (point 8) and left a dangling half-pair.
  - **Point 4 — deferred, not guessed.** `SU-0001` (M0, the specification freeze) still reads
    `Status: Proposal`, not `Implemented`. Beyond the field itself, the tree shows the four
    `docs/spec/` pages have taken real, substantive corrections discovered *during* M1 client-SDK
    implementation, not just been read as a settled reference: commit `6e2837b` changed `Tabs`'s
    `selectedId` prop to `bindTo` after building the Compose renderer, and commit `58f0f34` added a
    whole new "string interpolation" section to `spec/expression.md` (object-key ordering) after a
    real Swift/Kotlin behavior mismatch surfaced. That is normative churn discovered by
    implementation, still within this branch's history, not stability. Translating now risks paying
    for the same page twice, which is exactly the alternative the Detailed design already rejects. I
    skipped point 4 on that basis and left the four `docs/spec/` pages untouched, English and all.
  - **Point 5.** Before translating `roadmap.md`, checked it against the actual tree. Its own
    "実装状況 (現時点)" table near the top is accurate for this branch (manifest + codegen, the
    conformance corpus, both native runtimes, and both renderers are genuinely implemented; the editor
    and delivery platform are not). But the milestone checklist further down still shows every M0 and
    M1 box unchecked, which contradicts that same table — a pre-existing inconsistency in the Japanese
    source, not something this change introduced. I translated the page faithfully, checklist
    inconsistency included, rather than silently "fixing" it into a fresher-looking English version;
    fixing roadmap content accuracy is a separate concern from this item's scope. Flagging it here so
    it does not read as an English-side error later.
  - Also worth flagging, found while translating `index.md`: its "現在のフェーズ: 設計（実装コードなし）"
    admonition (current phase: design, no implementation code) is stale the same way — the repository
    has been in its client-implementation phase (per `README.md` and the tree) since before this item
    started. Translated it faithfully rather than quietly correcting it, for the same reason as
    `roadmap.md` above.
  - **Point 6.** Repointed every `docs/` cross-reference that needed it: the two READMEs, `docs/adr/`
    (both the English and the Japanese ADR pages that cited `architecture.md`, `editor.md`,
    `compatibility.md`, or `roadmap.md`), `docs/adr/README-ja.md`'s link to `tech-selection.md`, and
    every `roadmaps/*-ja.md` item that cited one of the six now-paired pages. English-side links needed
    no change, since English content now lives at the same unsuffixed filename those links already
    used. `scripts/site_links.py` needed no change: it rewrites links generically by path, with no
    hardcoded filename.
  - **Point 7.** Added `not_in_nav` entries for the five off-nav English pages
    (`tech-selection.md`, `architecture.md`, `editor.md`, `compatibility.md`, `roadmap.md`), matching
    the existing ADR pattern, and updated `nav:` to point at the new `-ja.md` filenames. `index.md` is
    the one exception: MkDocs always maps a `docs_dir`-root `index.md` to the site's own root URL
    regardless of `nav`, so leaving the new English `index.md` out of `nav` (as `not_in_nav` would)
    would have made the `/docs/` root serve English while every other nav item and the theme chrome
    stayed Japanese. Gave it an explicit `Home (English): index.md` entry instead, next to `ホーム`,
    mirroring how `docs/adr/README.md` already carries an explicit `Index (English)` entry beside `一覧`
    for the same reason (an index page, not an individual record).
  - **Point 8.** Added `scripts/check_docs_mirror.py`, wired into `.github/workflows/pages.yml` before
    `mkdocs build --strict`. It walks `docs/`, excluding `docs/spec/` (the point 4 exception, documented
    in the script's own docstring and in `CLAUDE.md`), and fails if any `X.md` lacks its `X-ja.md` or
    vice versa.
  - **Verification.** `pip install -r requirements-docs.txt` succeeded in this worktree, so I ran the
    real checks rather than hand-verifying: `mkdocs build --strict` passes, `python3
    scripts/check_docs_mirror.py` passes (and was confirmed to fail correctly against a deliberately
    unpaired test file, then re-verified clean after removing it), and `python3
    scripts/build_roadmap_index.py site` runs cleanly. Every new and edited Markdown file went through
    `textlint` per `.agent-workflows/document-writing/workflow.md`. `--fix` mangled English prose on
    the first pass — it applied Japanese-vocabulary substitutions inside English sentences (`path` to
    `パス`, `session` to `セッション`, `%` to `％`) — so I reverted those and fixed the rest by hand
    instead of re-running `--fix`. I cleared every genuine wording issue `write-good` and `stop-words`
    found (filler like "it is", hedges like "exactly" and "roughly", passive voice where an active
    rewrite read at least as well) up to the point where fixing one hedge word's flag (`only`) just
    tripped a different rule on its replacement (`several`, `solely`); past that point further
    rewriting stopped improving the prose and started fighting the linter's word list, so I stopped.
    What remains is `ja-technical-writing/sentence-length` (a Japanese-prose metric with no linguistic
    basis for English, and frequently counting a Markdown table row or a long inline link as one
    "sentence") and `alex` flagging domain vocabulary this specification and its ADRs already use
    throughout (`host`, `crash`, `kill`, `execute`, `color`, `period`, `Japanese`) — the same two
    categories the already-accepted `docs/adr/ADR-0001-client-rendering-strategy.md` also carries
    unresolved, which I used as the baseline for what this repository's textlint pass already accepts
    for English prose. I did not loosen `.textlintrc.json` to reach this state.

## References

- [`docs/adr/README.md`](../../docs/adr/README.md) — the architecture decision records, whose pairs set the precedent this item extends.
- [`.agent-workflows/document-writing/workflow.md`](../../.agent-workflows/document-writing/workflow.md) — the prose norm both language sides follow.
- [SU-0001 — M0, freeze the specification](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) — the freeze that decides when the specification pages are worth translating.
- [`docs/roadmap.md`](../../docs/roadmap.md) — the milestone overview this item schedules its work against.
