**English** · [日本語](SU-0012-apns-sdui-sample-app-ja.md)

# SU-0012 — The APNs-delivered SDUI sample

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0012](SU-0012-apns-sdui-sample-app.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **Proposal** |
| Topic | Client SDK |
| Related | [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md), [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) |
<!-- /SU-METADATA -->

## Introduction

This item adds a second iOS sample application. It renders a Spectre UI document delivered inside
a remote-notification payload. The document does not load from the application bundle. It
complements the catalog-browsing sample milestone M1 (SU-0002) already ships.

A developer demonstrates it by dragging an `.apns` payload file onto a booted iOS Simulator.

Xcode 14 introduced this remote-notification simulation for the Simulator. The sample extracts the
embedded document from the payload. It parses the document with the existing document parser.
It renders the document with the existing screen renderer. The demonstration needs no
push-notification server. It needs no Apple Push Notification service (APNs) certificate and no
physical device.

## Motivation

The M1 sample renders one bundled JSON file, picked from a segmented control. The application
packages every document it shows at build time. Each one arrives without any
external trigger. A production application built on Spectre UI has a different job. It must
render a document that arrives from outside the bundle. That document arrives unannounced, at a
moment the application's own code did not choose. A delivery mechanism produces that situation.
The M1 sample never exercises this path. Nothing in the repository shows that the existing runtime
already handles an outside document too. The runtime already handles a document it fetched or
bundled itself. It spans `DocumentLoader`, `DocumentParser`, and the SwiftUI renderer.

A remote-notification payload demonstrates that path without a server to build. The Simulator's
drag-and-drop feature delivers a payload to a running application. It delivers the payload the way
a real push notification would. The application cannot tell the two apart. The demonstration also
makes a stated constraint concrete. Apple caps a remote-notification payload at 4 kilobytes (KB).
ADR-0003 sets a Spectre UI document's expected size at 5 to 50 KB. A document that fits inside a
push payload is necessarily small. A notification-sized card fits; a full screen does not. The
sample's example payloads make that limit visible, not merely asserted in prose.

## Detailed design

1. **A new sample target**, `clients/ios/APNsSample`. It builds with its own `project.yml` for
   XcodeGen, alongside the existing `SampleApp`. It depends on the same local `SpectreUI` Swift
   package the M1 sample depends on.
2. **Notification permission and delegate wiring**. The sample requests notification authorization
   on launch. It implements `UNUserNotificationCenterDelegate`. That delegate handles a payload the
   foreground delivers (`willPresent`). It also handles one a notification-banner tap sends
   (`didReceive response:`). Either way, it reads `userInfo`.
3. **Document extraction.** The sample reads a custom payload key, `spectreDocument`. That key
   holds the embedded document as a JSON object. The sample re-serializes the object and parses it
   with `DocumentParser` from `SpectreCore`. That is the parser the M1 sample already calls. This
   item adds no new parsing code.
4. **Rendering.** The sample shows the parsed document with `SpectreScreen`. A minimal host
   delegate backs the screen, adapted from the M1 sample's `SampleHostDelegate`. An idle state
   names the next action: dragging a payload onto the Simulator.
5. **Example payloads.** A handful of `.apns` files live under the sample directory. Each one
   carries a compact document that stays under the 4 KB limit. A short README walks through
   dragging one onto the Simulator. It covers the `Simulator Target Bundle` key a payload needs to
   reach the right application.

## Alternatives considered

- **Extend the M1 sample instead of a new target**. Rejected. The M1 sample's
  continuous-integration (CI) job already exercises the catalog-browsing flow. Folding
  notification permissions and delegate wiring into it couples two demonstrations. Each one has a
  different life cycle. That risks the flow CI already depends on. A second, narrowly scoped
  target keeps each demonstration legible on its own.
- **Deliver the document by reference**. The payload would carry a Uniform Resource Locator (URL)
  instead of the document. A Notification Service Extension would fetch the document before
  rendering it. Rejected for this item. That path reintroduces the server dependency milestone M3
  (SU-0004) will supply once it exists. This item stands on its own without one. Fetch-by-reference
  stays follow-on work, for once M3's delivery API exists.
- **Shrink the document into a binary encoding**, to fit a larger screen inside the 4 KB budget.
  Rejected. ADR-0003 already reserves that `+cbor` escape route for a measured size problem. A
  sample application is not the place to prototype it. This sample shows the mechanism at the size
  Apple actually allows.

## Progress

> Keep this current as work proceeds. The checklist mirrors the *Detailed design* breakdown. The
> log records what changed and when, oldest first.

- [ ] Not started

**Log**

- No work has begun; the repository is in its design phase.

## References

- [ADR-0003 — The wire format of a user-interface definition](../../docs/adr/ADR-0003-ui-document-format/ADR-0003-ui-document-format.md) — the document-size figures and the `+cbor` escape route this item's payload budget draws on.
- [SU-0002 — M1, client SDKs for iOS and Android](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md) — the sample application and runtime this item builds alongside and reuses.
- [SU-0004 — M3, authoring and delivery platform](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md) — the future delivery API a fetch-by-reference version of this sample would depend on.
- [`docs/roadmap.md`](../../docs/roadmap.md) — the per-area implementation status this item's Progress section updates.
