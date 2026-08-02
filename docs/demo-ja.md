[English](demo.md) · **日本語**

# 実際に試す: 4つのデモ

`scripts/demo.sh`は、Spectre UIの4つのデモをそれぞれ起動するスクリプトです。どのデモも同じサンプル画面を
描画します。描画先はそのつど異なり、システムの別々の部分を通ります。サンプル画面は
[`examples/screens/product-detail.json`](../examples/screens/product-detail.json)です。デモは
リポジトリのルートで`./scripts/demo.sh <target>`として実行します。各デモのスクリプトは、
`scripts/demo/`以下からも直接実行できます。

```sh
./scripts/demo.sh editor    # WYSIWYGエディタ（まずはここから）
./scripts/demo.sh server    # オーサリングAPIと配信API
./scripts/demo.sh ios       # iOSサンプルアプリ
./scripts/demo.sh android   # Androidサンプルアプリ
```

各スクリプトは、処理を始める前に必要なツールを確認します。足りないものがあれば、その名前を示して止まりま
す。途中で理由のわからない失敗をすることはありません。

## 1. エディタ（`./scripts/demo.sh editor`）

**必要なもの**：Node.js 22以降とpnpmだけです。データベースもネイティブのツールチェインも要りません。

初回実行時に依存関係をインストールします。続けてエディタのVite開発サーバーを`http://localhost:5173`で起
動します。サンプル画面はこの時点ですでに読み込まれています。

これは、Spectre UIの中心にある発想をもっとも速く確かめられる方法です。パレット、キャンバス、インスペクタは
いずれも実行時に[コンポーネントマニフェスト](../spec/component-manifest.json)を読み込みます。読み込んだ
内容から自分自身を組み立てます。コンポーネントごとに手書きされた部分はここにはありません。

エディタを開いたら、次を試してください。

- パレットからコンポーネントをキャンバスへドラッグします。選択してインスペクタでプロパティを編集しま
  す。
- 下段の「データ」タブを開き、サンプルデータを編集します。価格や在庫数など、束縛されたフィールドの表示
  が、キャンバス上でただちに変わります。
- 「アクションカタログ」タブを開くと、[`docs/editor.md`](editor.md)§4で説明しているアクションエディタが
  見られます。
- Ctrl/Cmd+Zで編集を取り消し、Ctrl/Cmd+Shift+Zでやり直します。

この配線は`packages/editor/src/App.tsx`に書かれています。エディタの設計全体は
[`docs/editor.md`](editor.md)にまとめています。

## 2. サーバー（`./scripts/demo.sh server`）

**必要なもの**：Node.js、pnpm、そしてPostgreSQLです。

スクリプトはまずポート5432に既存のPostgreSQLがあるかを確認します。何も応答しない場合は、Dockerで使い捨
ての`postgres:16`コンテナを起動します。このコンテナは、スクリプト終了時に削除します。

PostgreSQLがすでにローカルで動いている場合は事情が異なります。この場合はそちらをそのまま使い、Dockerに
は触れません。

このデモは、オーサリングAPIと配信API（[`packages/server`](../packages/server)、SU-0004）を動かします。
著者が公開ボタンを押すと実際に通る4ステップの流れをそのままたどり、各リクエストとレスポンスをそのつど
表示します。

1. **下書きを作成する**：`POST /api/documents`。サンプル画面の本体を最初のバージョンとして登録します。
2. **検証する**：`POST /api/documents/:id/validate`。コンポーネントマニフェストに照らして検証します。
3. **公開する**：`POST /api/documents/:id/publish`。`internal`チャネルへ公開します
   （`production`はデフォルトで承認者が2人必要になるため、`internal`にしてコマンド1つで完結させます）。
4. **取得し直す**：`GET /screens/:screenId`。クライアントSDKが実際に送るのと同じリクエストです。公開済
   みのドキュメントが、条件付きリクエスト用の`ETag`付きで返ります。

サーバーはこのあとも動き続けます。スクリプトは、さらに試せる`curl`コマンドをいくつか表示します。ドキュ
メントをもう一度取得する、監査ログを読む、といった例です。

