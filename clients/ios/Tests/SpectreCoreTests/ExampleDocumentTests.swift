import XCTest
@testable import SpectreCore

/// examples/screens/product-detail.json を実際に読み込んで解決する。
///
/// コーパスが個々の規則を検証するのに対し、こちらは「設計時に書いたサンプルが
/// 本当に動く形式になっているか」を確認する統合的なテスト。
/// Kotlin の `ExampleDocumentTest.kt` と同じシナリオを踏んでいるので、
/// 片方だけ落ちればそれがプラットフォーム間のドリフトになる。
final class ExampleDocumentTests: XCTestCase {

    private let env = SpValue.object([
        "platform": .string("ios"),
        "locale": .string("ja-JP"),
        "timeZone": .string("Asia/Tokyo"),
        "appVersion": .string("3.14.0"),
        "theme": .string("light"),
    ])

    private func load() throws -> Document {
        let url = Conformance.examplesDir.appendingPathComponent("screens/product-detail.json")
        return try DocumentParser.parse(text: try String(contentsOf: url, encoding: .utf8))
    }

    private func scope(_ document: Document, data: SpValue? = nil) -> EvalScope {
        EvalScope(data: data ?? document.data, state: document.state, env: env)
    }

    private func collect(_ node: RenderNode) -> [RenderNode] {
        [node]
            + node.children.flatMap { collect($0) }
            + node.nodeProps.values.flatMap { $0 }.flatMap { collect($0) }
    }

    private func find(_ root: RenderNode, id: String) -> RenderNode? {
        collect(root).first { $0.nodeID == id }
    }

    func testParsesExampleDocument() throws {
        let document = try load()
        XCTAssertEqual(document.schemaVersion, "1.0")
        XCTAssertEqual(document.id, "product_detail")
        XCTAssertEqual(document.root.type, "Screen")
        XCTAssertEqual(document.overlays.count, 2)
        XCTAssertTrue(document.meta.pullToRefresh)
    }

    /// マニフェスト由来の nodePaths によって、props ではなく nodeProps に入る。
    func testSplitsAppBarAndBottomBarIntoNodeProps() throws {
        let root = try load().root
        XCTAssertEqual(Set(root.nodeProps.keys), ["appBar.actions[]", "bottomBar"])
        XCTAssertEqual(root.nodeProps["appBar.actions[]"]?.count, 1)
        XCTAssertEqual(root.nodeProps["appBar.actions[]"]?.first?.type, "Button")
        XCTAssertEqual(root.nodeProps["bottomBar"]?.first?.type, "HStack")
        // appBar 自体は title を持ったまま props に残る
        XCTAssertNotNil(root.props["appBar"]?["title"])
    }

    func testResolvesExpressionsIntoValues() throws {
        let document = try load()
        let result = Resolver().resolve(document, scope: scope(document))
        let root = try XCTUnwrap(result.root)

        let rendered = collect(root).filter { $0.type == "Text" }.map { $0.prop("text").stringify() }
        XCTAssertTrue(rendered.contains("ハンドドリップ コーヒーケトル 900ml"))
        // formatCurrency の結果はロケール依存なので、桁区切りだけを確認する
        XCTAssertTrue(
            rendered.contains { $0.contains("6,800") },
            "価格が整形されて描画されていません: \(rendered)"
        )

        // stock=3 なので在庫バッジは残り、割引バッジも残る
        let badges = collect(root).filter { $0.type == "Badge" }.map { $0.prop("text").stringify() }
        XCTAssertTrue(badges.contains("残り3点"), "在庫バッジがありません: \(badges)")
        XCTAssertTrue(badges.contains("20%OFF"), "割引バッジがありません: \(badges)")
    }

    func testOmitsNodesWhoseVisibleWhenIsFalse() throws {
        let document = try load()
        // 在庫を 0 にすると在庫バッジが消える
        let data = document.data.settingPath("product.stock", to: .number(0))
        let result = Resolver().resolve(document, scope: scope(document, data: data))
        let badges = collect(try XCTUnwrap(result.root)).filter { $0.type == "Badge" }
        XCTAssertFalse(
            badges.contains { $0.prop("text").stringify().hasPrefix("残り") },
            "在庫 0 なのに在庫バッジが描画されています"
        )
    }

