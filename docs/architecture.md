# アーキテクチャ

## 1. 全体像

```
                        ┌──────────────────────────────────────┐
                        │  spec/component-manifest.json        │
                        │  spec/tokens.json                    │  単一の情報源
                        └───────────────┬──────────────────────┘
                                        │ codegen
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
      TS types + JSON Schema      Swift types              Kotlin types
              │                         │                         │
   ┌──────────┴──────────┐              │                         │
   ▼                     ▼              │                         │
┌────────────┐    ┌─────────────┐       │                         │
│ Editor     │    │ Server      │       │                         │
│ (React)    │◄──►│ (Fastify)   │       │                         │
│            │    │             │       │                         │
│ - canvas   │    │ - authoring │       │                         │
│ - inspector│    │ - delivery  │       │                         │
│ - preview  │    │ - validation│       │                         │
└─────┬──────┘    └──────┬──────┘       │                         │
      │                  │              │                         │
      │ WS (draft)       │ HTTPS + CDN  │                         │
      │                  ▼              ▼                         ▼
      │           ┌─────────────────────────────────────────────────┐
      └──────────►│         UI Document (JSON)                      │
                  └──────────────┬───────────────┬──────────────────┘
                                 ▼               ▼
                        ┌────────────────┐  ┌────────────────┐
                        │ SpectreUI iOS  │  │ SpectreUI      │
                        │ (SwiftUI)      │  │ Android        │
                        │                │  │ (Compose)      │
                        └───────┬────────┘  └───────┬────────┘
                                ▼                   ▼
                        ┌────────────────────────────────────┐
                        │  Host App (delegate / handlers)    │
                        │  認証・ナビゲーション・カスタム動作 │
                        └────────────────────────────────────┘
```

## 2. クライアントSDKの内部構成

iOS / Android で同じレイヤ構成をとる。名前も揃える（レビュー時に対応が追える）。

```
┌──────────────────────────────────────────────────────────────┐
│ Public API                                                   │
│   SpectreScreen(screenId:) / SpectreScreen(document:)        │
│   SpectreClient  … 設定・キャッシュ・デリゲート登録          │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│ Runtime                                                      │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ DocumentLoader│ │ Store      │  │ ActionDispatcher      │  │
│  │  fetch/cache │ │ state+data │  │  順次実行・副作用管理  │  │
│  └──────┬─────┘  └─────┬──────┘  └──────────┬─────────────┘  │
│         │              │                     │               │
│  ┌──────▼──────────────▼─────────────────────▼─────────────┐ │
│  │ Resolver                                                │ │
│  │   式評価 (SpectreExpr) / バインディング解決 /            │ │
│  │   visibleWhen 判定 / repeat 展開 / 互換性の劣化処理      │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ RenderTree  … 解決済みの純粋なノード木 (式を含まない)    │ │
│  └──────────────────────┬──────────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Renderer   ← ここだけがプラットフォーム固有                  │
│   SwiftUI View / Composable への写像。1コンポーネント1ファイル│
│   ThemeProvider (トークン → 実際の色・フォント)              │
└──────────────────────────────────────────────────────────────┘
```

### 各レイヤの責務

**DocumentLoader**
- `screenId` → HTTP GET。ETag / `If-None-Match` による条件付きリクエスト。
- 3層キャッシュ: メモリ (LRU) → ディスク → アプリ同梱のバンドル済みフォールバック。
- **stale-while-revalidate**: 期限切れキャッシュを即座に描画し、裏で更新して差し替える。初回以外は必ず即時描画になる。
- ネットワーク到達不能かつキャッシュなしのときに何を出すかはホストアプリが決める（デリゲート）。

**Store**
- 2つのスコープを持つ。`data`（サーバ提供、不変）と `state`（クライアント可変）。
- `state` の更新は必ず `setState` アクション経由。パスベース (`form.email`) の更新で、購読しているノードのみ再描画する。
- 画面のライフサイクルに紐づく。再取得時に `state` を保持するか破棄するかはドキュメント側の `statePolicy` で指定。

**ActionDispatcher**
- アクション列を**逐次**実行する。`request` の完了を待って `onSuccess` に進む。
- 実行中の多重発火を防ぐ（ボタン連打）。同一ノードからのアクションは前回完了までブロックする。
- ホストアプリのデリゲートに割り込み機会を与える: `shouldPerform(action) -> Bool` と `perform(hostAction)`。

**Resolver**
- 未解決ドキュメント（式を含む）+ Store → 解決済み RenderTree。
- ここで互換性の劣化処理（未知ノードのフォールバック）も行う。**Renderer は未知の型を見ることがない**。
- Store の変更に対して差分再解決する。フル再解決は初回のみ。

