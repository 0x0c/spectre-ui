# 技術選定

技術上の決定は、1件につき1つの **ADR**（Architecture Decision Record、アーキテクチャ決定記録）として
[`docs/adr/`](adr/README-ja.md) 以下に日英両方で置いています。各記録は「文脈 → 検討した選択肢 → 決定 →
根拠 → 代償 → 再検討のトリガー」の順で書かれます。このページは、それらが共通して前提とする制約と、
選定結果の一覧を示す索引です。

## 前提として置いた制約

未確認のものは [roadmap.md](roadmap.md) の未決事項に再掲しています。

- ライブラリは**既存のホストアプリに組み込まれる**。バイナリサイズと依存の少なさは機能より優先度が高い。
- UIを編集するのは**エンジニアではない担当者**（企画・マーケ・CS）を想定する。したがってコンポーネントは
  閉じた集合で、自由なスタイリングは許さない。
- 対象は iOS / Android のネイティブアプリ。Web は**編集用インタフェース**であってレンダリング先ではない。
- 想定規模は数十〜数百画面、日次で数回の公開。ミリ秒単位の低レイテンシ配信ではなく、CDNキャッシュ前提でよい。

## 決定の一覧

| ID | 決定 | 要旨 |
| --- | --- | --- |
| [ADR-0001](adr/ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy-ja.md) | クライアントのレンダリング方式 | ネイティブ2実装。共有するのはコードではなく、仕様・生成された型・適合性コーパス |
| [ADR-0002](adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md) | コンポーネントマニフェストを単一の情報源にする | JSONのマニフェストから、スキーマ・各言語の型・エディタのパレットとインスペクタを生成する |
| [ADR-0003](adr/ADR-0003-ui-document-format/ADR-0003-ui-document-format-ja.md) | UI定義のワイヤ形式 | JSON と JSON Schema 2020-12。人が読めて差分が取れることを優先する |
| [ADR-0004](adr/ADR-0004-expression-language/ADR-0004-expression-language-ja.md) | 式言語とデータバインディング | 独自の `SpectreExpr`。意図的にチューリング完全にしない |
| [ADR-0005](adr/ADR-0005-editor-stack/ADR-0005-editor-stack-ja.md) | WYSIWYGエディタの技術スタック | React 19 + TypeScript + Vite。近似プレビューと実機ミラーの二段構え |
| [ADR-0006](adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md) | バージョニングと前方互換性 | ケイパビリティネゴシエーション、ノード単位のフォールバック、加算のみの進化 |
| [ADR-0007](adr/ADR-0007-backend-stack/ADR-0007-backend-stack-ja.md) | バックエンドと配信の形 | Node 22 + Fastify + PostgreSQL(JSONB) + S3 + CDN。ロールバックはポインタの差し替え |
| [ADR-0008](adr/ADR-0008-conformance-testing-strategy/ADR-0008-conformance-testing-strategy-ja.md) | 適合性テスト戦略 | 実装非依存のコーパスで3ランタイムの一致を機械的に保証する |

## 選定サマリ

| 領域 | 採用技術 |
| --- | --- |
| iOS SDK | Swift 6 / SwiftUI (iOS 16+), Swift Package Manager |
| Android SDK | Kotlin / Jetpack Compose (minSdk 24), Gradle |
| UI定義形式 | JSON + JSON Schema 2020-12 |
| 式言語 | 独自 `SpectreExpr` (非チューリング完全) |
| 単一の情報源 | `spec/component-manifest.json` + コード生成 |
| エディタ | React 19 + TypeScript + Vite + dnd-kit + Zustand/Immer |
| バックエンド | Node 22 + Fastify + PostgreSQL(JSONB) + S3 + CDN |
| 画像読み込み | iOS: Nuke / Android: Coil |
| 整合性担保 | 言語非依存の適合性コーパス + プラットフォーム内スナップショットテスト |

## 記録を追加・変更するには

採番の規則、書式、状態の値、そして置き換え（supersede）の手順は
[`docs/adr/README-ja.md`](adr/README-ja.md) にあります。承認済みの記録は書き換えず、新しい記録で
置き換えます。当時何を信じてそう決めたのかという記録を残すためです。
