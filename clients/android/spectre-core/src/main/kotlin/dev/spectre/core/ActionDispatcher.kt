package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import dev.spectre.core.expr.TemplateEvaluator
import kotlinx.coroutines.delay

/**
 * アクション列の逐次実行。
 *
 * 意図的にチューリング完全にしていない — ループがなく、ネストと総数に上限があるため、
 * 1回のディスパッチは必ず有限で終わる。無限ループするドキュメントは作れない
 * (docs/spec/actions.md §5)。
 */
class ActionDispatcher(
    private val host: SpectreHostDelegate,
    private val templates: TemplateEvaluator = TemplateEvaluator(),
    private val maxActions: Int = SpectreLimits.MAX_ACTIONS_PER_DISPATCH,
    private val maxNesting: Int = SpectreLimits.MAX_ACTION_NESTING,
) {

    /**
     * @param locals repeat の内側から発火した場合の `item` / `index`。
     */
    suspend fun dispatch(
        actions: List<SpValue>,
        store: Store,
        locals: Map<String, SpValue> = emptyMap(),
    ): DispatchResult {
        val run = Run(store, locals)
        run.execute(actions, depth = 0)
        return DispatchResult(run.effects, run.aborted)
    }

    data class DispatchResult(
        val effects: List<SpValue>,
        val aborted: Boolean,
    ) {
        /** UI 層が処理する副作用だけを取り出す。 */
        val uiEffects: List<SpectreUiEffect> get() = effects.mapNotNull { toUiEffect(it) }
    }

    private inner class Run(val store: Store, val locals: Map<String, SpValue>) {
        val effects = ArrayList<SpValue>()
        var aborted = false
        private var executed = 0
        private var errorScope: SpValue? = null

        fun scope(): EvalScope = store.scope(
            if (errorScope != null) locals + mapOf("error" to errorScope!!) else locals
        )

        suspend fun execute(actions: List<SpValue>, depth: Int) {
            if (depth > maxNesting) {
                emit("limitExceeded", "limit" to SpValue.Str("maxActionNesting"))
                aborted = true
                return
            }
            for (action in actions) {
                if (aborted) return
                if (executed >= maxActions) {
                    emit("limitExceeded", "limit" to SpValue.Str("maxActionsPerDispatch"))
                    aborted = true
                    return
                }
                executed++
                perform(action as? SpValue.Obj ?: continue, depth)
            }
        }

        private suspend fun perform(action: SpValue.Obj, depth: Int) {
            val type = action.entries["type"]?.asStringOrNull ?: return
            val continueOnError = action.entries["continueOnError"]?.asBoolOrNull ?: false

            // ホストアプリに割り込みの機会を与える。
            if (!host.shouldPerform(action)) {
                aborted = true
                return
            }

            val failed: Boolean = when (type) {
                "setState" -> { applySetState(action); false }
                "toggleState" -> { applyToggleState(action); false }
                "sequence" -> {
                    execute((action.entries["actions"] as? SpValue.Arr)?.items ?: emptyList(), depth + 1)
                    false
                }
                "condition" -> { applyCondition(action, depth); false }
                "delay" -> {
                    delay((action.entries["ms"]?.asIntOrNull ?: 0).toLong().coerceIn(0, 10_000))
                    false
                }
                "request" -> performRequest(action, depth)
                "navigate" -> { performNavigate(action); false }
                "openUrl" -> { performOpenUrl(action); false }
                "track" -> { performTrack(action); false }
                "host" -> performHostAction(action, depth)
                "showOverlay" -> {
                    emit("showOverlay", "id" to (action.entries["id"] ?: SpValue.Null)); false
                }
                "dismissOverlay" -> {
                    emit("dismissOverlay", "id" to (action.entries["id"] ?: SpValue.Null)); false
                }
                "back" -> { emit("back"); false }
                "dismiss" -> { emit("dismiss"); false }
                "refresh" -> {
                    emit("refresh", "preserveState" to SpValue.Bool(
                        action.entries["preserveState"]?.asBoolOrNull ?: false
                    ))
                    false
                }
                "applyPatch" -> {
                    emit("applyPatch", "patch" to (action.entries["patch"] ?: SpValue.Arr(emptyList())))
                    false
                }
                "focus" -> {
                    emit("focus", "nodeId" to (action.entries["nodeId"] ?: SpValue.Null)); false
                }
                "scrollTo" -> {
                    emit(
                        "scrollTo",
                        "nodeId" to (action.entries["nodeId"] ?: SpValue.Null),
                        "animated" to SpValue.Bool(action.entries["animated"]?.asBoolOrNull ?: true),
                    )
                    false
                }
                else -> { performUnknown(action, type, depth); false }
            }

            if (failed && !continueOnError) aborted = true
        }

        // -- 個別のアクション -------------------------------------------------

        private fun applySetState(action: SpValue.Obj) {
            val patch = action.entries["patch"] as? SpValue.Obj
            if (patch != null) {
                store.setStates(patch.entries.mapValues { resolve(it.value) })
                return
            }
            val path = action.entries["path"]?.asStringOrNull ?: return
            store.setState(path, resolve(action.entries["value"] ?: SpValue.Null))
        }

        private fun applyToggleState(action: SpValue.Obj) {
            val path = action.entries["path"]?.asStringOrNull ?: return
            val current = store.state.path(path)
            store.setState(path, SpValue.Bool(!current.isTruthy))
        }

        private suspend fun applyCondition(action: SpValue.Obj, depth: Int) {
            val condition = action.entries["if"]?.asStringOrNull ?: return
            val branch = if (evaluate(condition).isTruthy) "then" else "else"
            execute((action.entries[branch] as? SpValue.Arr)?.items ?: emptyList(), depth + 1)
        }

        /** @return 失敗したら true */
        private suspend fun performRequest(action: SpValue.Obj, depth: Int): Boolean {
            val endpoint = action.entries["endpoint"]?.asStringOrNull ?: return true
            val method = action.entries["method"]?.asStringOrNull ?: "GET"
            val loadingPath = action.entries["loadingPath"]?.asStringOrNull

            val body = resolve(action.entries["body"] ?: SpValue.Null)
            val pathParams = resolveMap(action.entries["pathParams"])
            val query = resolveMap(action.entries["query"])

            loadingPath?.let { store.setState(it, SpValue.Bool(true)) }

            emit(
                "request",
                "endpoint" to SpValue.Str(endpoint),
                "method" to SpValue.Str(method),
                "body" to body,
            )

            val response = runCatching {
                host.performRequest(
                    SpectreRequest(
                        endpoint = endpoint,
                        method = method,
                        pathParams = pathParams,
                        query = query,
                        body = body,
                        timeoutMs = action.entries["timeoutMs"]?.asIntOrNull ?: 10_000,
                        idempotencyKey = action.entries["idempotencyKey"]
                            ?.asStringOrNull
                            ?.let { resolve(SpValue.Str(it)).stringify() },
                    )
                )
            }.getOrElse { SpectreActionResponse.failure("NETWORK_ERROR", it.message ?: "リクエストに失敗しました") }

            // 適用順は screen -> data -> state -> patch -> actions (docs/spec/actions.md §3)
            response.screen?.let { emit("replaceScreen", "document" to it) }
            response.data?.let { store.mergeData(it) }
            response.state?.let { store.mergeState(it) }
            if (response.patch.isNotEmpty()) {
                emit("applyPatch", "patch" to SpValue.Arr(response.patch))
            }

            loadingPath?.let { store.setState(it, SpValue.Bool(false)) }

            return if (response.ok) {
                execute(response.actions, depth + 1)
                execute((action.entries["onSuccess"] as? SpValue.Arr)?.items ?: emptyList(), depth + 1)
                false
            } else {
                withErrorScope(response.error) {
                    execute((action.entries["onError"] as? SpValue.Arr)?.items ?: emptyList(), depth + 1)
                }
                true
            }
        }

        private fun performNavigate(action: SpValue.Obj) {
            val mode = action.entries["mode"]?.asStringOrNull ?: "push"
            val screen = action.entries["screen"]?.asStringOrNull
            val route = action.entries["route"]?.asStringOrNull?.let { resolve(SpValue.Str(it)).stringify() }
            val params = resolveMap(action.entries["params"])

            emit(
                "navigate",
                "mode" to SpValue.Str(mode),
                *listOfNotNull(
                    screen?.let { "screen" to SpValue.Str(it) },
                    route?.let { "route" to SpValue.Str(it) },
                    if (params.isNotEmpty()) "params" to SpValue.Obj(params) else null,
                ).toTypedArray(),
            )
            host.navigate(SpectreDestination(mode, screen, route, params))
        }

        private fun performOpenUrl(action: SpValue.Obj) {
            val url = resolve(action.entries["url"] ?: SpValue.Null).stringify()
            val mode = action.entries["mode"]?.asStringOrNull ?: "inApp"
            emit("openUrl", "url" to SpValue.Str(url), "mode" to SpValue.Str(mode))
            host.openUrl(url, mode)
        }

        private fun performTrack(action: SpValue.Obj) {
            val event = action.entries["event"]?.asStringOrNull ?: return
            val properties = SpValue.Obj(resolveMap(action.entries["properties"]))
            emit("track", "event" to SpValue.Str(event), "properties" to properties)
            host.track(event, properties)
        }

        private suspend fun performHostAction(action: SpValue.Obj, depth: Int): Boolean {
            val name = action.entries["name"]?.asStringOrNull ?: return true
            val params = SpValue.Obj(resolveMap(action.entries["params"]))
            emit("host", "name" to SpValue.Str(name), "params" to params)

            val result = runCatching { host.performHostAction(name, params) }
            return if (result.isSuccess) {
                action.entries["resultPath"]?.asStringOrNull?.let {
                    store.setState(it, result.getOrNull() ?: SpValue.Null)
                }
                execute((action.entries["onSuccess"] as? SpValue.Arr)?.items ?: emptyList(), depth + 1)
                false
            } else {
                withErrorScope(
                    SpectreErrorPayload("HOST_ACTION_FAILED", result.exceptionOrNull()?.message ?: "")
                ) {
                    execute((action.entries["onError"] as? SpValue.Arr)?.items ?: emptyList(), depth + 1)
                }
                true
            }
        }

        /**
         * 未知のアクション種別。
         *
         * 黙って飛ばすのは前方互換性のため — 新しいアクションを追加しても
         * 古いクライアントが壊れない。飛ばすと困るものには `required: true` を
         * 付けて `fallbackActions` を用意する (docs/spec/actions.md §4)。
         */
        private suspend fun performUnknown(action: SpValue.Obj, type: String, depth: Int) {
            emit("unknownAction", "name" to SpValue.Str(type))
            if (action.entries["required"]?.asBoolOrNull == true) {
                execute((action.entries["fallbackActions"] as? SpValue.Arr)?.items ?: emptyList(), depth + 1)
            }
        }

        // -- ヘルパ ------------------------------------------------------------

        private suspend fun withErrorScope(error: SpectreErrorPayload?, block: suspend () -> Unit) {
            val previous = errorScope
            errorScope = (error ?: SpectreErrorPayload("UNKNOWN", "")).toScopeValue()
            try { block() } finally { errorScope = previous }
        }

        private fun evaluate(source: String): SpValue = templates.evaluate(source, scope()).value

        /** アクション内の値を、その時点の state で解決する。 */
        private fun resolve(value: SpValue): SpValue = when (value) {
            is SpValue.Str -> templates.evaluate(value.value, scope()).value
            is SpValue.Arr -> SpValue.Arr(value.items.map { resolve(it) })
            is SpValue.Obj -> SpValue.Obj(value.entries.mapValues { resolve(it.value) })
            else -> value
        }

        private fun resolveMap(value: SpValue?): Map<String, SpValue> =
            (value as? SpValue.Obj)?.entries?.mapValues { resolve(it.value) } ?: emptyMap()

        private fun emit(type: String, vararg entries: Pair<String, SpValue>) {
            effects.add(SpValue.Obj(linkedMapOf("type" to SpValue.Str(type), *entries)))
        }
    }

    companion object {
        private fun toUiEffect(effect: SpValue): SpectreUiEffect? {
            val obj = effect as? SpValue.Obj ?: return null
            val id = obj.entries["id"]?.asStringOrNull
            val nodeId = obj.entries["nodeId"]?.asStringOrNull
            return when (obj.entries["type"]?.asStringOrNull) {
                "showOverlay" -> id?.let { SpectreUiEffect.ShowOverlay(it) }
                "dismissOverlay" -> SpectreUiEffect.DismissOverlay(id)
                "back" -> SpectreUiEffect.Back
                "dismiss" -> SpectreUiEffect.Dismiss
                "refresh" -> SpectreUiEffect.Refresh(
                    obj.entries["preserveState"]?.asBoolOrNull ?: false
                )
                "focus" -> nodeId?.let { SpectreUiEffect.Focus(it) }
                "scrollTo" -> nodeId?.let {
                    SpectreUiEffect.ScrollTo(it, obj.entries["animated"]?.asBoolOrNull ?: true)
                }
                "replaceScreen" -> (obj.entries["document"] as? SpValue.Obj)
                    ?.let { SpectreUiEffect.ReplaceScreen(it) }
                "applyPatch" -> SpectreUiEffect.ApplyPatch(
                    (obj.entries["patch"] as? SpValue.Arr)?.items ?: emptyList()
                )
                else -> null
            }
        }
    }
}
