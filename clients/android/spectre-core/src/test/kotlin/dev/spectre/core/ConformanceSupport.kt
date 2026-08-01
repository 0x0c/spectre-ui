package dev.spectre.core

import kotlinx.serialization.json.Json
import java.io.File
import kotlin.test.fail

/**
 * 適合性コーパス (spec/conformance) を読むための共通処理。
 *
 * このコーパスは Swift / Kotlin / TypeScript の3実装が同じ入力に対して
 * 同じ結果を返すことを機械的に保証するためのもの。実装非依存の JSON なので、
 * 各クライアント SDK のテストがこのファイル群を直接読んで実行する
 * (docs/tech-selection.md ADR-0008)。
 */
object Conformance {

    private val json = Json { ignoreUnknownKeys = true }

    val corpusDir: File by lazy {
        val configured = System.getProperty("spectre.conformance.dir")
        val candidates = listOfNotNull(
            configured?.let(::File),
            File("../../../spec/conformance"),
            File("spec/conformance"),
        )
        candidates.firstOrNull { it.isDirectory }
            ?: fail(
                "適合性コーパスが見つかりません。試したパス: " +
                    candidates.joinToString { it.absolutePath }
            )
    }

    val examplesDir: File by lazy {
        val configured = System.getProperty("spectre.examples.dir")
        val candidates = listOfNotNull(
            configured?.let(::File),
            File("../../../examples"),
            File("examples"),
        )
        candidates.firstOrNull { it.isDirectory }
            ?: fail("examples が見つかりません")
    }

    fun loadDir(name: String): List<Pair<String, SpValue.Obj>> {
        val dir = File(corpusDir, name)
        check(dir.isDirectory) { "${dir.absolutePath} がありません" }
        return dir.listFiles { f -> f.extension == "json" }
            .orEmpty()
            .sortedBy { it.name }
            .map { file -> file.name to parseObject(file.readText()) }
    }

    fun parseObject(text: String): SpValue.Obj =
        json.parseToJsonElement(text).toSpValue() as SpValue.Obj

    /**
     * 数値は微小な誤差を許容して比較する。
     *
     * `round(1.2345, 2)` のような計算は 10 のべき乗を経由するため、
     * プラットフォームによって最下位ビットがずれうる。仕様として意味があるのは
     * その桁までではないので、ここで吸収する。
     */
    fun valuesEqual(a: SpValue, b: SpValue): Boolean = when {
        a is SpValue.Num && b is SpValue.Num ->
            a.value == b.value || Math.abs(a.value - b.value) < 1e-9
        a is SpValue.Arr && b is SpValue.Arr ->
            a.items.size == b.items.size && a.items.indices.all { valuesEqual(a.items[it], b.items[it]) }
        a is SpValue.Obj && b is SpValue.Obj ->
            a.entries.keys == b.entries.keys && a.entries.all { (k, v) -> valuesEqual(v, b.entries.getValue(k)) }
        else -> a == b
    }

    /** 失敗メッセージ用の可読な表現。 */
    fun describe(value: SpValue): String = when (value) {
        is SpValue.Str -> "\"${value.value}\""
        is SpValue.Null -> "null"
        else -> value.stringify()
    }
}
