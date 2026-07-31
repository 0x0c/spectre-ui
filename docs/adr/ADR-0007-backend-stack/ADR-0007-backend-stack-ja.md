[English](ADR-0007-backend-stack.md) · **日本語**

# ADR-0007 — バックエンドと配信の形

<!-- ADR-METADATA -->
| 項目 | 値 |
|---|---|
| 記録 | [ADR-0007](ADR-0007-backend-stack-ja.md) |
| 起草者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **承認** |
| 日付 | 2026-07-31 |
| トピック | 配信 |
| 関連 | [ADR-0003](../ADR-0003-ui-document-format/ADR-0003-ui-document-format-ja.md), [ADR-0005](../ADR-0005-editor-stack/ADR-0005-editor-stack-ja.md), [ADR-0006](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md), [SU-0004](../../../roadmaps/SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform-ja.md) |
<!-- /ADR-METADATA -->

## 文脈

エディタの背後には2つのサービスがあります。オーサリングAPI（Application Programming Interface、
アプリケーションプログラミングインタフェース）は下書きを保存し、検証し、公開し、監査ログを残します。
配信APIは、画面の現在のバージョンを求めるクライアントに応答します。どちらにも言語、データストア、
キャッシュのモデルが必要です。

この記録は、組織にこれと異なる方針が既にあるわけではない、という前提を置いています。この前提は未確認の
ものとして [`docs/roadmap.md`](../../roadmap.md) の未決事項に記載しています。

## 検討した選択肢

- **A. Node上の TypeScript。エディタとコードを共有する。**
- **B. Kotlin と Spring。Androidクライアントとコードを共有する。**
- **C. Go または Rust。配信のスループットを基準に選ぶ。**

## 決定

**案A**を採用します。Node 22 上の TypeScript と Fastify、`JSONB` 列を用いた PostgreSQL、オブジェクト
ストレージ、そしてCDN（Content Delivery Network、コンテンツ配信網）です。オーサリングAPIと配信APIは
同一のコードベースですが、デプロイの単位は分けます。

配信は次の形を取ります。

- 公開されたドキュメントは**イミュータブル**です。`/d/{documentId}/{versionId}` は内容アドレスであり、
  `Cache-Control: immutable` によって永久にキャッシュできます。
- クライアントが引くのは `/screens/{screenId}` です。現在の公開ポインタを解決し、`200` または `304` を
  返します。TTLは短く取り、`ETag`（Entity Tag、実体タグ）を併用します。
- **ロールバックはポインタの差し替えだけ**で、数秒で完了します。

## 根拠

エディタと言語を共有するということは、構文を共有するという話ではなく、マニフェスト由来の型、検証ロジック、
式評価器を共有するということです。サーバは、エディタが使うのとまさに同じコードでドキュメントを検証し、
プレビューを描画できます。これは、規則の実装が1つであるか、ドリフトする2つであるかの違いです。

ここでは言語の性能は決め手になりません。配信の仕事は、ドキュメントを引いて、申告されたケイパビリティに
合わせて整形することであり、CPUバウンドでもアルゴリズム的に面白くもないからです。スループットが論点に
なりかねない負荷は、CDNが吸収します。

案Bは、組織がJVM（Java Virtual Machine、Java仮想マシン）一色である場合には妥当な選択です。式評価器の共有を
手放す代わりに、Androidクライアントとの実装共有を得ます。その制約の下では筋の通った取引ですが、私たちの
制約の下ではそうではありません。案Cは、希少ではない唯一の軸を最適化しています。

## 代償

イミュータブルなドキュメントと可変のポインタという分け方が、ロールバックを高速にしています。同時にそれは、
上書きではなく公開されたすべてのバージョンを保存することを意味します。ストレージは公開のたびに単調に
増えますが、日次で数回の公開という規模なら、数秒で完了するロールバックのために払う価値のある費用です。

## 再検討のトリガー

組織がJVM一色であることが判明した場合、案Bの取引は符号が変わるので、言語の選択を見直します。配信の形は、
CDNの背後で計測した画面解決のレイテンシが、ネットワーク時間に支配されなくなった時点で見直します。

## 参考

- [ADR-0003 — UI定義のワイヤ形式](../ADR-0003-ui-document-format/ADR-0003-ui-document-format-ja.md) — 保存し配信する対象の形式です。
- [ADR-0005 — WYSIWYGエディタの技術スタック](../ADR-0005-editor-stack/ADR-0005-editor-stack-ja.md) — このバックエンドがコードを共有する相手です。
- [ADR-0006 — バージョニングと前方互換性](../ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md) — 配信APIが応答するネゴシエーションです。
- [SU-0004 — M3、オーサリングと配信の基盤](../../../roadmaps/SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform-ja.md) — 両サービスを作る作業です。
- [`docs/architecture.md`](../../architecture.md) — 構成要素とデータフローの全体像です。
