[English](SU-0006-manifest-driven-codegen.md) · **日本語**

# SU-0006 — マニフェスト駆動のコード生成

<!-- SU-METADATA -->
| 項目 | 値 |
|---|---|
| 提案 | [SU-0006](SU-0006-manifest-driven-codegen-ja.md) |
| 提案者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **提案** |
| トピック | ツール |
| 関連 | [SU-0001](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze-ja.md), [SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor-ja.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus-ja.md) |
<!-- /SU-METADATA -->

## はじめに

この項目は、`spec/component-manifest.json` から派生物を生成する生成器を作ります。検証に使う JSON Schema、
エディタとサーバが使う TypeScript の型、クライアントSDK（Software Development Kit、ソフトウェア開発
キット）が使う Swift と Kotlin の型、そしてコンポーネントのドキュメントです。エディタのパレットと
プロパティインスペクタはファイルとしては生成せず、実行時にマニフェストを読みます。

## 動機

そうしなければ、1つのコンポーネント定義が同時に6箇所に現れます。スキーマ、2種類のクライアントの型、
パレット、インスペクタ、ドキュメントです。手で維持された写しは、そのうち1つが変わった瞬間から離れて
いきます。

生成は、このドリフトを「レビュアーが捕まえるべきもの」から「起こり得ないもの」へ変えます。同時に、
エディタ側のコンポーネントごとの費用も取り除きます。インスペクタはマニフェストのメタデータから実行時に
描画されるので、**コンポーネントを追加してもエディタのコードは不要**であり、これがカタログを安く育てられる
理由です。

## 詳細設計

1. **マニフェストのメタスキーマ。** コンポーネントの記述が何を宣言できるかを定めます。プロパティとその型、
   許可される子、既定値、そしてエディタ用メタデータ（カテゴリ、アイコン、インスペクタのウィジェット種別）です。
2. **マニフェストのローダと検証器。** `packages/manifest` に置き、生成器とサーバの双方が使います。
3. **生成器。** `packages/codegen` に置き、1つのマニフェストから JSON Schema、TypeScript、Swift の
   `Codable` な型、Kotlin の `kotlinx.serialization` な型を出力します。
4. **ドキュメント生成。** コンポーネントカタログのページを生成します。
5. **継続的インテグレーションでの再生成チェック。** すべての生成物を作り直し、コミットされている内容と
   異なれば失敗させます。

生成物はリポジトリにコミットします。iOS と Android の開発者が Node のツールチェインなしでビルドできる
ようにするためです。

## 検討した代替案

- **定義を TypeScript で書き、その型から他の言語を生成する。**
  [ADR-0002](../../docs/adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md)
  で却下済みです。エディタ用メタデータは型システムでは表現できず、別管理になります。名前を変えただけの
  元の問題です。
- **生成物をコミットせず、ビルド時に生成する。** 却下します。すべてのクライアントビルドのクリティカル
  パスに Node のツールチェインが乗ることになり、その利益を最も受けない人たちが日々その費用を払います。

## 進捗

> 作業の進行に合わせて更新します。チェックリストは*詳細設計*の分解を写したもので、ログは何がいつ
> 変わったかを古い順に記録します。

- [ ] 未着手

**ログ**

- 作業は未着手です。リポジトリは設計フェーズにあります。

## 参考

- [ADR-0002 — コンポーネントマニフェストを単一の情報源にする](../../docs/adr/ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md) — この項目が実装する決定です。
- [`spec/component-manifest.json`](../../spec/component-manifest.json) — マニフェストそのものです。
- [`spec/schema/document.schema.json`](../../spec/schema/document.schema.json) — 生成器が出力する内容の、手書きのサンプルです。
- [SU-0001 — M0、仕様の凍結](../SU-0001-m0-specification-freeze/SU-0001-m0-specification-freeze-ja.md) — この生成器が動いている必要があるマイルストーンです。
