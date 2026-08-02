# Spectre APNs Sample

[SU-0012](../../../roadmaps/SU-0012-apns-sdui-sample-app/SU-0012-apns-sdui-sample-app-ja.md) の実装です。
リモート通知のペイロードに埋め込んだ Spectre UI ドキュメントを、iOS シミュレータへの
ドラッグ&ドロップだけで描画します。プッシュ通知サーバも APNs 証明書も実機も要りません。

## 実行方法

1. XcodeGen を導入し、プロジェクトを生成します。

   ```sh
   brew install xcodegen
   cd clients/ios/APNsSample
   xcodegen generate
   open SpectreAPNsSample.xcodeproj
   ```

2. Xcode からシミュレータへビルド・実行します。起動直後に通知許可のダイアログが出るので、
   「許可」を選びます (拒否すると `willPresent` が呼ばれずバナーが出ませんが、通知タップ
   経由の受信は引き続き動きます)。

3. `Payloads/` 以下の `.apns` ファイルを Finder から、起動中のシミュレータのウインドウへ
   ドラッグ&ドロップします。アプリがフォアグラウンドにあれば、その場で画面が描画されます。
   バックグラウンドにあれば通知バナーが出るので、タップすると同じ画面が描画されます。

## ペイロードの構造

`Payloads/*.apns` は次の形をしています。`spectreDocument` キーに Spectre UI ドキュメントを
JSON オブジェクトとしてそのまま埋め込みます (文字列に二重エスケープしません)。

```json
{
  "Simulator Target Bundle": "dev.spectre.apnssample",
  "aps": {
    "alert": { "title": "...", "body": "..." },
    "sound": "default"
  },
  "spectreDocument": { "schemaVersion": "1.0", "id": "...", "root": { "type": "Screen", "...": "..." } }
}
```

`Simulator Target Bundle` はシミュレータがどのアプリへペイロードを届けるかを決めるキーで、
本サンプルのバンドルID `dev.spectre.apnssample` と一致させています。

## サイズの制約

Appleはリモート通知のペイロードを4KBに制限しています。[ADR-0003](../../../docs/adr/ADR-0003-ui-document-format/ADR-0003-ui-document-format-ja.md)
が定めるSpectre UIドキュメントの想定サイズ (5〜50KB) より小さいため、ここに収まるドキュメントは
画面全体ではなく通知カード程度のものに限られます。`Payloads/` の例示ペイロードは、いずれも
2KB未満に収めています。

## 新しいペイロードを作る

`spectreDocument` の中身は、`examples/screens/` にある通常のSpectre UIドキュメントと同じ形式です。
ただし4KBの上限に収まるよう、ノード数を絞ってください。作成後は次のコマンドでJSONとして妥当か
確認できます。

```sh
python3 -c "import json; json.load(open('Payloads/your-payload.apns'))"
```
