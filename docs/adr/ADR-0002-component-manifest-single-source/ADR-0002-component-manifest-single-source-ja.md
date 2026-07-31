[English](ADR-0002-component-manifest-single-source.md) · **日本語**

# ADR-0002 — コンポーネントマニフェストを単一の情報源にする

<!-- ADR-METADATA -->
| 項目 | 値 |
|---|---|
| 記録 | [ADR-0002](ADR-0002-component-manifest-single-source-ja.md) |
| 起草者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **承認** |
| 日付 | 2026-07-31 |
| トピック | 仕様 |
| 関連 | [ADR-0001](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy-ja.md), [ADR-0003](../ADR-0003-ui-document-format/ADR-0003-ui-document-format-ja.md), [ADR-0005](../ADR-0005-editor-stack/ADR-0005-editor-stack-ja.md), [SU-0006](../../../roadmaps/SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen-ja.md) |
<!-- /ADR-METADATA -->

## 文脈

同じコンポーネント定義が6箇所に現れます。ドキュメントを検証する JSON Schema、iOS の型、Android の型、
エディタのパレット、エディタのプロパティインスペクタ、そしてドキュメントです。手書きで6つの写しを
維持すれば、それらは必ずずれます。これはリスクではなく、確定した帰結です。あるコンポーネントに1箇所で
プロパティが増え、残りの5箇所は後から直されるか、直されないままになるからです。

## 検討した選択肢

- **A. 各所で手書きし、レビューで同期を守る。**
- **B. 型定義をどれか1つの言語（たとえば TypeScript）で書き、他を生成する。**
- **C. 言語中立の宣言的マニフェスト（JSON）を情報源とし、すべてを生成する。**

## 決定

**案C**を採用します。[`spec/component-manifest.json`](../../../spec/component-manifest.json) を情報源とし、
次のものを生成します。

```
spec/component-manifest.json
   ├─→ spec/schema/document.schema.json   （サーバとエディタでの検証）
   ├─→ packages/manifest/src/types.ts     （エディタとサーバの型）
   ├─→ clients/ios/.../Generated/*.swift  （Codable な型と列挙）
   ├─→ clients/android/.../generated/*.kt （kotlinx.serialization な型と列挙）
   ├─→ エディタのパレットとプロパティインスペクタ（実行時にマニフェストを読む）
   └─→ docs/spec/components.md
```

生成物はリポジトリにコミットし、生成し直しても差分が出ないことを継続的インテグレーションで検証します。

## 根拠

マニフェストは型情報だけを持つわけにはいきません。エディタ用のメタデータも持ちます。コンポーネントが
属するカテゴリ、アイコン、インスペクタの入力欄が使うウィジェットの種別、許可される子コンポーネント、
各プロパティの既定値です。これらを TypeScript の型システムで表現しきることはできないので、案Bでは
メタデータを別管理する羽目になります。それは6つの写しのうち1つに名前を付け替えただけで、元の問題が
そのまま残ります。

日々の運用でいちばん効くのは、インスペクタのフォームをマニフェストから実行時に生成することです。これに
より**コンポーネントを追加してもエディタのコードを一切書かずに済みます**。パレットの項目も、インスペクタの
入力欄も、検証も、すべてマニフェストの記述から従います。

生成は型とデコーダまでにとどめます。レンダラ本体は手書きのままです。描画コードまで生成できるだけの
表現力を生成器に持たせようとすると、レイアウト、アニメーション、アクセシビリティをモデル化することになり、
生成器のほうが保守の難所になってしまいます。

## 代償

マニフェスト自身のスキーマ、すなわちメタスキーマを設計し維持する必要が生じます。これは上位に生成器を
持たない唯一の成果物です。

生成コードをコミットするのは意図的な取引です。iOS と Android の開発者が Node のツールチェインなしで
ビルドできるようになる代わりに、継続的インテグレーションでの再生成チェックと、マニフェスト変更のたびに
差分がやや増えることを引き受けます。この取引は採ります。クライアントのリポジトリで日々作業する人にとって、
ツールチェイン不要のビルドのほうが重要だからです。

## 再検討のトリガー

再生成チェックがビルド失敗の常習的な原因になった場合、または生成物のツリーが大きくなり、その差分が
レビュー時に手書きの変更を埋もれさせるようになった場合、生成物をコミットする方針を見直します。

## 参考

- [ADR-0001 — クライアントのレンダリング方式](../ADR-0001-client-rendering-strategy/ADR-0001-client-rendering-strategy-ja.md) — この生成によって現実的になるネイティブ2実装の決定です。
- [ADR-0003 — UI定義のワイヤ形式](../ADR-0003-ui-document-format/ADR-0003-ui-document-format-ja.md) — ここで生成する JSON Schema が検証する形式です。
- [ADR-0005 — WYSIWYGエディタの技術スタック](../ADR-0005-editor-stack/ADR-0005-editor-stack-ja.md) — 実行時にマニフェストを読むエディタです。
- [SU-0006 — マニフェスト駆動のコード生成](../../../roadmaps/SU-0006-manifest-driven-codegen/SU-0006-manifest-driven-codegen-ja.md) — 生成器を作る作業です。
- [`docs/spec/components.md`](../../spec/components.md) — このマニフェストが記述するコンポーネントカタログです。
