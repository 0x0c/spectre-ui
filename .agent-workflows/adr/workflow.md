# Authoring an architecture decision record

An architecture decision record (ADR) captures one significant technical decision: the context that
forced the choice, the options weighed, the decision, the reasoning, the price paid, and what would
reopen it. This workflow authors a new record, or supersedes an existing one, in both languages.

Spectre UI is a cross-platform library for server-driven user interfaces (SDUI), in which a server
ships a user-interface definition document and native software development kits on iOS and Android
render it. Its records live under [`docs/adr/`](../../docs/adr/README.md).

## When this workflow applies

- **A decision has been made** and needs recording. That is this workflow.
- **Work is being proposed** and has not been decided. That is
  [`roadmap-item`](../roadmap-item/workflow.md).
- **An accepted decision turns out to be wrong.** Still this workflow, but by *superseding* — never
  by rewriting the accepted record in place.

The distinction matters because the value of a record is that it preserves what was believed at the
time. A record edited into a different decision destroys exactly the thing it exists to keep.

## Scope: records only — never implement

This workflow writes files under `docs/adr/` and the two index READMEs beside them. It does not
write product code, and it does not change a roadmap item's status. When the discussion makes the
implementation obvious, note that and stop.

## Workflow

### 1. Ground yourself in the existing records

Read [`docs/adr/README.md`](../../docs/adr/README.md) for the numbering and format rules, then read
the records adjacent to the topic. A new record almost always relates to at least one existing one,
and the `Related` links have to be reciprocal.

Read [`docs/tech-selection.md`](../../docs/tech-selection.md) too: it states the constraints every
record assumes — the library is embedded into a host application, the editors are not engineers, the
render targets are native iOS and Android, and the scale is tens to hundreds of screens with a few
publications a day.

### 2. Establish that a record is warranted

A record is warranted when the decision is hard to reverse, or when a future reader would otherwise
have to reconstruct the reasoning from code. A choice that any competent implementer would make the
same way does not need one.

State which of the two applies before drafting. If neither does, say so and stop rather than adding
a record nobody will consult.

### 3. Allocate the ID and create both files

```bash
ls -d docs/adr/ADR-*/ | sort | tail -1
```

The next ID is that number plus one, zero-padded to four digits. Create
`docs/adr/ADR-NNNN-<slug>/` with `ADR-NNNN-<slug>.md` and `ADR-NNNN-<slug>-ja.md`, following the
metadata block and section list in [`docs/adr/README.md`](../../docs/adr/README.md). A record starts
at `Status: Proposed` and moves to `Accepted` once the decision is agreed.

### 4. Draft the record

Invoke [`document-writing`](../document-writing/workflow.md) *before* writing — it shapes the draft
rather than proofreading it. Write the English side under
[`english-document-writing`](../english-document-writing/workflow.md) and the Japanese side under
[`japanese-document-writing`](../japanese-document-writing/workflow.md) (敬体). The Japanese file's
title is written in Japanese, not copied from the English heading.

Four sections carry the weight, and each fails in a characteristic way:

- **Context** states what forced the choice. It fails by describing the solution instead of the
  pressure.
- **Options considered** names the real alternatives, each with the strength that made it a
  candidate. An option listed only to be dismissed is not an option; it is decoration.
- **Rationale** says why the chosen option beat the others *on this project's constraints*. It fails
  by repeating the decision in different words.
- **Revisit triggers** names, in advance, the observation that would reopen the decision — a
  threshold, a measurement, a changed premise. A record without one cannot be falsified, and a
  decision nobody can revisit is not a decision but a habit.

Say what the decision costs in **Consequences**. A record whose consequences section is empty is
either recording something trivial or hiding the price.

### 5. Superseding an existing record

When a new record replaces an old one:

1. Write the new record normally, and list the old one under `Supersedes`.
2. In the old record, set `Status` to `Superseded` and name the successor under `Superseded by`.
   **Change nothing else in the old record.**
3. Update both index READMEs.

### 6. Verify before committing

1. Run textlint over every file you wrote or edited, as
   [`document-writing`](../document-writing/workflow.md#mandatory-textlint-verification-after-drafting)
   describes, and keep revising until no finding remains.
2. Check that every relative link resolves, and that each `Related` link is reciprocal.
3. Add the record's row to the table in both `docs/adr/README.md` and `docs/adr/README-ja.md`.
4. Reread both files under the four rereads the prose norm requires.

Commit with a scoped message (`docs(adr): …`) on the session's designated branch.
