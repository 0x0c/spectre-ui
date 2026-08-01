import XCTest
@testable import SpectreCore

/// RFC 6902 (JSON Patch) の適用を検証する。`applyPatch` アクションが使う
/// (docs/spec/actions.md)。Kotlin 側 (`JsonPatchTest.kt`) と同じ観点を確認する。
final class JsonPatchTests: XCTestCase {

    private func doc(_ json: String) throws -> SpValue {
        try SpValue.from(jsonString: json)
    }

    private func op(_ json: String) throws -> SpValue {
        try SpValue.from(jsonString: json)
    }

    func testReplaceReplacesValue() throws {
        let root = try doc(#"{"root":{"props":{"text":"old"}}}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"replace","path":"/root/props/text","value":"new"}"#)])
        XCTAssertEqual(result.path("root.props.text"), .string("new"))
    }

    func testAddInsertsObjectKey() throws {
        let root = try doc(#"{"root":{"props":{}}}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"add","path":"/root/props/text","value":"hello"}"#)])
        XCTAssertEqual(result.path("root.props.text"), .string("hello"))
    }

    func testAddInsertsIntoArrayAtIndex() throws {
        let root = try doc(#"{"items":["a","c"]}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"add","path":"/items/1","value":"b"}"#)])
        XCTAssertEqual(result.path("items").asArray?.map { $0.asString }, ["a", "b", "c"])
    }

    func testAddAppendsWithDashIndex() throws {
        let root = try doc(#"{"items":["a"]}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"add","path":"/items/-","value":"b"}"#)])
        XCTAssertEqual(result.path("items").asArray?.map { $0.asString }, ["a", "b"])
    }

    func testRemoveDeletesArrayElement() throws {
        let root = try doc(#"{"items":["a","b","c"]}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"remove","path":"/items/1"}"#)])
        XCTAssertEqual(result.path("items").asArray?.map { $0.asString }, ["a", "c"])
    }

    func testRemoveDeletesObjectKey() throws {
        let root = try doc(#"{"props":{"a":1,"b":2}}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"remove","path":"/props/a"}"#)])
        XCTAssertEqual(Set((result.path("props").asObject ?? [:]).keys), ["b"])
    }

    func testMoveRelocatesValue() throws {
        let root = try doc(#"{"a":{"x":1},"b":{}}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"move","from":"/a/x","path":"/b/x"}"#)])
        XCTAssertNil(result.path("a").asObject?["x"])
        XCTAssertEqual(result.path("b.x"), .number(1))
    }

    func testCopyDuplicatesValue() throws {
        let root = try doc(#"{"a":{"x":1},"b":{}}"#)
        let result = try JsonPatch.apply(root, [try op(#"{"op":"copy","from":"/a/x","path":"/b/x"}"#)])
        XCTAssertEqual(result.path("a.x"), .number(1))
        XCTAssertEqual(result.path("b.x"), .number(1))
    }

    func testOpThrowsOnMismatch() throws {
        let root = try doc(#"{"a":1}"#)
        XCTAssertThrowsError(try JsonPatch.apply(root, [try op(#"{"op":"test","path":"/a","value":2}"#)]))
    }

    func testMissingPathThrows() throws {
        let root = try doc(#"{"a":1}"#)
        XCTAssertThrowsError(
            try JsonPatch.apply(root, [try op(#"{"op":"replace","path":"/missing/x","value":1}"#)])
        )
    }

    func testAppliesOperationsInOrder() throws {
        let root = try doc(#"{"items":["a"]}"#)
        let result = try JsonPatch.apply(root, [
            try op(#"{"op":"add","path":"/items/-","value":"b"}"#),
            try op(#"{"op":"replace","path":"/items/0","value":"A"}"#),
        ])
        XCTAssertEqual(result.path("items").asArray?.map { $0.asString }, ["A", "b"])
    }
}
