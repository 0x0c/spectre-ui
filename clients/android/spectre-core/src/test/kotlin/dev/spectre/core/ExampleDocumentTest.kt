package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import kotlinx.coroutines.runBlocking
import java.io.File
import org.junit.jupiter.api.DisplayName
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * examples/screens/product-detail.json を実際に読み込んで解決する。
 *
 * コーパスが個々の規則を検証するのに対し、こちらは「設計時に書いたサンプルが
 * 本当に動く形式になっているか」を確認する統合的なテスト。
 */
class ExampleDocumentTest {

    private val documentText: String by lazy {
        File(Conformance.examplesDir, "screens/product-detail.json").readText()
    }

    private val env = SpValue.Obj(
        mapOf(
            "platform" to SpValue.Str("android"),
            "locale" to SpValue.Str("ja-JP"),
            "timeZone" to SpValue.Str("Asia/Tokyo"),
            "appVersion" to SpValue.Str("3.14.0"),
            "theme" to SpValue.Str("light"),
        )
    )

    private fun load(): Document = DocumentParser.parse(documentText)

    private fun scopeOf(document: Document) =
        EvalScope(data = document.data, state = document.state, env = env)

    @Test
    @DisplayName("サンプルドキュメントが解析できる")
    fun parsesExampleDocument() {
        val document = load()
        assertEquals("1.0", document.schemaVersion)
        assertEquals("product_detail", document.id)
        assertEquals("Screen", document.root.type)
        assertEquals(2, document.overlays.size)
        assertTrue(document.meta.pullToRefresh)
    }

    @Test
    @DisplayName("Screen の appBar と bottomBar が子ノードとして振り分けられる")
    fun splitsAppBarAndBottomBarIntoNodeProps() {
        val root = load().root
        // マニフェスト由来の nodePaths によって、props ではなく nodeProps に入る
        assertEquals(listOf("appBar.actions[]", "bottomBar"), root.nodeProps.keys.toList())
        assertEquals(1, root.nodeProps["appBar.actions[]"]?.size)
        assertEquals("Button", root.nodeProps["appBar.actions[]"]?.first()?.type)
        assertEquals("HStack", root.nodeProps["bottomBar"]?.first()?.type)
        // appBar 自体は title を持ったまま props に残る
        assertContains((root.props["appBar"] as SpValue.Obj).entries.keys, "title")
    }

    @Test
    @DisplayName("解決すると式が値になり、条件付きノードが取り除かれる")
    fun resolvesExpressionsIntoValues() {
        val document = load()
        val result = Resolver().resolve(document, scopeOf(document))
        val root = assertNotNull(result.root)

        val texts = collect(root).filter { it.type == "Text" }
        val rendered = texts.mapNotNull { it.prop("text").asStringOrNull }

        assertContains(rendered, "ハンドドリップ コーヒーケトル 900ml")
        // formatCurrency の結果はロケール依存なので、桁区切りだけを確認する
        assertTrue(
            rendered.any { it.contains("6,800") },
            "価格が整形されて描画されていません: $rendered",
        )

        // stock=3 なので在庫バッジは残り、割引バッジも残る
        val badges = collect(root).filter { it.type == "Badge" }
        assertContains(badges.mapNotNull { it.prop("text").asStringOrNull }, "残り3点")
        assertContains(badges.mapNotNull { it.prop("text").asStringOrNull }, "20%OFF")
    }

    @Test
    @DisplayName("visibleWhen が偽のノードは木に現れない")
    fun omitsNodesWhoseVisibleWhenIsFalse() {
        val document = load()
        // 在庫を 0 にすると在庫バッジが消える
        val data = document.data.settingPath("product.stock", SpValue.Num(0.0))
        val result = Resolver().resolve(document, scopeOf(document).copy(data = data))
        val badges = collect(assertNotNull(result.root)).filter { it.type == "Badge" }
        assertFalse(
            badges.any { it.prop("text").asStringOrNull?.startsWith("残り") == true },
            "在庫 0 なのに在庫バッジが描画されています",
        )
    }

    @Test
    @DisplayName("未対応の Carousel は fallback に劣化する")
    fun degradesUnsupportedCarouselToFallback() {
        val document = load()
        val data = document.data.settingPath(
            "related",
            SpValue.Arr(
                listOf(
                    SpValue.Obj(
                        mapOf(
                            "id" to SpValue.Str("SKU-2"),
                            "name" to SpValue.Str("ドリッパー"),
                            "price" to SpValue.Num(2400.0),
                            "imageUrl" to SpValue.Str("https://cdn.example.com/p/2.jpg"),
                        )
                    )
                )
            )
        )
        val result = Resolver().resolve(document, scopeOf(document).copy(data = data))
        val root = assertNotNull(result.root)

        // Carousel はカタログにないので fallback (Section + List) が描画される
        assertTrue(
            result.degradations.any { it.nodeType == "Carousel" && it.degradedTo == DegradedTo.FALLBACK },
            "Carousel の劣化が記録されていません: ${result.degradations}",
        )
        assertFalse(collect(root).any { it.type == "Carousel" }, "レンダラに未知の型が渡っています")
        assertContains(collect(root).map { it.type }, "Card")
        assertContains(
            collect(root).filter { it.type == "Text" }.mapNotNull { it.prop("text").asStringOrNull },
            "ドリッパー",
        )
    }

