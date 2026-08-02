**English** · [日本語](SU-0014-overlay-presentation-options-ja.md)

# SU-0014 — Overlay presentation options

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0014](SU-0014-overlay-presentation-options.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Implemented** |
| Topic | Specification |
| Related | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md), [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0013](../SU-0013-editor-workspace-layout/SU-0013-editor-workspace-layout.md) |
<!-- /SU-METADATA -->

## Introduction

This item adds a `presentation` block to an overlay. A document then says how an overlay appears.
Today the appearance falls to each client's one built-in choice.

A Spectre UI document declares its sheets, alerts, and toasts in the `overlays` array. The array
sits at the top level, outside the node tree. An action opens one overlay by identifier. Each
overlay carries a `kind`. Today that one field decides both what the overlay contains and how the
overlay appears on screen.

The new block splits the two apart. `kind` keeps deciding the content model: a node tree, a set of
buttons, or a transient message. `presentation` decides the appearance. An overlay becomes a
bottom sheet, a full-screen modal, or a centered dialog. A backdrop dims behind it or does not. A
tap outside closes it, a drag closes it, or neither does. An alert gains display options of its
own: a tone, an icon, and a button layout. Every key stays optional, and every default reproduces
what clients draw today.

## Motivation

An author who needs a modal today has one shape available. A node tree fits in `kind: "sheet"`
and nowhere else. Both clients draw a sheet from the bottom edge. SwiftUI presents it with
`.sheet`, and Jetpack Compose presents it with `ModalBottomSheet`. A confirmation that wants the reader's whole
attention arrives from the bottom. So does a full-screen editing flow, and so does a small
centered dialog. The `detents` list nudges the height and nothing more. The document cannot ask
for anything else, because no field exists to ask with.

The same gap runs through dismissal. `dismissible` is one boolean standing in for three separate
questions. One asks whether a tap outside closes the overlay. One asks whether a downward drag
closes it. One asks whether the overlay dims what sits behind it. A destructive confirmation wants
a dimmed backdrop that a stray tap cannot clear. A size picker wants the opposite, since closing
it costs the reader nothing. Both land on `dismissible: true` today, and each client picks its
own reading.

An alert is thinner still. The specification gives an alert a title, a message, and up to three
buttons. Nothing tells an informational alert from a destructive one at a glance. A button's
`role` already carries `destructive`. One button turns red while the alert around it stays
neutral. The tone belongs to the alert, not to a single button inside it.

A `presentation` block beats new `kind` values on two counts. It keeps the catalog closed, which
ADR-0002 asks of every addition an author can see. It also keeps each client's drawing switch at
three cases instead of six. The block also satisfies ADR-0006 without a fallback node. A client
that predates the block ignores an unknown key. Such a client draws the overlay the way it draws
one today. Every default names today's behavior.

## Detailed design

1. **The schema block.** An optional `presentation` object joins the overlay definition in
   `spec/schema/document.schema.json`. The object sets `additionalProperties: false`. It holds
   these keys:

   | Key | Type | Default | Meaning |
   | --- | --- | --- | --- |
   | `style` | `sheet` \| `fullScreen` \| `dialog` | `sheet` | How the overlay occupies the screen |
   | `dimBackground` | boolean | `true` | Whether the content behind the overlay dims |
   | `dismissOnBackdrop` | boolean | the overlay's `dismissible` | Whether a tap outside closes it |
   | `dragToDismiss` | boolean | the overlay's `dismissible` | Whether a drag closes it |

   `style` applies to `kind: "sheet"`, the one kind that carries a node tree. An alert is always a
   dialog, and a toast is always a transient banner. On an alert the schema thus takes
   `dimBackground` and `dismissOnBackdrop`, and refuses `style` and `dragToDismiss`. On a toast it
   refuses the whole `presentation` block.
2. **The alert's options.** An alert gains three optional keys. `tone` takes `neutral`,
   `success`, `warning`, or `error`, and defaults to `neutral`. `icon` names an icon from the
   manifest's icon set. `buttonLayout` takes `auto`, `horizontal`, or `vertical`, and defaults to
   `auto`. Under `auto` the platform arranges the buttons, which is what both clients do today.
3. **The generated types.** `packages/codegen/generate.mjs` emits the TypeScript overlay union.
   That union gains the block and the alert keys. Nobody edits
   `packages/manifest/src/generated.ts` by hand. The generator rewrites it, since ADR-0002 keeps
   generated catalogs generated. A drift check runs in continuous integration (CI). The check
   fails when a generated file and the generator disagree.
4. **The iOS renderer.** `SpectreScreen` maps each `style` to the SwiftUI presentation it names.
   `sheet` maps to `.sheet` with the existing detents. `fullScreen` maps to `.fullScreenCover`.
   `dialog` maps to a centered card over a scrim the renderer draws itself. `dragToDismiss: false`
   becomes `.interactiveDismissDisabled()`. `dismissOnBackdrop` governs the scrim's tap target in
   the dialog style. A SwiftUI sheet exposes no backdrop tap, so the key does nothing there. The
   specification records the gap. A SwiftUI `.alert` takes no decoration at all. An alert that
   sets `tone`, `icon`, or `buttonLayout` switches to a dialog the renderer draws instead. An
   alert that sets none of the three keeps the system alert it uses today.
