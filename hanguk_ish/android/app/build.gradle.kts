plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
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
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
