**English** · [日本語](editor-ja.md)

# Web WYSIWYG editor design

See [tech-selection.md](tech-selection.md), ADR-0005, for why we chose this technology stack.

## 1. Screen layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Product detail v12 (draft)]  [Validation: ⚠2]  [Device preview] [Staging] [Publish] │
├───────────┬──────────────────────────────────────┬───────────────────────┤
│ Palette   │              Canvas                   │  Inspector            │
│           │                                       │                       │
│ 📐 Layout  │   ┌───────────────────────┐          │ Button                │
│  VStack   │   │  iPhone 15 ▾  ja-JP ▾  │          │ ─────────────────     │
│  HStack   │   │  Dark ▾  Text 100% ▾   │          │ label                 │
│  Card     │   │                        │          │  [Add to cart      ] │
│  List     │   │  ┌──────────────────┐  │          │ variant               │
│           │   │  │ Product name     │  │          │  ( ●primary  ○...) │
│ 📝 Content │   │  │ ¥1,280           │  │          │ enabled               │
│  Text     │   │  │ [Low stock]       │  │          │  fx ${data.stock>0} │
│  Image    │   │  │ ┌──────────────┐ │  │          │ onTap                 │
│  Badge    │   │  │ │ Add to cart   │ │  │◄─selected│  ▸ 3 actions          │
│           │   │  │ └──────────────┘ │  │          │ ─────────────────     │
│ ⌨ Input   │   │  └──────────────────┘  │          │ Layout                │
│  Button   │   └───────────────────────┘          │ Style                 │
│  TextField│                                       │ Accessibility ⚠       │
│  Toggle   │  ┌── Tree ─────────────────┐          │ Compatibility ✓ 100%  │
│           │  │ ▾ Screen                │          │                       │
│ ⚠ Carousel│  │   ▾ VStack              │          │                       │
│   73%     │  │     • Text (product name)│         │                       │
│           │  │     • Text (price)       │         │                       │
│           │  │     • Badge             │         │                       │
│           │  │     ▸ Button ◄─selected  │         │                       │
│           │  └─────────────────────────┘         │                       │
├───────────┴──────────────────────────────────────┴───────────────────────┤
│ Data  |  State  |  Validation(2)  |  Diff  |  History                    │
│ { "product": { "name": "...", "price": 1280, "stock": 3 } }              │
└──────────────────────────────────────────────────────────────────────────┘
```

### The workspace rearranges (SU-0013)

The wireframe above is the shipped default, not a fixed frame. The workspace holds four slots:
left, center, right, and bottom. Any panel can occupy any slot.

- **Boundaries resize.** A splitter sits on each boundary between two panels. Dragging one moves
  the boundary. The arrow keys move it once the splitter takes focus. Each splitter clamps both of
  its panels to a floor size. No drag can squeeze a panel out of existence.
- **Panels move.** Each panel header carries a drag handle. Dropping one panel's handle on another
  panel's header exchanges the two slots. The arrow keys on a focused handle send the panel to the
  next slot.
- **The arrangement persists.** Sizes and slot assignments live apart from the document. Both go
  to local storage under a versioned key. A panel size is not a
  document edit, so it stays out of the undo history. A toolbar command restores the default.

The editor opens on an **empty canvas**, not on the bundled sample. The canvas names the next
action, and the toolbar keeps a command that loads the sample screen.

## 2. Manifest-driven

The palette, the inspector, and validation all read `spec/component-manifest.json` at runtime and
build themselves from it. **Adding a new component requires not one line of editor code.**

The inspector's fields come from the manifest's `editor.widget`:

| `editor.widget` | UI |
| --- | --- |
| `text` | A single-line text field with an expression toggle |
| `textarea` | Multi-line |
| `number` | A number field with a stepper |
| `boolean` | A switch |
| `enum` | A segmented control (three values or fewer) or a dropdown |
| `colorToken` | A list of token swatches (a free color is not selectable) |
| `spacingToken` / `radiusToken` | A row of token chips |
| `typographyToken` | A list with a preview |
| `icon` | An icon picker |
| `actions` | The action editor (below) |
| `binding` | A data-path picker plus an expression editor |
| `options` | A table editor for `{value, label}` |

## 3. Editing an expression

Hand-writing `${data.product.stock > 0}` is not realistic for a non-engineer. We provide two modes.

**A. Picker mode (default)** — choose a data path from a tree; compose the comparison operator and
the value from dropdowns.

```
Visible when:  [data.product.stock ▾]  [greater than ▾]  [0        ]  [+ Add condition]
```

**B. Expression mode** — for advanced authors. CodeMirror 6, driven by SpectreExpr's grammar
definition, gives syntax highlighting, completion, error display, and a **live preview of the
evaluated result**.

```
fx ${data.product.stock > 0 && !state.adding}
   ↳ Evaluates to: true   (against the current sample data)
