**English** · [日本語](architecture-ja.md)

# Architecture

## 1. Overview

```
                        ┌──────────────────────────────────────┐
                        │  spec/component-manifest.json        │
                        │  spec/tokens.json                    │  single source of truth
                        └───────────────┬──────────────────────┘
                                        │ codegen
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
      TS types + JSON Schema      Swift types              Kotlin types
              │                         │                         │
   ┌──────────┴──────────┐              │                         │
   ▼                     ▼              │                         │
┌────────────┐    ┌─────────────┐       │                         │
│ Editor     │    │ Server      │       │                         │
│ (React)    │◄──►│ (Fastify)   │       │                         │
│            │    │             │       │                         │
│ - canvas   │    │ - authoring │       │                         │
│ - inspector│    │ - delivery  │       │                         │
│ - preview  │    │ - validation│       │                         │
└─────┬──────┘    └──────┬──────┘       │                         │
      │                  │              │                         │
      │ WS (draft)       │ HTTPS + CDN  │                         │
      │                  ▼              ▼                         ▼
      │           ┌─────────────────────────────────────────────────┐
      └──────────►│         UI Document (JSON)                      │
                  └──────────────┬───────────────┬──────────────────┘
                                 ▼               ▼
                        ┌────────────────┐  ┌────────────────┐
                        │ SpectreUI iOS  │  │ SpectreUI      │
                        │ (SwiftUI)      │  │ Android        │
                        │                │  │ (Compose)      │
                        └───────┬────────┘  └───────┬────────┘
                                ▼                   ▼
                        ┌────────────────────────────────────┐
                        │  Host App (delegate / handlers)    │
                        │  Authentication, navigation,       │
                        │  custom behavior                    │
                        └────────────────────────────────────┘
```

## 2. The client SDK's internal structure

iOS and Android take the same layering, with matching layer names, so a reviewer can trace the same
concept across platforms.

```
┌──────────────────────────────────────────────────────────────┐
│ Public API                                                   │
│   SpectreScreen(screenId:) / SpectreScreen(document:)        │
│   SpectreClient  … configuration, cache, delegate registration│
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│ Runtime                                                      │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ DocumentLoader│ │ Store      │  │ ActionDispatcher      │  │
│  │  fetch/cache │ │ state+data │  │  sequential execution, │  │
│  │              │  │            │  │  side-effect management│  │
│  └──────┬─────┘  └─────┬──────┘  └──────────┬─────────────┘  │
│         │              │                     │               │
│  ┌──────▼──────────────▼─────────────────────▼─────────────┐ │
│  │ Resolver                                                │ │
│  │   Expression evaluation (SpectreExpr), binding           │ │
│  │   resolution, visibleWhen evaluation, repeat expansion,  │ │
│  │   compatibility degradation                              │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ RenderTree  … a resolved, pure node tree (no expressions)│ │
│  └──────────────────────┬──────────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Renderer   ← the only platform-specific layer                │
│   Maps to SwiftUI views or composables, one file per          │
│   component                                                   │
│   ThemeProvider (tokens → actual colors and fonts)            │
└──────────────────────────────────────────────────────────────┘
```

### Each layer's responsibility

**DocumentLoader**
- `screenId` → an HTTP GET, with a conditional request via ETag / `If-None-Match`.
- A three-tier cache: memory (LRU) → disk → a bundled fallback shipped with the application.
- **Stale-while-revalidate**: render an expired cache entry without delay, then refresh it in the
  background and swap it in. Every render past the first happens this way.
- The host application decides, through its delegate, what to show when the network is unreachable
  and no cache exists.

**Store**
- Holds two scopes: `data` (server-provided, immutable) and `state` (client-mutable).
- Every `state` update goes through the `setState` action. A path-based update (`form.email`)
  re-renders only the nodes subscribed to that path.
- Tied to the screen's lifecycle. The document's own `statePolicy` says whether a refetch keeps or
  discards `state`.

**ActionDispatcher**
- Executes an action array **sequentially**: it waits for `request` to complete before moving on to
  `onSuccess`.
- Prevents duplicate firing during execution (a button tapped more than once). An action from the same
  node blocks until the previous one completes.
- Gives the host application's delegate a chance to intervene: `shouldPerform(action) -> Bool` and
  `perform(hostAction)`.

