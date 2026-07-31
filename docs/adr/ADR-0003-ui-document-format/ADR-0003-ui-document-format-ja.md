[English](ADR-0003-ui-document-format.md) · **日本語**

# ADR-0003 — UI定義のワイヤ形式

<!-- ADR-METADATA -->
| 項目 | 値 |
|---|---|
| 記録 | [ADR-0003](ADR-0003-ui-document-format-ja.md) |
| 起草者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **承認** |
| 日付 | 2026-07-31 |
| トピック | 仕様 |
| 関連 | [ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md), [ADR-0006](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md), [ADR-0007](../ADR-0007-backend-stack/ADR-0007-backend-stack-ja.md) |
<!-- /ADR-METADATA -->

## 文脈

UI定義ドキュメントは、サーバが配信し、クライアントで描画されるものです。同時に、WYSIWYG（What You
See Is What You Get、見たままが得られる）エディタが編集する対象でもあります。公開前のレビュー対象で
あり、本番で画面が崩れたときにエンジニアが最初に開くものでもあります。形式はこの4種類の読み手すべてに
応える必要があります。

想定規模が性能面の予算を決めます。数十〜数百画面、日次で数回の公開、そしてCDN（Content Delivery
Network、コンテンツ配信網）のキャッシュを介した配信です。ミリ秒単位の低レイテンシ配信が求められる問題では
ありません。

## 検討した選択肢

- **A. JSON と JSON Schema による検証。**
- **B. Protocol Buffers または FlatBuffers。**
- **C. 独自のテキストDSL（Domain-Specific Language、ドメイン固有言語）。**

## 決定

**案A、JSON** を採用します。ワイヤ上は gzip または brotli で圧縮し、JSON Schema draft 2020-12 で検証
します。スキーマ自体はコンポーネントマニフェストから生成します
（[ADR-0002](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md)）。

## 根拠

ドキュメントはエディタが直接操作する成果物なので、人間が読めて差分が取れることの価値が大きく効きます。
バージョン管理、レビュー、ロールバック、障害時に目で追うこと、そのすべてがこの性質に依存しており、
二進形式はそれらを一度に手放します。

その損失を正当化できるほど、サイズは制約になっていません。想定される1画面あたり5〜50KBという規模では、
CDNと brotli の下で、JSONと二進符号化の差は利用者が知覚するレイテンシに現れません。

案Bにはさらに、スキーマ進化が硬いという問題があります。これはSDUIの核心、すなわち見たことのない
フィールドを持つノードをクライアントがどう扱うかという問いと正面から衝突します
（[ADR-0006](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md)）。
案Cはエディタとの往復、つまりパース、編集、再シリアライズの過程でコメントや整形が壊れます。しかも最初の
画面を出す前から、3つのランタイム分のパーサを保守する立場に置かれます。

## 代償

二進符号化に比べてペイロードは大きくなります。その代わりに、誰でも読める形式を得ます。

サイズが本当に制約になった場合の逃げ道は残します。ドキュメントは `Content-Type` でネゴシエートします。
そのため `application/vnd.spectre.doc+json` に後から `application/vnd.spectre.doc+cbor` を並べられます。構造は
同一で符号化だけを差し替えるため、この道を採るために他の決定を開き直す必要はありません。

## 再検討のトリガー

実際の画面構成に対して計測した95パーセンタイルのドキュメント転送時間が、初回描画までの時間のうち無視
できない割合を占めるようになった時点で、二進符号化を追加します。単体のドキュメントが大きく見えるという
だけでは動きません。

## 参考

- [ADR-0002 — コンポーネントマニフェストを単一の情報源にする](../ADR-0002-component-manifest-single-source/ADR-0002-component-manifest-single-source-ja.md) — JSON Schema の生成元となるマニフェストです。
- [ADR-0006 — バージョニングと前方互換性](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md) — 案Bを退けたスキーマ進化の要件です。
- [ADR-0007 — バックエンドと配信の形](../ADR-0007-backend-stack/ADR-0007-backend-stack-ja.md) — ドキュメントをどうキャッシュし配信するかです。
- [`docs/spec/schema.md`](../../spec/schema.md) — ドキュメントスキーマそのものです。
