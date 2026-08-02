import XCTest
@testable import SpectreCore

/// `Resolver.reresolveTraced` が、変更された state/data のパスに依存しないノードを
/// 全解決と同じ値に再解決することを確認する (docs/architecture.md §2, §5)。
///
/// `RenderNode` は Swift では struct (値型) なので、Kotlin 側のテスト
/// (`ResolverDiffTest.kt`) がやっている「同一インスタンスを再利用したか」の検証は
/// 参照を持たないここでは意味を持たない。その不変条件は Kotlin 側のテストと、
/// 両実装が同じロジックを辿っていることの目視確認でカバーする — ここでは
/// 差分再解決が全解決と常に同じ**値**を返すことを確認する。
final class ResolverDiffTests: XCTestCase {

    private let documentText = #"""
    {
      "schemaVersion": "1.0",
      "id": "diff_test",
      "data": {"items": [{"name": "a"}, {"name": "b"}]},
      "state": {"counterA": 1, "counterB": 10, "showC": true, "filter": "x"},
      "root": {
        "type": "Screen",
        "children": [
          {"type": "Text", "id": "a", "props": {"text": "${state.counterA}"}},
          {"type": "Text", "id": "b", "props": {"text": "${state.counterB}"}},
          {"type": "Text", "id": "c", "props": {"text": "shown"}, "visibleWhen": "${state.showC}"},
          {
            "type": "Text",
            "id": "item",
            "props": {"text": "${item.name}-${state.filter}"},
            "repeat": {"for": "${data.items}"}
          }
        ]
      }
    }
    """#

    private func load() throws -> Document {
        try DocumentParser.parse(text: documentText)
    }

    private func collect(_ node: RenderNode) -> [RenderNode] {
        [node] + node.children.flatMap { collect($0) }
    }

    func testReusesUnaffectedSiblingValue() throws {
        let document = try load()
        let resolver = Resolver()
        let store = Store(data: document.data, state: document.state)

        let initial = resolver.resolveTraced(document, scope: store.scope())
        let nodeC = collect(initial.result.root!).first { $0.nodeID == "c" }

        store.setState("counterB", .number(11))
        let changed = store.consumeChangedPaths()
        XCTAssertEqual(changed, ["state.counterB"])

        let next = resolver.reresolveTraced(document, previous: initial, changedPaths: changed, scope: store.scope())
        let nextRoot = next.result.root!
        let nextNodeC = collect(nextRoot).first { $0.nodeID == "c" }
        let nextNodeB = collect(nextRoot).first { $0.nodeID == "b" }

        // 変更されていない兄弟は同じ値のまま。
        XCTAssertEqual(nodeC?.prop("text").stringify(), nextNodeC?.prop("text").stringify())
        // 変更された state を参照するノードは新しい値になる。
        XCTAssertEqual(nextNodeB?.prop("text").stringify(), "11")
    }

    func testUpdatesVisibilityWhenItsOwnDependencyChanges() throws {
        let document = try load()
        let resolver = Resolver()
        let store = Store(data: document.data, state: document.state)

        let initial = resolver.resolveTraced(document, scope: store.scope())
        XCTAssertTrue(collect(initial.result.root!).contains { $0.nodeID == "c" })

        store.setState("showC", .bool(false))
        let changed = store.consumeChangedPaths()
        let next = resolver.reresolveTraced(document, previous: initial, changedPaths: changed, scope: store.scope())

        XCTAssertFalse(collect(next.result.root!).contains { $0.nodeID == "c" })
    }

    func testReusesRepeatWholesaleWhenUnaffected() throws {
        let document = try load()
        let resolver = Resolver()
        let store = Store(data: document.data, state: document.state)

        let initial = resolver.resolveTraced(document, scope: store.scope())
        let items = collect(initial.result.root!).filter { $0.nodeID == "item" }

        store.setState("counterA", .number(2))
        let changed = store.consumeChangedPaths()
        let next = resolver.reresolveTraced(document, previous: initial, changedPaths: changed, scope: store.scope())
        let nextItems = collect(next.result.root!).filter { $0.nodeID == "item" }

        XCTAssertEqual(items.map { $0.prop("text").stringify() }, nextItems.map { $0.prop("text").stringify() })
    }

    func testReexpandsRepeatWhenBodyDependencyChanges() throws {
        let document = try load()
        let resolver = Resolver()
        let store = Store(data: document.data, state: document.state)

        let initial = resolver.resolveTraced(document, scope: store.scope())
        let items = collect(initial.result.root!).filter { $0.nodeID == "item" }
        XCTAssertEqual(items.map { $0.prop("text").stringify() }, ["a-x", "b-x"])

        store.setState("filter", .string("y"))
        let changed = store.consumeChangedPaths()
        let next = resolver.reresolveTraced(document, previous: initial, changedPaths: changed, scope: store.scope())
        let nextItems = collect(next.result.root!).filter { $0.nodeID == "item" }

        XCTAssertEqual(nextItems.map { $0.prop("text").stringify() }, ["a-y", "b-y"])
    }

    func testDiffResolveMatchesFullResolve() throws {
        let document = try load()
        let store = Store(data: document.data, state: document.state)

        let initial = Resolver().resolveTraced(document, scope: store.scope())
        store.setState("counterA", .number(9))
        store.setState("showC", .bool(false))
        let changed = store.consumeChangedPaths()

        let diffed = Resolver().reresolveTraced(document, previous: initial, changedPaths: changed, scope: store.scope())
        let full = Resolver().resolve(document, scope: store.scope())

        XCTAssertEqual(full.exprErrors, diffed.result.exprErrors)
        XCTAssertEqual(
            collect(full.root!).map { ($0.nodeID, $0.prop("text").stringify()) }.map(Pair.init),
            collect(diffed.result.root!).map { ($0.nodeID, $0.prop("text").stringify()) }.map(Pair.init)
        )
    }

    func testReturnsPreviousResultWhenNothingChanged() throws {
        let document = try load()
        let resolver = Resolver()
        let store = Store(data: document.data, state: document.state)
        let initial = resolver.resolveTraced(document, scope: store.scope())

        let next = resolver.reresolveTraced(document, previous: initial, changedPaths: [], scope: store.scope())

        XCTAssertEqual(
            collect(initial.result.root!).map { ($0.nodeID, $0.prop("text").stringify()) }.map(Pair.init),
            collect(next.result.root!).map { ($0.nodeID, $0.prop("text").stringify()) }.map(Pair.init)
        )
    }
}

/// `[(String?, String)]` は Equatable でないタプル配列なので、比較用に包む。
private struct Pair: Equatable {
    let id: String?
    let text: String
    init(_ tuple: (String?, String)) {
        id = tuple.0
        text = tuple.1
    }
}