**Resolver**
- Turns an unresolved document (one that still contains expressions), combined with the Store, into
  a resolved RenderTree.
- Also performs compatibility degradation here (fallback for an unknown node). **The Renderer never
  sees an unknown type.**
- Re-resolves the diff against a Store change; the first pass alone triggers a full resolution.

**Renderer**
- Renders resolved nodes, and nothing else. It carries no branching and no expression evaluation. Keeping this
  layer thin directly limits the drift between the two platforms.

## 3. Data flow

### 3.1 First render

```
Host App                SDK                        Server/CDN
   │                     │                             │
   ├─ SpectreScreen("product_detail", params) ────────►│
   │                     │                             │
   │                     ├─ cache lookup ──┐           │
   │                     │◄─ hit(stale) ───┘           │
   │                     │                             │
   │  ◄── immediate render (stale) ─┤                  │
   │                     ├─ GET /screens/product_detail│
   │                     │   Spectre-Capabilities: ... │
   │                     │   If-None-Match: "abc"      │
   │                     ├────────────────────────────►│
   │                     │◄──── 200 + document ────────┤
   │                     ├─ validate → Resolver        │
   │  ◄── swapped-in render ────┤                       │
```

See [compatibility.md](compatibility.md) for what `Spectre-Capabilities` carries.

### 3.2 Interaction → action → update

```
 User taps Button
        │
        ▼
 ActionDispatcher.dispatch([
   {setState: state.submitting = true},
   {request: POST cart.add, body:{...}},
 ])
        │
        ├─ setState ──► Store ──► Resolver (diff) ──► re-render (button shows a loading state)
        │
        ├─ request ───► the Host App's NetworkDelegate
        │                 (resolving the base URL, the auth header, and the
        │                  endpoint name is the host's responsibility)
        │                        │
        │                        ▼ HTTPS
        │                 ┌──────────────┐
        │                 │   API Server │
        │                 └──────┬───────┘
        │                        │ ActionResponse
        │                        ▼
        │   { state: {...}, patch: [...], actions: [{showToast}] }
        │                        │
        ├────────────────────────┘
        ├─ merge state
        ├─ apply patch to the document (partial update)
        ├─ execute actions sequentially → show a toast
        ▼
    Resolver (diff) ──► re-render
```

**Indirection for endpoints**: the document never carries an absolute URL; it carries a logical name
(`cart.add`) instead. The host application resolves the actual URL, authentication, and headers.
Three reasons drive this:

1. The document is a public artifact cached on a CDN, so it must never carry an internal URL or a
   token.
2. It avoids authoring a separate document per environment (dev, staging, production).
3. The host application reuses its existing network layer as-is (authentication, retries,
   certificate pinning).

## 4. Server-side structure

```
┌────────────────── Authoring Plane ──────────────────┐
│  Fastify (authenticated, internal)                   │
│                                                     │
│   POST /api/documents            create a draft      │
│   PUT  /api/documents/:id        update a draft      │
│                                   (optimistic lock)   │
│   POST /api/documents/:id/validate  schema + lint     │
│   POST /api/documents/:id/publish   publish          │
│   POST /api/documents/:id/rollback  roll back        │
│   WS   /api/preview/:sessionId   device-mirror relay  │
│                                                     │
│   PostgreSQL: documents, document_versions,         │
│               releases, audit_log                   │
└─────────────────────────────────────────────────────┘
                        │ publish (immutable write)
                        ▼
┌────────────────── Delivery Plane ───────────────────┐
│  Fastify (public, behind a CDN)                       │
│                                                     │
│   GET /screens/:screenId    resolve the current       │
│                              published version         │
│        → 200 + document | 304                       │
│   GET /d/:documentId/:versionId   immutable           │
│        → Cache-Control: public, max-age=31536000,   │
│          immutable                                  │
│   GET /manifest/:schemaVersion  for client validation │
└─────────────────────────────────────────────────────┘
```

**Why we split the planes**: the delivery plane is stateless and read-only, and scales on the
assumption of a CDN. The authoring plane carries database writes and authentication, with different
availability requirements, a different scale, and a different failure-isolation and deployment
cadence.

### Data model (outline)

