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
        // Without key.properties, this config exists but has no key, and the
        // release buildType selection logic below throws rather than silently
        // falling back to debug signing.
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
            // Real release signing is mandatory. A release build without
            // key.properties must fail loudly at configuration time rather
            // than silently ship a debug-signed AAB that Play will reject.
            signingConfig = if (hasReleaseKeys) {
                signingConfigs.getByName("release")
            } else {
                throw GradleException(
                    "android/key.properties topilmadi. Release build imzolab bo'lmaydi. " +
                    "key.properties.template dan nusxa oling va to'ldiring. " +
                    "Batafsil: hanguk_app/docs/RELEASE.md"
                )
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

flutter {
    source = "../.."
}
