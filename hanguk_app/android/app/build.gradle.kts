import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing config is loaded from android/key.properties (gitignored).
// See docs/RELEASE.md for keystore generation and CI restoration.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
val hasReleaseKeys = keystorePropertiesFile.exists()
if (hasReleaseKeys) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.hanguk.studentapp.hanguk_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.hanguk.studentapp.hanguk_app"
        minSdk = flutter.minSdkVersion
        targetSdk = 35  // Pinned: Play Store 2026 hard requirement
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // ── Distribution channels ────────────────────────────────────────
    // store    → Google Play / App Store. APK-sideload updater removed
    //            (see src/store/AndroidManifest.xml + kIsStoreBuild).
    // selfHost → direct APK distribution. Bundled updater stays active.
    // applicationId is intentionally the same across flavors — the Play
    // listing must keep resolving to the same app.
    flavorDimensions += "distribution"
    productFlavors {
        create("store") {
            dimension = "distribution"
        }
        create("selfHost") {
            dimension = "distribution"
        }
    }

    signingConfigs {
        // Always declare "release"; only configure it if key.properties is present.
        // Without key.properties, this config exists but has no key. Assigning
        // it to buildTypes.release below is a configuration-time no-op that
        // must never fail on its own — Gradle configures the release build
        // type for EVERY invocation (even `assembleStoreDebug`), regardless
        // of which variant task actually runs. The real enforcement is the
        // taskGraph.whenReady check further down, which only fires when a
        // release task is genuinely requested.
        create("release") {
            if (hasReleaseKeys) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeys) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            // R8 obfuscation + minification for release. Disable temporarily
            // if a class is being mangled — but try to fix it with proguard
            // rules first rather than turning these off in production.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

// Real release builds must never fall back to debug signing. Checked at
// task-graph time (once Gradle knows which tasks were actually requested),
// not at configuration time — so debug builds and CI's unsigned build-check
// (which never touch a release signing config) aren't blocked by a missing
// keystore. Fires for assemble/bundle tasks of any release variant, in any
// flavor (assembleRelease, bundleStoreRelease, assembleSelfHostRelease, ...).
gradle.taskGraph.whenReady {
    val requestedRelease = allTasks.any { task ->
        task.name.contains("Release") &&
            (task.name.startsWith("assemble") || task.name.startsWith("bundle"))
    }
    if (requestedRelease && !hasReleaseKeys) {
        throw GradleException(
            "android/key.properties topilmadi. Release build imzolab bo'lmaydi. " +
            "key.properties.template dan nusxa oling va to'ldiring. " +
            "Batafsil: hanguk_app/docs/RELEASE.md"
        )
    }
}

flutter {
    source = "../.."
}
