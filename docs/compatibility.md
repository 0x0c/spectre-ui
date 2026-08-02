**English** · [日本語](compatibility-ja.md)

# Versioning and forward compatibility

When an SDUI adoption fails, the cause almost always traces back here.
**An app version stays old until the user force-updates it.** A device running an app from six
months ago still receives a document that carries a component added today.

Behind "the server can change anything" always sits "the server cannot send what the client does not
support." The design has to handle this asymmetry directly.

## 1. Three layers of defense

| Layer | Responsibility | Impact on failure |
| --- | --- | --- |
| （1） Capability negotiation | The server returns a tree shaped for the older client | Best. The author never has to think about it |
| （2） Per-node fallback | An unknown node is replaced with an alternative the author specified | Good. The author designs how the degradation looks |
| （3） Safe omission of an unknown node | Drop it without crashing | Minimum. A gap appears, but nothing breaks |

Layer （2） catches what （1） cannot prevent, and layer （3） catches what ② has no answer for either.
**Whenever （3） fires, telemetry always records it.**

## 2. （1） Capability negotiation

The client declares its own capabilities on every request.

```http
GET /screens/product_detail HTTP/2
Spectre-Schema: 1.3
Spectre-Components: 7f3a9c21
Spectre-Platform: ios
Spectre-App-Version: 3.14.0
Spectre-SDK-Version: 1.3.2
If-None-Match: "01J8XKQ...-7f3a9c21"
```

- `Spectre-Components` is a hash of **the set of supported component names**, embedded by the SDK at
  build time. We keep it independent of the SDK version, because a host application can disable a
  component partway.
- The server matches this hash against the set it knows; if it is unknown, the server estimates
  conservatively from `Spectre-Schema`.

Server-side processing:

```
1. Resolve the currently published document from screenId
2. Walk the tree against the client's capabilities
3. Replace an unsupported node with its fallback, or drop it if it is optional
4. Return an ETag for the result (the ETag carries the capabilities)
```

**Including the capability hash in the ETag matters**: without it, a CDN can serve a response meant
for a newer client to an older one. Set `Vary: Spectre-Schema, Spectre-Components` on the CDN's cache
key too.

> This trades off against CDN cache efficiency: the number of cache entries grows with the number of
> capability combinations, so we round the capability set down to a handful of discrete tiers (for
> example, `tier=A|B|C`) rather than keying the cache on the raw set itself, for the cache key. Only
> a handful of SDK versions are ever in circulation at once, so this works well in practice.

## 3. （2） Per-node fallback

```jsonc
{
  "type": "Carousel",              // a new component added in v1.4
  "props": { "items": "${data.banners}" },
  "fallback": {
    "type": "Image",               // a component that has existed since v1.0
    "props": { "url": "${first(data.banners).imageUrl}" }
  }
}
```

What a client does on encountering an unknown `type`:

```
type is unknown
  ├─ a fallback exists    → resolve the fallback (recursively) and render it
  ├─ optional: true       → omit the node entirely
  └─ neither applies      → omit it, and record spectre.node.unknown
                            (a debug build shows a red placeholder)
```

The same rule applies at the property level. An unknown `props` key is **silently ignored**. An
unknown enum value (a new `variant`, for example) **falls back to that property's default**.

**Why fallback belongs in the language specification**: leaving how to handle an unknown node to a
client's implementation detail (a `default: break`) lets the degradation drift between iOS and
Android. Making it part of the specification keeps the behavior aligned, and it lets **the editor
preview "here's how this looks on an old app"**.

## 4. （3） Safe omission and crash resilience

An invariant every client SDK holds:

- **The document's content must never crash the app.** Not an unknown type, not a missing property,
  not a broken expression, not an unexpected nesting depth, not a circular reference.
- A document that fails validation is never applied; the client uses **the last cached, valid
  version** instead. Absent that, it shows the host application's `fallbackView`.
- The client enforces the limits (node count, depth, size) on receipt ([architecture.md](architecture.md)
  §5).

