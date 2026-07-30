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
        // Android 16. Pinned rather than tracking flutter.targetSdkVersion,
        // because targetSdk is what opts the app into a platform release's
        // behaviour changes — that should be a deliberate, tested step, not
        // something a Flutter upgrade does silently underneath us.
        //
        // Play requires this to stay within one year of the latest Android
        // release. It sat at 35 until Play refused further updates:
        //
        //   NEXT DEADLINE — raise to 37 (Android 17) before Aug 31, 2027.
        //
        // Reviewed for the API 36 behaviour changes before bumping:
        //   * Edge-to-edge is now unconditional (the opt-out flag is ignored).
        //     No change here: nothing ever set windowOptOutEdgeToEdgeEnforcement,
        //     and enforcement already applied at 35 on Android 15. Every screen
        //     paints through SeoulNightScaffold, whose gradient fills the window
        //     and whose body is inside a SafeArea.
        //   * Large screens may no longer have orientation or resizability
        //     locked. The manifest declares neither screenOrientation nor
        //     resizeableActivity, so there is nothing to lose.
        //   * Stricter foreground-service and JobScheduler rules — the app
        //     declares no foreground service and schedules no jobs.
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        // Always declare "release"; only configure it if key.properties is present.
        // Without key.properties, this config exists but has no key, so the
        // release buildType selection logic below falls back to debug-signing
        // and prints a loud warning.
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
            // Use the real release signing config when keys are present;
            // otherwise fall back to debug signing (so `flutter run --release`
            // still works locally) but warn loudly so we never accidentally
            // ship a debug-signed APK.
            signingConfig = if (hasReleaseKeys) {
                signingConfigs.getByName("release")
            } else {
                logger.warn(
                    "[hanguk] WARNING: android/key.properties not found. " +
                    "Falling back to DEBUG signing for the release build. " +
                    "Production releases MUST be signed with the real upload key. " +
                    "See docs/RELEASE.md."
                )
                signingConfigs.getByName("debug")
            }
            // R8 obfuscation + minification for release. Disable temporarily
            // if a class is being mangled — but try to fix it with proguard
            // rules first rather than turning these off in production.
            isMinifyEnabled = true
            isShrinkResources = true
        }
    }
}

flutter {
    source = "../.."
}