5. **The Android renderer.** `SpectreScreen` maps `sheet` to `ModalBottomSheet`. For `fullScreen`
   it uses a `Dialog` that releases the platform width. The surface then fills the screen. For
   `dialog` it uses a `Dialog` holding a centered surface. On the two `Dialog` styles,
   `dismissOnBackdrop` and the back gesture map onto `DialogProperties`. A bottom sheet routes the
   scrim tap and the drag through one path, so the two keys collapse into one gesture switch there,
   and the specification records that. `dimBackground: false` drops the scrim. `AlertDialog` takes
   an icon slot, which `icon` fills, and `tone` tints that icon. `buttonLayout: "vertical"` stacks
   the buttons in the dialog's button slot.
6. **The conformance corpus.** New cases join `spec/conformance/resolve/resolver.json`. Each one
   resolves a document that carries a `presentation` block. Swift and Kotlin run the resolve
   corpus, so both then agree on two points. The block survives resolution unchanged. An absent
   block stays absent instead of gaining defaults. ADR-0008 makes the corpus the cross-platform
   guarantee. A change to the document format belongs in it.
7. **The overlay panel.** A new editor panel lists a document's overlays. The panel creates and
   deletes an overlay. It edits the options above through the same manifest-driven fields the
   inspector uses. It previews the selected overlay on the canvas, in the style the document asks
   for. Without the panel, an author reaches the new keys one way alone. That way is by hand, in
   JavaScript Object Notation (JSON).
8. **The specification page.** Section 3 of `docs/spec/schema.md` documents the block. It states
   the per-kind applicability and the defaults. It also names the two places where a platform
   cannot honor an option.

## Alternatives considered

- **A `modal` kind beside `sheet`.** A fourth `kind` would name the full-screen and dialog cases
  directly. We rule that out. Its content model would repeat `sheet`'s: a node tree, a title, and
  a dismissible flag. The addition would duplicate a definition to express a difference in
  appearance. Each client's drawing switch would grow a case reaching the same content path.
  Splitting content from appearance keeps `kind` at three values.
- **Actions carrying inline content.** An action would declare its overlay inline. Both a
  `showModal` action and a `showAlert` action would work that way. We rule that out. Overlays sit outside the node tree for a
  reason. iOS and Android differ in how a modal attaches to a view hierarchy. Moving the
  definition into an action brings back a placement dependence the current design avoids. It
  would also give a document two ways to define one overlay, which ADR-0002 forbids.
- **A presentation animation option.** A `none` / `fade` / `slide` key would control how the
  overlay arrives. We rule that out. SwiftUI's `.sheet` fixes its presentation animation, and
  Compose's `ModalBottomSheet` fixes its own. Both clients would drop the key in the styles
  authors reach for most. An option nothing honors misleads an author worse than a missing one.
- **A toast position option.** We rule that out as beyond this item. A toast is a transient
  banner, and neither client varies its placement. This item's subject is the modal and the alert.
- **Options on `navigate`.** The `mode: "present"` case would take them. We rule that out here.
  `navigate` hands off to another screen document. Its presentation belongs to the embedding
  application's navigation stack, not to the current document's overlay list.

## Progress

> Keep this current as work proceeds. The checklist mirrors the *Detailed design* breakdown. The
> log records what changed and when, oldest first.

- [x] The schema block
- [x] The alert's options
- [x] The generated types
- [x] The iOS renderer
- [x] The Android renderer
- [x] The conformance corpus
- [x] The overlay panel
- [x] The specification page

**Log**

- 2026-08-02: Authored the item.
- 2026-08-02: Landed the schema block and the alert options. The TypeScript types came from the
  generator. Both renderers, three corpus cases, the editor panel, and the specification page
  landed with them. The Kotlin resolve corpus runs green. The Swift and Android builds run in
  continuous integration. `Status` moves to Implemented.
- 2026-08-02: An adversarial review pass followed, and four fixes landed. A bottom sheet could
  strand itself off-screen. `Window.setDimAmount` needs a newer software development kit than
  this library targets. The schema let an alert's own keys through on a sheet. A `neutral` tone
  gave up the system alert for nothing. The specification also gained the platform notes those
  fixes made necessary.

## References

- [SU-0001 — M0, freezing the specification](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md) — the freeze this addition lands before.
- [SU-0003 — M2, the WYSIWYG editor](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md) — the editor whose overlay panel exposes these keys.
- [SU-0013 — A rearrangeable editor workspace](../SU-0013-editor-workspace-layout/SU-0013-editor-workspace-layout.md) — the arrangement the overlay panel joins.
- [ADR-0002 — The component manifest as the single source](../../docs/adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) — the rule keeping the catalog closed.
- [ADR-0006 — Versioning and forward compatibility](../../docs/adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) — the degradation rule a defaulted key satisfies.
- [ADR-0008 — The conformance testing strategy](../../docs/adr/ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md) — why a format change extends the corpus.
- [`docs/spec/schema.md`](../../docs/spec/schema.md) — the document-format page this item rewrites in part.
