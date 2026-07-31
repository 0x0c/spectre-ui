plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

java {
    // Android ライブラリ (spectre-ui) から使うため 17 をターゲットにする。
    // toolchain を固定せず実行中の JDK で 17 バイトコードを出す — JDK 17 が
    // 入っていない環境でもコアのテストだけは走らせられるようにするため。
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        // Android の spectre-ui からも使うため、Android 非依存を保つ。
        freeCompilerArgs.add("-Xjvm-default=all")
    }
}

dependencies {
    api(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(kotlin("test"))
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.platform.launcher)
}

tasks.test {
    useJUnitPlatform()
    // 適合性コーパスの場所をテストに渡す (spec/conformance)
    systemProperty("spectre.conformance.dir", rootProject.file("../../spec/conformance").absolutePath)
    systemProperty("spectre.examples.dir", rootProject.file("../../examples").absolutePath)
    testLogging {
        events("passed", "skipped", "failed")
        showStandardStreams = false
    }
}
