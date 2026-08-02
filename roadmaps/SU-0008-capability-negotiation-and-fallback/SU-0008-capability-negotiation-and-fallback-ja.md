[English](SU-0008-capability-negotiation-and-fallback.md) · **日本語**

# SU-0008 — ケイパビリティネゴシエーションとノード単位のフォールバック

<!-- SU-METADATA -->
| 項目 | 値 |
|---|---|
| 提案 | [SU-0008](SU-0008-capability-negotiation-and-fallback-ja.md) |
| 提案者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **進行中** |
| トピック | 互換性 |
| 関連 | [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md), [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform-ja.md), [SU-0005](../SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity-ja.md), [SU-0007](../SU-0007-conformance-corpus/SU-0007-conformance-corpus-ja.md) |
<!-- /SU-METADATA -->

## はじめに

この項目は、古いアプリを新しいドキュメントに対して動かし続けるための3層を実装します。ワイヤ上の
ケイパビリティネゴシエーション、ドキュメント言語におけるノード単位のフォールバック、そしてスキーマ進化を
加算のみに限る規則です。作業はクライアントSDK（Software Development Kit、ソフトウェア開発キット）、
配信サービス、エディタにまたがります。

## 動機

インストール済みのアプリは、全利用者に強制更新をかけない限り古いバージョンのまま残ります。したがって、
今日追加したコンポーネントを含むドキュメントは、半年前に作られたアプリへ届きます。そのときに何が起きるかが、
チームがこの仕組みを信頼するかどうかを決めます。クラッシュや真っ白な画面は採用を終わらせますし、黙って
省略されるだけでもほとんど同じくらい悪い結果です。しかもプラットフォームごとに挙動が違えば、作成時には
誰も予測できません。

劣化をドキュメント言語の一部にすることで、この結末が作成者の手に移ります。古いアプリで代わりに何を見せるかを
作成者が指定でき、エディタは公開前に、その画面が要求するバージョンの下限を警告できます。

## 詳細設計

1. **クライアントによるケイパビリティの申告。** SDKが、対応するスキーマバージョンと描画できる
   コンポーネント集合のハッシュをリクエストヘッダで送ります。
2. **サーバ側での木の整形。** 配信サービスが、申告されたケイパビリティに適合する木を返し、クライアントが
   描画できない部分を解決します。
3. **ノードの `fallback` と `optional` フィールド。** ドキュメントスキーマに規定し、両方のレンダラが
   これを尊重します。
4. **クライアントランタイムにおける決まった劣化の順序。** フォールバック、省略、プレースホルダの順で、
   クラッシュは決してしません。
5. **加算のみという進化の規則。** マニフェスト変更時に強制します。マイナーバージョンで許すのは
   プロパティの追加だけです。
6. **エディタの警告。** 編集中の画面が要求するバージョンの下限を示します。
7. **`compat/` のコーパスケース。** 各劣化経路をカバーし、両ランタイムが同一に劣化することを保証します。

## 検討した代替案

- **未知のノードの扱いを各クライアントの実装に委ねる。** 却下します。劣化が実装の詳細になり、同じ
  ドキュメントが iOS と Android で違う劣化をして、作成者はそのどちらも予測できません。
- **完全に理解できないドキュメントの描画を拒否する。** 却下します。加算的な変更のたびに、古いアプリで
  画面が真っ白になります。劣化した画面よりも悪い失敗です。

## 進捗

> 作業の進行に合わせて更新します。チェックリストは*詳細設計*の分解を写したもので、ログは何がいつ
> 変わったかを古い順に記録します。

- [x] 1. クライアントによるケイパビリティの申告
- [x] 2. サーバ側での木の整形
- [x] 3. ノードの `fallback` と `optional` フィールド
- [x] 4. プレースホルダ段階を含む、決まった劣化の順序
- [x] 5. 加算のみという進化の規則の CI 強制
- [ ] 6. エディタの警告
- [x] 7. `compat/` のコーパスケース

**ログ**

