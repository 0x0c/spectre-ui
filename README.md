# Spectre UI

サーバードリブンUI (Server-Driven UI, SDUI) のためのクロスプラットフォームライブラリ。

サーバから配信された **UI定義ドキュメント (JSON)** を iOS / Android のネイティブSDKが解釈してレンダリングし、
ボタンタップなどの操作を宣言的な **アクション** として処理する。UI定義は Web の **WYSIWYGエディタ** から、
あらかじめ定義された **コンポーネントカタログ** の組み合わせで編集・公開できる。

現在のフェーズ: **設計 (実装コードなし)**。本リポジトリには技術選定と仕様のドキュメントのみが含まれる。

---

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/tech-selection.md](docs/tech-selection.md) | 技術選定。ADR形式で各決定の選択肢・比較・結論 |
| [docs/architecture.md](docs/architecture.md) | 全体アーキテクチャ、コンポーネント構成、データフロー |
| [docs/spec/schema.md](docs/spec/schema.md) | UI定義ドキュメントのスキーマ仕様 v0.1 |
| [docs/spec/components.md](docs/spec/components.md) | コンポーネントカタログ v0.1 とデザイントークン |
| [docs/spec/expression.md](docs/spec/expression.md) | 式言語 SpectreExpr とデータバインディング |
| [docs/spec/actions.md](docs/spec/actions.md) | アクション仕様とサーバ応答プロトコル |
| [docs/editor.md](docs/editor.md) | Web WYSIWYGエディタの設計 |
| [docs/compatibility.md](docs/compatibility.md) | バージョニング・前方互換・配信/ロールバック戦略 |
| [docs/roadmap.md](docs/roadmap.md) | マイルストーンと未決事項 |

## 成果物 (設計サンプル)

| ファイル | 内容 |
| --- | --- |
| [spec/component-manifest.json](spec/component-manifest.json) | コンポーネントマニフェスト。全生成物の単一の情報源 |
| [spec/schema/document.schema.json](spec/schema/document.schema.json) | ドキュメント用 JSON Schema (マニフェストから生成される想定の手書きサンプル) |
| [examples/screens/product-detail.json](examples/screens/product-detail.json) | 商品詳細画面のUI定義サンプル |

---

## 設計の要点 (3行)

1. **コンポーネントマニフェストを単一の情報源**とし、JSON Schema / TypeScript型 / Swift型 / Kotlin型 / エディタのパレットとインスペクタをすべてそこから生成する。
2. **レンダラは各プラットフォームネイティブ** (SwiftUI / Jetpack Compose / React)。共有するのは「コード」ではなく「仕様 + 適合性テストコーパス」。
3. **前方互換性を最優先**。古いアプリバージョンが未知のコンポーネントを受け取っても壊れないよう、ケイパビリティネゴシエーションとノード単位のフォールバックを言語仕様に組み込む。

## リポジトリ構成 (実装フェーズの想定)

```
spectre-ui/
├── spec/                       # 仕様の単一の情報源
│   ├── component-manifest.json #   コンポーネント定義
│   ├── tokens.json             #   デザイントークン
│   ├── schema/                 #   生成された JSON Schema
│   └── conformance/            #   適合性テストコーパス (全ランタイム共通)
├── packages/                   # TypeScript モノレポ (pnpm workspace)
│   ├── manifest/               #   マニフェストのローダと検証
│   ├── codegen/                #   TS / Swift / Kotlin コード生成
│   ├── core/                   #   式評価・パッチ適用の TS 実装 (エディタ/サーバ共用)
│   ├── editor/                 #   React WYSIWYG エディタ
│   └── server/                 #   オーサリングAPI + 配信サービス (Fastify)
├── clients/
│   ├── ios/                    # Swift Package: SpectreUI
│   └── android/                # Gradle module: spectre-ui
└── examples/
```
