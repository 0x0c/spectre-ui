package dev.spectre.core

import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.DisplayName
import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * examples/screens/settings-form.json による入力コンポーネントとアクションの検証。
 *
 * 商品詳細が「表示中心の画面」なのに対し、こちらは state の双方向バインドと
 * 条件分岐アクションを踏む。サンプルアプリで手を動かす前に、ロジックが
 * 意図どおり動くことをここで固定しておく。
 */
class SettingsFormDocumentTest {

    private val documentText: String by lazy {
        File(Conformance.examplesDir, "screens/settings-form.json").readText()
    }

    private val env = SpValue.Obj(
        mapOf(
            "platform" to SpValue.Str("android"),
            "locale" to SpValue.Str("ja-JP"),
            "appVersion" to SpValue.Str("3.14.0"),
        )
    )

    private fun load(): Document = DocumentParser.parse(documentText)

    private fun storeOf(document: Document) =
        Store(initialData = document.data, initialState = document.state, env = env)

    private fun resolve(document: Document, store: Store): RenderNode =
        assertNotNull(Resolver().resolve(document, store.scope()).root)

    private fun collect(node: RenderNode): List<RenderNode> =
        listOf(node) + node.children.flatMap { collect(it) } +
            node.nodeProps.values.flatten().flatMap { collect(it) }

    private fun find(root: RenderNode, id: String): RenderNode? =
        collect(root).firstOrNull { it.id == id }

    @Test
    @DisplayName("入力コンポーネントが一通り解決される")
    fun resolvesAllInputComponents() {
        val document = load()
        val root = resolve(document, storeOf(document))
        val types = collect(root).map { it.type }.toSet()
        listOf("Tabs", "Toggle", "RadioGroup", "Select", "Slider", "TextField", "Checkbox", "Button")
            .forEach { assertContains(types, it) }
    }

    @Test
    @DisplayName("Select と RadioGroup の options が data から展開される")
    fun expandsOptionsFromData() {
        val document = load()
        val root = resolve(document, storeOf(document))

        val radio = assertNotNull(find(root, "frequency_picker"))
        val options = assertNotNull(radio.prop("options").asListOrNull)
        assertEquals(3, options.size)
        assertEquals(
            SpValue.Str("リアルタイム"),
            (options.first() as SpValue.Obj).entries["label"],
        )

        val select = assertNotNull(find(root, "category_select"))
        assertEquals(3, assertNotNull(select.prop("options").asListOrNull).size)
    }

    @Test
    @DisplayName("トグルを両方オフにすると頻度セクションが消える")
    fun hidesFrequencySectionWhenAllNotificationsOff() {
        val document = load()
        val store = storeOf(document)

        assertNotNull(find(resolve(document, store), "frequency_picker"))

        store.setState("pushEnabled", SpValue.Bool(false))
        store.setState("mailEnabled", SpValue.Bool(false))

        assertTrue(
            find(resolve(document, store), "frequency_picker") == null,
            "通知がすべてオフなのに頻度セクションが残っています",
        )
    }

    @Test
    @DisplayName("サイレント時間の説明文がスライダーの値に追従する")
    fun subtitleFollowsSliderValue() {
        val document = load()
        val store = storeOf(document)

        fun subtitle(): String? = collect(resolve(document, store))
            .firstOrNull { it.type == "Section" && it.prop("title").asStringOrNull == "サイレント時間" }
            ?.prop("subtitle")?.asStringOrNull

        assertEquals("22時以降は通知しません", subtitle())
        store.setState("quietHours", SpValue.Num(20.0))
        assertEquals("20時以降は通知しません", subtitle())
    }

    @Test
    @DisplayName("同意していないと保存ボタンが無効になる")
    fun saveButtonDisabledUntilAgreed() {
        val document = load()
        val store = storeOf(document)

        assertEquals(SpValue.Bool(false), assertNotNull(find(resolve(document, store), "save_btn")).prop("enabled"))
        store.setState("agreed", SpValue.Bool(true))
        assertEquals(SpValue.Bool(true), assertNotNull(find(resolve(document, store), "save_btn")).prop("enabled"))
    }

    @Test
    @DisplayName("メールアドレスが不正なら condition が検証エラーを立ててリクエストを送らない")
    fun conditionBlocksSaveWhenEmailInvalid() = runBlocking {
        val document = load()
        val store = storeOf(document)
        store.setState("agreed", SpValue.Bool(true))
        store.setState("email", SpValue.Str("not-an-email"))

        val button = assertNotNull(find(resolve(document, store), "save_btn"))
        val host = RecordingHost()
        ActionDispatcher(host = host).dispatch(button.actions("onTap"), store)

        assertEquals(
            SpValue.Str("メールアドレスの形式が正しくありません"),
            store.state.path("emailError"),
        )
        assertTrue(host.requests.isEmpty(), "検証に失敗しているのにリクエストが送信されました")
    }

