plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "dev.spectre.sample"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.spectre.sample"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
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

    buildFeatures { compose = true }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    // サンプル画面の JSON は examples/ を単一の情報源として参照する。
    // assets へコピーを置くと必ず古くなるため。
    sourceSets["main"].assets.srcDir(rootProject.file("../../examples"))
}

dependencies {
    implementation(project(":spectre-ui"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)

    debugImplementation(libs.compose.ui.tooling)
}
