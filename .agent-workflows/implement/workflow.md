# Implementing a roadmap item

Take one roadmap (SU) item from proposal to shipped code. You are the **implementer**, not the
judge: the guardrails below and the platform checks in [`README.md`](../../README.md#running-it)
decide whether the change is correct, not your own first impression of it. This is the counterpart
to [`roadmap-item`](../roadmap-item/workflow.md): that workflow authors an SU item and never touches
product code; this one ships it and never reshapes the proposal it was handed. A design gap found
while implementing goes back to `roadmap-item`, or to the user directly — it is not quietly patched
in place here.

Spectre UI is a cross-platform library for server-driven user interfaces (SDUI), in which a server
ships a user-interface definition document and native software development kits (SDKs) on iOS and
Android render it. The repository holds real product code today under `clients/`, `packages/`, and
`spec/` — see the implementation-status table near the top of
[`docs/roadmap.md`](../../docs/roadmap.md) for exactly what already exists and what each area's
check verifies, and read it **before** trusting an item's `Status` field: this repository has items
still marked `Proposal` whose code has already landed, because the change that landed the code did
not flip the metadata. Treat the tree and `docs/roadmap.md` as more current than a stale `Status`
when the two disagree, and say so to the user rather than silently picking one.

## Scope: ships code — never invents scope

This workflow writes product code, its tests, and the bilingual metadata update that follows from
shipping. It does not originate design: the item's own **Detailed design** is the spec, and
**Alternatives considered** is the list of paths already rejected — don't re-open them. If the
Detailed design is too thin to implement from, or the implementation needs something the design
doesn't cover, stop and ask, rather than deciding silently. Two neighboring cases go elsewhere:

- Work that is **not yet decided** is a roadmap item, not this workflow. Use
  [`roadmap-item`](../roadmap-item/workflow.md).
- A **read-only survey** of what already exists is [`roadmap-filter`](../roadmap-filter/workflow.md).

## Guardrails every implementation must respect

These bound every line of code the same way they bound every idea in `roadmap-item`. An
implementation that brushes against one is not silently reshaped around it: stop and name the
conflict to the user.

1. **The item's Detailed design is the spec.** Build to it, matching its scope — not more, not
   less. A gap between the design and what turns out to be needed is a question for the user, not a
   judgment call to make alone.
2. **Never violate an accepted ADR** ([`docs/adr/README.md`](../../docs/adr/README.md)). In
   particular:
   - The manifest is the single source of truth (ADR-0002). Never hand-edit a generated catalog
     type; regenerate it from `spec/component-manifest.json` with `packages/codegen/generate.mjs`
     and commit the regenerated output alongside the manifest change.
   - No arbitrary code from the server (ADR-0004). The expression evaluator never gains an `eval`,
     a dynamic function call, or any other Turing-complete escape hatch — on any platform.
   - Old applications must not break (ADR-0006). A new node type, prop, or action ships with a
     degradation path (fallback, omission, or a documented default) — never a crash on an older
     client that doesn't know it yet.
   - The render targets stay two native implementations sharing a specification and a conformance
     corpus, not code (ADR-0001) — don't reach for a cross-platform shortcut that quietly
     recentralizes logic outside the corpus's reach.
3. **Enforce `docs/architecture.md`'s resource limits in the code you write**, not just in a test:
   a 2,000-node cap, a tree depth of 32, a 1 MB uncompressed document, 256 AST nodes per expression,
   and a 500-item `repeat` expansion. Anything that trusts a server-sourced document beyond these
   without rejecting it is a defect against
   [§7 of `docs/architecture.md`](../../docs/architecture.md), not a feature.
4. **Match the established layering.** iOS and Android name their layers the same
   (`DocumentLoader` / `Store` / `Resolver` / `ActionDispatcher` / `Renderer`, per
   `docs/architecture.md`) precisely so a reviewer can trace the same concept across platforms.
   Don't introduce a platform-specific layer name or split for a concept that already has one.
5. **Bilingual docs move together.** If the change makes a documented behavior true that a
   roadmap item, an ADR, or `README.md` describes differently, update the English file and its
   `-ja.md` mirror in the same change, under
   [`document-writing`](../document-writing/workflow.md).
6. **The self-review loop (below) is not a formality.** It is what stands in for a single
   unified test gate here — there isn't one command that verifies the whole repository the way
   `make check` might elsewhere, only the per-area checks this workflow names. Skipping the loop, or
   stopping it after a fixed number of passes rather than at zero findings, defeats the reason it
   exists.

## Workflow

### 1. Resolve the item

Accept a full ID (`SU-0006`), a bare number (`6` / `0006`), or a slug fragment. Every item lives at
a permanent, flat path — find it with:

```bash
ls -d roadmaps/SU-*<id-or-slug>*/
```

Read **both** language files; the English file is the authoritative spec, the `-ja.md` mirror is
supporting context. **Before doing anything else, explain the item to the user**: its ID and title,
its `Status` and `Topic`, a plain-language summary of the Introduction and Motivation in your own
words, and its current state — including whatever `docs/roadmap.md` and the actual tree say about
it, if that differs from its `Status` field.

Then branch on `Status`:

- **`Proposal`** — the normal case, unless the tree already shows code for it (see above) — note
  that clearly. Implementing it is what moves `Status` toward `In progress` or `Implemented`; say so.
- **`In progress`** — read its `Progress` log first, so the change continues the work rather than
  redoing or contradicting it.
- **`Implemented`** — it has already shipped. Stop and confirm what the user actually wants
  (extend it? a follow-up item? a bug fix?) before writing anything.
- **`Proposal (deferred)`** — confirm the user wants to un-defer it and build it now.

### 2. Check for parallel work

This repository has no formal claiming mechanism (no tracking-issue label convention), so check by
hand before branching: search open pull requests and branches that mention the item's ID. If
another change already covers this item, stop and tell the user rather than duplicating it —
proceed only if they explicitly say to.

### 3. Ground yourself in the spec and the existing code

- Read the item's **Detailed design** and **Alternatives considered** closely.
- Open every file the item's design references, and the surrounding code around each, so the
  change matches what already exists rather than reinventing it.
- Read the implementation-status table near the top of
  [`docs/roadmap.md`](../../docs/roadmap.md) and the relevant slice of the actual tree
  (`clients/`, `packages/`, `spec/`) — this is the accurate picture of what is built, which can run
  ahead of the formal `Status` field (see the note at the top of this document).
- **Check dependencies.** If the design leans on another SU item or an ADR, verify that
  prerequisite is actually in the state the design assumes. A prerequisite that is still only a
  `Proposal` is a blocker: surface it and ask how to proceed (build the prerequisite first? a
  thinner first slice that doesn't need it?).

For a large item, fan out read-only discovery across subagents where the runtime supports it, and
keep only the synthesis in the main thread. Draft the implementation strategy before step 5.

### 4. Set up a focused workspace

One item per branch. If the session is already on a dedicated branch, stay there; otherwise branch
from the latest `origin/main`. Touch only the files this item needs — if the design genuinely forces
a cross-cutting change, say so up front rather than letting the diff quietly grow.

### 5. Plan, then confirm before writing code

Implementing a whole roadmap item is large and hard to reverse, so get the user's go-ahead on a
concrete plan first. Name:

- the files you'll add or change, and the shape of the change;
- the outcome that proves it works — which existing check it extends (see step 7) or which new one
  it adds;
- the tests you'll add or change, including conformance-corpus cases where the item touches the
  expression language or the resolver (ADR-0008);
- any documentation that must move, and therefore needs both languages;
- any tension with the guardrails above, and how the plan resolves it — surfaced, not silently
  routed around.

Only start writing code once the user is happy with the plan.

### 6. Implement

Build to the Detailed design, matching the codebase's grain:

- Match each file's own existing comment language and density — several files here carry Japanese
  comments explaining a non-obvious rationale (an ADR trade-off, a specific bug workaround); follow
  that where it's already the file's convention, in English where it isn't. Either way, comments
  explain **why**, not what.
- Follow the guardrails above as you write, not as an afterthought applied to a finished diff.
- A change to behavior brings its regression test with it — extend the conformance corpus
  (`spec/conformance/`) when the change touches expression evaluation or resolution, so the
  cross-platform guarantee in ADR-0008 keeps holding.
- Regenerate, never hand-edit, anything `packages/codegen/generate.mjs` produces.

### 7. Verify — run the checks this item touches

There is no single command that verifies the whole repository; run whichever of these apply to what
you changed, from [`README.md`](../../README.md#running-it):

```bash
# Kotlin runtime and the conformance corpus (no Android SDK needed)
cd clients/android && ./gradlew :spectre-core:test

# Generated catalogs still match the component manifest (needs node)
node packages/codegen/generate.mjs --check

# Android library and sample compile (needs the Android SDK)
cd clients/android && ./gradlew :spectre-ui:assembleDebug :sample:assembleDebug

# iOS runtime tests and build (needs Xcode)
cd clients/ios && swift test && swift build
```

If the item's area has no existing check yet (for example, the editor or the delivery platform,
per `docs/roadmap.md`'s "not yet implemented" row), the plan from step 5 must say what the new check
is and add it as part of this change — don't ship an area with no way to verify it next time.
**Never proceed to step 8 with a red check**, and never substitute a passing check for the review
loop below — a build that compiles is not a build that was reviewed.

### 8. The mandatory self-review loop

This is the gate that stands in for a single unified test suite (see guardrail 6). Run it after
step 7 is green, and don't stop early:

1. Review the diff against every guardrail above, plus correctness, simplification (no
   unrequested abstraction, no dead code, no duplicated logic that step 6 could have shared), and
   security (no path that lets a server-supplied document reach a code-execution primitive, no
   trust of a value past the resource limits in guardrail 3, no injection risk in any string
   built from document content).
2. Fix every finding from that pass.
3. Re-run the checks from step 7 if the fix touched anything they cover.
4. Review the **updated** diff again, fresh — not a recheck of the same list, a new read, ideally
   in a fresh context (a subagent with no memory of why the code was written this way reviews more
   skeptically than the author re-reading their own reasoning).
5. Repeat 1–4 until one full pass turns up nothing. The stop condition is zero findings on a fresh
   pass, not a fixed number of iterations.

### 9. Flip the roadmap item's status

The implementing change is what ships the item, so update it in the same change, in **both**
language files:

1. Set `Status` to `Implemented` if the change completes the item, or `In progress` if it lands
   only part of the Detailed design.
2. Tick every `Progress` checklist box the change completes, and add a dated log line describing
   what landed (and the pull request, once it exists).
3. The item's path never moves and its ID never changes — `Status` is the only thing that changed.

### 10. Commit

Work on the session's designated branch. Commit with a scoped conventional message (for example
`feat(ios): …`, `feat(android): …`, `feat(codegen): …`). Open a pull request **only if the user
asked for one** — implementing an item does not imply permission to open one. If a pull request
does exist for this change, keep it green: don't leave a red check or an unanswered review sitting
idle, and push fixes as they come up rather than waiting to be asked again.

## References

- [`docs/adr/README.md`](../../docs/adr/README.md) — the accepted decisions guardrail 2 enforces.
- [`docs/architecture.md`](../../docs/architecture.md) — the layering (guardrail 4) and the resource
  limits and security table (guardrail 3).
- [`docs/roadmap.md`](../../docs/roadmap.md) — what already exists per area, and which check
  verifies it; read before assuming an item's `Status` field is current.
- [`README.md`](../../README.md#running-it) — the per-area commands step 7 runs.
- [`roadmap-item`](../roadmap-item/workflow.md) — authors the proposal this workflow ships; a design
  gap found here goes back there, not around it.
- [`document-writing`](../document-writing/workflow.md) — the bilingual prose norm guardrail 5 and
  step 9 apply.