To back this up, both SDKs carry a **fuzzing test**: it mutates a valid document at random (swapping
types, deleting keys, deep nesting, oversized arrays) and verifies that nothing crashes.

## 5. Schema evolution rules

`schemaVersion` is `major.minor`.

### What a minor bump may do (additive only)

- Add a new component
- Add an **optional property** to an existing component (its default must match existing behavior)
- Add a value to an existing enum
- Add a new built-in function
- Add a new action kind

### What requires a major bump

- Removing or renaming a component or a property
- Changing a default value
- Changing what a property means
- Adding a required property
- Changing an expression's evaluation rule

**Migrating a major version**: the server delivers both major versions in parallel. The editor saves
a document under the new major version, and converts it down to the old major version at delivery
time (when conversion is impossible, the server returns the old published pointer to old clients
instead). We treat the migration period as done once "clients that do not support the target major
version fall under 1% of the total."

### The rule we never break

> **We never change what an already-published property name means.**

Deprecating and ignoring a property is always cheaper than deleting it. The manifest carries
`deprecated: true` and `deprecatedSince`; the editor hides it from the palette, but an existing
document that uses it keeps working.

## 6. Feedback to the author, grounded in measurement

This is the key that makes the whole approach operable.

The client SDK sends a `spectre.node.unknown` event ([architecture.md](architecture.md) §8).
The server aggregates this against the delivery log and keeps **each component's "share of supported
users"**.

The editor reflects this in the palette and on the canvas:

```
┌─ Components ────────────────────┐
│  Text          ✓ 100%           │
│  Button        ✓ 100%           │
│  Tabs          ✓  99.2%         │
│  Carousel      ⚠  73.4%   NEW   │  ← 26.6% of users see the fallback instead
└─────────────────────────────────┘
```

Placing `Carousel` on the canvas automatically prompts the editor to **ask for a fallback
configuration**. Publishing without one triggers a `compat/unsupported-component` warning (the
threshold is configurable; the default warns below 95% support).

**We do not aim for a state where "old apps need no thought at all"; we aim for a state where "what
happens on an old app is visible from the editing screen."** The first is impossible; the second is
operable.

## 7. Publishing and rollback

```
Draft ──validate──► Staged ──approve──► Released
  │                    │                    │
  │                    │  internal          │  production
  │                    │  canary (N%)       │  100%
  │                    │                    │
  └──── confirm on the device mirror ──┘    └─► Rollback (a pointer swap, seconds)
```

- A published version is **immutable**. `/d/{documentId}/{versionId}` is cacheable forever.
- Rollback swaps the published pointer in the `releases` table, nothing more. It needs no build and no
  deploy.
- Staged rollout: `rollout_percent` and `targeting` (the app version range, the platform, the user
  segment). A/B testing shares the same mechanism.
- The client-side cache TTL is the floor on how fast a rollback takes effect. **Keep `/screens/:id`'s
  `max-age` around 60 seconds**, and rely on `stale-while-revalidate` to keep the perceived speed up
  instead. An emergency kill switch (a mechanism that pushes every client to refetch without delay) is
  under consideration for M4.

## 8. Operating an SDK release and adding a component

The flow for adding a new component:

```
1. Add the component to spec/component-manifest.json (a minor bump)
2. Run codegen → the TS/Swift/Kotlin types are generated
3. Implement the iOS/Android renderer (the design makes an unimplemented case a compile error against the generated types)
4. Add cases to spec/conformance/
5. The editor picks it up in the palette automatically (manifest-driven, no implementation needed)
6. Release the SDK → the host application adopts it → store review → distribution
7. The editor keeps warning until the adoption rate crosses the threshold
```

**Step 3's "an unimplemented case is a compile error" is what makes this work.** Making the generated
renderer's dispatch an exhaustive `switch` lets the Swift and Kotlin compilers catch a missing
implementation.

Adding a component requires an SDK release, so **investing in the catalog design up front pays off
heavily**. Conversely, once the catalog covers enough ground, every later screen change stays entirely
server-side. That is SDUI's real payoff, and reaching it needs the feedback loop in §6.
