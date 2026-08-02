import XCTest
import SwiftUI
import SpectreCore
@testable import SpectreUI

/// Exercises property extraction from a resolved node, and the token-to-SwiftUI maps.
///
/// This is where the promise "a malformed document must not take the app down" is actually
/// written. Every function in `Props.swift` relies on falling back to a default rather than
/// throwing when a value is not the expected type, yet `SpectreUI` had no test target at all
/// and CI only ever confirmed that it built.
///
/// The conformance corpus fixes the resolution results produced by `SpectreCore`; how the
/// renderer then reads those results sits outside the corpus. Mirrors `PropsTest.kt` on the
/// Kotlin side.
final class PropsTests: XCTestCase {

    private func node(
        props: [String: SpValue] = [:],
        a11y: [String: SpValue] = [:]
    ) -> RenderNode {
        RenderNode(type: "Text", props: props, a11y: a11y)
    }

    // MARK: - string

    func testStringReturnsTheStringAsIs() {
        XCTAssertEqual(node(props: ["text": .string("hello")]).string("text"), "hello")
    }

    func testStringStringifiesNumbersAndBooleans() {
        // A lone expression such as `"${item}"` keeps its type and resolves as a number.
        XCTAssertEqual(node(props: ["text": .number(1280)]).string("text"), "1280")
        XCTAssertEqual(node(props: ["text": .bool(true)]).string("text"), "true")
    }

    func testStringFallsBackForMissingAndNull() {
        XCTAssertEqual(node().string("text"), "")
        XCTAssertEqual(node().string("text", default: "fallback"), "fallback")
        XCTAssertEqual(node(props: ["text": .null]).string("text", default: "fallback"), "fallback")
    }

    func testStringOrNilReturnsNilForMissingAndNull() {
        XCTAssertNil(node().stringOrNil("text"))
        XCTAssertNil(node(props: ["text": .null]).stringOrNil("text"))
        XCTAssertEqual(node(props: ["text": .string("x")]).stringOrNil("text"), "x")
    }

    // MARK: - bool

    func testBoolFollowsTruthiness() {
        XCTAssertTrue(node(props: ["on": .bool(true)]).bool("on", default: false))
        XCTAssertFalse(node(props: ["on": .bool(false)]).bool("on", default: true))
        XCTAssertTrue(node(props: ["on": .string("x")]).bool("on", default: false))
        XCTAssertFalse(node(props: ["on": .string("")]).bool("on", default: true))
        XCTAssertFalse(node(props: ["on": .number(0)]).bool("on", default: true))
    }

    func testBoolFallsBackForMissingAndNull() {
        XCTAssertTrue(node().bool("on", default: true))
        XCTAssertFalse(node().bool("on", default: false))
        XCTAssertTrue(node(props: ["on": .null]).bool("on", default: true))
    }

    // MARK: - int / double

    func testIntTakesNumbersOnly() {
        XCTAssertEqual(node(props: ["n": .number(3)]).int("n", default: 0), 3)
        XCTAssertEqual(node(props: ["n": .string("3")]).int("n", default: 0), 0, "strings are not coerced")
        XCTAssertEqual(node().int("n", default: 7), 7)
    }

    func testOptionalNumericAccessors() {
        XCTAssertNil(node().intOrNil("n"))
        XCTAssertNil(node(props: ["n": .string("x")]).intOrNil("n"))
        XCTAssertEqual(node(props: ["n": .number(3)]).intOrNil("n"), 3)
        XCTAssertNil(node().doubleOrNil("n"))
        XCTAssertEqual(node(props: ["n": .number(1.5)]).doubleOrNil("n"), 1.5)
    }

    func testDoubleKeepsTheFraction() {
        XCTAssertEqual(node(props: ["n": .number(1.5)]).double("n", default: 0), 1.5)
        XCTAssertEqual(node().double("n", default: 0.5), 0.5)
    }

    // MARK: - token

    func testTokenTakesStringsOnly() {
        XCTAssertEqual(node(props: ["radius": .string("md")]).token("radius", default: "none"), "md")
        // A token is a name, not a number. Fall back when a number arrives.
        XCTAssertEqual(node(props: ["radius": .number(8)]).token("radius", default: "none"), "none")
        XCTAssertEqual(node().token("radius", default: "none"), "none")
        XCTAssertNil(node().tokenOrNil("radius"))
    }

    // MARK: - options

    func testOptionsReadsValueLabelEnabled() {
        let node = node(props: [
            "options": .array([.object(["value": .string("a"), "label": .string("A"), "enabled": .bool(false)])]),
        ])
        XCTAssertEqual(node.options("options"), [SpectreOption(value: "a", label: "A", enabled: false)])
    }

    func testOptionsDefaultsLabelToValueAndEnabledToTrue() {
        let node = node(props: ["options": .array([.object(["value": .string("a")])])])
        XCTAssertEqual(node.options("options"), [SpectreOption(value: "a", label: "a", enabled: true)])
    }

    func testOptionsDropsEntriesWithoutAValue() {
        // A broken entry costs only itself; the rest still render.
        let node = node(props: [
            "options": .array([
                .object(["label": .string("A")]),
                .string("not even an entry"),
                .object(["value": .string("b")]),
            ]),
        ])
        XCTAssertEqual(node.options("options"), [SpectreOption(value: "b", label: "b", enabled: true)])
    }