    func testDegradesUnsupportedCarouselToFallback() throws {
        let document = try load()
        let data = document.data.settingPath("related", to: .array([
            .object([
                "id": .string("SKU-2"),
                "name": .string("ドリッパー"),
                "price": .number(2400),
                "imageUrl": .string("https://cdn.example.com/p/2.jpg"),
            ])
        ]))
        let result = Resolver().resolve(document, scope: scope(document, data: data))
        let root = try XCTUnwrap(result.root)

        // Carousel はカタログにないので fallback (Section + List) が描画される
        XCTAssertTrue(
            result.degradations.contains { $0.nodeType == "Carousel" && $0.degradedTo == .fallback },
            "Carousel の劣化が記録されていません: \(result.degradations)"
        )
        XCTAssertFalse(
            collect(root).contains { $0.type == "Carousel" },
            "レンダラに未知の型が渡っています"
        )
        XCTAssertTrue(collect(root).contains { $0.type == "Card" })
        XCTAssertTrue(
            collect(root).filter { $0.type == "Text" }
                .contains { $0.prop("text").stringify() == "ドリッパー" }
        )
    }

    func testExpandsRepeatOverRelatedProducts() throws {
        let document = try load()
        let related = SpValue.array((1...3).map { i in
            .object([
                "id": .string("SKU-\(i)"),
                "name": .string("商品\(i)"),
                "price": .number(Double(1000 * i)),
                "imageUrl": .string("https://cdn.example.com/p/\(i).jpg"),
            ])
        })
        let data = document.data.settingPath("related", to: related)
        let result = Resolver().resolve(document, scope: scope(document, data: data))
        let cards = collect(try XCTUnwrap(result.root)).filter { $0.type == "Card" }
        XCTAssertEqual(cards.count, 3)
        XCTAssertEqual(cards.map(\.key), ["SKU-1", "SKU-2", "SKU-3"])
    }

    /// 解決後もアクションは式のまま保持され、ディスパッチ時点の state で評価される。
    func testEvaluatesActionsAtDispatchTime() async throws {
        let document = try load()
        let result = Resolver().resolve(document, scope: scope(document))
        let button = try XCTUnwrap(find(try XCTUnwrap(result.root), id: "add_to_cart"))

        let onTap = button.actions("onTap")
        XCTAssertFalse(onTap.isEmpty, "onTap が失われています")

        let store = Store(data: document.data, state: document.state, env: env)
        let host = RecordingHost()
        let dispatched = await ActionDispatcher(host: host).dispatch(onTap, store: store)

        // adding が true -> false と遷移し、リクエストが 1 回だけ飛ぶ
        XCTAssertEqual(store.state.path("adding"), .bool(false))
        XCTAssertEqual(host.requests.count, 1)
        XCTAssertEqual(host.requests.first?.endpoint, "cart.add")

        // body の式が「その時点の state」で解決されている (selectedSize=900, qty=1)
        let body = try XCTUnwrap(host.requests.first?.body)
        XCTAssertEqual(body["productId"], .string("SKU-1042"))
        XCTAssertEqual(body["size"], .string("900"))
        XCTAssertEqual(body["qty"], .number(1))

        // 成功時にトーストが出て、計測イベントが送られる
        XCTAssertTrue(
            dispatched.uiEffects.contains {
                if case .showOverlay(let id) = $0 { return id == "added_toast" }
                return false
            },
            "成功トーストが発火していません"
        )
        XCTAssertTrue(host.trackedEvents.contains("cart_add"))
    }

    func testReflectsQuantityChangeInRequestBody() async throws {
        let document = try load()
        let store = Store(data: document.data, state: document.state, env: env)
        // Stepper の onChange 相当 — 直接 state を更新する
        store.setState("qty", .number(3))

        let result = Resolver().resolve(document, scope: store.scope())
        let button = try XCTUnwrap(find(try XCTUnwrap(result.root), id: "add_to_cart"))
        let host = RecordingHost()
        _ = await ActionDispatcher(host: host).dispatch(button.actions("onTap"), store: store)

        XCTAssertEqual(host.requests.first?.body["qty"], .number(3))
    }

    func testTogglesDescriptionLineLimit() throws {
        let document = try load()
        let store = Store(data: document.data, state: document.state, env: env)

        func maxLines() throws -> SpValue {
            let result = Resolver().resolve(document, scope: store.scope())
            return try XCTUnwrap(find(try XCTUnwrap(result.root), id: "description")).prop("maxLines")
        }

        XCTAssertEqual(try maxLines(), .number(3))
        store.setState("descExpanded", .bool(true))
        XCTAssertEqual(try maxLines(), .null)
    }

