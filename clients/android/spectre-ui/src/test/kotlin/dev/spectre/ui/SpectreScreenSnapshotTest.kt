package dev.spectre.ui

import android.content.res.Configuration
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import com.github.takahirom.roborazzi.ExperimentalRoborazziApi
import com.github.takahirom.roborazzi.RoborazziComposeOptions
import com.github.takahirom.roborazzi.captureRoboImage
import com.github.takahirom.roborazzi.fontScale
import com.github.takahirom.roborazzi.size
import com.github.takahirom.roborazzi.uiMode
import dev.spectre.core.DocumentParser
import dev.spectre.core.SpValue
import dev.spectre.core.SpectreActionResponse
import dev.spectre.core.SpectreDestination
import dev.spectre.core.SpectreHostDelegate
import dev.spectre.core.SpectreRequest
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Compose レンダラのビジュアルリグレッションテスト (SU-0013)。
 *
 * `spec/vrt/cases.json` のケースを1件ずつ描画し、`src/test/snapshots/` の
 * ゴールデン画像と突き合わせる。実行モードは Roborazzi のシステムプロパティで決まり、
 * `spectre-ui/build.gradle.kts` が Gradle 側から渡す。
 *
 * - 検証 (既定): `./gradlew :spectre-ui:testDebugUnitTest`
 * - 記録: `./gradlew :spectre-ui:testDebugUnitTest -Pspectre.vrt.record=true`
 *
 * Robolectric 上で描くのでエミュレータも実機も要らない。SDK を固定しているのは、
 * 描画結果が Android のバージョンで変わるため。ゴールデンと同じ条件で比較できないと、
 * この一式は意味を持たない。
 *
 * iOS 側の対応物は `SpectreScreenSnapshotTests.swift`。同じケースを描くが、
 * ゴールデンは共有しない (ADR-0001 のとおり2つのレンダラは別実装なので、
 * 画素が違うことは意図した結果)。
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class SpectreScreenSnapshotTest {

    /**
     * 全ケースをまとめて1つのテストにしているのは、失敗したケースを一度に出すため。
     * ケースごとにテストを分けると、最初の1件で止まって残りの差分が見えない。
     */
    @Test
    @OptIn(ExperimentalRoborazziApi::class)
    fun rendersEveryVrtCase() {
        assumeTrue(
            "ゴールデン画像がまだありません。-Pspectre.vrt.record=true で記録してください。",
            VrtCases.isRecording || VrtCases.hasGoldens,
        )

        val failures = mutableListOf<String>()

        for (case in VrtCases.all) {
            val document = DocumentParser.parse(case.document.readText())
            val composeOptions = RoborazziComposeOptions {
                size(widthDp = case.widthDp, heightDp = case.heightDp)
                uiMode(
                    if (case.isDark) Configuration.UI_MODE_NIGHT_YES
                    else Configuration.UI_MODE_NIGHT_NO
                )
                fontScale(case.fontScale)
            }

            try {
                captureRoboImage(
                    file = VrtCases.goldenFile(case.id),
                    roborazziComposeOptions = composeOptions,
                ) {
                    MaterialTheme(
                        colorScheme = if (case.isDark) darkColorScheme() else lightColorScheme()
                    ) {
                        SpectreScreen(
                            document = document,
                            host = SnapshotHostDelegate,
                            env = case.env(),
                        )
                    }
                }
            } catch (failure: AssertionError) {
                failures += "${case.id}: ${failure.message}"
            }
        }

        assertTrue(
            "ゴールデン画像と一致しないケースがあります。差分画像は" +
                " spectre-ui/build/outputs/roborazzi/ に出力されています。" +
                " 意図した変更なら -Pspectre.vrt.record=true で記録し直してください。\n" +
                failures.joinToString("\n"),
            failures.isEmpty(),
        )
    }
}

/**
 * 何もしないホスト実装。
 *
 * VRT が見るのは初期描画だけで、アクションは発火しない。ネットワークや遷移を
 * 伴う実装を挿すと、応答の有無で画像が変わりうる。
 */
private object SnapshotHostDelegate : SpectreHostDelegate {
    override suspend fun performRequest(request: SpectreRequest): SpectreActionResponse =
        SpectreActionResponse(ok = true)

    override fun navigate(destination: SpectreDestination): Boolean = true

    override suspend fun performHostAction(name: String, params: SpValue): SpValue? = null

    override fun track(event: String, properties: SpValue) = Unit

    override fun openUrl(url: String, mode: String): Boolean = true
}
