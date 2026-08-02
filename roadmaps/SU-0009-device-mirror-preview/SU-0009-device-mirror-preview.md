**English** · [日本語](SU-0009-device-mirror-preview-ja.md)

# SU-0009 — The device mirror preview

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0009](SU-0009-device-mirror-preview.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Editor |
| Related | [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md), [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md), [SU-0013](../SU-0013-renderer-visual-regression-testing/SU-0013-renderer-visual-regression-testing.md) |
<!-- /SU-METADATA -->

## Introduction

The device mirror lets an author see a draft screen rendered by the real client renderer on a real
device, while editing it in the browser. The editor broadcasts the draft document over a WebSocket;
an application in developer mode, or a dedicated preview application, receives it and renders it
with the production renderer. A QR code joins a device to the session.

## Motivation

The browser canvas is a **third renderer**, and it cannot agree exactly with SwiftUI and Jetpack
Compose: font metrics, line breaking, and scroll behavior differ by construction. An author who
trusts the browser preview will therefore publish a screen that breaks on a device — not as a risk
but as a routine occurrence, since the mismatch is systematic rather than occasional.

The mirror closes that gap by making the authoritative preview the one produced by the code that
will actually render the screen in production. This is why it is a requirement of milestone M2 and
not a later addition: an editor without it is an editor whose output nobody can safely approve.

## Detailed design

1. **The draft broadcast channel.** The editor streams document changes over a WebSocket, as Immer
   patches where possible, so a device updates without a full reload.
2. **Session joining by QR code**, pairing a device to the editing session without manual
   configuration.
3. **The receiving mode in the client SDKs**, which renders a streamed draft through the production
   renderer, gated so it cannot be reached in a release build.
4. **Approximation labeling in the browser preview**, stating plainly that it is not authoritative.
5. **Multi-device sessions**, so an iOS and an Android device can mirror the same draft at once.

## Alternatives considered

- **Increase the fidelity of the browser preview instead.** Rejected: exact agreement with two
  native renderers is impossible in principle, so effort spent there buys a smaller gap rather than
  a trustworthy one, and the remaining gap is the one that causes incidents.
- **Preview by publishing to a staging environment and opening the application manually.** Rejected:
  the loop is too slow for editing, and it puts a publication step between an author and the
  feedback they need continuously.

## Progress

> Keep this current as work proceeds. The checklist mirrors the breakdown in *Detailed design*;
> the log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [ADR-0005 — The WYSIWYG editor's technology stack](../../docs/adr/ADR-0005-editor-stack/ADR-0005-editor-stack.md) — the two-tier preview decision this item implements.
- [`docs/editor.md`](../../docs/editor.md) — the editor's design in full.
- [SU-0003 — M2, the WYSIWYG editor](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md) — the milestone this is a requirement of.
- [SU-0002 — M1, client SDKs for iOS and Android](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) — the renderer the mirror displays through.
