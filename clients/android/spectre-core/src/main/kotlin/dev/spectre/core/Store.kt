package dev.spectre.core

import dev.spectre.core.expr.EvalScope

/**
 * 画面のデータ保持。
 *
 * `data` (サーバ提供・不変) と `state` (クライアント可変) を分けているのは、
 * サーバから来た値をクライアントがうっかり壊さないようにするためと、
 * 再取得時にどちらを保持するかを `statePolicy` で選べるようにするため
 * (docs/spec/schema.md §1)。
 */
class Store(
    initialData: SpValue.Obj = SpValue.EmptyObj,
    initialState: SpValue.Obj = SpValue.EmptyObj,
    val env: SpValue.Obj = SpValue.EmptyObj,
) {
    var data: SpValue.Obj = initialData
        private set

    var state: SpValue.Obj = initialState
        private set

    /** 直近の更新で変化した state のパス。差分再解決の入力になる。 */
    var lastChangedPaths: Set<String> = emptySet()
        private set

    fun scope(locals: Map<String, SpValue> = emptyMap()): EvalScope =
        EvalScope(data = data, state = state, env = env, locals = locals)

    fun setState(path: String, value: SpValue) {
        state = state.settingPath(path, value)
        lastChangedPaths = setOf("state.$path")
    }

    fun setStates(patch: Map<String, SpValue>) {
        var next = state
        for ((path, value) in patch) next = next.settingPath(path, value)
        state = next
        lastChangedPaths = patch.keys.map { "state.$it" }.toSet()
    }

    /** サーバ応答の `state` を浅くマージする。 */
    fun mergeState(patch: SpValue.Obj) {
        state = state.mergedWith(patch)
        lastChangedPaths = patch.entries.keys.map { "state.$it" }.toSet()
    }

    /** サーバ応答の `data` を浅くマージする。 */
    fun mergeData(patch: SpValue.Obj) {
        data = data.mergedWith(patch)
        lastChangedPaths = patch.entries.keys.map { "data.$it" }.toSet()
    }

    fun replaceData(next: SpValue.Obj) {
        data = next
        lastChangedPaths = setOf("data")
    }

    fun resetState(next: SpValue.Obj) {
        state = next
        lastChangedPaths = setOf("state")
    }
}
