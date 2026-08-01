pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "spectre-ui-android"

// spectre-core は純粋な JVM モジュールで、Android SDK なしでビルド・テストできる。
// 適合性コーパス (spec/conformance) はこのモジュールのテストとして実行される。
include(":spectre-core")

// spectre-ui と sample は Android SDK を必要とする。SDK が見つからない環境
// (CI のロジック検証ジョブなど) では設定エラーで全体が落ちないよう、条件付きで含める。
val androidSdkDir: String? = System.getenv("ANDROID_HOME")
    ?: System.getenv("ANDROID_SDK_ROOT")
    ?: file("local.properties")
        .takeIf { it.exists() }
        ?.let { f -> java.util.Properties().apply { f.inputStream().use(::load) }.getProperty("sdk.dir") }

if (androidSdkDir != null) {
    include(":spectre-ui")
    include(":sample")
} else {
    logger.lifecycle(
        "[spectre] Android SDK が見つからないため :spectre-ui と :sample をスキップします。" +
            " :spectre-core のみを構成します。"
    )
}
