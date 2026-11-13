import java.util.Properties

plugins {
    id("com.android.application") version "8.13.2"
    id("org.jetbrains.kotlin.android") version "2.2.20"
}

// Release signing key, outside the repo (see README). Without it the release APK stays unsigned.
val keystore = Properties().apply { file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) } }

android {
    namespace = "dev.jonasludorf.cast"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "dev.jonasludorf.cast"
        minSdk = 32 // Horizon OS
        targetSdk = 34
        versionCode = 2
        versionName = "0.1.0"
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        ndk { abiFilters += "arm64-v8a" } // Quest
    }

    buildTypes {
        debug {
            // Local dev stack runs on plain http/ws
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
        release {
            if (!keystore.isEmpty) {
                signingConfig = signingConfigs.create("release") {
                    storeFile = file(keystore.getProperty("storeFile"))
                    storePassword = keystore.getProperty("storePassword")
                    keyAlias = keystore.getProperty("keyAlias")
                    keyPassword = keystore.getProperty("keyPassword")
                }
            }
        }
    }

    buildFeatures {
        buildConfig = true // BuildConfig.DEBUG: release builds only use cast.nwdl.org
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("io.livekit:livekit-android:2.30.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
}