    func testFiresOnAppearTracking() async throws {
        let document = try load()
        let store = Store(data: document.data, state: document.state, env: env)
        let host = RecordingHost()
        _ = await ActionDispatcher(host: host).dispatch(document.onAppear, store: store)
        XCTAssertTrue(host.trackedEvents.contains("product_view"))
    }
}

/// examples/screens/settings-form.json による入力バインドと条件分岐の検証。
/// Kotlin の `SettingsFormDocumentTest.kt` と対になっている。
final class SettingsFormDocumentTests: XCTestCase {

    private let env = SpValue.object([
        "platform": .string("ios"),
        "locale": .string("ja-JP"),
        "appVersion": .string("3.14.0"),
    ])

    private func load() throws -> Document {
        let url = Conformance.examplesDir.appendingPathComponent("screens/settings-form.json")
        return try DocumentParser.parse(text: try String(contentsOf: url, encoding: .utf8))
    }

    private func store(_ document: Document) -> Store {
        Store(data: document.data, state: document.state, env: env)
    }

    private func resolve(_ document: Document, _ store: Store) throws -> RenderNode {
        try XCTUnwrap(Resolver().resolve(document, scope: store.scope()).root)
    }

    private func collect(_ node: RenderNode) -> [RenderNode] {
        [node]
            + node.children.flatMap { collect($0) }
            + node.nodeProps.values.flatMap { $0 }.flatMap { collect($0) }
    }

    private func find(_ root: RenderNode, id: String) -> RenderNode? {
        collect(root).first { $0.nodeID == id }
    }

    func testResolvesAllInputComponents() throws {
        let document = try load()
        let types = Set(collect(try resolve(document, store(document))).map(\.type))
        for expected in ["Tabs", "Toggle", "RadioGroup", "Select", "Slider", "TextField", "Checkbox", "Button"] {
            XCTAssertTrue(types.contains(expected), "\(expected) が解決されていません")
        }
    }

    func testExpandsOptionsFromData() throws {
        let document = try load()
        let root = try resolve(document, store(document))

        let radio = try XCTUnwrap(find(root, id: "frequency_picker"))
        let options = try XCTUnwrap(radio.prop("options").asArray)
        XCTAssertEqual(options.count, 3)
        XCTAssertEqual(options.first?["label"], .string("リアルタイム"))

        let select = try XCTUnwrap(find(root, id: "category_select"))
        XCTAssertEqual(select.prop("options").asArray?.count, 3)
    }

    func testHidesFrequencySectionWhenAllNotificationsOff() throws {
        let document = try load()
        let s = store(document)
        XCTAssertNotNil(find(try resolve(document, s), id: "frequency_picker"))

        s.setState("pushEnabled", .bool(false))
        s.setState("mailEnabled", .bool(false))
        XCTAssertNil(
            find(try resolve(document, s), id: "frequency_picker"),
            "通知がすべてオフなのに頻度セクションが残っています"
        )
    }

    func testSubtitleFollowsSliderValue() throws {
        let document = try load()
        let s = store(document)

        func subtitle() throws -> String? {
            collect(try resolve(document, s))
                .first { $0.type == "Section" && $0.prop("title").asString == "サイレント時間" }?
                .prop("subtitle").asString
        }

        XCTAssertEqual(try subtitle(), "22時以降は通知しません")
        s.setState("quietHours", .number(20))
        XCTAssertEqual(try subtitle(), "20時以降は通知しません")
    }

    func testSaveButtonDisabledUntilAgreed() throws {
        let document = try load()
        let s = store(document)
        XCTAssertEqual(try XCTUnwrap(find(try resolve(document, s), id: "save_btn")).prop("enabled"), .bool(false))
        s.setState("agreed", .bool(true))
        XCTAssertEqual(try XCTUnwrap(find(try resolve(document, s), id: "save_btn")).prop("enabled"), .bool(true))
    }

    /// メールアドレスが不正なら condition が検証エラーを立て、リクエストを送らない。
    func testConditionBlocksSaveWhenEmailInvalid() async throws {
        let document = try load()
        let s = store(document)
        s.setState("agreed", .bool(true))
        s.setState("email", .string("not-an-email"))

        let button = try XCTUnwrap(find(try resolve(document, s), id: "save_btn"))
        let host = RecordingHost()
        _ = await ActionDispatcher(host: host).dispatch(button.actions("onTap"), store: s)

        XCTAssertEqual(s.state.path("emailError"), .string("メールアドレスの形式が正しくありません"))
        XCTAssertTrue(host.requests.isEmpty, "検証に失敗しているのにリクエストが送信されました")
    }

