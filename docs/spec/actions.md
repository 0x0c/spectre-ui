# アクション仕様 v0.1

ユーザ操作や画面ライフサイクルに対する反応を宣言的に表現する。

## 1. 基本形

アクションは**配列**で書き、**上から順に逐次実行**される。非同期アクション（`request`）は完了を待つ。

```jsonc
{
  "type": "Button",
  "id": "add_to_cart",
  "props": {
    "label": "カートに追加",
    "onTap": [
      { "type": "setState", "path": "adding", "value": true },
      { "type": "request",
        "endpoint": "cart.add",
        "method": "POST",
        "body": { "productId": "${data.product.id}", "qty": "${state.qty}" },
        "onSuccess": [
          { "type": "showOverlay", "id": "added_toast" },
          { "type": "track", "event": "cart_add", "properties": { "sku": "${data.product.id}" } }
        ],
        "onError": [
          { "type": "showOverlay", "id": "error_alert" }
        ]
      },
      { "type": "setState", "path": "adding", "value": false }
    ]
  }
}
```

途中のアクションが失敗した場合、既定では**残りを中止する**（`request` の `onError` は実行される）。`"continueOnError": true` で継続できる。

## 2. アクション一覧

### `setState`
```jsonc
{ "type": "setState", "path": "form.email", "value": "${...}" }
{ "type": "setState", "path": "qty", "value": "${state.qty + 1}" }
{ "type": "setState", "patch": { "form.email": "", "form.name": "" } }  // 複数同時
```
`path` は `state` からの相対パス。`data` は書き換えられない。

### `toggleState`
```jsonc
{ "type": "toggleState", "path": "expanded" }
```
boolean の反転。頻出するので専用アクションにする。

### `request`
```jsonc
{
  "type": "request",
  "endpoint": "cart.add",        // 論理名。絶対URLは禁止
  "method": "POST",              // GET|POST|PUT|PATCH|DELETE
  "pathParams": { "id": "${data.product.id}" },
  "query":      { "lang": "${env.locale}" },
  "body":       { ... },         // 式で組み立て可
  "loadingPath": "loading.cart", // 実行中 true になる state パス（省略可）
  "timeoutMs": 10000,
  "idempotencyKey": "${data.product.id}",  // 重複送信の抑止
  "onSuccess": [ ...Action... ],
  "onError":   [ ...Action... ]
}
```

**エンドポイントは論理名のみ**。実URL・ベースURL・認証ヘッダ・リトライ・証明書ピンニングはホストアプリの `SpectreHostDelegate.performRequest` が担う。理由は [architecture.md](../architecture.md) §3.2。

ホストアプリが登録していない `endpoint` は実行されず `onError` に落ちる。

### `navigate`
```jsonc
{ "type": "navigate", "mode": "push",    "screen": "product_detail",
  "params": { "id": "${item.id}" } }
{ "type": "navigate", "mode": "present", "screen": "checkout" }
{ "type": "navigate", "mode": "replace", "screen": "home" }
{ "type": "navigate", "mode": "route",   "route": "app://orders/${data.orderId}" }
```

`mode: route` はホストアプリ既存のルーティングに委譲する（SDUI画面でない先へ飛ぶため）。`SpectreHostDelegate.navigate` が `false` を返した場合は何も起きず、テレメトリに記録される。

### `back` / `dismiss`
```jsonc
{ "type": "back" }
{ "type": "dismiss" }          // モーダル/シートを閉じる
{ "type": "dismissOverlay", "id": "size_picker" }
```

### `showOverlay`
```jsonc
{ "type": "showOverlay", "id": "size_picker" }
```
`overlays` に定義されたシート/アラート/トーストを開く（[schema.md](schema.md) §3）。

### `openUrl`
```jsonc
{ "type": "openUrl", "url": "https://example.com/help", "mode": "inApp" }
```
`mode`: `inApp`（SFSafariViewController / Custom Tabs）| `external`。
ホストアプリが設定したドメインアロウリストで検証される。リスト外は実行されず警告としてテレメトリに残る。

### `refresh`
```jsonc
{ "type": "refresh", "preserveState": true }
```
現在の画面ドキュメントを再取得する。

### `applyPatch`
```jsonc
{ "type": "applyPatch", "patch": [ { "op": "replace", "path": "/root/children/2/props/text", "value": "..." } ] }
```
ドキュメントの部分更新。主にサーバ応答から使う（§3）。

