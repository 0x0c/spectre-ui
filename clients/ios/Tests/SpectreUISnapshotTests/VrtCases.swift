#if os(iOS)
import Foundation
import SpectreCore

/// VRT (ビジュアルリグレッションテスト) のケース1件 (SU-0013)。
///
/// ケースの実体は `spec/vrt/cases.json` にあり、Android 側の `VrtCases.kt` が同じ
/// ファイルを読む。どの画面をどの条件で描くかを両プラットフォームで揃えるためで、
/// ゴールデン画像そのものはレンダラごとに別物になる。
struct VrtCase: Decodable {
    let id: String
    let document: String
    let widthDp: Double
    let heightDp: Double
    let theme: String
    let fontScale: Double
    let locale: String

    var isDark: Bool { theme == "dark" }

    var documentURL: URL { VrtCases.repoRoot.appendingPathComponent(document) }

    /// ケースが宣言した描画条件を、式から見える `env` に落とす。
    ///
    /// 実行環境から組み立てないのは、OS バージョンやタイムゾーンが混ざると
    /// 同じケースの画像が環境ごとに変わりうるため。
    var env: SpValue {
        .object([
            "platform": .string("ios"),
            "appVersion": .string("0.0.0"),
            "osVersion": .string(""),
            "locale": .string(locale),
            "timeZone": .string("Asia/Tokyo"),
            "theme": .string(theme),
            "widthClass": .string(widthDp < 600 ? "compact" : (widthDp < 840 ? "regular" : "expanded")),
            "fontScale": .number(fontScale),
            "isOnline": .bool(true),
        ])
    }
}

/// `spec/vrt/cases.json` の読み込み。
enum VrtCases {

    /// リポジトリルート。#filePath から辿る。
    /// <root>/clients/ios/Tests/SpectreUISnapshotTests/VrtCases.swift
    static let repoRoot: URL = {
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { url.deleteLastPathComponent() }
        return url
    }()

    private struct CaseList: Decodable {
        let cases: [VrtCase]
    }

    /// ゴールデン画像の置き場所。swift-snapshot-testing の既定の探し先と同じ。
    static let goldenDirectory: URL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("__Snapshots__/SpectreScreenSnapshotTests")

    /// 記録モードか。
    ///
    /// `TEST_RUNNER_` 接頭辞つきの名前も見るのは、`xcodebuild test` がシミュレータ上の
    /// テストプロセスへ環境変数を渡す経路がこの接頭辞だけだから。接頭辞は外されて
    /// 届くはずだが、届き方が変わっても記録モードを落とさないよう両方を見る。
    static var isRecording: Bool {
        let environment = ProcessInfo.processInfo.environment
        return environment["SPECTRE_VRT_RECORD"] == "1"
            || environment["TEST_RUNNER_SPECTRE_VRT_RECORD"] == "1"
    }

    /// ゴールデン画像が1枚でもあるか。
    ///
    /// 1枚もない状態で検証すると、比較対象がないという理由だけで必ず落ちる。
    /// それは退行ではないので、記録を1度も通していない間は検証を飛ばす。
    /// 最初の記録が入った時点から、以後は通常のテストとして検証が効き始める。
    static var hasGoldens: Bool {
        let files = (try? FileManager.default.contentsOfDirectory(
            at: goldenDirectory,
            includingPropertiesForKeys: nil
        )) ?? []
        return files.contains { $0.pathExtension == "png" }
    }

    static func all() throws -> [VrtCase] {
        let url = repoRoot.appendingPathComponent("spec/vrt/cases.json")
        let list = try JSONDecoder().decode(CaseList.self, from: try Data(contentsOf: url))
        return list.cases
    }
}
#endif
