# Spectre UI

サーバードリブンUI (Server-Driven UI, SDUI) のためのクロスプラットフォームライブラリ。

サーバから配信された **UI定義ドキュメント (JSON)** を iOS / Android のネイティブSDKが解釈してレンダリングし、
ボタンタップなどの操作を宣言的な **アクション** として処理する。UI定義は Web の **WYSIWYGエディタ** から、
あらかじめ定義された **コンポーネントカタログ** の組み合わせで編集・公開できる。

!!! info "現在のフェーズ: 設計（実装コードなし）"
    このリポジトリには技術選定と仕様のドキュメント、ADR、ロードマップのみが含まれる。
    実装はまだ始まっていない。着手前に確認すべきことは
    [ロードマップと未決事項](roadmap.md) にまとめてある。

## 設計の要点

1. **コンポーネントマニフェストを単一の情報源**とし、JSON Schema / TypeScript型 / Swift型 / Kotlin型 /
   エディタのパレットとインスペクタをすべてそこから生成する。
2. **レンダラは各プラットフォームネイティブ**（SwiftUI / Jetpack Compose / React）。
   共有するのは「コード」ではなく「仕様 + 適合性テストコーパス」。
3. **前方互換性を最優先**。古いアプリバージョンが未知のコンポーネントを受け取っても壊れないよう、
   ケイパビリティネゴシエーションとノード単位のフォールバックを言語仕様に組み込む。

## どこから読むか

<div class="grid cards" markdown>

- **決定の経緯を知る**

    [技術選定](tech-selection.md) が索引、個々の決定は [ADR 一覧](adr/README-ja.md)。
    文脈・選択肢・決定・根拠・代償・再検討のトリガーの順で書かれている。

- **仕様を確認する**

    [スキーマ](spec/schema.md) / [コンポーネント](spec/components.md) /
    [式言語](spec/expression.md) / [アクション](spec/actions.md)。

- **何をいつ作るか**

    [ロードマップと未決事項](roadmap.md) で全体像を、
    [ロードマップ項目一覧](roadmaps/index.md) で個々の提案を見る。

- **一番の勘所**

    [互換性・配信戦略](compatibility.md)。SDUI が失敗するとき、原因はほぼここに集中する。

</div>

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [技術選定](tech-selection.md) | 前提として置いた制約と、決定の一覧（ADRへの索引） |
| [ADR 一覧](adr/README-ja.md) | 技術上の決定を1件1記録で残したもの（日英） |
| [アーキテクチャ](architecture.md) | 全体構成、コンポーネント構成、データフロー |
| [スキーマ仕様 v0.1](spec/schema.md) | UI定義ドキュメントのスキーマ |
| [コンポーネントカタログ v0.1](spec/components.md) | カタログとデザイントークン |
| [式言語 SpectreExpr](spec/expression.md) | 式とデータバインディング |
| [アクション仕様](spec/actions.md) | アクションとサーバ応答プロトコル |
| [エディタ設計](editor.md) | Web WYSIWYGエディタ |
| [互換性・配信戦略](compatibility.md) | バージョニング・前方互換・配信/ロールバック |
| [ロードマップと未決事項](roadmap.md) | マイルストーン、見積もり、未決事項、リスク |
| [ロードマップ項目一覧](roadmaps/index.md) | 個々の作業提案（日英、状態つき） |

英語版は各ページ冒頭の言語切り替えリンクから辿れる（ADR とロードマップ項目）。

## 成果物（設計サンプル）

リポジトリ上のファイル。

| ファイル | 内容 |
| --- | --- |
| [spec/component-manifest.json](../spec/component-manifest.json) | コンポーネントマニフェスト。全生成物の単一の情報源 |
| [spec/schema/document.schema.json](../spec/schema/document.schema.json) | ドキュメント用 JSON Schema（生成される想定の手書きサンプル） |
| [examples/screens/product-detail.json](../examples/screens/product-detail.json) | 商品詳細画面のUI定義サンプル |

## リポジトリ構成（実装フェーズの想定）

```
spectre-ui/
├── docs/                       # 設計ドキュメント
│   └── adr/                    #   アーキテクチャ決定記録 (1決定1ディレクトリ、日英)
├── roadmaps/                   # ロードマップ項目 (1項目1ディレクトリ、日英)
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