- 2026-08-02: 項目3, 4, 5, 7を実装しました。`fallback` と `optional` フィールドは両方の
  `Resolver` 実装ですでに尊重されていました。この変更が追加するのは、`fallback` のない必須ノードに
  対する第3の劣化段階 — 汎用プレースホルダです。ADR-0006 が定める決まった順序（フォールバック、
  省略、プレースホルダ）が、クラッシュせずに両プラットフォームで成り立つようになりました。
  `Model.kt`/`Model.swift` に `DegradedTo.PLACEHOLDER` と、マニフェストの名前空間と衝突しない
  合成型 `Spectre.UnsupportedComponent` を追加しました。`Resolver.kt`/`Resolver.swift` の
  `degrade()` はここへ落ちるようになり、あわせて `repeat` 要素の安定キーを fallback とプレースホルダの
  どちらの結果にも引き継ぐようにしました（関連する既存の未検証の隙間として、`repeat` 内で解決された
  `fallback` が要素のキーを失っていた点も一緒に直しています）。`SpectreNodeView`（Compose/SwiftUI）は
  警告アイコンつきの枠線ボックスとアクセシビリティラベルとして描画し、元の未知の `type` を
  `componentType` prop に積んで診断できるようにしました。`docs/compatibility.md` §3 は
  ADR-0006 の3段階の順序に合わせて書き直しました（以前は2段階しか説明しておらず、プレースホルダは
  デバッグビルド限定の余談として触れられているだけでした — この記述は、すでに承認済みの ADR から
  ずれていました）。項目5の加算のみ規則は、新しいスクリプト
  `packages/codegen/check-additive-evolution.mjs` が CI の `codegen` ジョブから強制します。
  `spec/component-manifest.json` を `origin/main` とのマージベースと比較し、マイナーの
  `schemaVersion` の増加でコンポーネント・プロパティ・アクション・列挙値の削除、`default` の変更、
  既存コンポーネントへの必須プロパティの追加のいずれかがあれば失敗させます。比較元の版が解決できない
  ときは「合格」ではなく「スキップ」にし、メジャーバージョンが変わったときは何もしません。項目7では
  `spec/conformance/compat/degradation.json`（各段階・再帰的な fallback・複数経路が混在する木・
  `repeat` との相互作用をカバーする8ケース）を追加し、`resolve/` ハーネスの単一ファイル読み込みではなく
  ディレクトリ内の全ファイルを汎用的に読むハーネスを両プラットフォームに追加しました
  （`ConformanceCompatTest.kt`、`ConformanceTests.swift` の `ConformanceCompatTests`）。
  既存の `resolve/resolver.json` にあった「`fallback` も `optional` もない」ケースは、
  この変更が正確に置き換える挙動だったため、プレースホルダを期待するよう更新しました。

  項目1と2は、後続の変更で実装しました。
  [SU-0002](../SU-0002-m1-client-sdks/SU-0002-m1-client-sdks-ja.md) の `DocumentLoader` と
  [SU-0004](../SU-0004-m3-delivery-platform/SU-0004-m3-delivery-platform-ja.md) の配信サービスが
  このブランチへ合流した後の対応です(上記の変更はどちらより前の時点にあり、それを見落としではなく
  実在の前提条件の欠落として明記していました)。`DocumentLoader.load()` は、コンストラクタの
  `supportedComponents` に対応する `SpectreCapabilities` の値
  (`GeneratedCatalog.SCHEMA_VERSION` / `GeneratedCatalog.capabilityHash()`) を毎リクエスト計算し、
  両プラットフォームで `SpectreDocumentTransport.fetch()` に渡すようになりました。ホスト側の
  transport 実装は、これを `Spectre-Schema` と `Spectre-Components` ヘッダとして転送します
  (`docs/compatibility.md` §2)。`packages/manifest` には `degradeDocumentTree()` を追加しました。
  ハッシュが現行マニフェストと一致すれば木を歩かずに済み、一致しなければ `Spectre-Schema` と
  各コンポーネントの `since` フィールドから保守的に見積もり、未対応ノードを
  (再帰的に解決した) `fallback` に差し替えるか、`optional` なら省略します。どちらも
  クライアント側 `Resolver.degrade()` の最初の2分岐をそのまま写したものです。第3の分岐
  (`fallback` のない必須ノード) はあえて手を付けていません — サーバが独自のプレースホルダを
  作ると実装が二重管理になるため、そこはクライアントの `Resolver` に最終防衛線として委ねます。
  `packages/server` の配信ルートは `GET /screens/:screenId` のたびにこれを呼び、申告された
  ケイパビリティを `ETag` に織り込みます。CDN が一方のクライアント向けに整形した応答を、別の
  クライアントへ誤って返さないようにするためです。項目6は依然としてブロックされたままです。
  バージョンの下限警告を出す場所となるエディタが、まだ存在しないからです
  ([SU-0003](../SU-0003-m2-wysiwyg-editor/SU-0003-m2-wysiwyg-editor-ja.md))。

## 参考

- [ADR-0006 — バージョニングと前方互換性](../../docs/adr/ADR-0006-versioning-and-forward-compatibility/ADR-0006-versioning-and-forward-compatibility-ja.md) — この項目が実装する決定です。
- [`docs/compatibility.md`](../../docs/compatibility-ja.md) — ロールバック戦略を含む仕組みの全体です。
- [SU-0007 — 適合性コーパス](../SU-0007-conformance-corpus/SU-0007-conformance-corpus-ja.md) — 両ランタイムを同じ劣化に縛る `compat/` のケースです。
- [SU-0005 — M4、運用の成熟](../SU-0005-m4-operational-maturity/SU-0005-m4-operational-maturity-ja.md) — このテレメトリの上に作る対応率フィードバックです。