### `host`
```jsonc
{ "type": "host", "name": "share",
  "params": { "url": "${data.product.url}", "text": "${data.product.name}" },
  "resultPath": "shareResult",     // 戻り値を state に書く（省略可）
  "onSuccess": [ ... ], "onError": [ ... ] }
```
**エスケープハッチ**。共有シート、決済、カメラ、生体認証など、SDUIで表現すべきでない機能をホストアプリに委譲する。
ホストが登録していない `name` は実行されない。この仕組みがあることで、コンポーネントカタログを小さく保てる。

### `track`
```jsonc
{ "type": "track", "event": "cart_add", "properties": { "sku": "${data.product.id}" } }
```

### `sequence` / `condition` / `delay`
```jsonc
{ "type": "condition", "if": "${state.agreed}",
  "then": [ ... ], "else": [ { "type": "showOverlay", "id": "need_consent" } ] }

{ "type": "delay", "ms": 300 }
```
`sequence` は入れ子のグルーピング用（`condition` の分岐内で複数書くときなど）。

### `focus` / `scrollTo`
```jsonc
{ "type": "focus", "nodeId": "email_field" }
{ "type": "scrollTo", "nodeId": "reviews", "animated": true }
```

## 3. サーバ応答プロトコル

`request` の応答は以下の形をとる（HTTP 2xx の場合）。

```jsonc
{
  "data":   { ... },              // data スコープにマージ（浅いマージ）
  "state":  { ... },              // state スコープにマージ
  "patch":  [ ...JSON Patch... ], // ドキュメント木の部分更新 (RFC 6902)
  "screen": { ...Document... },   // 画面全体の差し替え
  "actions":[ ...Action... ]      // 続けて実行するアクション
}
```

すべて任意。適用順は `screen` → `data` → `state` → `patch` → `actions`。

**使い分け**:

| 応答の形 | 使う場面 |
| --- | --- |
| `data` のみ | 一覧の追記、カウンタ更新など、木の構造が変わらない |
| `patch` | 一部のノードを差し替える（フォームのエラー表示など） |
| `screen` | 画面の意味が変わる（ステップの進行、状態遷移） |
| `actions` | 遷移・トースト・トラッキングなどの副作用 |

`patch` はサイズが小さい代わりに、木の構造（配列インデックス）に依存して壊れやすい。
**JSON Pointer にインデックスではなくノードIDを使う独自パス形式**を併用する:

```jsonc
{ "op": "replace", "path": "#email_field/props/errorText", "value": "形式が正しくありません" }
{ "op": "replace", "path": "#submit_btn/props/enabled",    "value": false }
```

`#nodeId` 起点のパスは構造変更に強い。標準の `/root/children/2` 形式もサポートするが、**エディタとサーバSDKは `#nodeId` 形式を生成する**。

### エラー応答

HTTP 4xx/5xx、またはボディに `error` を含む場合は `onError` へ。

```jsonc
{ "error": { "code": "OUT_OF_STOCK", "message": "在庫がありません", "fields": { "qty": "..." } } }
```

`onError` 内では `${error.code}` / `${error.message}` / `${error.fields.qty}` を参照できる。

## 4. 実行時の保証

| 項目 | 挙動 |
| --- | --- |
| 多重発火 | 同一ノードのアクション列は前回完了までブロック。ボタン連打で二重送信されない |
| 画面離脱 | 実行中の `request` はキャンセルされ、後続アクションは破棄される |
| `idempotencyKey` | ホストアプリに渡され、リトライ時の重複実行を防ぐのに使える |
| ホストの割り込み | `SpectreHostDelegate.shouldPerform(action)` が `false` を返すとその時点で中止 |
| 未知のアクション種別 | 無視して次へ進む + `spectre.action.unknown` を記録。**クラッシュしない** |
| ネストの深さ | `condition`/`sequence` の入れ子は8段まで |
| 総アクション数 | 1回のディスパッチで64個まで |

## 5. 設計上の注記

- **アクションはチューリング完全にしない**。ループがなく、`condition` の入れ子に上限があるため、1回のディスパッチは有限で終わる。無限ループするドキュメントを作れない。
- **ビジネスロジックはサーバに置く**。クライアント側のアクションは「表示状態を変える」「サーバを呼ぶ」「ホストに委譲する」の3つに限定するのが健全な使い方。複雑な条件分岐がドキュメントに現れ始めたら設計を疑うべきで、エディタは `condition` のネストが3段を超えたら情報レベルの警告を出す。
- **未知のアクションを無視する**のは前方互換性のため。新しいアクション種別を追加しても古いクライアントは黙って飛ばす。ただし「飛ばすと壊れる」場合があるので、必須のアクションには `"required": true` を付けられる（古いクライアントは代わりに `fallbackActions` を実行する）。
