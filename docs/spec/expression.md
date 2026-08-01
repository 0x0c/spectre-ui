# SpectreExpr — 式言語仕様 v0.1

ドキュメント内の動的な値を表現するための小さな式言語。
**設計目標は表現力ではなく、安全性・停止性・3実装の一致・エディタでの静的検証**。

## 1. 埋め込み方

文字列プロパティの中で `${ ... }` として書く。

```jsonc
"text": "${data.user.name}さん、こんにちは"      // 補間 → 文字列
"text": "残り${data.stock}点"                     // 補間 → 文字列
"visibleWhen": "${data.stock < 10}"               // 全体が式 → boolean
"enabled": "${state.agreed && state.email != ''}" // 全体が式 → boolean
"value": "${data.price}"                          // 全体が式 → number（型が保存される）
```

**規則**: 文字列全体がちょうど1つの `${...}` で構成される場合、評価結果の**型がそのまま保存される**（number / boolean / array / object / null）。それ以外は文字列補間として全体を文字列化する。

リテラルの `${` を書きたい場合は `$${` とエスケープする。

### 文字列化の規則

補間で値を文字列に変換するときの対応。3実装で完全に一致させる必要があるため、ここで規定する。

| 値 | 文字列化 |
| --- | --- |
| `null` | `""`（空文字）。`"在庫: ${data.stock}"` で stock が欠けたとき `"在庫: null"` と出るより害が小さい |
| boolean | `"true"` / `"false"` |
| number | 整数値は小数部を落とす（`1280.0` → `"1280"`、`0.25` → `"0.25"`） |
| string | そのまま |
| array | JSON 表記（`[1,2]`） |
| object | JSON 表記。**キーは辞書順に固定する** |

オブジェクトのキーを辞書順にするのは、Swift の `Dictionary` が順序を持たないため。
挿入順に依存させると iOS と Android で出力が食い違い、しかもテストで気づきにくい。

## 2. スコープ

| 名前 | 可変 | 内容 |
| --- | --- | --- |
| `data` | 不変 | サーバが提供したデータ |
| `state` | 可変 | クライアント状態。`setState` で書き換え |
| `item` / `index` | 不変 | `repeat` の内側でのみ有効（名前は `as`/`indexAs` で変更可） |
| `env` | 不変 | 実行環境 |

### `env` の内容

```jsonc
{
  "platform": "ios",             // ios | android
  "appVersion": "3.14.0",
  "osVersion": "18.2",
  "locale": "ja-JP",
  "timeZone": "Asia/Tokyo",
  "theme": "dark",               // light | dark
  "widthClass": "compact",       // compact | regular | expanded
  "fontScale": 1.0,
  "isOnline": true
}
```

`env` を式から読めるようにすることで、「タブレットだけ2カラム」「特定バージョン以上でのみ表示」をドキュメント側で表現できる。

## 3. 文法

```ebnf
expr        = ternary ;
ternary     = or [ "?" expr ":" expr ] ;
or          = and { "||" and } ;
and         = equality { "&&" equality } ;
equality    = comparison { ( "==" | "!=" ) comparison } ;
comparison  = additive { ( "<" | "<=" | ">" | ">=" ) additive } ;
additive    = multiplicative { ( "+" | "-" ) multiplicative } ;
multiplicative = unary { ( "*" | "/" | "%" ) unary } ;
unary       = [ "!" | "-" ] postfix ;
postfix     = primary { "." IDENT | "[" expr "]" | "(" [ args ] ")" | "?." IDENT } ;
primary     = NUMBER | STRING | "true" | "false" | "null"
            | IDENT | "(" expr ")" | array | object ;
array       = "[" [ expr { "," expr } ] "]" ;
object      = "{" [ STRING ":" expr { "," STRING ":" expr } ] "}" ;
args        = expr { "," expr } ;
```

**含まれないもの（意図的）**: 代入、ループ、ラムダ、関数定義、再帰、`import`、正規表現リテラル、ビット演算。
これにより任意の式は AST のサイズに比例した有限時間で評価が終わることが構文上保証される。

### 演算子の意味

- `+` は number 同士なら加算、いずれかが string なら連結。それ以外はエラー。
- `==` / `!=` は**型変換をしない**厳密比較。`1 == "1"` は `false`。
- `/` は 0除算で `null` を返す（例外にしない）。
- `?.` は null 安全アクセス。`data.a?.b` は `data.a` が null なら `null`。
- 存在しないプロパティへのアクセスは `null` を返す（エラーにしない）。ただしエディタは `expr/unknown-path` として警告する。

### 真値判定

`visibleWhen` などが boolean を要求する箇所での真値判定:

| 値 | 判定 |
| --- | --- |
| `true` | 真 |
| `false`, `null` | 偽 |
| number | `0` と `NaN` が偽、それ以外は真 |
| string | 空文字が偽、それ以外は真 |
| array / object | 空が偽、要素があれば真 |

## 4. 組み込み関数

ホワイトリストのみ。ユーザ定義は不可。

