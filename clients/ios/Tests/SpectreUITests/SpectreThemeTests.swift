import XCTest
import SwiftUI
@testable import SpectreUI

/// Exercises token resolution.
///
/// The SDK knows token names only; the host app injects what they stand for
/// (docs/architecture.md §6). So what this type is really about is what happens when an unknown
/// token arrives — if that path breaks, swapping the host theme stops being safe. Whether the
/// default tables cover the manifest's tokens matters for the same reason: a gap shows up as
/// that one element quietly drawing with a default.
final class SpectreThemeTests: XCTestCase {

    private let theme = SpectreTheme()

    // MARK: - unknown tokens

    func testUnknownAndNilTokensFallBack() {
        XCTAssertEqual(theme.space("unknown-token"), 0)
        XCTAssertEqual(theme.space(nil), 0)
        XCTAssertEqual(theme.corner("unknown-token"), 0)
        XCTAssertEqual(theme.corner(nil), 0)
    }

    func testUnknownIconFallsBackToTheInfoSymbol() {
        // Better to draw something than to leave a hole.
        XCTAssertEqual(theme.symbol("unknown-token"), "info.circle")
        XCTAssertEqual(theme.symbol(nil), "info.circle")
    }

    func testUnknownColorUsesTheGivenFallback() {
        XCTAssertEqual(theme.color("unknown-token", default: .red), .red)
        XCTAssertEqual(theme.color(nil, default: .red), .red)
    }

    // MARK: - default tables

    func testSpacingScale() {
        XCTAssertEqual(theme.space("none"), 0)
        XCTAssertEqual(theme.space("md"), 16)
        XCTAssertEqual(theme.space("xxl"), 48)
    }

    func testRadiusScale() {
        XCTAssertEqual(theme.corner("none"), 0)
        XCTAssertEqual(theme.corner("md"), 8)
        // `full` means fully rounded, drawn as a large enough value.
        XCTAssertGreaterThan(theme.corner("full"), 100)
    }

    func testTheSpacingScaleIsMonotonic() {
        let scale = ["none", "xs", "sm", "md", "lg", "xl", "xxl"].map { theme.space($0) }
        XCTAssertEqual(scale, scale.sorted(), "an inverted step would make spacing counter-intuitive")
    }

    // MARK: - substitution

    func testAHostCanReplaceIndividualTables() {
        let custom = SpectreTheme(spacing: ["md": 99])
        XCTAssertEqual(custom.space("md"), 99)
        // Tables that were not replaced keep their defaults.
        XCTAssertEqual(custom.corner("md"), 8)
        // A token missing from a replaced table falls to the default value, not the default table.
        XCTAssertEqual(custom.space("lg"), 0)
    }

    // MARK: - coverage against the manifest

    /// Corresponds to tokens in spec/component-manifest.json. A gap shows up as that one
    /// element quietly drawing with a default, which is hard to spot by eye.
    func testEveryManifestSpacingTokenResolves() {
        for token in ["none", "xs", "sm", "md", "lg", "xl", "xxl"] {
            XCTAssertNotNil(SpectreTheme.defaultSpacing[token], "spacing token \(token)")
        }
    }

    func testEveryManifestRadiusTokenResolves() {
        for token in ["none", "sm", "md", "lg", "xl", "full"] {
            XCTAssertNotNil(SpectreTheme.defaultRadius[token], "radius token \(token)")
        }
    }

    func testEveryManifestColorTokenResolves() {
        let tokens = [
            "primary", "onPrimary", "primaryContainer", "onPrimaryContainer",
            "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
            "surface", "onSurface", "surfaceVariant", "onSurfaceVariant",
            "background", "onBackground", "outline", "outlineVariant",
            "error", "onError", "success", "onSuccess",
            "warning", "onWarning", "info", "onInfo", "transparent",
        ]
        for token in tokens {
            XCTAssertNotNil(SpectreTheme.defaultColors[token], "color token \(token)")
        }
    }

    func testEveryManifestTypographyTokenResolves() {
        let tokens = [
            "displayLg", "displayMd", "titleLg", "titleMd", "titleSm",
            "bodyLg", "bodyMd", "bodySm", "label", "caption", "overline",
        ]
        for token in tokens {
            XCTAssertNotNil(SpectreTheme.defaultFonts[token], "typography token \(token)")
        }
    }
}
