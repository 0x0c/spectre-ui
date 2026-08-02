#if os(iOS)
import SnapshotTesting
import SwiftUI
import XCTest
import SpectreCore
import SpectreUI

/// SwiftUI レンダラのビジュアルリグレッションテスト (SU-0013)。
///
/// `spec/vrt/cases.json` のケースを1件ずつ描画し、`__Snapshots__/` のゴールデン画像と
/// 突き合わせる。実行モードは環境変数 `SPECTRE_VRT_RECORD` で決まる。
///
/// - 検証 (既定):
///   `xcodebuild test -scheme SpectreUI -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:SpectreUISnapshotTests`
/// - 記録: 同じコマンドを `SPECTRE_VRT_RECORD=1` を渡して実行する。
///
/// iOS シミュレータ上でしか走らない。`swift build` / `swift test` が使う macOS の
/// SwiftUI は、ホストアプリが出荷するものとは描画が違うため、そちらで固定しても
/// 意味がない。
///
/// Android 側の対応物は `SpectreScreenSnapshotTest.kt`。同じケースを描くが、
/// ゴールデンは共有しない (ADR-0001 のとおり2つのレンダラは別実装なので、
/// 画素が違うことは意図した結果)。
final class SpectreScreenSnapshotTests: XCTestCase {

    @MainActor
    func testRendersEveryVrtCase() throws {
        let isRecording = VrtCases.isRecording
        try XCTSkipUnless(
            isRecording || VrtCases.hasGoldens,
            "ゴールデン画像がまだありません。SPECTRE_VRT_RECORD=1 で記録してください。"
        )

        let cases = try VrtCases.all()
        XCTAssertFalse(cases.isEmpty, "VRT のケースが1件もありません")

        withSnapshotTesting(record: isRecording ? .all : .never) {
            for testCase in cases {
                assertCase(testCase)
            }
        }
    }

    @MainActor
    private func assertCase(_ testCase: VrtCase) {
        let document: Document
        do {
            let text = try String(contentsOf: testCase.documentURL, encoding: .utf8)
            document = try DocumentParser.parse(text: text)
        } catch {
            XCTFail("ケース \(testCase.id) のドキュメントを読めません: \(error)")
            return
        }

        // ホストアプリと同じく NavigationStack の中に置く。appBar は
        // `navigationTitle` と `toolbar` で表現されるので、外に出すと消える。
        let view = NavigationStack {
            SpectreScreen(
                document: document,
                host: SnapshotHostDelegate(),
                env: testCase.env
            )
        }

        let traits = UITraitCollection(traitsFrom: [
            UITraitCollection(userInterfaceStyle: testCase.isDark ? .dark : .light),
            UITraitCollection(preferredContentSizeCategory: contentSizeCategory(testCase.fontScale)),
        ])

        // `SpectreScreen` は onAppear で解決するので、レイアウトが一度落ち着くのを
        // 待ってから撮る。待たずに撮ると解決前の待機表示が写りうる。
        assertSnapshot(
            of: view,
            as: .wait(
                for: 0.5,
                on: .image(
                    layout: .fixed(
                        width: CGFloat(testCase.widthDp),
                        height: CGFloat(testCase.heightDp)
                    ),
                    traits: traits
                )
            ),
            testName: testCase.id
        )
    }

    /// フォントスケールを Dynamic Type の段階に写す。
    ///
    /// ケース一覧は倍率という連続値で条件を書くが、iOS が持つのは段階だけなので、
    /// 一番近い段階を選ぶ。Android 側は倍率をそのまま使える。
    private func contentSizeCategory(_ fontScale: Double) -> UIContentSizeCategory {
        switch fontScale {
        case ..<1.05: return .large
        case ..<1.15: return .extraLarge
        case ..<1.25: return .extraExtraLarge
        case ..<1.45: return .extraExtraExtraLarge
        default: return .accessibilityMedium
        }
    }
}

/// 何もしないホスト実装。
///
/// VRT が見るのは初期描画だけで、アクションは発火しない。ネットワークや遷移を
/// 伴う実装を挿すと、応答の有無で画像が変わりうる。
private final class SnapshotHostDelegate: SpectreHostDelegate {
    func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse {
        SpectreActionResponse(ok: true)
    }

    func navigate(to destination: SpectreDestination) -> Bool { true }

    func performHostAction(name: String, params: SpValue) async throws -> SpValue? { nil }

    func track(event: String, properties: SpValue) {}

    func openURL(_ url: String, mode: String) -> Bool { true }
}
#endif
