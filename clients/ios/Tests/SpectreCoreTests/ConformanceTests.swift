import XCTest
@testable import SpectreCore

/// spec/conformance の全ケースを実行する。
///
/// このコーパスは Swift / Kotlin / TypeScript の3実装が同じ入力に対して
/// 同じ結果を返すことを機械的に保証するためのもの (docs/tech-selection.md ADR-0008)。
/// Kotlin 側 (`ConformanceExprTest.kt` ほか) と同じファイルを読んでいるので、
/// 片方だけ通って片方が落ちれば、それがそのままドリフトの検出になる。
enum Conformance {

    /// リポジトリルート。#filePath から辿る。
    /// <root>/clients/ios/Tests/SpectreCoreTests/ConformanceTests.swift
    static let repoRoot: URL = {
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { url.deleteLastPathComponent() }
        return url
    }()

    static var corpusDir: URL { repoRoot.appendingPathComponent("spec/conformance") }
    static var examplesDir: URL { repoRoot.appendingPathComponent("examples") }

    static func loadDir(_ name: String) throws -> [(String, SpValue)] {
        let dir = corpusDir.appendingPathComponent(name)
        let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        return try files.map { url in
            (url.lastPathComponent, try SpValue.from(jsonData: try Data(contentsOf: url)))
        }
    }

    /// 数値は微小な誤差を許容して比較する。
    ///
    /// `round(1.2345, 2)` のような計算は 10 のべき乗を経由するため、
    /// プラットフォームによって最下位ビットがずれうる。
    static func valuesEqual(_ a: SpValue, _ b: SpValue) -> Bool {
        switch (a, b) {
        case (.number(let x), .number(let y)):
            return x == y || abs(x - y) < 1e-9
        case (.array(let xs), .array(let ys)):
            return xs.count == ys.count && zip(xs, ys).allSatisfy { valuesEqual($0, $1) }
        case (.object(let xs), .object(let ys)):
            return Set(xs.keys) == Set(ys.keys)
                && xs.allSatisfy { key, value in valuesEqual(value, ys[key]!) }
        default:
            return a == b
        }
    }

    static func describe(_ value: SpValue) -> String {
        if case .string(let s) = value { return "\"\(s)\"" }
        if case .null = value { return "null" }
        return value.stringify()
    }

    /// `RenderNode` をコーパスの期待値と同じ形に正規化する。
    ///
    /// 空のフィールドは出力しない。既定値の適用は描画時であって解決時ではないため、
    /// ソースに現れなかったプロパティはここにも現れない。プレースホルダ
    /// (`RenderNode.placeholderType`) はマニフェストに存在しないため `acceptsChildren` は
    /// 常に false 扱いになり、`children` を出力しない (葉ノードと同じ扱いでよい)。
    static func normalizeRenderNode(_ node: RenderNode) -> SpValue {
        var out: [String: SpValue] = ["type": .string(node.type)]
        if let nodeID = node.nodeID { out["id"] = .string(nodeID) }
        if let key = node.key { out["key"] = .string(key) }

        var props = node.props
        for (key, value) in node.rawProps { props[key] = value }
        for (path, nodes) in node.nodeProps {
            props[path] = .array(nodes.map { normalizeRenderNode($0) })
        }
        if !props.isEmpty { out["props"] = .object(props) }

        if !node.layout.isEmpty { out["layout"] = .object(node.layout) }
        if !node.style.isEmpty { out["style"] = .object(node.style) }
        if !node.a11y.isEmpty { out["a11y"] = .object(node.a11y) }

        // 子を取れるコンポーネントは、0件でも children を出力する。
        // 「repeat が何も生まなかったコンテナ」と「そもそも子を持たない葉」は別物。
        if GeneratedCatalog.spec(node.type)?.acceptsChildren == true {
            out["children"] = .array(node.children.map { normalizeRenderNode($0) })
        }
        return .object(out)
    }

    /// 「document + capabilities -> 正規化された RenderTree + degradations」のケースを1件実行する。
    ///
    /// `resolve/resolver.json` (基本の解決規則) と `compat/` (ケイパビリティ由来の劣化) の
    /// 両方が同じ形のケースを使うため、`ConformanceResolveTests` と `ConformanceCompatTests` で共有する。
    static func runResolveCase(_ raw: SpValue, name: String) throws {
        guard let documentValue = raw["document"] else { return }
        let document = try DocumentParser.parse(value: documentValue)

        // ケイパビリティ指定がなければカタログ全体を対応済みとみなす。
        let supported: Set<String> = raw["capabilities"]?["components"]?.asArray
            .map { Set($0.compactMap(\.asString)) } ?? GeneratedCatalog.componentNames

        let scope = EvalScope(
            data: document.data,
            state: document.state,
            env: raw["env"] ?? .emptyObject
        )
        let result = Resolver(supportedComponents: supported).resolve(document, scope: scope)

        if let expected = raw["expect"] {
            let actual = result.root.map(normalizeRenderNode) ?? .null
            XCTAssertTrue(
                valuesEqual(actual, expected),
                """
                \(name): 解決結果が期待と異なります
                  期待: \(expected.stringify())
                  実際: \(actual.stringify())
                """
            )
        }

        if let expectedDegradations = raw["expectDegradations"]?.asArray {
            let actual = result.degradations.map { degradation in
                SpValue.object([
                    "nodeType": .string(degradation.nodeType),
                    "degradedTo": .string(degradation.degradedTo.rawValue),
                ])
            }
            XCTAssertEqual(
                actual.count, expectedDegradations.count,
                "\(name): 劣化の件数が異なります (実際: \(SpValue.array(actual).stringify()))"
            )
            for (i, expected) in expectedDegradations.enumerated() where i < actual.count {
                XCTAssertTrue(
                    valuesEqual(actual[i], expected),
                    "\(name): 劣化[\(i)] が期待と異なります"
                )
            }
        }
    }
}

