**English** · [日本語](SU-0003-m2-wysiwyg-editor-ja.md)

# SU-0003 — M2, the WYSIWYG editor

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0003](SU-0003-m2-wysiwyg-editor.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
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

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [ADR-0005 — The WYSIWYG editor's technology stack](../../docs/adr/ADR-0005-editor-stack/ADR-0005-editor-stack.md) — the stack and the two-tier preview decision.
- [`docs/editor.md`](../../docs/editor.md) — the editor's design in full.
- [SU-0002 — M1, client SDKs for iOS and Android](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) — the renderer the device mirror depends on.
- [SU-0006 — Manifest-driven code generation](../SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen.md) — the generation the palette and inspector rely on.
- [SU-0009 — The device mirror preview](../SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md) — the mirror as a tracked item.
