// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SpectreUI",
    platforms: [
        // SwiftUI の Layout / Grid が揃うのが iOS 16 (docs/tech-selection.md ADR-0001)
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        // ロジックだけが必要なホスト (サーバサイド検証・CLI・テスト) 向け。
        // Foundation にしか依存しないため、SwiftUI が使えない環境でも取り込める。
        .library(name: "SpectreCore", targets: ["SpectreCore"]),
        .library(name: "SpectreUI", targets: ["SpectreUI"]),
    ],
    targets: [
        .target(name: "SpectreCore"),
        .target(name: "SpectreUI", dependencies: ["SpectreCore"]),
        // 適合性コーパスとサンプル画面はリポジトリ共通のものを参照する。
        // Swift / Kotlin / TypeScript が同じファイルを読むことに意味があるため、
        // バンドルにコピーせず #filePath からリポジトリルートを辿って直接読む
        // (SwiftPM の resources はターゲットディレクトリ外を参照できない)。
        .testTarget(name: "SpectreCoreTests", dependencies: ["SpectreCore"]),
        // Tests for SpectreUI, the counterpart to the `:spectre-ui` unit tests on the Compose
        // side. They target property extraction from a resolved node and the token maps — the
        // layer that can be checked without building a SwiftUI view — rather than screen
        // assembly itself.
        .testTarget(name: "SpectreUITests", dependencies: ["SpectreUI", "SpectreCore"]),
    ]
)
