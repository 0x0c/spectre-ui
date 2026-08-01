# Authoring a roadmap item

A sounding board for shaping Spectre UI work into numbered roadmap (SU) items. You are the author
and the thinking partner, **not** the judge. Converse in the user's language — the roadmap is
bilingual, so mirror their language in the chat and write the files in both, as required below.

Spectre UI is a cross-platform library for server-driven user interfaces (SDUI), in which a server
ships a user-interface definition document and native software development kits (SDKs) on iOS and
Android render it.

## Scope: roadmap authoring only — never implement

This workflow **only** authors and shapes roadmap items. It stops at the files under `roadmaps/`
(and, when asked, the pull request that carries them). **Do not write, modify, or refactor product
code**, even if the discussion makes the implementation obvious or the user nudges toward "just
build it". The deliverable is always the proposal, never a working feature.

Three neighboring cases go elsewhere:

- A decision that is **already made** and needs recording is an architecture decision record, not a
  roadmap item. Use [`adr`](../adr/workflow.md).
- A **read-only survey** of what is already proposed is [`roadmap-filter`](../roadmap-filter/workflow.md).
- A proposal that is **accepted and ready to build** is [`implement`](../implement/workflow.md), the
  counterpart to this workflow: it ships an item's code and never reshapes the proposal it was
  handed. A design gap it finds comes back here, not around it.

## Constraints every idea must respect

These come from the accepted architecture decision records under
[`docs/adr/`](../../docs/adr/README.md). An idea that brushes against one of them is not silently
dropped: name the conflict, then reshape the idea into something that fits.

1. **The library is embedded into an existing host application.** Binary size and the absence of
   imposed dependencies outrank features.
2. **The manifest is the single source of truth.** Anything that adds a second hand-maintained copy
   of a component definition is reshaped or rejected (ADR-0002).
3. **No arbitrary code from the server.** The expression language stays non-Turing-complete, and
   presentation logic stays on the client while computation moves to the server (ADR-0004).
4. **Old applications must not break.** Every user-visible addition has a degradation story:
   fallback, omission, or placeholder — never a crash (ADR-0006).
5. **Editors are not engineers.** The component catalog stays a closed set, and free-form styling
   stays out.

## Workflow

### 1. Ground yourself in the existing roadmap

Before proposing, read:

- [`roadmaps/README.md`](../../roadmaps/README.md) and [`README-ja.md`](../../roadmaps/README-ja.md)
  — every item, its topic, and the numbering rules.
- [`docs/roadmap.md`](../../docs/roadmap.md) — the milestones, estimates, open questions, and risks.
- [`docs/adr/README.md`](../../docs/adr/README.md) — the decisions already made.
- The specific `SU-NNNN-*/` files relevant to the user's topic.

This is what makes the session a sounding board rather than a blank page: every suggestion is
anchored to what is already planned or deliberately excluded.

### 2. Ideate with the user

Go back and forth. Offer concrete, bounded ideas, and ask the questions that sharpen scope: who is
it for, which milestone does it belong to, and what is the observable outcome that would say it is
done. Pull in adjacent items as reference points — "this is close to SU-000x; extend it, or is it
distinct?" — and keep offering seeds the user can react to.

### 3. Classify each idea that survives

For every idea the user wants to keep, choose one of three landings and say which you chose and why:

- **Overlaps an existing item** → do not create a duplicate. Sharpen that item's Motivation or
  Detailed design in both languages, and say in the chat which item you extended.
- **Novel and scoped enough** → draft a new item (step 4).
- **Still unformed** → add a bullet under *Unsorted ideas* in both READMEs, and promote it later once
  its scope is clear.

### 4. Draft the item in both languages

Allocate the next ID — the highest existing `SU-NNNN` plus one:

```bash
ls -d roadmaps/SU-*/ | sort | tail -1
```

Create `roadmaps/SU-NNNN-<slug>/` with `SU-NNNN-<slug>.md` and `SU-NNNN-<slug>-ja.md`, following the
metadata block and section list in [`roadmaps/README.md`](../../roadmaps/README.md). A new item is
always `Status: Proposal`.

Before drafting the prose, invoke [`document-writing`](../document-writing/workflow.md) — it is the
authoritative norm for this prose in both languages, and it shapes the draft rather than proofreading
it, so read it *before* writing. A roadmap item is argued prose: an Introduction that states its
contribution up front, a Motivation that moves from the known problem to the new result, and a
Detailed design that enumerates the work MECE (mutually exclusive, collectively exhaustive).

Write the English side under [`english-document-writing`](../english-document-writing/workflow.md)
and the Japanese side under [`japanese-document-writing`](../japanese-document-writing/workflow.md)
(敬体). **The Japanese file is not a transliteration of the English one** — including its title,
which is written in Japanese.

Then add the item's row to the table in both `roadmaps/README.md` and `roadmaps/README-ja.md`, and
make every `Related` link reciprocal: if the new item points at SU-000x, SU-000x points back.

### 5. Verify before committing

1. Run textlint over every file you wrote or edited, as
   [`document-writing`](../document-writing/workflow.md#mandatory-textlint-verification-after-drafting)
   describes, and keep revising until no finding remains.
2. Check that every relative link resolves — item to item, item to ADR, item to `docs/`.
3. Reread both files under the four rereads the prose norm requires. The Japanese side is read as
   Japanese, not as a translation.

### 6. Commit

Work on the session's designated branch. Commit with a scoped message (`docs(roadmap): …`), and open
a pull request **only if the user asked for one**. The pull request title and body are in English.
