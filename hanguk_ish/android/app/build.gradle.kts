import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services") apply false
}

// Push (P56): Firebase reads android/app/google-services.json — both apps
// (uz.hanguk.ish, uz.hanguk.ish.biz) in the Firebase project of the student
// app (hanguk-consulting), whose service account the server sends with.
// Without the file the apps build and run as before, without pushes.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

// The Play upload key: android/key.properties (storeFile, storePassword,
// keyAlias, keyPassword), written by CI from the repository secrets or kept
// locally — never committed. Without it, release builds use the test key.
val uploadKey = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) FileInputStream(file).use { load(it) }
}

android {
    namespace = "uz.hanguk.ish"
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
        applicationId = "uz.hanguk.ish"
        minSdk = flutter.minSdkVersion
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // One codebase, two apps (decision 2026-11-10):
    //   flutter build apk --flavor worker   -t lib/main_worker.dart
    //   flutter build apk --flavor employer -t lib/main_employer.dart
    flavorDimensions += "app"
    productFlavors {
        create("worker") {
            dimension = "app"
            applicationId = "uz.hanguk.ish"
            resValue("string", "app_name", "Hanguk Ish")
        }
        create("employer") {
            dimension = "app"
            applicationId = "uz.hanguk.ish.biz"
            resValue("string", "app_name", "Hanguk Ish 사장님")
        }
    }

    signingConfigs {
        // Test APKs are signed with a STABLE throwaway key (published password)
        // so each new test build installs over the previous one. Store signing
        // arrives with the release step (P7) and never uses this key.
        getByName("debug") {
            storeFile = file("sideload-test.keystore")
            storePassword = "hanguktest"
            keyAlias = "sideload-test"
            keyPassword = "hanguktest"
        }
        if (!uploadKey.isEmpty) {
            create("upload") {
                storeFile = rootProject.file(uploadKey.getProperty("storeFile"))
                storePassword = uploadKey.getProperty("storePassword")
                keyAlias = uploadKey.getProperty("keyAlias")
                keyPassword = uploadKey.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName(if (uploadKey.isEmpty) "debug" else "upload")
        }
    }
}

flutter {
    source = "../.."
}
