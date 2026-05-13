plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "io.github.tsuguchi.kanjibuilder"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.tsuguchi.kanjibuilder"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Room schema export (for migrations later — JSON snapshots).
        ksp {
            arg("room.schemaLocation", "$projectDir/schemas")
            arg("room.incremental", "true")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// Copy the Python-pipeline-generated kanji.sqlite into the app assets directory
// before the merge-assets step. Fails gracefully if the file isn't present yet
// (allows AS sync / lint runs without forcing the data pipeline to have been run).
val kanjiSqliteSrc = file("$rootDir/../data/bundle/kanji.sqlite")
val assetsDir = file("$projectDir/src/main/assets")
val copyKanjiSqlite by tasks.registering(Copy::class) {
    from(kanjiSqliteSrc)
    into(assetsDir)
    onlyIf {
        if (!kanjiSqliteSrc.exists()) {
            logger.warn("WARN: ${kanjiSqliteSrc.relativeTo(rootDir)} not found. " +
                "Run scripts/01_*..04_*.py to generate it. Skipping copy.")
            false
        } else true
    }
}
tasks.named("preBuild") { dependsOn(copyKanjiSqlite) }

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
}
