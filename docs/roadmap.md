**English** · [日本語](roadmap-ja.md)

# Roadmap and open questions

This page collects the milestone overview, the estimates, the open questions, and the risks. The
individual work items live under [`roadmaps/`](../roadmaps/README.md), one directory per item, each
proposed in both English and Japanese. Each milestone below corresponds to items SU-0001 through
SU-0005.

## Implementation status (as of now)

M0 and M1 are in, short of fuzz testing and snapshot testing. M3 (the authoring and delivery
platform) already has real code. That includes capability-based tree shaping.
**The editor (M2) has its first pass in.** The palette, canvas, and inspector work. So do the
action editor, sample data, and undo/redo. The device mirror does not exist yet. That is
[SU-0009](../roadmaps/SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md), a
WebSocket-based device preview. An approximate preview alone cannot confirm a screen is ready to
publish.

| Area | Status | Verification |
| --- | --- | --- |
| Component manifest + codegen | Implemented | The catalog-sync tests (both Kotlin and Swift) + a drift check in CI |
| Conformance corpus | Implemented (242 cases, verified by three implementations: Swift, Kotlin, and TypeScript) | `pnpm --filter @spectre-ui/core run test` (the TypeScript SpectreExpr) |
| Kotlin runtime (spectre-core) | Implemented | **297 tests green** |
| Compose renderer + Android sample | Implemented | CI (the `android` job) |
| Swift runtime (SpectreCore) | Implemented | CI (the `ios` job) |
| SwiftUI renderer + iOS sample | Implemented | CI (the `ios` / `ios-sample` jobs) |
| Diff-based re-resolution | Implemented | `Resolver.reresolveTraced` connects the dependency-path extraction that already existed |
| `applyPatch` / `focus` / `scrollTo` | Implemented | RFC 6902 JSON Patch, plus the focus and scroll wiring |
| Delivery and caching (DocumentLoader) | Implemented | A three-tier cache plus stale-while-revalidate; the samples already use it |
| Capability negotiation and per-node fallback degradation | Implemented | `Spectre-Schema`/`Spectre-Components` headers, server-side `degradeDocumentTree`, and the client's fixed fallback → optional-omission → placeholder order (ADR-0006) |
| Authoring and delivery API (M3) | In progress | `packages/server`; permissions and workflow (item 3) is still a stand-in |
| Editor (M2) | In progress | `packages/editor`; the palette, canvas, inspector, action editor, sample data, and undo/redo work, but the device mirror (SU-0009) is missing, so M2's own acceptance bar isn't met yet |

### How verification splits

Depending on the development environment, iOS and Android compilation may not be verifiable — the
Swift toolchain may be missing, or `dl.google.com` may be unreachable, blocking the Android Gradle
Plugin (AGP) and androidx.

To handle this, `clients/android/settings.gradle.kts` skips `:spectre-ui` and `:sample` when the
Android SDK is not found. **The logic tests alone run in any environment.**

Continuous integration (CI) owns compile verification. The job definitions live in
[.github/workflows/ci.yml](../.github/workflows/ci.yml).

| Job | Runner | Contents |
| --- | --- | --- |
| `core` | Ubuntu | `:spectre-core:test` — the conformance corpus and the runtime |
| `codegen` | Ubuntu | Whether the generated artifacts still match the manifest, the specification JSON's syntax, the corpus-extension rule, and additive-only manifest evolution |
| `server` | Ubuntu | Type checks and tests for `packages/core` / `packages/manifest` / `packages/server` / `packages/editor` (with a PostgreSQL service container) |
| `android` | Ubuntu | Building `:spectre-ui` / `:sample` |
| `ios` | macOS | `swift build` / `swift test`, plus `xcodebuild` for iOS |
| `ios-sample` | macOS | Generating the project with XcodeGen and building the sample app |

To verify everything locally, run the following in an environment with the Android SDK and Xcode:

```sh
cd clients/android && ./gradlew build
cd clients/ios && swift test
```

## Milestones

Estimates are in full-time-equivalent person-weeks, on the assumption of one iOS engineer, one
Android engineer, and one or two web/server engineers.

### M0 — Freeze the specification (3–4 weeks) — [SU-0001](../roadmaps/SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze.md)

**Deliverable**: the specification frozen, with code generation working.

- [ ] Design the component manifest's meta-schema
- [ ] Settle component catalog v0.1 (verify it can express three real target screens on paper)
- [ ] Define the design tokens (copy them from an existing design system where one exists)
- [ ] Fix SpectreExpr's grammar, plus the first version of the conformance corpus
- [ ] codegen: manifest → JSON Schema / TS / Swift / Kotlin
- [ ] A skeleton conformance-corpus runner (in all three languages)

> **M0's acceptance criterion**: three real screens (a list, a detail view, and a form) can be
> expressed as hand-written JSON, and review agrees "this is enough." Compromising here means
> rebuilding from M3 onward.

### M1 — Client SDKs (6–8 weeks, iOS and Android in parallel) — [SU-0002](../roadmaps/SU-0002-m1-client-sdks/SU-0002-m1-client-sdks.md)

- [ ] Runtime: DocumentLoader / Store / Resolver / ActionDispatcher
- [ ] The SpectreExpr parser and evaluator (passing the conformance corpus)
- [ ] Renderer: every component in catalog v0.1
- [ ] ThemeProvider, the host delegate
- [ ] A three-tier cache plus stale-while-revalidate
- [ ] Compatibility degradation (fallback / optional / enforcing the upper limits)
- [ ] Fuzz testing, snapshot testing
- [ ] A sample application