```

An expression the picker can represent converts back and forth freely. A complex expression written
in expression mode may not convert back to the picker; in that case, the field stays locked to
expression mode.

Authors edit **sample data** in the Data tab: paste in an actual API response, or fetch one from an
endpoint and pin it. Without sample data the preview stays empty, and WYSIWYG has nothing to show.

## 4. The action editor

We edit an action array as a vertical stack of cards.

```
onTap
 ┌─────────────────────────────────────────┐
 │ 1. Change state                     ⋮  │
 │    adding = true                        │
 ├─────────────────────────────────────────┤
 │ 2. Call an API                      ⋮  │
 │    POST cart.add                        │
 │    ├ On success: show toast, track       │
 │    └ On failure: show alert              │
 ├─────────────────────────────────────────┤
 │ 3. Change state                     ⋮  │
 │    adding = false                       │
 └─────────────────────────────────────────┘
 [+ Add action]
```

We never let `endpoint` be free text; the author **chooses from the list of logical endpoints already
registered on the server**. This structurally rules out a `security/inline-url` lint violation. When
an endpoint registers its request and response schema, the editor also assists in composing `body`
and completing the response.

## 5. Authoring overlays

A document declares its sheets, alerts, and toasts in `overlays`, outside the node tree. An action
opens one by identifier ([spec/schema.md](spec/schema.md) §3). The overlay panel lists them. It
creates and deletes one, and edits the display options `presentation` carries (SU-0014).

Every display option offers an explicit "unspecified" choice. The specification fills in no
defaults for a key the document leaves out. The editor thus separates two cases: leaving a value
to the client, and writing down the same value. Selecting an overlay draws it on the canvas, in
the style the document asks for. That style is a sheet, a full-screen modal, a dialog, or a banner.

## 6. Canvas fidelity

The web canvas is a **third renderer**, and it does not match SwiftUI or Compose pixel for pixel (font
metrics, line breaking, scroll inertia differ). We do not hide this; we handle it with a two-tier
setup.

### Approximate preview (web)
- For fast feedback while editing.
- The UI states explicitly that this is an "approximate view."
- The device frame, locale, theme, and font scale are all switchable. **Verifying at 200% font
  scale** is mandatory practice, the single largest cause of layout breakage.
- Constrained to the same layout rules as the Compose and SwiftUI implementations (Stack, weight, and
  alignment only), so no structural drift occurs. What can drift stays limited to where text wraps.

### Device mirror (device preview) — **mandatory for M2**
```
Editor ──WS──► server /api/preview/:sessionId ──WS──► the device app
                                                        (developer mode or a
                                                         dedicated preview app)
```
- The editor displays a QR code; scanning it on the device connects it to the session.
- An edit reaches the device within several hundred milliseconds.
- More than one device can connect at once (checking an iPhone and an Android device side by side).
- **This is the source of truth for confirming a document before publishing.**

Treating the device mirror as a feature to add later guarantees an accident: an author trusts the web
view's look, publishes, and the layout breaks on a real device. This is one of the most common
failures in adopting SDUI, which is why it belongs in the initial scope.

## 7. State management and undo/redo

Zustand plus Immer. Every update to the document tree goes through an Immer producer, and **the
generated patch and inversePatch go straight onto the history stack**.

```ts
const { document, apply, undo, redo } = useEditorStore()

apply(draft => {
  draft.root.children[2].props.label = 'Buy now'
})
// → patches: [{op:'replace', path:['root','children',2,'props','label'], value:'Buy now'}]
//   inversePatches: [{op:'replace', ..., value:'Add to cart'}]
```

- Because history is a list of patches, it stays memory-efficient, and **the same list feeds
  collaborative editing and the diff view directly**.
- The Diff tab highlights the difference against the published version, on the tree.

## 8. Validation and lint

We **share** the validation implementation in `packages/core` between the editor and the server (the
same code runs in both). The editor side debounces and runs it on every edit.

- An **error** disables the publish button.
- A **warn** still allows publishing, but a confirmation dialog appears.
- The lint rule list lives in [spec/schema.md](spec/schema.md) §5.

`compat/unsupported-component` uses the measured value from delivery telemetry
([compatibility.md](compatibility.md) §6).

## 9. Permissions and workflow

| Role | Permissions |
| --- | --- |
| Viewer | View, preview |
| Editor | Edit a draft, publish to staging |
| Publisher | Publish to production, roll back |
| Admin | Manage permissions, register endpoints, configure the theme |

- Publishing to production can require **two-person approval** (configurable).
- The audit log records every publish and rollback (who, when, what, and the diff).
- Concurrent editing of a draft uses **optimistic locking** (a `version` mismatch rejects the save)
  plus presence display. We do not add CRDTs in v1 (ADR-0005).

## 10. Templates and component composition

A mechanism to avoid repeating the same structure. This is **v0.2 scope**, but we lay out the data
model from the start.

- **Template**: a whole-screen skeleton that authors choose when creating a new document.
- **Partial**: a named subtree that takes parameters, referenced by several screens. Updating the
  referenced partial propagates to every place that uses it.

We inline a partial at delivery time (the client never knows about it). This keeps reference
resolution out of the client SDK entirely.

## 11. Performance notes

- The canvas re-renders the selected node and its ancestors alone. We memoize each node, keyed by a
  hash of its resolved props.
- Editing a 2,000-node document (the limit) at 60 fps is the benchmark's acceptance criterion.
- The tree panel uses virtual scrolling (`@tanstack/react-virtual`).