**Renderer**
- 解決済みノードを描画するだけ。分岐も式評価も持たない。ここを薄く保つことが、2プラットフォーム間のドリフト抑制に直結する。

## 3. データフロー

### 3.1 初回描画

```
Host App                SDK                        Server/CDN
   │                     │                             │
   ├─ SpectreScreen("product_detail", params) ────────►│
   │                     │                             │
   │                     ├─ cache lookup ──┐           │
   │                     │◄─ hit(stale) ───┘           │
   │                     │                             │
   │  ◄── 即時描画 (stale) ─┤                          │
   │                     ├─ GET /screens/product_detail│
   │                     │   Spectre-Capabilities: ... │
   │                     │   If-None-Match: "abc"      │
   │                     ├────────────────────────────►│
   │                     │◄──── 200 + document ────────┤
   │                     ├─ validate → Resolver        │
   │  ◄── 差し替え描画 ────┤                            │
```

`Spectre-Capabilities` の内容は [compatibility.md](compatibility.md) を参照。

### 3.2 操作 → アクション → 更新

```
 User taps Button
        │
        ▼
 ActionDispatcher.dispatch([
   {setState: state.submitting = true},
   {request: POST cart.add, body:{...}},
 ])
        │
        ├─ setState ──► Store ──► Resolver (差分) ──► 再描画 (ボタンがローディング表示に)
        │
        ├─ request ───► Host App の NetworkDelegate
        │                 (ベースURL・認証ヘッダ・エンドポイント名の解決はホスト責務)
        │                        │
        │                        ▼ HTTPS
        │                 ┌──────────────┐
        │                 │   API Server │
        │                 └──────┬───────┘
        │                        │ ActionResponse
        │                        ▼
        │   { state: {...}, patch: [...], actions: [{showToast}] }
        │                        │
        ├────────────────────────┘
        ├─ state をマージ
        ├─ patch をドキュメントに適用 (部分更新)
        ├─ actions を逐次実行 → トースト表示
        ▼
    Resolver (差分) ──► 再描画
```

**エンドポイントの間接参照**: ドキュメントには絶対URLを書かず論理名 (`cart.add`) を書く。実URL・認証・ヘッダの付与はホストアプリが解決する。理由は3つ。

1. ドキュメントはCDNにキャッシュされる公開物であり、内部URLやトークンを含めてはならない。
2. 環境（dev/stg/prod）ごとにドキュメントを作り分けずに済む。
3. ホストアプリが既存のネットワーク層（認証・リトライ・証明書ピンニング）をそのまま使える。

## 4. サーバ側の構成

```
┌────────────────── Authoring Plane ──────────────────┐
│  Fastify (認証あり、社内向け)                        │
│                                                     │
│   POST /api/documents            下書き作成          │
│   PUT  /api/documents/:id        下書き更新 (楽観ロック) │
│   POST /api/documents/:id/validate  スキーマ+リント   │
│   POST /api/documents/:id/publish   公開            │
│   POST /api/documents/:id/rollback  ロールバック     │
│   WS   /api/preview/:sessionId   実機ミラー中継      │
│                                                     │
│   PostgreSQL: documents, document_versions,         │
│               releases, audit_log                   │
└─────────────────────────────────────────────────────┘
                        │ publish (immutable write)
                        ▼
┌────────────────── Delivery Plane ───────────────────┐
│  Fastify (公開、CDN背後)                             │
│                                                     │
│   GET /screens/:screenId    現在の公開版を解決       │
│        → 200 + document | 304                       │
│   GET /d/:documentId/:versionId   イミュータブル      │
│        → Cache-Control: public, max-age=31536000,   │
│          immutable                                  │
│   GET /manifest/:schemaVersion  クライアント検証用    │
└─────────────────────────────────────────────────────┘
```

**プレーンを分ける理由**: 配信系はステートレスかつ読み取り専用で、CDN前提でスケールする。オーサリング系はDB書き込みと認証を伴い、可用性要求も規模も違う。障害の切り分けとデプロイ頻度も別。

### データモデル (概略)

```sql
documents          (id, screen_id, name, current_draft_version, created_by, ...)
document_versions  (id, document_id, seq, body jsonb, checksum, author, created_at)
                   -- body は不変。更新は常に新しい行
releases           (id, document_id, version_id, channel, rollout_percent,
                    targeting jsonb, published_at, published_by, superseded_by)
audit_log          (id, actor, action, document_id, version_id, diff jsonb, at)
```