サーバーはCtrl+Cで停止してください。Dockerコンテナを起動していた場合は、これも一緒に片付けます。

オーサリングAPIと配信APIの設計全体は[`docs/architecture.md`](architecture.md)§4にまとめています。配信
レスポンスの`ETag`とケイパビリティ関連ヘッダーの意味は、[`docs/compatibility.md`](compatibility.md)が説
明しています。

## 3. iOSサンプルアプリ（`./scripts/demo.sh ios`）

**必要なもの**：macOS、Xcode、そして[XcodeGen](https://github.com/yonaskolb/XcodeGen)
（`brew install xcodegen`）です。

`clients/ios/SampleApp`のXcodeプロジェクトを生成して開きます。プロジェクトそのものはコミットしません。
情報源はXcodeGenが読む`project.yml`です。Xcodeのインデックスが終わったらRun（⌘R）を押してください。サン
プル画面が、[`clients/ios`](../clients/ios)以下のSwiftランタイムである`SpectreUI`を通じて、SwiftUIで描
画されます。

もう1つのサンプルアプリは、Apple Push Notification service（APNs）で配信された画面を描画します。この画
面はアプリに同梱しません。`clients/ios/APNsSample`で`xcodegen generate && open
SpectreAPNsSample.xcodeproj`を実行してください。設計は
[SU-0012](../roadmaps/SU-0012-apns-sdui-sample-app/SU-0012-apns-sdui-sample-app.md)に記録していま
す。

## 4. Androidサンプルアプリ（`./scripts/demo.sh android`）

**必要なもの**：Android SDKと、接続済みのデバイスか起動中のエミュレータです。Android SDKの場所は、
Android Studioがデフォルトで`ANDROID_HOME`または`ANDROID_SDK_ROOT`に設定します。

サンプルアプリのデバッグビルドを作成してインストールします（`./gradlew :sample:installDebug`）。完了し
たら、デバイスのアプリ一覧から「Spectre Sample」を開いてください。サンプル画面がそこでJetpack Compose
で描画されます。描画するのは、[`clients/android`](../clients/android)以下のKotlinランタイムである
`spectre-ui`です。

## トラブルシューティング

- **「No device or emulator is connected」（Android）**：Android StudioのDevice Managerからエミュレー
  タを起動してください。あるいは、USBデバッグを有効にした実機を接続してください。スクリプトを再実行して
  ください。
- **「Docker is installed but not running」（サーバー）**：Docker Desktopを起動してください。Linuxで
  は`docker`デーモンを起動してください。そのあと、スクリプトを再実行してください。PostgreSQLがすでに別
  の場所で動いている場合は事情
  が異なります。この場合は、実行前に`DATABASE_URL`を指定してください。例：
  `DATABASE_URL=postgres://user:pass@db-host:5432/db ./scripts/demo.sh server`。スクリプトは、すでに
  接続できるデータベースがあればそれを再利用し、それ以外の場合にDockerへ回ります。
- **ポート3000や5173がすでに使われている**：使用中のプロセスを止めてください。あるいは、実行前にポート
  を指定してください（`PORT=3001 ./scripts/demo.sh server`）。エディタのポートはVite自身の`--port`フラ
  グです。`pnpm --filter @spectre-ui/editor run dev`のあとに`--`を挟んで渡してください。
- **デモスクリプトが具体的な指示とともに終了する**（ツールを入れる、サービスを起動するなど）：その指示が
  そのまま対処法です。各スクリプトは他の処理より先に前提条件を確認します。ツール不足が、途中の理由不明な
  失敗として現れることはありません。

これらのデモが扱わない範囲もあります。テストスイートの実行や、生成コードをマニフェストと突き合わせる確
認が、その一例です。継続的インテグレーション（CI）が、この残りの検証をプルリクエストのたびに行います。
これらのコマンドは、[トップレベルのREADMEの「動かす」](../README-ja.md#動かす)を参照してください。
