package dev.spectre.core

import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.DynamicNode
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import kotlin.test.assertTrue

/**
 * spec/conformance/resolve/actions.json の全ケースを実行する。
 *
 * 検証対象は「状態 + アクション列 -> 遷移後の状態 + 発火した副作用の列」。
 */
class ConformanceActionsTest {

    @TestFactory
    fun actionCorpus(): List<DynamicNode> {
        val doc = Conformance.loadDir("resolve").first { it.first == "actions.json" }.second
        val cases = (doc.entries["cases"] as? SpValue.Arr)?.items.orEmpty()

        return cases.mapIndexedNotNull { index, raw ->
            val case = raw as? SpValue.Obj ?: return@mapIndexedNotNull null
            val name = case.entries["name"]?.asStringOrNull ?: "case $index"
            DynamicTest.dynamicTest(name) { runCase(case) }
        }
    }

    private fun runCase(case: SpValue.Obj) = runBlocking {
        val store = Store(
            initialData = case.entries["data"] as? SpValue.Obj ?: SpValue.EmptyObj,
            initialState = case.entries["state"] as? SpValue.Obj ?: SpValue.EmptyObj,
            env = case.entries["env"] as? SpValue.Obj ?: SpValue.EmptyObj,
        )
        val host = FakeHost(case.entries["responses"] as? SpValue.Obj ?: SpValue.EmptyObj)
        val maxActions = (case.entries["limits"] as? SpValue.Obj)
            ?.entries?.get("maxActionsPerDispatch")?.asIntOrNull
            ?: SpectreLimits.MAX_ACTIONS_PER_DISPATCH

        val dispatcher = ActionDispatcher(host = host, maxActions = maxActions)
        val actions = (case.entries["actions"] as? SpValue.Arr)?.items.orEmpty()
        val result = dispatcher.dispatch(actions, store)

        case.entries["expectState"]?.let { expected ->
            assertTrue(
                Conformance.valuesEqual(store.state, expected),
                "遷移後の state が期待と異なります\n" +
                    "  期待: ${expected.stringify()}\n" +
                    "  実際: ${store.state.stringify()}",
            )
        }

        (case.entries["expectEffects"] as? SpValue.Arr)?.let { expected ->
            assertTrue(
                Conformance.valuesEqual(SpValue.Arr(result.effects), expected),
                "発火した副作用が期待と異なります\n" +
                    "  期待: ${expected.stringify()}\n" +
                    "  実際: ${SpValue.Arr(result.effects).stringify()}",
            )
        }
    }

    /**
     * コーパスの `responses` を返すだけのホスト。
     *
     * 登録されていないエンドポイントを `ENDPOINT_NOT_REGISTERED` で失敗させるのは
     * 実際のホストアプリと同じ責務 — ドキュメントには論理名しか書かれておらず、
     * それを実 URL に解決できるのはホストだけなので、未登録の判定もホスト側で行う。
     */
    private class FakeHost(private val responses: SpValue.Obj) : SpectreHostDelegate {
        override suspend fun performRequest(request: SpectreRequest): SpectreActionResponse {
            val entry = responses.entries[request.endpoint] as? SpValue.Obj
                ?: return SpectreActionResponse.failure(
                    "ENDPOINT_NOT_REGISTERED",
                    "エンドポイント '${request.endpoint}' は登録されていません",
                )
            return SpectreActionResponse.from(
                ok = entry.entries["ok"]?.asBoolOrNull ?: true,
                body = entry.entries["body"] ?: SpValue.EmptyObj,
            )
        }

        override fun navigate(destination: SpectreDestination): Boolean = true
        override suspend fun performHostAction(name: String, params: SpValue): SpValue? = null
        override fun track(event: String, properties: SpValue) = Unit
        override fun openUrl(url: String, mode: String): Boolean = true
    }
}
