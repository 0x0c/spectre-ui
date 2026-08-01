package dev.spectre.ui

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.spectre.core.ActionDispatcher
import dev.spectre.core.Document
import dev.spectre.core.DocumentParser
import dev.spectre.core.GeneratedCatalog
import dev.spectre.core.JsonPatch
import dev.spectre.core.OverlayKind
import dev.spectre.core.RenderOverlay
import dev.spectre.core.ResolveResult
import dev.spectre.core.Resolver
import dev.spectre.core.SpValue
import dev.spectre.core.SpectreHostDelegate
import dev.spectre.core.SpectreUiEffect
import dev.spectre.core.Store
import dev.spectre.core.TracedResolveResult
import dev.spectre.core.asIntOrNull
import dev.spectre.core.expr.TemplateEvaluator
import dev.spectre.core.path
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 1画面ぶんの実行時状態。
 *
 * ドキュメント・ストア・解決結果・オーバレイの表示状態を束ね、
 * アクションのディスパッチと再解決を仲介する。
 *
 * スレッド前提: Compose のメインスレッドから触られることを想定している。
 * [TemplateEvaluator] の AST キャッシュも同じ前提で同期を持たない。
 */
@Stable
class SpectreScreenController(
    private val host: SpectreHostDelegate,
    private val env: SpValue.Obj,
    private val coroutineScope: CoroutineScope,
    supportedComponents: Set<String> = GeneratedCatalog.componentNames,
) {
    // Resolver と Dispatcher で同じ TemplateEvaluator を共有し、AST キャッシュを効かせる。
    private val templates = TemplateEvaluator()
    private val resolver = Resolver(templates, supportedComponents)
    private val dispatcher = ActionDispatcher(host, templates)

    var document by mutableStateOf<Document?>(null)
        private set

    var render by mutableStateOf<ResolveResult?>(null)
        private set

    var store: Store? = null
        private set

    /** 直近の解決結果。差分再解決の入力として次回に渡す (docs/architecture.md §2)。 */
    private var traced: TracedResolveResult? = null

    /** 現在開いているシート/アラートの id。 */
    val visibleOverlays = mutableStateListOf<String>()

    /** 表示中のトースト。時間経過で自動的に消える。 */
    var activeToast by mutableStateOf<RenderOverlay?>(null)
        private set

    /** 実行中の request があるか。プルリフレッシュのインジケータなどに使う。 */
    var isBusy by mutableStateOf(false)
        private set

    /** `focus` アクションが指定した nodeId。レンダラ側がこれを見てフォーカスを移す。 */
    var focusRequest: String? by mutableStateOf(null)
        private set

    /** `scrollTo` アクションが指定した対象。同じ nodeId への連続リクエストも見分けられるよう連番を持つ。 */
    var scrollRequest: ScrollRequest? by mutableStateOf(null)
        private set

    private var scrollRequestSeq = 0L

    data class ScrollRequest(val nodeId: String, val animated: Boolean, val seq: Long)

    private var toastJob: Job? = null

    fun load(document: Document) {
        this.document = document
        this.store = Store(
            initialData = document.data,
            initialState = document.state,
            env = env,
        )
        visibleOverlays.clear()
        activeToast = null
        val fresh = resolver.resolveTraced(document, requireNotNull(store).scope())
        traced = fresh
        render = fresh.result
        if (document.onAppear.isNotEmpty()) dispatch(document.onAppear)
    }

    /**
     * 木を再解決する。
     *
     * 変更された state/data のパスに依存しないノードは、[Resolver.reresolveTraced] が
     * 前回の [dev.spectre.core.RenderNode] をそのまま使い回す。初回 ([load]) だけは
     * 比較対象がないため常に全解決になる。
     */
    fun reresolve() {
        val doc = document ?: return
        val currentStore = store ?: return
        val previous = traced ?: return
        val changed = currentStore.consumeChangedPaths()
        val next = resolver.reresolveTraced(doc, previous, changed, currentStore.scope())
        traced = next
        render = next.result
    }

    /** 入力コンポーネントの双方向バインド。 */
    fun setStateValue(path: String, value: SpValue) {
        store?.setState(path, value)
        reresolve()
    }

    fun stateValue(path: String): SpValue = store?.state?.path(path) ?: SpValue.Null

    fun dispatch(actions: List<SpValue>, locals: Map<String, SpValue> = emptyMap()) {
        if (actions.isEmpty()) return
        val currentStore = store ?: return
        coroutineScope.launch {
            isBusy = true
            try {
                val result = dispatcher.dispatch(actions, currentStore, locals)
                result.uiEffects.forEach { applyUiEffect(it) }
            } finally {
                isBusy = false
                reresolve()
            }
        }
    }

    fun dismissOverlay(id: String?) {
        if (id == null) visibleOverlays.clear() else visibleOverlays.remove(id)
    }

    private fun applyUiEffect(effect: SpectreUiEffect) {
        when (effect) {
            is SpectreUiEffect.ShowOverlay -> showOverlay(effect.id)
            is SpectreUiEffect.DismissOverlay -> dismissOverlay(effect.id)
            is SpectreUiEffect.Refresh -> onRefreshRequested?.invoke(effect.preserveState)
            is SpectreUiEffect.Back -> onBack?.invoke()
            is SpectreUiEffect.Dismiss -> onDismiss?.invoke()
            is SpectreUiEffect.ReplaceScreen -> onReplaceScreen?.invoke(effect.document)
            is SpectreUiEffect.Focus -> focusRequest = effect.nodeId
            is SpectreUiEffect.ScrollTo -> {
                scrollRequestSeq++
                scrollRequest = ScrollRequest(effect.nodeId, effect.animated, scrollRequestSeq)
            }
            is SpectreUiEffect.ApplyPatch -> applyPatch(effect.operations)
        }
    }

    /** [focusRequest] を消費する。レンダラがフォーカスを移し終えたら呼ぶ。 */
    fun consumeFocusRequest() {
        focusRequest = null
    }

    /** [scrollRequest] を消費する。レンダラがスクロールし終えたら呼ぶ。 */
    fun consumeScrollRequest() {
        scrollRequest = null
    }

    /**
     * `applyPatch` (RFC 6902)。パース前の生 JSON ([Document.raw]) に適用してから
     * 再パースする — 木構造は差し替わるが、[store] はそのまま使い続けるので
     * `state`/`data` は保持される (docs/spec/actions.md `applyPatch`)。
     */
    private fun applyPatch(operations: List<SpValue>) {
        val currentDocument = document ?: return
        val currentStore = store ?: return
        val raw = currentDocument.raw
        if (raw == null) {
            // DocumentParser を経由しない手組みの Document には適用しようがない。
            onUnimplementedEffect?.invoke("applyPatch")
            return
        }
        val patched = runCatching { JsonPatch.apply(raw, operations) as? SpValue.Obj }.getOrNull() ?: return
        val newDocument = runCatching { DocumentParser.parse(patched) }.getOrNull() ?: return
        document = newDocument
        val fresh = resolver.resolveTraced(newDocument, currentStore.scope())
        traced = fresh
        render = fresh.result
    }

    private fun showOverlay(id: String) {
        val overlay = render?.overlays?.firstOrNull { it.id == id } ?: return
        if (overlay.kind == OverlayKind.TOAST) {
            toastJob?.cancel()
            activeToast = overlay
            val durationMs = overlay.props["durationMs"]?.asIntOrNull ?: 3000
            toastJob = coroutineScope.launch {
                delay(durationMs.toLong().coerceIn(1000, 10_000))
                activeToast = null
            }
        } else if (!visibleOverlays.contains(id)) {
            visibleOverlays.add(id)
        }
    }

    // ホストアプリ側が差し込むコールバック。SDK が扱えない遷移をここで受ける。
    var onBack: (() -> Unit)? = null
    var onDismiss: (() -> Unit)? = null
    var onRefreshRequested: ((preserveState: Boolean) -> Unit)? = null
    var onReplaceScreen: ((SpValue.Obj) -> Unit)? = null
    var onUnimplementedEffect: ((String) -> Unit)? = null
}
