**English** · [日本語](ADR-0005-editor-stack-ja.md)

# ADR-0005 — The WYSIWYG editor's technology stack

<!-- ADR-METADATA -->
| Field | Value |
|---|---|
| Record | [ADR-0005](ADR-0005-editor-stack.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Accepted** |
| Date | 2026-07-31 |
| Topic | Editor |
| Related | [ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md), [ADR-0007](../ADR-0007-backend-stack/ADR-0007-backend-stack.md), [SU-0003](../../../roadmaps/SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0009](../../../roadmaps/SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) |
<!-- /ADR-METADATA -->

## Context

The people who edit screens are not engineers: they work in planning, marketing, or customer
support. They need a what-you-see-is-what-you-get (WYSIWYG) editor in the browser that composes
screens out of a closed catalog of components, and they need to trust what it shows them before they
publish.

## Options considered

Each row of the decision below was chosen against alternatives; the rationale section covers the two
choices that carry the most consequence. The framework choice itself was between React with
TypeScript and a compile-time framework such as Svelte, and the state layer was between an
immutable-patch store and a conflict-free replicated data type (CRDT).

## Decision

| Area | Choice | Reason |
| --- | --- | --- |
| Framework | React 19, TypeScript, Vite | Ecosystem and hiring pool, and the manifest-derived types are consumed directly |
| Drag and drop | `dnd-kit` | Supports keyboard operation and screen readers. `react-dnd` is stagnant and carries constraints inherited from HTML5 drag and drop |
| State management | Zustand with Immer | For editing a document tree, Immer's patch stream is directly the foundation for undo and redo, and later for collaborative editing |
| Canvas | The document object model (DOM), as React components | Canvas or WebGL rendering would mean rebuilding selection, text editing, and accessibility by hand |
| Forms | React Hook Form, generated dynamically from the manifest | The inspector needs no code when a component is added ([ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md)) |
| Server communication | TanStack Query, with WebSocket for preview synchronization | |

Two further decisions follow from this stack: how faithful the canvas is, and what collaborative
editing means in version 1.

### Canvas fidelity: an approximation plus a device mirror

The web canvas is a **third renderer**, and making it agree exactly with SwiftUI and Compose is
impossible in principle — font metrics, line breaking, and scroll behavior all differ. We therefore
split preview into two tiers:

1. **The approximate preview**, in the browser, for fast feedback while editing. The interface says
   plainly that it is an approximation.
2. **The device mirror**, in which the editor broadcasts the draft document over a WebSocket and a
   real application — in developer mode, or a dedicated preview application — receives it and
   renders it **with the real renderer**. A QR code joins a device to the session. Pre-publication
   confirmation is done here, and this preview is authoritative.

The device mirror is a **requirement of milestone M2**, not a feature to add afterwards. Without it,
an editor trusts what the browser shows, publishes, and the screen breaks on a real device — an
accident that is certain rather than likely.

### Collaborative editing

Version 1 **does not adopt a CRDT**. It carries a `version` field on the document for optimistic
locking, plus a presence indicator showing who else is in the screen. At the expected concurrency —
one or two people on a single screen — the cost of adopting a library such as Yjs, and the risk that
an automatically merged tree is structurally valid but semantically wrong, both outweigh the
benefit.

## Rationale

Rendering the inspector from the manifest is what makes the editor cheap to extend, and it works
only because the manifest carries editor metadata as well as types. The stack is therefore chosen
to consume generated TypeScript directly, which is also why the backend shares the language
([ADR-0007](../ADR-0007-backend-stack/ADR-0007-backend-stack.md)).

Immer's patches do triple duty: undo and redo, transmission of a draft to the device mirror, and —
should collaborative editing later need it — the change unit a merge strategy would operate on.
Choosing the patch-based store now keeps that door open without paying for it today.

## Consequences

The browser preview will always differ from a device in some detail, and the interface has to keep
saying so rather than quietly implying fidelity it cannot deliver. The device mirror is the answer,
and it makes M2 depend on at least one client SDK being renderable ahead of the editor's completion.

Optimistic locking means two people editing one screen at once will see a conflict rather than a
merge. That is the intended behavior at this scale.

## Revisit triggers

We revisit the CRDT decision when more than two people routinely edit one screen at the same time,
or when conflict rejections become frequent enough that editors start avoiding the tool.

## References

- [ADR-0002 — The component manifest as the single source of truth](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) — the metadata the palette and inspector are generated from.
- [ADR-0007 — The backend stack and the shape of delivery](../ADR-0007-backend-stack/ADR-0007-backend-stack.md) — the shared language that lets validation run on both sides.
- [SU-0003 — M2, the WYSIWYG editor](../../../roadmaps/SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md) — the milestone this stack builds.
- [SU-0009 — The device mirror preview](../../../roadmaps/SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) — the mirror as a tracked item.
- [`docs/editor.md`](../../editor.md) — the editor's design in full.