> **M1's acceptance criterion**: three real screens, hand-written as JSON, render on both operating
> systems, with a difference against the existing native implementation that review finds acceptable.
> The conformance corpus passes 100% on both operating systems.

### M2 — The editor (6–8 weeks) — [SU-0003](../roadmaps/SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor.md)

- [x] A manifest-driven palette and inspector
- [x] The canvas (drag-and-drop, selection, a tree panel)
- [x] An expression picker mode (the CodeMirror text mode is not started yet)
- [x] The action editor: a manifest-driven catalog plus parameter editing. The server-response
      protocol's UX stays thin.
- [x] Sample-data management
- [x] Undo/redo (lint display and a diff view are not started yet)
- [ ] **The device mirror (WebSocket)** ← mandatory, tracked as
      [SU-0009](../roadmaps/SU-0009-device-mirror-preview/SU-0009-device-mirror-preview.md), out of
      scope for this first pass
- [x] Switching device, locale, theme, and font scale (inside the approximate preview)

### M3 — The delivery platform (4–5 weeks) — [SU-0004](../roadmaps/SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform.md)

- [ ] The authoring API (drafts, validation, publish, rollback, audit log)
- [ ] The delivery API (capability negotiation, ETag, CDN configuration)
- [ ] Permissions and workflow (an approval flow)
- [ ] Registering and managing logical endpoints
- [ ] Telemetry collection and adoption-rate aggregation

> **Production-ready as of M3's completion**, starting with the lowest-impact screens (a campaign
> announcement, a notice list, and the like).

### M4 — Operational maturity (ongoing) — [SU-0005](../roadmaps/SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity.md)

- [ ] Staged rollout, A/B testing, segmented delivery
- [ ] Adoption-rate feedback in the editor
- [ ] Partials and templates
- [ ] `HostSlot` (embedding a native view)
- [ ] Advancing pagination and pull-to-refresh
- [ ] An emergency kill switch

---

## Open questions (need confirmation)

The design assumed answers to these. In order of how much the real answer would change the design:

### 1. The host application's current state — **design impact: large**

- iOS's UI framework: SwiftUI or UIKit. A UIKit-centered app needs extra design work at the
  `UIHostingController` embedding boundary (safe area, scroll coordination, size resolution).
- Android's UI framework: Compose or the View system.
- The lowest supported OS version. We provisionally assume iOS 16 and minSdk 24; a higher floor
  eases implementation (the `Layout` protocol, `FlowRow`, and the like).

### 2. Who edits the UI — **design impact: large**

- We designed the catalog closed, and expressions picker-centric, assuming non-engineers (planning,
  customer support) as editors.
- If **engineers alone edit**, raising the expression language's expressiveness and leaning the
  editor toward a code editor lowers the total cost, and M2's scope shrinks a great deal.

### 3. An existing design system — **design impact: medium**

- If existing token definitions exist (Figma Variables, Style Dictionary, and the like), we would use
  them as the source for `spec/tokens.json` rather than defining tokens from zero.

### 4. The backend's language and existing infrastructure — **design impact: medium**

- ADR-0007 chose TypeScript and Fastify; if the organization runs entirely on the JVM, Kotlin and
  Spring are a reasonable choice too (trading shared code with the Android implementation for losing
  shared validation logic with the editor).
- The integration points with existing CDN, authentication, feature-flag, and measurement
  infrastructure.

### 5. Scope of application — **design impact: medium**

- "The whole app" versus "a specific area" (campaigns, notices, onboarding).
- The latter lets M0's catalog shrink considerably, cutting months off the schedule. **We
  strongly recommend starting with the latter.**

### 6. Update frequency and scale

- The number of screens, the number of daily publishes, and peak request volume. These shape the CDN
  design and the cache TTL.

### 7. Offline requirements

- Whether any screens must render offline, and how much of a bundled fallback document to prepare.

### 8. Multilingual support

- Whether the document carries text directly, or only keys that resolve against the app's own text
  resources.
- The former lets the author manage translation directly; the latter rides on an existing translation
  workflow. **The current design assumes the former**, though adding a `t('key')`-equivalent function
  would express the latter too.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| An insufficient catalog design forces a breaking change later | Large | Make M0's acceptance criterion strict; freeze only after verifying against three real screens |
| Web, iOS, and Android drift apart visually, and the author stops trusting the tool | Large | Make the device mirror mandatory for M2; label an approximation as an approximation in the UI |
| Degradation on an old app version stays invisible, and causes an incident | Large | Surface adoption-rate telemetry in the editor (M3/M4) |
| A requirement turns out inexpressible in SDUI, forcing a return to native implementation | Medium | The `host` action and `HostSlot` are designed in from the start, as an escape hatch |
| The expression language grows complex enough to make the document unreadable | Medium | Keep the language deliberately weak; warn on nesting; keep logic on the server as a principle |
| Conformance drift (Swift, Kotlin, and TypeScript behave differently) | Medium | The conformance corpus and CI; partial migration to Kotlin Multiplatform (KMP) if drift crosses a threshold (ADR-0001's revisit trigger) |
| A bloated document delays the first render | Small | A node-count limit, lazy rendering, stale-while-revalidate, a bundled fallback |

---

## Next actions

1. Confirm items 1, 2, and 5 among the open questions above, in order of design impact.
2. Choose three real screens to replace, and verify hand-written JSON can express them.
3. Settle component catalog v0.1 from that result, and enter M0.

We propose narrowing the scope of application as
[SU-0010](../roadmaps/SU-0010-narrow-scope-pilot/SU-0010-narrow-scope-pilot.md).