    @Test
    @DisplayName("正しい入力なら保存リクエストが現在の state を載せて飛ぶ")
    fun sendsSaveRequestWithCurrentState() = runBlocking {
        val document = load()
        val store = storeOf(document)
        store.setState("agreed", SpValue.Bool(true))
        store.setState("frequency", SpValue.Str("weekly"))
        store.setState("quietHours", SpValue.Num(23.0))

        val button = assertNotNull(find(resolve(document, store), "save_btn"))
        val host = RecordingHost()
        val result = ActionDispatcher(host = host).dispatch(button.actions("onTap"), store)

        assertEquals(1, host.requests.size)
        val body = host.requests.first().body as SpValue.Obj
        assertEquals(SpValue.Str("weekly"), body.entries["frequency"])
        assertEquals(SpValue.Num(23.0), body.entries["quietHours"])
        assertEquals(SpValue.Bool(true), body.entries["push"])

        // loadingPath が true -> false と往復して戻っている
        assertEquals(SpValue.Bool(false), store.state.path("saving"))
        assertTrue(
            result.uiEffects.any { it is SpectreUiEffect.ShowOverlay && it.id == "saved_toast" },
            "保存成功トーストが発火していません",
        )
    }

    @Test
    @DisplayName("保存に失敗するとアラートが開き、後続アクションが中止される")
    fun showsAlertAndAbortsOnFailure() = runBlocking {
        val document = load()
        val store = storeOf(document)
        store.setState("agreed", SpValue.Bool(true))

        val button = assertNotNull(find(resolve(document, store), "save_btn"))
        val host = RecordingHost(failWith = SpectreErrorPayload("SERVER", "サーバが混み合っています"))
        val result = ActionDispatcher(host = host).dispatch(button.actions("onTap"), store)

        assertTrue(
            result.uiEffects.any { it is SpectreUiEffect.ShowOverlay && it.id == "save_error" },
            "失敗アラートが発火していません",
        )
        // onSuccess の track は実行されない
        assertFalse(host.trackedEvents.contains("settings_saved"))
        assertEquals(SpValue.Bool(false), store.state.path("saving"))
    }

    @Test
    @DisplayName("リセットボタンの setState patch が複数キーをまとめて戻す")
    fun resetPatchRestoresDefaults() = runBlocking {
        val document = load()
        val store = storeOf(document)
        store.setState("pushEnabled", SpValue.Bool(false))
        store.setState("frequency", SpValue.Str("weekly"))
        store.setState("quietHours", SpValue.Num(18.0))

        val button = assertNotNull(find(resolve(document, store), "reset_btn"))
        ActionDispatcher(host = RecordingHost()).dispatch(button.actions("onTap"), store)

        assertEquals(SpValue.Bool(true), store.state.path("pushEnabled"))
        assertEquals(SpValue.Str("daily"), store.state.path("frequency"))
        assertEquals(SpValue.Num(22.0), store.state.path("quietHours"))
    }

    @Test
    @DisplayName("エラーオーバレイのメッセージが error スコープを解決する")
    fun errorOverlayResolvesErrorScope() {
        val document = load()
        val store = storeOf(document)
        // error スコープが無い状態では default() の代替値になる
        val overlays = Resolver().resolve(document, store.scope()).overlays
        val alert = assertNotNull(overlays.firstOrNull { it.id == "save_error" })
        assertEquals("通信に失敗しました", alert.props["message"]?.asStringOrNull)
    }

    @Test
    @DisplayName("ヘルプボタンが外部URLを開く")
    fun helpButtonOpensUrl() = runBlocking {
        val document = load()
        val store = storeOf(document)
        val button = assertNotNull(find(resolve(document, store), "help_btn"))
        val host = RecordingHost()
        ActionDispatcher(host = host).dispatch(button.actions("onTap"), store)
        assertContains(host.openedUrls, "https://example.com/help/notifications")
    }

    private class RecordingHost(
        private val failWith: SpectreErrorPayload? = null,
    ) : SpectreHostDelegate {
        val requests = ArrayList<SpectreRequest>()
        val trackedEvents = ArrayList<String>()
        val openedUrls = ArrayList<String>()

        override suspend fun performRequest(request: SpectreRequest): SpectreActionResponse {
            requests.add(request)
            return if (failWith != null) {
                SpectreActionResponse(ok = false, error = failWith)
            } else {
                SpectreActionResponse(ok = true)
            }
        }

        override fun navigate(destination: SpectreDestination): Boolean = true
        override suspend fun performHostAction(name: String, params: SpValue): SpValue? = null
        override fun track(event: String, properties: SpValue) { trackedEvents.add(event) }
        override fun openUrl(url: String, mode: String): Boolean {
            openedUrls.add(url); return true
        }
    }
}