// MARK: - 式

final class ConformanceExprTests: XCTestCase {

    func testExpressionCorpus() throws {
        for (fileName, doc) in try Conformance.loadDir("expr") {
            let advisory = doc["advisory"]?.asBool ?? false
            let scopeValue = doc["scope"]
            let scope = EvalScope(
                data: scopeValue?["data"] ?? .emptyObject,
                state: scopeValue?["state"] ?? .emptyObject,
                env: scopeValue?["env"] ?? .emptyObject
            )

            for (index, raw) in (doc["cases"]?.asArray ?? []).enumerated() {
                guard let source = raw["expr"]?.asString else { continue }
                let label = "\(fileName)[\(index)] \(source)"

                // 評価器はケースごとに作る。キャッシュ越しの状態が結果に影響しないことも
                // 同時に確認できる。
                let result = TemplateEvaluator().evaluate(source, scope: scope)

                if let expected = raw["expect"] {
                    XCTAssertTrue(
                        Conformance.valuesEqual(result.value, expected),
                        """
                        \(label) の評価結果が期待と異なります
                          期待: \(Conformance.describe(expected))
                          実際: \(Conformance.describe(result.value))
                        """
                    )
                }

                if let expectedError = raw["error"]?.asString {
                    XCTAssertTrue(
                        result.errors.contains { $0.code.rawValue == expectedError },
                        "\(label) は \(expectedError) を記録するはずですが "
                            + "\(result.errors.map(\.code.rawValue)) でした"
                    )
                } else if !advisory {
                    XCTAssertTrue(
                        result.errors.isEmpty,
                        "\(label) はエラーなく評価されるはずですが "
                            + "\(result.errors.map { "\($0.code.rawValue): \($0.message)" }) が記録されました"
                    )
                }

                if let asBoolean = raw["asBoolean"]?.asBool {
                    XCTAssertEqual(result.value.isTruthy, asBoolean, "\(label) の真偽判定が期待と異なります")
                }

                // ロケール依存の書式は完全一致を要求せず、部分一致だけを検査する。
                for needle in raw["contains"]?.asArray ?? [] {
                    guard let expected = needle.asString else { continue }
                    XCTAssertTrue(
                        result.value.stringify().contains(expected),
                        "\(label) の結果 \"\(result.value.stringify())\" に \"\(expected)\" が含まれていません"
                    )
                }

                if let pattern = raw["matches"]?.asString {
                    let text = result.value.stringify()
                    let matched = text.range(of: pattern, options: .regularExpression) != nil
                    XCTAssertTrue(matched, "\(label) の結果 \"\(text)\" が /\(pattern)/ にマッチしません")
                }
            }
        }
    }
}

// MARK: - 解決

final class ConformanceResolveTests: XCTestCase {

    func testResolverCorpus() throws {
        let doc = try Conformance.loadDir("resolve").first { $0.0 == "resolver.json" }!.1
        for raw in doc["cases"]?.asArray ?? [] {
            try Conformance.runResolveCase(raw, name: raw["name"]?.asString ?? "(no name)")
        }
    }
}

// MARK: - 互換性

/// spec/conformance/compat/ の全ケースを実行する (SU-0008)。
///
/// `resolve/resolver.json` がノード解決の基本規則を検証するのに対し、こちらは
/// ケイパビリティ由来の劣化 (fallback → optional による省略 → プレースホルダ、
/// docs/compatibility.md §3, ADR-0006) だけに焦点を当てる。iOS/Android が同じ木・
/// 同じ degradations 列を出すことを保証する (SU-0007 の compat/ 区分)。
final class ConformanceCompatTests: XCTestCase {

    func testCompatCorpus() throws {
        for (fileName, doc) in try Conformance.loadDir("compat") {
            for raw in doc["cases"]?.asArray ?? [] {
                let name = "\(fileName): \(raw["name"]?.asString ?? "(no name)")"
                try Conformance.runResolveCase(raw, name: name)
            }
        }
    }
}

// MARK: - アクション

final class ConformanceActionsTests: XCTestCase {

