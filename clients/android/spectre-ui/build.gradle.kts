plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "dev.spectre.ui"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    sourceSets["main"].java.srcDir("src/main/kotlin")
    sourceSets["test"].java.srcDir("src/test/kotlin")

    buildFeatures { compose = true }

    testOptions {
        // Robolectric がリソースとマニフェストを読めるようにする。VRT (SU-0013) が
        // Compose を実際に描画するために要る。
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    api(project(":spectre-core"))

    implementation(platform(libs.compose.bom))
    api(libs.compose.ui)
    api(libs.compose.foundation)
    api(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.coil.compose)

    debugImplementation(libs.compose.ui.tooling)

    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)

    // VRT (SU-0013)。Roborazzi の取得関数はテストのクラスパスに載る普通のライブラリで、
    // Gradle プラグインを増やさない。ActivityScenario と setContent を使うため
    // androidx.test:core と activity-compose もテスト側に要る。
    testImplementation(libs.robolectric)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.activity.compose)
    testImplementation(libs.junit4)
    testRuntimeOnly(libs.junit.vintage.engine)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()

    // VRT の実行モード。既定は検証で、ゴールデンを更新するときだけ
    // -Pspectre.vrt.record=true を渡す。どちらも渡さないと Roborazzi は
    // 撮影自体を行わないので、必ず一方を立てる。
    val recording = providers.gradleProperty("spectre.vrt.record").orNull == "true"
    systemProperty("roborazzi.test.record", recording.toString())
    systemProperty("roborazzi.test.verify", (!recording).toString())

    // フィクスチャ (spec/vrt) とゴールデンの位置は、テストの作業ディレクトリに
    // 依存させずここで渡す。
    systemProperty("spectre.repo.root", rootProject.file("../..").absolutePath)
    systemProperty("spectre.vrt.golden.dir", file("src/test/snapshots").absolutePath)

    testLogging {
        events("passed", "skipped", "failed")
        showStandardStreams = false
    }
}
