# ─── Hanguk ProGuard / R8 rules ──────────────────────────────────────────────
# Be conservative — keep more than strictly necessary. R8 will warn if rules
# are unused. Wrong rules cause silent runtime crashes that don't reproduce
# in debug.
#
# This file is referenced from android/app/build.gradle.kts via:
#   proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"),
#                 "proguard-rules.pro")

# ── Flutter engine ──────────────────────────────────────────────────────────
-keep class io.flutter.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# ── Kotlin / coroutines / serialization (Supabase, gotrue, Vapi all use) ────
-keep class kotlin.Metadata { *; }
-keep class kotlin.reflect.** { *; }
-keep class kotlinx.serialization.** { *; }
-keep class kotlinx.coroutines.** { *; }
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn kotlinx.serialization.**
-dontwarn kotlinx.coroutines.**

# ── Supabase / gotrue / postgrest ───────────────────────────────────────────
-keep,includedescriptorclasses class io.github.jan.supabase.** { *; }
-dontwarn io.github.jan.supabase.**

# ── OkHttp / dio / HTTP / dart_jsonwebtoken transitive ──────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── pointycastle (auth JWT signing — pinned to 3.x by pubspec override) ────
-dontwarn pointycastle.**
-keep class pointycastle.** { *; }

# ── WebView JavaScript bridge (Kakao Maps embed) ───────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * {
    @JavascriptInterface <methods>;
}

# ── Audio players (mock interview audio playback) ──────────────────────────
-keep class xyz.luan.audioplayers.** { *; }
-dontwarn xyz.luan.audioplayers.**

# ── install_plugin (kept alive for non-store flavor; gated at runtime) ─────
-keep class com.zaihui.installplugin.** { *; }
-dontwarn com.zaihui.installplugin.**

# ── Vapi (local fork under packages/vapi/) ─────────────────────────────────
-keep class com.vapi.** { *; }
-keep class ai.vapi.** { *; }
-dontwarn com.vapi.**
-dontwarn ai.vapi.**

# ── Kakao SDK classes (referenced by AndroidManifest meta-data even though
#    no kakao_flutter_sdk dependency is on the classpath today). ────────────
-keep class com.kakao.** { *; }
-dontwarn com.kakao.**

# ── JSON / Freezed / json_serializable model classes ───────────────────────
# Generated fromJson/toJson methods are invoked reflectively in some paths;
# keep them. The default constructors are also needed for deserialization.
-keepclassmembers class * {
    public <init>(...);
}
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# ── Riverpod / freezed generated code ──────────────────────────────────────
-keep class **$$Provider** { *; }
-keep class **$$Notifier** { *; }
-keep class **$$Family** { *; }
-keep class **.g.dart { *; }
-keep class **.freezed.dart { *; }

# ── path_provider / package_info_plus / device_info_plus / permission_handler
-keep class com.baseflow.permissionhandler.** { *; }
-keep class dev.fluttercommunity.plus.** { *; }

# ── file_picker / image_picker ─────────────────────────────────────────────
-keep class com.mr.flutter.plugin.filepicker.** { *; }
-keep class io.flutter.plugins.imagepicker.** { *; }

# ── webview_flutter ────────────────────────────────────────────────────────
-keep class io.flutter.plugins.webviewflutter.** { *; }

# ── url_launcher / open_filex ──────────────────────────────────────────────
-keep class io.flutter.plugins.urllauncher.** { *; }

# ── Suppress noisy warnings from transitively-included libraries ───────────
-dontwarn javax.annotation.**
-dontwarn org.bouncycastle.**
-dontwarn org.checkerframework.**
-dontwarn com.google.errorprone.**