    func testActionCorpus() async throws {
        let doc = try Conformance.loadDir("resolve").first { $0.0 == "actions.json" }!.1

        for raw in doc["cases"]?.asArray ?? [] {
            let name = raw["name"]?.asString ?? "(no name)"
            let store = Store(
                data: raw["data"] ?? .emptyObject,
                state: raw["state"] ?? .emptyObject,
                env: raw["env"] ?? .emptyObject
            )
            let host = FakeHost(responses: raw["responses"] ?? .emptyObject)
            let maxActions = raw["limits"]?["maxActionsPerDispatch"]?.asInt
                ?? SpectreLimits.maxActionsPerDispatch

            let dispatcher = ActionDispatcher(host: host, maxActions: maxActions)
            let result = await dispatcher.dispatch(raw["actions"]?.asArray ?? [], store: store)

            if let expected = raw["expectState"] {
                XCTAssertTrue(
                    Conformance.valuesEqual(store.state, expected),
                    """
                    \(name): 遷移後の state が期待と異なります
                      期待: \(expected.stringify())
                      実際: \(store.state.stringify())
                    """
                )
            }

            if let expected = raw["expectEffects"] {
                XCTAssertTrue(
                    Conformance.valuesEqual(.array(result.effects), expected),
                    """
                    \(name): 発火した副作用が期待と異なります
                      期待: \(expected.stringify())
                      実際: \(SpValue.array(result.effects).stringify())
                    """
                )
            }
        }
    }

    /// コーパスの `responses` を返すだけのホスト。
    ///
    /// 登録されていないエンドポイントを `ENDPOINT_NOT_REGISTERED` で失敗させるのは
    /// 実際のホストアプリと同じ責務 — ドキュメントには論理名しか書かれておらず、
    /// それを実 URL に解決できるのはホストだけなので、未登録の判定もホスト側で行う。
    private final class FakeHost: SpectreHostDelegate {
        private let responses: SpValue

        init(responses: SpValue) { self.responses = responses }

        func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse {
            guard let entry = responses[request.endpoint], entry.asObject != nil else {
                return .failure(
                    code: "ENDPOINT_NOT_REGISTERED",
                    message: "エンドポイント '\(request.endpoint)' は登録されていません"
                )
            }
            return .from(ok: entry["ok"]?.asBool ?? true, body: entry["body"] ?? .emptyObject)
        }

        func navigate(to destination: SpectreDestination) -> Bool { true }
        func performHostAction(name: String, params: SpValue) async throws -> SpValue? { nil }
        func track(event: String, properties: SpValue) {}
        func openURL(_ url: String, mode: String) -> Bool { true }
    }
}

// MARK: - カタログ同期

final class CatalogSyncTests: XCTestCase {

    private func manifest() throws -> SpValue {
        let url = Conformance.repoRoot.appendingPathComponent("spec/component-manifest.json")
        return try SpValue.from(jsonData: try Data(contentsOf: url))
    }

    func testComponentNamesMatchManifest() throws {
        let components = try manifest()["components"]?.asArray ?? []
        let expected = Set(components.compactMap { $0["name"]?.asString })
        XCTAssertEqual(
            expected, GeneratedCatalog.componentNames,
            "マニフェストと生成物がずれています。`node packages/codegen/generate.mjs` を実行してください"
        )
    }

    func testPropNamesMatchManifest() throws {
        for component in try manifest()["components"]?.asArray ?? [] {
            guard let name = component["name"]?.asString else { continue }
            let expected = Set((component["props"]?.asObject ?? [:]).keys)
            guard let spec = GeneratedCatalog.spec(name) else {
                XCTFail("\(name) がカタログにありません")
                continue
            }
            XCTAssertEqual(expected, spec.propNames, "\(name) のプロパティ名がずれています")
        }
    }

    func testLimitsMatchManifest() throws {
        let limits = try manifest()["limits"]
        XCTAssertEqual(limits?["maxNodes"]?.asInt, SpectreLimits.maxNodes)
        XCTAssertEqual(limits?["maxDepth"]?.asInt, SpectreLimits.maxDepth)
        XCTAssertEqual(limits?["maxRepeatItems"]?.asInt, SpectreLimits.maxRepeatItems)
        XCTAssertEqual(
            limits?["maxActionsPerDispatch"]?.asInt,
            SpectreLimits.maxActionsPerDispatch
        )
    }

    /// ケイパビリティハッシュは Kotlin 実装と同じ値でなければならない。
    /// サーバは両プラットフォームから来たハッシュを同じ表として引くため、
    /// ここがずれると古い端末向けの劣化判定が壊れる。
    func testCapabilityHashIsStableAndSensitive() {
        let full = GeneratedCatalog.capabilityHash()
        let reduced = GeneratedCatalog.capabilityHash(
            supported: GeneratedCatalog.componentNames.subtracting(["Tabs"])
        )
        XCTAssertNotEqual(full, reduced, "対応集合が変わってもハッシュが変わっていません")
        XCTAssertEqual(full, GeneratedCatalog.capabilityHash(), "ハッシュが安定していません")
        XCTAssertEqual(full.count, 8)
    }
}