### 文字列
| 関数 | 説明 |
| --- | --- |
| `len(v)` | 文字列/配列/オブジェクトの長さ |
| `upper(s)` / `lower(s)` / `trim(s)` | |
| `contains(s, sub)` / `startsWith(s, p)` / `endsWith(s, p)` | 配列にも適用可 |
| `join(arr, sep)` | |
| `slice(v, start, end?)` | 文字列・配列 |
| `replace(s, from, to)` | 部分文字列置換（正規表現なし） |
| `split(s, sep)` | |

### 数値
| 関数 | 説明 |
| --- | --- |
| `min(a, b)` / `max(a, b)` / `abs(n)` | |
| `round(n, digits?)` / `floor(n)` / `ceil(n)` | |
| `toNumber(v)` / `toString(v)` | 変換失敗は `null` |
| `sum(arr)` | 数値配列の合計 |

### 書式（ロケール依存 — 各プラットフォームのネイティブAPIに委譲）
| 関数 | 説明 |
| --- | --- |
| `formatNumber(n, opts?)` | `{minFractionDigits, maxFractionDigits, grouping}` |
| `formatCurrency(n, code)` | `formatCurrency(1280, 'JPY')` → `¥1,280` |
| `formatPercent(n, digits?)` | |
| `formatDate(iso, style)` | style: `short`\|`medium`\|`long`\|`relative` |
| `plural(n, forms)` | `plural(n, {one:'${n}件', other:'${n}件'})` |

> **注意**: 書式系の結果は `env.locale` と OS の設定に依存するため、適合性コーパスでは `locale` を固定した上で期待値を持つ。ロケール依存の差異はコーパスの対象外とし、各プラットフォームのネイティブフォーマッタに委ねる。

### 論理・コレクション
| 関数 | 説明 |
| --- | --- |
| `if(cond, a, b)` | 三項演算子の関数形 |
| `coalesce(a, b, ...)` | 最初の非null |
| `default(v, fallback)` | v が null/空 なら fallback |
| `has(obj, key)` | |
| `get(obj, path, default?)` | `get(data, 'a.b.c', 0)` |
| `first(arr)` / `last(arr)` | |
| `count(arr)` | `len` の別名 |
| `indexOf(arr, v)` | |

### 環境
| 関数 | 説明 |
| --- | --- |
| `versionAtLeast(v)` | `env.appVersion >= v` のセマンティックバージョン比較 |
| `isPlatform(p)` | |

**`map` / `filter` / `reduce` は入れない**。ラムダが必要になり、言語が一気に大きくなる。配列の加工が必要な場合は**サーバ側で加工して `data` に入れる**のが正しい。

## 5. エラー処理

式の評価は**例外を投げない**。エラーは値 `null` + テレメトリイベントとして扱う。

| コード | 状況 | 結果 |
| --- | --- | --- |
| `E_PARSE` | 構文エラー | `null`。ドキュメント検証時に検出されるべき |
| `E_TYPE` | 型不一致（`"a" - 1` など） | `null` |
| `E_UNKNOWN_FN` | 未知の関数（新しいスキーマバージョンの関数） | `null` |
| `E_DEPTH` | AST深度・ノード数の上限超過 | `null`。検証時に拒否 |

「壊れた式で画面が真っ白になる」より「その部分だけ空になる」ほうがよい、という判断。ただしエディタとサーバの検証では `E_PARSE` / `E_DEPTH` を**公開ブロッキングのエラー**とする。

## 6. 実装上の要件

- **パーサは3実装（Swift / Kotlin / TypeScript）**。再帰下降。
- **AST はキャッシュする**。同じ式文字列を再パースしない。ドキュメント読み込み時に全式をプリコンパイルし、パースエラーを一括検出する。
- **依存パスを静的に抽出する**。`${state.form.email}` から `state.form.email` への依存を取り出し、Store の該当パスが変わったノードだけを再解決する。これが差分描画の基盤になる。
- AST ノード数の上限 256。深度の上限 32。

## 7. 適合性コーパスの形式

`spec/conformance/expr/*.json`:

```jsonc
{
  "name": "string interpolation preserves type when whole",
  "scope": {
    "data": { "price": 1280 },
    "state": {},
    "env": { "locale": "ja-JP", "platform": "ios" }
  },
  "cases": [
    { "expr": "${data.price}",              "expect": 1280 },
    { "expr": "価格: ${data.price}円",       "expect": "価格: 1280円" },
    { "expr": "${formatCurrency(data.price, 'JPY')}", "expect": "¥1,280" },
    { "expr": "${data.missing.deep}",       "expect": null },
    { "expr": "${1 == '1'}",                "expect": false },
    { "expr": "${'a' - 1}",                 "expect": null, "error": "E_TYPE" }
  ]
}
```

Swift / Kotlin / TypeScript の各テストがこのファイル群を直接読んで実行する。
**仕様の変更はコーパスへのケース追加を伴わなければならない**（CIで検査）。