`releases` に `channel`（internal / canary / production）と `rollout_percent`、`targeting`（アプリバージョン範囲、プラットフォーム、ユーザセグメント）を持たせ、段階公開とA/Bを同じ仕組みで扱う。

## 5. スレッドと性能

| 処理 | 実行場所 |
| --- | --- |
| ネットワーク・ディスクI/O | バックグラウンド |
| JSONデコード・スキーマ検証 | バックグラウンド |
| Resolver の初回全解決 | バックグラウンド |
| Resolver の差分解決 | メインスレッド可（ノード単位で軽量） |
| 描画 | メイン |

**保護のための上限値**（超過時はドキュメントを拒否し、キャッシュ済みの旧版かホスト提供のフォールバックを出す）:

| 項目 | 上限 |
| --- | --- |
| ノード総数 | 2,000 |
| 木の深さ | 32 |
| ドキュメントサイズ (非圧縮) | 1 MB |
| 1式あたりのASTノード数 | 256 |
| `repeat` の展開件数 | 500 (超過分は切り捨て、テレメトリに記録) |

同じ上限をオーサリング時の検証にも適用し、公開できないものが端末に届かないようにする。

リスト系コンポーネントは必ず遅延描画にマップする（`LazyVStack` / `LazyColumn`）。安定した `id` を持つノードのみ差分描画の対象とし、`id` のないノードは親ごと再構築される。**エディタは全ノードに安定IDを自動採番する**。

## 6. ホストアプリとの統合点

SDKがホストアプリに要求するのは以下だけ。これ以上増やさない。

```swift
protocol SpectreHostDelegate {
    // 論理エンドポイント名 → 実リクエスト。認証ヘッダの付与もここ。
    func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse

    // ドキュメントで表現できない画面遷移。既存のルーティングに委ねる。
    func navigate(to destination: SpectreDestination) -> Bool

    // `host` アクション（共有シート、決済、カメラ等）の実行
    func performHostAction(name: String, params: [String: SpectreValue]) async throws -> SpectreValue?

    // 計測イベントの転送先
    func track(event: String, properties: [String: SpectreValue])

    // 読み込み失敗時の代替表示
    func fallbackView(for screenId: String, error: SpectreError) -> AnyView?
}
```

Android 側も同一シグネチャの `SpectreHostDelegate` インタフェースを持つ。

**テーマ**: SDKはトークン名しか知らない。トークン → 実際の色/フォント/角丸の対応はホストアプリが `SpectreTheme` として注入する。これにより、ホストアプリのデザインシステムにそのまま馴染み、ダークモードやフォントスケーリングもホスト側の仕組みに乗る。

## 7. セキュリティ設計

| 脅威 | 対策 |
| --- | --- |
| サーバ侵害による任意コード実行 | 式言語が非チューリング完全でコード実行機構を持たない (ADR-0004)。JSランタイムを積まない |
| 悪意あるドキュメントによるクライアントDoS | §5 の上限値をクライアント側でも強制。超過はドキュメント拒否 |
| フィッシング (`openUrl`) | URLスキームとホストのアロウリストをホストアプリが設定。外部ドメインは明示的な確認ダイアログを既定とする |
| 意図しないAPI呼び出し | `request` は論理エンドポイント名のみ。ホストアプリが登録した名前以外は実行不可 |
| 資格情報の漏洩 | ドキュメントはCDNキャッシュされる公開物として扱う。秘匿値を入れない。オーサリングAPI側のリントで検出 |
| 画像経由の情報漏洩・トラッキング | 画像ホストのアロウリスト |
| 不正なドキュメントの混入 | 公開版はチェックサム付き。ホストアプリの設定で署名検証（Ed25519）を有効化できる |
| オーサリング権限の濫用 | 公開操作は監査ログに全件記録。本番チャネルへの公開は承認必須（2名体制）を設定可能 |

## 8. 可観測性

クライアントSDKが `track` デリゲート経由でホストの計測基盤に流すもの:

- `spectre.document.loaded` (screenId, versionId, source=network|cache|bundle, ms)
- `spectre.document.rejected` (screenId, reason)
- `spectre.node.unknown` (screenId, versionId, nodeType, degradedTo) ← **互換性の実測値。最重要**
- `spectre.expr.error` (screenId, nodeId, code)
- `spectre.action.performed` / `spectre.action.failed`
- `spectre.render.ms` (screenId, nodeCount)

`spectre.node.unknown` を集計することで「このコンポーネントを使うと現在のユーザの何%で劣化するか」が実測でき、エディタ上で編集者に警告として出せる。これが前方互換戦略を運用可能にする鍵になる。
