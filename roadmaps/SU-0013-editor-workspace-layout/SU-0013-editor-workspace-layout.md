**English** · [日本語](SU-0013-editor-workspace-layout-ja.md)

# SU-0013 — A rearrangeable editor workspace

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0013](SU-0013-editor-workspace-layout.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Implemented** |
| Topic | Editor |
| Related | [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0009](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md), [SU-0014](../SU-0014-overlay-presentation-options/SU-0014-overlay-presentation-options.md), [SU-0015](../SU-0015-canvas-inline-editing/SU-0015-canvas-inline-editing.md) |
<!-- /SU-METADATA -->

## Introduction

This item hands the editor's panel arrangement to the author. The editor is the browser-based
screen composer that milestone M2
([SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md)) specifies. It follows the
what-you-see-is-what-you-get (WYSIWYG) principle. The author edits a picture of the screen, not
its source. A static build lives on GitHub Pages, so anyone can open the editor without a server.

The published editor opens onto three columns at fixed widths. A component palette sits on the
left. A canvas and a document tree sit in the middle. An inspector sits on the right. A bundled
sample document already fills the canvas.

Three changes replace that fixed arrangement. The editor opens on an empty canvas instead of the
sample. Each boundary between two panels becomes a drag target that resizes the panels beside it.
Each panel gains a handle. Dragging a handle moves the panel to another slot, or swaps the panel
with the one already there.

## Motivation

A fixed arrangement suits one task at a time. Screen authoring is a sequence of tasks. Composing a
layout wants a wide canvas. Wiring an action wants a wide inspector, because the action editor
stacks cards two levels deep. Reviewing sample data wants a tall bottom panel. The data arrives
as JavaScript Object Notation (JSON), and JSON is verbose.

The published editor answers each of those tasks the same way. The palette holds 200 pixels of
width, the inspector 300, and the bottom panel 220 pixels of height. The numbers hold whatever
the author is doing, and whatever the size of the display. On a narrow laptop screen, idle panels
eat the canvas. On a wide display, most of the width goes unused.

The opening document is the second half of the same problem. The editor loads
`examples/screens/product-detail.json` on first mount. An author who came to compose a new screen
starts by deleting somebody else's. The sample is worth keeping. Reading the sample is the fastest
way to see a composed screen. Still, opening on it confuses a demonstration with a starting point.
An empty canvas states what the editor is for. The author places the first component.

Neither change asks for a new dependency. ADR-0005 fixes the editor's stack. React with
TypeScript builds the interface, Vite bundles it, and dnd-kit carries the dragging. Zustand with
Immer holds the state. The work below reaches for the browser's own pointer input and the existing
store. ADR-0005 chose that stack to keep the build small and the behavior legible. A
general-purpose docking framework trades both away, for arrangements this item does not need.

## Detailed design

1. **An empty canvas at startup.** The editor mounts with an empty document. The document store
   already defines one: a `Screen` root with no children. The canvas shows a
   placeholder naming the next action: drag a component in from the palette. The toolbar keeps its
   button that loads the sample, so the demonstration stays one click away.
2. **Resizable boundaries.** A splitter sits on each boundary between two panels. Four boundaries
   qualify. The palette meets the center column, and the center column meets the inspector. The
   canvas meets the document tree, and the main area meets the bottom panel. Dragging a splitter
   moves the boundary. The arrow keys move it by a fixed step once the splitter takes keyboard
   focus. Resizing thus never needs a pointing device. Each splitter clamps both of its panels to
   a floor size. No drag can squeeze a panel out of existence.
3. **Panel handles that move and swap panels.** Each panel gains a header. The header carries the
   panel's name and a drag handle. Dropping one panel's handle on another panel's header exchanges the two
   slots. Dropping a handle on an empty slot moves the panel there. The four slots stay the ones
   the arrangement already has: left, center, right, and bottom. An arrangement thus stays a shape
   the layout can draw. No panel lands where the author cannot find it.
4. **The workspace layout as saved state.** A separate store holds the panel sizes. The same
   store holds the panel-to-slot assignment. The store writes both to the browser's local storage under a
   versioned key. Reopening the editor restores the author's arrangement. A toolbar command resets
   the arrangement to the shipped default. That command recovers an author who saved a layout that
   dragging cannot undo. Keeping this store apart from the document store matters. A panel size is
   not a document edit. It stays out of the Immer-patch undo history that ADR-0005 builds.
5. **Tests.** The editor's Vitest suite gains one case per unit of behavior above. The editor
   mounts with an empty document. A splitter drag resizes a panel and stops at the floor size. A
   handle drop swaps two slots. A reload restores the saved arrangement.

## Alternatives considered

- **A docking-panel library.** Such a framework supplies splitters and tab groups. It supplies
  floating panels and arbitrary nesting too. We rule that out. The editor needs one arrangement of
  four slots. ADR-0005 picked the current stack to keep the build small enough for a static site.
  A framework of that reach costs bundle size. It also adds a second layout model to reason about.
- **Free-floating panels.** Panels would move anywhere, at any size, over the canvas. We rule that
  out. Free placement lets an author bury one panel behind another and lose it. The editor has no
  window manager to dig the panel back out. Slots keep every panel reachable.
- **Sizes in memory only, without saving.** We rule that out. An author sizes panels for a task
  that outlasts one sitting. Discarding the arrangement on reload asks for the same drags again.
- **Keeping the sample as the opening document.** We rule that out as the default. It stays as a
  command. Opening on somebody else's screen makes deletion the author's first act. The toolbar
  button already serves the author who wants to read the sample.

## Progress

> Keep this current as work proceeds. The checklist mirrors the *Detailed design* breakdown. The
> log records what changed and when, oldest first.

- [x] An empty canvas at startup
- [x] Resizable boundaries
- [x] Panel handles that move and swap panels
- [x] The workspace layout as saved state
- [x] Tests

**Log**

- 2026-08-02: Authored the item.
- 2026-08-02: Landed the empty opening canvas and the four-slot workspace. Boundaries resize,
  handles move and swap panels, and the arrangement persists. The Vitest suite covers each one.
  `Status` moves to Implemented.

## References

- [SU-0003 — M2, the WYSIWYG editor](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md) — the editor this item rearranges.
- [SU-0009 — The device mirror preview](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) — a preview surface bound for a slot here.
- [SU-0014 — Overlay presentation options](../SU-0014-overlay-presentation-options/SU-0014-overlay-presentation-options.md) — the overlay panel joining this arrangement.
- [ADR-0005 — The editor's technology stack](../../docs/adr/ADR-0005-editor-stack/ADR-0005-editor-stack.md) — the stack, and the undo history this item stays out of.
- [`docs/editor.md`](../../docs/editor.md) — the design document whose screen-layout section this item updates.
