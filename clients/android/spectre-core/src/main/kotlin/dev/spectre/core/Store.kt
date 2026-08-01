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

    /**
     * 直近の [consumeChangedPaths] 以降に変化した state/data のパスの累積。差分再解決の入力になる。
     *
     * 1回のアクションディスパッチは複数回 state/data を書き換えうるため、上書きではなく
     * 蓄積する。上書きだと列の途中の変更が再解決に反映されず、画面が古いまま止まって見える
     * ことになる。
     */
    var lastChangedPaths: Set<String> = emptySet()
        private set

    fun scope(locals: Map<String, SpValue> = emptyMap()): EvalScope =
        EvalScope(data = data, state = state, env = env, locals = locals)

    /** 蓄積した変更パスを取り出し、蓄積をリセットする。差分再解決を1回行うたびに呼ぶ。 */
    fun consumeChangedPaths(): Set<String> {
        val changed = lastChangedPaths
        lastChangedPaths = emptySet()
        return changed
    }

    fun setState(path: String, value: SpValue) {
        state = state.settingPath(path, value)
        lastChangedPaths = lastChangedPaths + "state.$path"
    }

    fun setStates(patch: Map<String, SpValue>) {
        var next = state
        for ((path, value) in patch) next = next.settingPath(path, value)
        state = next
        lastChangedPaths = lastChangedPaths + patch.keys.map { "state.$it" }
    }

    /** サーバ応答の `state` を浅くマージする。 */
    fun mergeState(patch: SpValue.Obj) {
        state = state.mergedWith(patch)
        lastChangedPaths = lastChangedPaths + patch.entries.keys.map { "state.$it" }
    }

    /** サーバ応答の `data` を浅くマージする。 */
    fun mergeData(patch: SpValue.Obj) {
        data = data.mergedWith(patch)
        lastChangedPaths = lastChangedPaths + patch.entries.keys.map { "data.$it" }
    }

    fun replaceData(next: SpValue.Obj) {
        data = next
        lastChangedPaths = lastChangedPaths + "data"
    }

    fun resetState(next: SpValue.Obj) {
        state = next
        lastChangedPaths = lastChangedPaths + "state"
    }
}