    @Test
    @DisplayName("repeat が関連商品の件数ぶん展開される")
    fun expandsRepeatOverRelatedProducts() {
        val document = load()
        val related = SpValue.Arr(
            (1..3).map { i ->
                SpValue.Obj(
                    mapOf(
                        "id" to SpValue.Str("SKU-$i"),
                        "name" to SpValue.Str("商品$i"),
                        "price" to SpValue.Num(1000.0 * i),
                        "imageUrl" to SpValue.Str("https://cdn.example.com/p/$i.jpg"),
                    )
                )
            }
        )
        val data = document.data.settingPath("related", related)
        val result = Resolver().resolve(document, scopeOf(document).copy(data = data))
        val cards = collect(assertNotNull(result.root)).filter { it.type == "Card" }
        assertEquals(3, cards.size)
        assertEquals(listOf("SKU-1", "SKU-2", "SKU-3"), cards.map { it.key })
    }

    @Test
    @DisplayName("アクションは解決されず、タップ時点の state で評価される")
    fun evaluatesActionsAtDispatchTime() = runBlocking {
        val document = load()
        val result = Resolver().resolve(document, scopeOf(document))
        val button = collect(assertNotNull(result.root)).first { it.id == "add_to_cart" }

        // 解決後もアクションは式のまま保持されている
        val onTap = button.actions("onTap")
        assertTrue(onTap.isNotEmpty(), "onTap が失われています")

        val store = Store(initialData = document.data, initialState = document.state, env = env)
        val host = RecordingHost()
        val dispatched = ActionDispatcher(host = host).dispatch(onTap, store)

        // adding が true -> false と遷移し、リクエストが 1 回だけ飛ぶ
        assertEquals(SpValue.Bool(false), store.state.path("adding"))
        assertEquals(1, host.requests.size)
        assertEquals("cart.add", host.requests.first().endpoint)

        // body の式が「その時点の state」で解決されている (selectedSize=900, qty=1)
        val body = host.requests.first().body as SpValue.Obj
        assertEquals(SpValue.Str("SKU-1042"), body.entries["productId"])
        assertEquals(SpValue.Str("900"), body.entries["size"])
        assertEquals(SpValue.Num(1.0), body.entries["qty"])

        // 成功時にトーストが出て、計測イベントが送られる
        assertTrue(
            dispatched.uiEffects.any { it is SpectreUiEffect.ShowOverlay && it.id == "added_toast" },
            "成功トーストが発火していません: ${dispatched.uiEffects}",
        )
        assertContains(host.trackedEvents, "cart_add")
    }

    @Test
    @DisplayName("Stepper で数量を増やすとリクエストの body に反映される")
    fun reflectsQuantityChangeInRequestBody() = runBlocking {
        val document = load()
        val store = Store(initialData = document.data, initialState = document.state, env = env)

        // Stepper の onChange 相当 — 直接 state を更新する
        store.setState("qty", SpValue.Num(3.0))

        val result = Resolver().resolve(document, store.scope())
        val button = collect(assertNotNull(result.root)).first { it.id == "add_to_cart" }
        val host = RecordingHost()
        ActionDispatcher(host = host).dispatch(button.actions("onTap"), store)

        val body = host.requests.first().body as SpValue.Obj
        assertEquals(SpValue.Num(3.0), body.entries["qty"])
    }

    @Test
    @DisplayName("もっと見るボタンが説明文の行数制限を切り替える")
    fun togglesDescriptionLineLimit() {
        val document = load()
        val store = Store(initialData = document.data, initialState = document.state, env = env)

        fun maxLinesOf(): SpValue {
            val result = Resolver().resolve(document, store.scope())
            return collect(assertNotNull(result.root)).first { it.id == "description" }.prop("maxLines")
        }

        assertEquals(SpValue.Num(3.0), maxLinesOf())
        store.setState("descExpanded", SpValue.Bool(true))
        assertEquals(SpValue.Null, maxLinesOf())
    }

    @Test
    @DisplayName("onAppear の計測イベントが発火する")
    fun firesOnAppearTracking() = runBlocking {
        val document = load()
        val store = Store(initialData = document.data, initialState = document.state, env = env)
        val host = RecordingHost()
        ActionDispatcher(host = host).dispatch(document.onAppear, store)
        assertContains(host.trackedEvents, "product_view")
    }

    // -- ヘルパ ---------------------------------------------------------------

    private fun collect(node: RenderNode): List<RenderNode> =
        listOf(node) + node.children.flatMap { collect(it) } +
            node.nodeProps.values.flatten().flatMap { collect(it) }

    private class RecordingHost : SpectreHostDelegate {
        val requests = ArrayList<SpectreRequest>()
        val trackedEvents = ArrayList<String>()

        override suspend fun performRequest(request: SpectreRequest): SpectreActionResponse {
            requests.add(request)
            return SpectreActionResponse(ok = true)
        }

        override fun navigate(destination: SpectreDestination): Boolean = true
        override suspend fun performHostAction(name: String, params: SpValue): SpValue? = null
        override fun track(event: String, properties: SpValue) { trackedEvents.add(event) }
        override fun openUrl(url: String, mode: String): Boolean = true
    }
}
