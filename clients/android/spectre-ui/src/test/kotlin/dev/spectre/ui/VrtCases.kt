package dev.spectre.ui

import dev.spectre.core.SpValue
import dev.spectre.core.asStringOrNull
import dev.spectre.core.stringify
import dev.spectre.core.toSpValue
import java.io.File
import kotlinx.serialization.json.Json

/**
 * VRT (ビジュアルリグレッションテスト) のケース1件 (SU-0015)。
 *
 * ケースの実体は `spec/vrt/cases.json` にあり、iOS 側の `VrtCases.swift` が同じ
 * ファイルを読む。どの画面をどの条件で描くかを両プラットフォームで揃えるためで、
 * ゴールデン画像そのものはレンダラごとに別物になる。
 */
data class VrtCase(
    val id: String,
    val document: File,
    val widthDp: Int,
    val heightDp: Int,
    val theme: String,
    val fontScale: Float,
    val locale: String,
) {
    val isDark: Boolean get() = theme == "dark"

    /**
     * ケースが宣言した描画条件を、式から見える `env` に落とす。
     *
     * 実行環境から取る [rememberSpectreEnv] を使わないのは、OS バージョンや
     * タイムゾーンが混ざると同じケースの画像が環境ごとに変わりうるため。
     */
    fun env(): SpValue.Obj = SpValue.Obj(
        mapOf(
            "platform" to SpValue.Str("android"),
            "appVersion" to SpValue.Str("0.0.0"),
            "osVersion" to SpValue.Str(""),
            "locale" to SpValue.Str(locale),
            "timeZone" to SpValue.Str("Asia/Tokyo"),
            "theme" to SpValue.Str(theme),
            "widthClass" to SpValue.Str(
                when {
                    widthDp < 600 -> "compact"
                    widthDp < 840 -> "regular"
                    else -> "expanded"
                }
            ),
            "fontScale" to SpValue.Num(fontScale.toDouble()),
            "isOnline" to SpValue.Bool(true),
        )
    )
}

/** `spec/vrt/cases.json` の読み込みと、ゴールデン画像の置き場所。 */
object VrtCases {

    private val json = Json { ignoreUnknownKeys = true }

    private val repoRoot: File = File(
        requireNotNull(System.getProperty("spectre.repo.root")) {
            "spectre.repo.root が渡されていません (spectre-ui/build.gradle.kts を参照)"
        }
    )

    private val goldenDir: File = File(
        requireNotNull(System.getProperty("spectre.vrt.golden.dir")) {
            "spectre.vrt.golden.dir が渡されていません (spectre-ui/build.gradle.kts を参照)"
        }
    )

    val all: List<VrtCase> by lazy {
        val file = File(repoRoot, "spec/vrt/cases.json")
        require(file.isFile) { "VRT のケース一覧が見つかりません: ${file.absolutePath}" }
        val root = json.parseToJsonElement(file.readText()).toSpValue() as SpValue.Obj
        val items = (root.entries["cases"] as? SpValue.Arr)?.items
            ?: error("cases.json に cases 配列がありません")
        require(items.isNotEmpty()) { "VRT のケースが1件もありません" }
        items.map { parse(it as SpValue.Obj) }
    }

    /** ゴールデン画像の絶対パス。記録モードではここへ書き、検証モードではここと比べる。 */
    fun goldenFile(id: String): File = File(goldenDir, "$id.png")

    /** 記録モードか。Gradle 側が Roborazzi のシステムプロパティとして渡す。 */
    val isRecording: Boolean get() = System.getProperty("roborazzi.test.record") == "true"

    /**
     * ゴールデン画像が1枚でもあるか。
     *
     * 1枚もない状態で検証すると、比較対象がないという理由だけで必ず落ちる。
     * それは退行ではないので、記録を1度も通していない間は検証を飛ばす。
     * 最初の記録が入った時点から、以後は通常のテストとして検証が効き始める。
     */
    val hasGoldens: Boolean
        get() = goldenDir.listFiles { file -> file.extension == "png" }.orEmpty().isNotEmpty()

    private fun parse(case: SpValue.Obj): VrtCase {
        fun str(key: String): String = case.entries[key]?.asStringOrNull
            ?: error("ケースに $key がありません: ${case.stringify()}")

        fun num(key: String): Double = (case.entries[key] as? SpValue.Num)?.value
            ?: error("ケースに $key がありません: ${case.stringify()}")

        return VrtCase(
            id = str("id"),
            document = File(repoRoot, str("document")),
            widthDp = num("widthDp").toInt(),
            heightDp = num("heightDp").toInt(),
            theme = str("theme"),
            fontScale = num("fontScale").toFloat(),
            locale = str("locale"),
        )
    }
}
