**English** · [日本語](tech-selection-ja.md)

# Tech selection

We record each technical decision as one **ADR** (Architecture Decision Record), in both English and
Japanese, under [`docs/adr/`](adr/README.md). Each record reads context, options considered,
decision, rationale, consequences, and revisit triggers, in that order. This page is the index: the
constraints every record assumes as a premise, and the list of what we chose.

## Constraints assumed as a premise

We restate the ones still unconfirmed among the open questions in [roadmap.md](roadmap.md).

- The library **embeds into an existing host application**. Binary size and a small dependency
  footprint outrank new features.
- We assume the people who edit the UI are **not engineers** (planning, marketing, customer
  support). The component set is closed as a result, and free-form styling is not allowed.
- The targets are native iOS and Android applications. The web is an **editing interface**, not a
  render target.
- We size the system for tens to several hundred screens, published several times a day. We do not
  need millisecond-level low-latency delivery; a CDN-cached model is enough.

## The list of decisions

| ID | Decision | Summary |
| --- | --- | --- |
| [ADR-0001](adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy.md) | Client rendering strategy | Two native implementations. They share not code but the specification, the generated types, and the conformance corpus |
| [ADR-0002](adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source.md) | The component manifest as the single source of truth | Generate the schema, each language's types, and the editor's palette and inspector from the JSON manifest |
| [ADR-0003](adr/ADR-0003-ui-document-format/ADR-0003-ui-document-format.md) | The wire format of a UI definition | JSON and JSON Schema 2020-12. We prioritize human readability and diffability |
| [ADR-0004](adr/ADR-0004-expression-language/ADR-0004-expression-language.md) | The expression language and data binding | A purpose-built `SpectreExpr`, deliberately not Turing-complete |
| [ADR-0005](adr/ADR-0005-editor-stack/ADR-0005-editor-stack.md) | The WYSIWYG editor's technology stack | React 19, TypeScript, and Vite, with a two-tier setup of an approximate preview and a device mirror |
| [ADR-0006](adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility.md) | Versioning and forward compatibility | Capability negotiation, per-node fallback, and additive-only evolution |
| [ADR-0007](adr/ADR-0007-backend-stack/ADR-0007-backend-stack.md) | The backend stack and the shape of delivery | Node 22, Fastify, PostgreSQL (JSONB), S3, and a CDN. Rollback is a pointer swap |
| [ADR-0008](adr/ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy.md) | The conformance testing strategy | An implementation-independent corpus that mechanically guarantees agreement across the three runtimes |

## Selection summary

| Area | Technology chosen |
| --- | --- |
| iOS SDK | Swift 6, SwiftUI (iOS 16+), Swift Package Manager |
| Android SDK | Kotlin, Jetpack Compose (minSdk 24), Gradle |
| UI definition format | JSON, JSON Schema 2020-12 |
| Expression language | Purpose-built `SpectreExpr` (not Turing-complete) |
| Single source of truth | `spec/component-manifest.json`, plus code generation |
| Editor | React 19, TypeScript, Vite, dnd-kit, Zustand/Immer |
| Backend | Node 22, Fastify, PostgreSQL (JSONB), S3, CDN |
| Image loading | Nuke on iOS, Coil on Android |
| Consistency guarantee | A language-independent conformance corpus, plus per-platform snapshot tests |

## Adding or changing a record

The numbering rules, the format, the status values, and the supersede procedure live in
[`docs/adr/README.md`](adr/README.md). We never rewrite an accepted record; we replace it with a new
one, so the record of what we believed at the time, and why, survives.
