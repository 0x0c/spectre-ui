[English](README.md) · **日本語**

# Spectre UI

Spectre UI は、サーバードリブンUI（Server-Driven UI、SDUI）のためのクロスプラットフォームライブラリです。

サーバは、JSON（JavaScript Object Notation）で書かれた**UI定義ドキュメント**を配信します。iOS と
Android のネイティブSDK（Software Development Kit、ソフトウェア開発キット）は、そのドキュメントを
解釈して画面を描画します。ボタンのタップは、宣言的な**アクション**として処理します。同じドキュメント
は、Web の**WYSIWYG（What You See Is What You Get、見たままが得られる）エディタ**から編集して公開
できます。画面は、あらかじめ定義された**コンポーネントカタログ**の組み合わせで作ります。

本リポジトリは**設計フェーズ**にあり、実装コードはまだありません。ここにあるのは、技術選定と仕様を
記録したドキュメントです。

**ロードマップの可視化: https://0x0c.github.io/spectre-ui/**

マイルストーン M0 から M4 までのタイムライン、成果物、未決事項、リスクを1ページにまとめたものです。

---

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/adr/](docs/adr/README-ja.md) | ADR（アーキテクチャ決定記録）。1決定1ディレクトリ、英語と日本語の両方 |
| [roadmaps/](roadmaps/README-ja.md) | ロードマップ項目。1項目1ディレクトリ、英語と日本語の両方 |
| [docs/tech-selection.md](docs/tech-selection.md) | 技術選定の索引。前提とする制約と、ADRの一覧 |
| [docs/architecture.md](docs/architecture.md) | 全体アーキテクチャ、コンポーネント構成、データフロー |
| [docs/spec/schema.md](docs/spec/schema.md) | UI定義ドキュメントのスキーマ仕様 v0.1 |
| [docs/spec/components.md](docs/spec/components.md) | コンポーネントカタログ v0.1 とデザイントークン |
| [docs/spec/expression.md](docs/spec/expression.md) | 式言語 SpectreExpr とデータバインディング |
| [docs/spec/actions.md](docs/spec/actions.md) | アクション仕様とサーバ応答プロトコル |
| [docs/editor.md](docs/editor.md) | Web WYSIWYGエディタの設計 |
| [docs/compatibility.md](docs/compatibility.md) | バージョニング、前方互換、配信とロールバックの戦略 |
| [docs/roadmap.md](docs/roadmap.md) | マイルストーンの概観、見積もり、未決事項、リスク |

ADRとロードマップ項目は永続的な番号を持ち、1件につき1ディレクトリを占めます。各ディレクトリには、
英語版 `X.md` と日本語版 `X-ja.md` を組で置きます。採番と書式の規則は
[docs/adr/README-ja.md](docs/adr/README-ja.md) と [roadmaps/README-ja.md](roadmaps/README-ja.md) に
あります。執筆時の文章規範と手順は [.agent-workflows/](.agent-workflows/README.md) にあり、
`.claude/skills/` のアダプタがそれを Claude Code へ読み込みます。

英語が主、日本語が従です。例外は `docs/adr/` を除く `docs/` 以下のドキュメントで、現時点では日本語
だけがあります。

## 成果物（設計サンプル）

| ファイル | 内容 |
| --- | --- |
| [spec/component-manifest.json](spec/component-manifest.json) | コンポーネントマニフェスト。生成物すべての単一の情報源 |
| [spec/schema/document.schema.json](spec/schema/document.schema.json) | ドキュメント用 JSON Schema（マニフェストから生成する想定の手書きサンプル） |
| [examples/screens/product-detail.json](examples/screens/product-detail.json) | 商品詳細画面のUI定義サンプル |

---

## 設計の要点

1. **コンポーネントマニフェストを単一の情報源とします。** JSON Schema と、TypeScript型、Swift型、
   Kotlin型は、その1ファイルから生成します。エディタのパレットとインスペクタも同じです。
2. **レンダラは各プラットフォームのネイティブ実装です**（SwiftUI、Jetpack Compose、React）。
   プラットフォーム間で共有するのはコードではなく、仕様と適合性テストコーパスです。
3. **前方互換性を最優先します。** ケイパビリティネゴシエーションとノード単位のフォールバックは、
   言語仕様そのものに組み込みます。古いアプリバージョンが未知のコンポーネントを受け取っても、
   壊れません。

## リポジトリ構成（実装フェーズの想定）

```
spectre-ui/
├── docs/adr/                   # ADR（1決定1ディレクトリ、英語と日本語の両方）
├── roadmaps/                   # ロードマップ項目（1項目1ディレクトリ、英語と日本語の両方）
├── .agent-workflows/           # 共有のエージェント手順（.claude/skills がこれを読む）
├── spec/                       # 仕様の単一の情報源
│   ├── component-manifest.json #   コンポーネント定義
│   ├── tokens.json             #   デザイントークン
│   ├── schema/                 #   生成された JSON Schema
│   └── conformance/            #   適合性テストコーパス（全ランタイム共通）
├── packages/                   # TypeScript モノレポ（pnpm workspace）
│   ├── manifest/               #   マニフェストのローダと検証
│   ├── codegen/                #   TypeScript、Swift、Kotlin のコード生成
│   ├── core/                   #   式評価とパッチ適用の TypeScript 実装（エディタとサーバで共用）
│   ├── editor/                 #   React WYSIWYG エディタ
│   └── server/                 #   オーサリングAPI と配信サービス（Fastify）
├── clients/
│   ├── ios/                    # Swift パッケージ: SpectreUI
│   └── android/                # Gradle モジュール: spectre-ui
└── examples/
```