```sql
documents          (id, screen_id, name, current_draft_version, created_by, ...)
document_versions  (id, document_id, seq, body jsonb, checksum, author, created_at)
                   -- body is immutable; every update is a new row
releases           (id, document_id, version_id, channel, rollout_percent,
                    targeting jsonb, published_at, published_by, superseded_by)
audit_log          (id, actor, action, document_id, version_id, diff jsonb, at)
```

`releases` carries `channel` (internal / canary / production), `rollout_percent`, and `targeting`
(the app version range, the platform, the user segment), so staged rollout and A/B testing share one
mechanism.

## 5. Threading and performance

| Work | Where it runs |
| --- | --- |
| Network and disk I/O | Background |
| JSON decoding and schema validation | Background |
| The Resolver's first full resolution | Background |
| The Resolver's diff resolution | May run on the main thread (lightweight, per node) |
| Rendering | Main |

**Protective limits** (the client rejects a document that exceeds one, and falls back to a cached
older version or a host-provided fallback):

| Item | Limit |
| --- | --- |
| Total node count | 2,000 |
| Tree depth | 32 |
| Document size (uncompressed) | 1 MB |
| AST nodes per expression | 256 |
| `repeat` expansion count | 500 (excess is truncated and recorded in telemetry) |

We apply the same limits to authoring-time validation, so nothing unpublishable ever reaches a
device.

List components always map to lazy rendering (`LazyVStack` / `LazyColumn`). Diffed rendering considers
a node solely when it carries a stable `id`; a node without one gets rebuilt along with its parent. **The
editor assigns a stable ID to every node automatically.**

## 6. The integration surface with the host app

The SDK asks the host application for nothing more than the following, and does not grow this surface
further.

```swift
protocol SpectreHostDelegate {
    // Logical endpoint name → the actual request. Also where the auth header is attached.
    func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse

    // A screen transition the document cannot express. Delegates to existing routing.
    func navigate(to destination: SpectreDestination) -> Bool

    // Executes a `host` action (a share sheet, payment, camera, and so on)
    func performHostAction(name: String, params: [String: SpectreValue]) async throws -> SpectreValue?

    // Where to forward measurement events
    func track(event: String, properties: [String: SpectreValue])

    // The fallback view to show on a load failure
    func fallbackView(for screenId: String, error: SpectreError) -> AnyView?
}
```

Android carries the same `SpectreHostDelegate` interface, with an identical signature.

**Theming**: the SDK knows token names alone. The host application injects the mapping from a token to
an actual color, font, or corner radius, as `SpectreTheme`. This lets the SDK blend into the host
application's own design system as-is, and lets dark mode and font scaling ride on the host's own
mechanism.

## 7. Security design

| Threat | Mitigation |
| --- | --- |
| Arbitrary code execution from a compromised server | The expression language is not Turing-complete and carries no code-execution mechanism (ADR-0004). No JavaScript runtime is embedded |
| Client denial of service from a malicious document | The §5 limits are enforced on the client too; the client rejects an excess document |
| Phishing (`openUrl`) | The host application configures an allowlist of URL schemes and hosts. An external domain defaults to an explicit confirmation dialog |
| An unintended API call | `request` carries only a logical endpoint name; nothing outside the names the host application registered can execute |
| Credential leakage | We treat the document as a public artifact cached on a CDN and never place a secret in it. The authoring API's lint catches violations |
| Information leakage or tracking through images | An allowlist of image hosts |
| A tampered document reaching a client | A published version carries a checksum. The host application's configuration can enable signature verification (Ed25519) |
| Abuse of authoring privileges | Every publish operation is recorded in the audit log in full. Publishing to the production channel can require approval (a two-person rule) |

## 8. Observability

What the client SDK forwards to the host's measurement infrastructure through the `track` delegate:

- `spectre.document.loaded` (screenId, versionId, source=network|cache|bundle, ms)
- `spectre.document.rejected` (screenId, reason)
- `spectre.node.unknown` (screenId, versionId, nodeType, degradedTo) ← **the measured signal of
  compatibility, and the most important one**
- `spectre.expr.error` (screenId, nodeId, code)
- `spectre.action.performed` / `spectre.action.failed`
- `spectre.render.ms` (screenId, nodeCount)

Aggregating `spectre.node.unknown` lets us measure, for real, what share of current users degrade
when an author uses a given component, and surface that as a warning in the editor.
This measurement is the key that makes the forward-compatibility strategy operable.