    func testSendsSaveRequestWithCurrentState() async throws {
        let document = try load()
        let s = store(document)
        s.setState("agreed", .bool(true))
        s.setState("frequency", .string("weekly"))
        s.setState("quietHours", .number(23))

        let button = try XCTUnwrap(find(try resolve(document, s), id: "save_btn"))
        let host = RecordingHost()
        let result = await ActionDispatcher(host: host).dispatch(button.actions("onTap"), store: s)

        XCTAssertEqual(host.requests.count, 1)
        let body = try XCTUnwrap(host.requests.first?.body)
        XCTAssertEqual(body["frequency"], .string("weekly"))
        XCTAssertEqual(body["quietHours"], .number(23))
        XCTAssertEqual(body["push"], .bool(true))

        // loadingPath が true -> false と往復して戻っている
        XCTAssertEqual(s.state.path("saving"), .bool(false))
        XCTAssertTrue(result.uiEffects.contains {
            if case .showOverlay(let id) = $0 { return id == "saved_toast" }
            return false
        })
    }

    func testShowsAlertAndAbortsOnFailure() async throws {
        let document = try load()
        let s = store(document)
        s.setState("agreed", .bool(true))

        let button = try XCTUnwrap(find(try resolve(document, s), id: "save_btn"))
        let host = RecordingHost(failWith: SpectreErrorPayload(code: "SERVER", message: "サーバが混み合っています"))
        let result = await ActionDispatcher(host: host).dispatch(button.actions("onTap"), store: s)

        XCTAssertTrue(result.uiEffects.contains {
            if case .showOverlay(let id) = $0 { return id == "save_error" }
            return false
        }, "失敗アラートが発火していません")
        // onSuccess の track は実行されない
        XCTAssertFalse(host.trackedEvents.contains("settings_saved"))
        XCTAssertEqual(s.state.path("saving"), .bool(false))
    }

    func testResetPatchRestoresDefaults() async throws {
        let document = try load()
        let s = store(document)
        s.setState("pushEnabled", .bool(false))
        s.setState("frequency", .string("weekly"))
        s.setState("quietHours", .number(18))

        let button = try XCTUnwrap(find(try resolve(document, s), id: "reset_btn"))
        _ = await ActionDispatcher(host: RecordingHost()).dispatch(button.actions("onTap"), store: s)

        XCTAssertEqual(s.state.path("pushEnabled"), .bool(true))
        XCTAssertEqual(s.state.path("frequency"), .string("daily"))
        XCTAssertEqual(s.state.path("quietHours"), .number(22))
    }

    /// error スコープが無い状態では default() の代替値になる。
    func testErrorOverlayResolvesErrorScope() throws {
        let document = try load()
        let overlays = Resolver().resolve(document, scope: store(document).scope()).overlays
        let alert = try XCTUnwrap(overlays.first { $0.id == "save_error" })
        XCTAssertEqual(alert.props["message"]?.asString, "通信に失敗しました")
    }

    func testHelpButtonOpensURL() async throws {
        let document = try load()
        let s = store(document)
        let button = try XCTUnwrap(find(try resolve(document, s), id: "help_btn"))
        let host = RecordingHost()
        _ = await ActionDispatcher(host: host).dispatch(button.actions("onTap"), store: s)
        XCTAssertTrue(host.openedURLs.contains("https://example.com/help/notifications"))
    }
}

/// 記録するだけのホスト。`failWith` を渡すと常に失敗を返す。
final class RecordingHost: SpectreHostDelegate {
    private let failWith: SpectreErrorPayload?
    private(set) var requests: [SpectreRequest] = []
    private(set) var trackedEvents: [String] = []
    private(set) var openedURLs: [String] = []

    init(failWith: SpectreErrorPayload? = nil) {
        self.failWith = failWith
    }

    func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse {
        requests.append(request)
        if let failWith { return SpectreActionResponse(ok: false, error: failWith) }
        return SpectreActionResponse(ok: true)
    }

    func navigate(to destination: SpectreDestination) -> Bool { true }
    func performHostAction(name: String, params: SpValue) async throws -> SpValue? { nil }
    func track(event: String, properties: SpValue) { trackedEvents.append(event) }
    func openURL(_ url: String, mode: String) -> Bool { openedURLs.append(url); return true }
}
