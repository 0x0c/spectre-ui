**English** · [日本語](SU-0015-canvas-inline-editing-ja.md)

# SU-0015 — Inline canvas editing

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0015](SU-0015-canvas-inline-editing.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Editor |
| Related | [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0013](../SU-0013-editor-workspace-layout/SU-0013-editor-workspace-layout.md) |
<!-- /SU-METADATA -->

## Introduction

This item lets an author edit a selected component's text directly on the canvas. It also makes
the link between that selection and the inspector panel visible. Both changes close the gap
between selecting a component and editing it. Neither adds a dependency beyond the stack ADR-0005
already fixed.

## Motivation

Selecting a component on the canvas today runs one line of code. `NodeView.tsx`'s click handler
calls `select(effectiveSelectId)`. That call sets `selectedNodeId` on the document store. The
canvas shows a two-pixel outline around the selected node. Nothing else on the canvas changes.
Editing that node's properties happens in a separate panel, the inspector. SU-0013 lets an author
move, resize, or swap that panel out of view.

An author selected a component to change its text. The author reported that the component feels
like it disappears into a settings screen. The component stays on the canvas with its outline;
nothing removes it. What changes is where the author's attention and the property form go. Both
move from the picture of the screen to a form in another panel. The two views then read as a mode
switch, not as one continuous edit of that component.

That switch works against the principle SU-0013 states for this editor. The author edits a picture
of the screen, not its source. Editing a label today means leaving the picture and typing into a
form instead. That leaves the what-you-see-is-what-you-get (WYSIWYG) view. Changing visible text
is the edit that view exists to make direct.

## Detailed design

1. **Inline text editing on the canvas.** A selected node's literal string props become editable.
   The eligible props include `Text.text`, `Button.label`, and `Badge.text`. They also
   include `Section.title`, `Section.subtitle`, and the label props on `TextField` and
   `DatePicker`. `componentViews.tsx` already renders every one of these fields through
   `previewText`. A raw value with no `${` is a literal. Double-clicking such a value turns it
   into a contenteditable region. Enter or a blur commits the new text, and Escape cancels without
   committing. An inline edit commits through `documentStore.updateNodeProp`. That is the same
   call the inspector's Properties tab already uses. The edit runs through Immer's
   `produceWithPatches`. It joins the same undo and redo stack the inspector already uses. A raw
   value with `${` is a binding, not a literal. The canvas keeps such a value uneditable.
   SU-0003's expression picker and the inspector's text mode remain the way to change a bound
   value. Typing an expression inline would reopen a risk: free-form code from the author.
   ADR-0005 and the roadmap's open question 2 both warn against that risk. SU-0003 assumes a
   non-engineer editor, not one composing expressions inline.
2. **A visible selection-to-inspector link.** Selecting a node switches the inspector to
   Properties. The panel an author lands on then always matches the edit they asked for. Choosing
   a different tab afterward still persists while the same node stays selected. The selected
   node's canvas outline and the inspector's header take a matching highlight. The two panels then
   read as one object shown twice, not as two panels that happen to agree.
3. **Tests.** The editor's Vitest suite gains one case per unit above. Committing an inline edit
   updates the document. It updates the undo stack the same way the inspector's Properties tab
   does. A bound prop does not turn editable on click. Selecting a different node resets the
   inspector to the Properties tab. A node expanded from a `repeat` block commits an inline edit
   through the source node's id. That matches the existing inspector behavior for repeated nodes.

## Alternatives considered

- **A focus view that dims sibling components.** Rejected for this item. This proposal's report
  asked for editing in place, on the canvas as it renders now. It did not ask for a mode that
  replaces the surrounding screen. A later item can propose a focus view on its own. That item can
  wait for inline editing to show whether the screen still gets in the way.
- **Inline-editing every prop, including layout and style.** Rejected. Spacing, styling, and
  visibility conditions have no on-canvas spot to click into. Visible text has that spot; these
  other props do not. The inspector's manifest-driven tabs already cover every prop. Duplicating
  that coverage on the canvas would give one edit two sources of truth.
- **Auto-surfacing a hidden inspector panel.** Rejected. Moving a panel the author placed on
  purpose runs against SU-0013's own design. SU-0013 built its arrangement so a panel stays where
  the author put it. This item assumes the inspector already occupies a slot. That matches the
  shipped default (`docs/editor.md`).

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Inline text editing for literal string props
- [ ] Inspector tab reset and matching selection highlight
- [ ] Tests

**Log**

- 2026-08-03: Authored the item.

## References

- [SU-0003 — M2, the WYSIWYG editor](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md) —
  the canvas selection and inspector this item extends.
- [SU-0013 — A rearrangeable editor workspace](../SU-0013-editor-workspace-layout/SU-0013-editor-workspace-layout.md) —
  the panel arrangement the inspector link assumes.
- [ADR-0005 — The WYSIWYG editor's technology stack](../../docs/adr/ADR-0005-editor-stack/ADR-0005-editor-stack.md) —
  the undo history the inline edit joins.
- [`docs/editor.md`](../../docs/editor.md) — the editor's design, including the default panel
  arrangement.