    func testOptionsIsEmptyWhenNotAnArray() {
        XCTAssertEqual(node().options("options"), [])
        XCTAssertEqual(node(props: ["options": .string("not an array")]).options("options"), [])
    }

    // MARK: - tabItems

    func testTabItemsReadsAllFields() {
        let node = node(props: [
            "items": .array([
                .object([
                    "id": .string("home"),
                    "label": .string("Home"),
                    "icon": .string("house"),
                    "badge": .string("3"),
                ]),
            ]),
        ])
        XCTAssertEqual(node.tabItems(), [SpectreTabItem(id: "home", label: "Home", icon: "house", badge: "3")])
    }

    func testTabItemsDefaultsLabelToId() {
        let node = node(props: ["items": .array([.object(["id": .string("home")])])])
        XCTAssertEqual(node.tabItems(), [SpectreTabItem(id: "home", label: "home", icon: nil, badge: nil)])
    }

    func testTabItemsDropsEntriesWithoutAnId() {
        let node = node(props: [
            "items": .array([.object(["label": .string("A")]), .object(["id": .string("b")])]),
        ])
        XCTAssertEqual(node.tabItems(), [SpectreTabItem(id: "b", label: "b", icon: nil, badge: nil)])
    }

    // MARK: - a11y

    func testA11yLabelReturnsTheLabel() {
        XCTAssertEqual(node(a11y: ["label": .string("image description")]).a11yLabel(), "image description")
    }

    func testA11yLabelHidesDecorativeNodes() {
        // When hidden is true the node stays unread even if it carries a label.
        let decorative = node(a11y: ["label": .string("decoration"), "hidden": .bool(true)])
        XCTAssertNil(decorative.a11yLabel())
        XCTAssertTrue(decorative.a11yHidden())
    }

    func testA11yLabelIsNilWhenAbsentOrNull() {
        XCTAssertNil(node().a11yLabel())
        XCTAssertNil(node(a11y: ["label": .null]).a11yLabel())
    }

    func testA11yHiddenDefaultsToFalse() {
        XCTAssertFalse(node().a11yHidden())
        XCTAssertFalse(node(a11y: ["hidden": .bool(false)]).a11yHidden())
    }

    // MARK: - token maps
    // An unknown token always falls to the default. That is the path by which an older client
    // that does not know a newer token degrades to a near-enough look instead of crashing
    // (ADR-0006).

    func testTextAlignmentOf() {
        XCTAssertEqual(textAlignmentOf("center"), .center)
        XCTAssertEqual(textAlignmentOf("end"), .trailing)
        XCTAssertEqual(textAlignmentOf("start"), .leading)
        XCTAssertEqual(textAlignmentOf("unknown-token"), .leading)
    }

    func testFrameAlignmentOf() {
        XCTAssertEqual(frameAlignmentOf("center"), .center)
        XCTAssertEqual(frameAlignmentOf("end"), .trailing)
        XCTAssertEqual(frameAlignmentOf("unknown-token"), .leading)
    }

    func testFontWeightOf() {
        XCTAssertEqual(fontWeightOf("medium"), .medium)
        XCTAssertEqual(fontWeightOf("bold"), .bold)
        XCTAssertNil(fontWeightOf("regular"), "the default weight is left to the theme")
        XCTAssertNil(fontWeightOf("unknown-token"))
    }

    func testContentModeOf() {
        XCTAssertEqual(contentModeOf("fit"), .fit)
        XCTAssertEqual(contentModeOf("fill"), .fill)
        XCTAssertEqual(contentModeOf("unknown-token"), .fill)
    }

    func testHorizontalAlignmentOf() {
        XCTAssertEqual(horizontalAlignmentOf("center"), .center)
        XCTAssertEqual(horizontalAlignmentOf("trailing"), .trailing)
        XCTAssertEqual(horizontalAlignmentOf("leading"), .leading)
        XCTAssertEqual(horizontalAlignmentOf("unknown-token"), .leading)
    }

    func testVerticalAlignmentOf() {
        XCTAssertEqual(verticalAlignmentOf("top"), .top)
        XCTAssertEqual(verticalAlignmentOf("bottom"), .bottom)
        XCTAssertEqual(verticalAlignmentOf("baseline"), .firstTextBaseline)
        XCTAssertEqual(verticalAlignmentOf("center"), .center)
        XCTAssertEqual(verticalAlignmentOf("unknown-token"), .center)
    }

    func testStackAlignmentOfCoversAllNineDirections() {
        // The same nine directions as `boxAlignmentOf` on the Kotlin side.
        XCTAssertEqual(stackAlignmentOf("topLeading"), .topLeading)
        XCTAssertEqual(stackAlignmentOf("top"), .top)
        XCTAssertEqual(stackAlignmentOf("topTrailing"), .topTrailing)
        XCTAssertEqual(stackAlignmentOf("leading"), .leading)
        XCTAssertEqual(stackAlignmentOf("center"), .center)
        XCTAssertEqual(stackAlignmentOf("trailing"), .trailing)
        XCTAssertEqual(stackAlignmentOf("bottomLeading"), .bottomLeading)
        XCTAssertEqual(stackAlignmentOf("bottom"), .bottom)
        XCTAssertEqual(stackAlignmentOf("bottomTrailing"), .bottomTrailing)
        XCTAssertEqual(stackAlignmentOf("unknown-token"), .center)
    }
}
