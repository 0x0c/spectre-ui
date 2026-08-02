**English** · [日本語](SU-0003-m2-wysiwyg-editor-ja.md)

# SU-0003 — M2, the WYSIWYG editor

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0003](SU-0003-m2-wysiwyg-editor.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **In progress** |
| Topic | Editor |
| Related | [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md), [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md), [SU-0006](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md), [SU-0009](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) |
<!-- /SU-METADATA -->

## Introduction

Milestone M2 builds the what-you-see-is-what-you-get (WYSIWYG) editor: a browser application in
which someone who is not an engineer composes a screen out of the component catalog, binds data to
it, attaches actions, and previews the result before publishing. Estimated at six to eight
full-time-equivalent person-weeks.

## Motivation

The editor is what makes the whole system worth building. Without it, a server-driven user interface
(SDUI) merely moves screen definitions from application code into JSON that engineers still write —
a change of file format, not of who can ship a screen.

Two parts of the editor carry most of that value. The palette and the inspector are generated from
the component manifest, so a new component becomes editable without any editor code being written
([SU-0006](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md)). The device
mirror shows the draft rendered by the real client renderer, which is the only preview an editor can
safely trust before publishing.

## Detailed design

1. **A manifest-driven palette and inspector**, generated at run time from the manifest.
2. **The canvas**: drag and drop, selection, and a tree panel over the document structure.
3. **Expression editing in two modes**: a picker for common bindings, and a text mode backed by
   CodeMirror for authors who want the expression itself.
4. **The action editor**, covering the action catalog and the server response protocol.
5. **Sample data management**, so a screen previews against realistic values.
6. **Lint display, undo and redo, and a diff view** against the published version.
7. **The device mirror over WebSocket**, tracked as
   [SU-0009](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md). This is a
   requirement of M2, not a follow-up.
8. **Switching device, locale, theme, and font scale** in the approximate preview.

## Alternatives considered

- **Defer the device mirror to M3 or M4.** Rejected: without it, an editor trusts the browser
  approximation, publishes, and the screen breaks on a real device. The mirror is what makes
  publishing safe, so it cannot be the part that arrives last.
- **Hand-write the inspector per component**, for tighter control of each form. Rejected: it puts
  editor work on the critical path of every component addition, which is precisely the cost
  [ADR-0002](../../docs/adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md)
  set out to remove.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [x] A manifest-driven palette and inspector
- [x] The canvas: drag and drop, selection, and a tree panel
- [ ] Expression editing in two modes (picker mode shipped; the CodeMirror text mode is open)
- [x] The action editor
- [x] Sample data management
- [ ] Lint display, undo and redo, and a diff view (undo and redo shipped; the rest is open)
- [ ] The device mirror over WebSocket ([SU-0009](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md))
- [x] Switching device, locale, theme, and font scale in the approximate preview

**Log**

- 2026-08-02: This change adds `packages/editor` to the pnpm workspace.
- The stack is React 19, TypeScript, and Vite, per ADR-0005.
- This is the editor's first working slice.
- It ships items 1, 2, and 4 of the Detailed design in full.
- It also ships items 5 and 8 in full, and items 3 and 6 in part.
- The palette and inspector generate at run time from `packages/manifest` (item 1).
- A new component in `spec/component-manifest.json` needs no editor code.
- The canvas uses DOM-based React components, per ADR-0005 (item 2).
- It supports drag and drop from the palette into the document tree.
- It also supports node selection and a tree panel.
- The tree panel mirrors the document's `children` structure.
- The document store is Zustand with Immer.
- Every edit runs through `produceWithPatches`.
- Undo and redo (part of item 6) is the resulting patch stack.
- Item 3 ships the picker mode alone.
- The picker offers a `data.x`/`state.y` path with a live preview.
- The CodeMirror text mode stays open.
- A raw text input stands in for a free-form expression instead.
- That input has no syntax highlighting, completion, or error display.
- The action editor covers the manifest's action catalog (item 4).
- The catalog lists every action's name and whether it runs async.
- Hand-written parameter forms cover each action type.
- The manifest itself does not carry those parameter shapes.
- The sample-data panel edits the `data` and `state` scopes (item 5).
- The canvas preview evaluates against those scopes.
- Device, locale, theme, and font-scale switching drive the `env` scope (item 8).
- The approximate preview reads that scope.
- Item 6's lint display and diff view stay open.
- Both need the live authoring-API integration this pass does not build.
- The editor runs offline against a local or sample document instead.
- Import and export JSON is the primary loop.
- A thin client for `packages/server`'s authoring endpoints exists.
- It lives at `packages/editor/src/api/client.ts`.
- No screen wires to it yet.
- Item 7, the device mirror over WebSocket, is out of scope for this change.
- It continues under SU-0009.
- `Status` stays `In progress`, not `Implemented`.
- This item's Alternatives considered section treats the mirror as required, not a follow-up.
- The approximate preview is not authoritative.
- An editor without the mirror cannot make publishing safe yet.
- The canvas preview resolves `${...}` with a local, minimal stub.
- The stub lives at `packages/editor/src/expression/interpolate.ts`.
- The stub does not cover the full SpectreExpr language.
- It resolves a whole-expression `data.x`/`state.y` path and preserves its type.
- The type-preservation rule follows [`docs/spec/expression.md`](../../docs/spec/expression.md) §1.
- The stub does not parse operators, ternaries, or built-in functions.
- A real TypeScript port of SpectreExpr is running in a parallel change.
- The port touches `packages/core`.
- This change's worktree lacked the port.
- Swap the stub for that evaluator once it lands.
- This change's starting worktree branched before two prerequisites landed.
- Those prerequisites are `packages/manifest` and `packages/server`.
- Both landed on the shared integration branch after the branch point.
- This item's design depends on both packages.
- This change fast-forwarded the worktree branch onto the integration branch's tip.
- This step came before any editor code.
- This change also extends `packages/manifest`.
- It adds a browser-safe editor schema: `editorSchema.ts`.
- The editor consumes that schema without `packages/manifest`'s Node-specific file access.
- This change also fixes a Node-specific call in `validate.ts`.
- `Buffer.byteLength` becomes `TextEncoder`.
- The same resource-limit check now runs in the browser too.
- 106 Vitest cases cover the store's undo and redo.
- They also cover the manifest-driven palette and drag-and-drop tree updates.
- They cover the interpolation stub's type-preservation rule too.
- CI's `server` job now runs `packages/editor`'s typecheck, test, and build.
- It already ran `packages/manifest` and `packages/server`'s checks.
- 2026-08-02: `.github/workflows/pages.yml` now also builds `packages/editor` and publishes it to
  GitHub Pages, alongside the documentation site, at `/spectre-ui/editor/`.
- `vite.config.ts` sets `base` to that path for `vite build`; `vite dev` keeps `/`.
- The editor still runs offline against its bundled sample document — this change only adds
  hosting, not the authoring-API wiring or the device mirror.
- No `Progress` box changes: none of this item's design points are about hosting.

## References

- [ADR-0005 — The WYSIWYG editor's technology stack](../../docs/adr/ADR-0005-editor-stack/ADR-0005-editor-stack.md) — the stack and the two-tier preview decision.
- [`docs/editor.md`](../../docs/editor.md) — the editor's design in full.
- [SU-0002 — M1, client SDKs for iOS and Android](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) — the renderer the device mirror depends on.
- [SU-0006 — Manifest-driven code generation](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md) — the generation the palette and inspector rely on.
- [SU-0009 — The device mirror preview](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) — the mirror as a tracked item.
