package com.hanguk.studentapp.hanguk_app

import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    private companion object {
        // Must match ScreenAwake in lib/core/platform/screen_awake.dart.
        const val SCREEN_AWAKE_CHANNEL = "com.hanguk.studentapp/screen_awake"
    }

    /**
     * Holds the screen on for the duration of a spoken interview.
     *
     * Scoped deliberately: the student talks for minutes without touching the
     * phone, so the idle timer would dim and lock the screen mid-interview.
     * Setting the flag on request, rather than in `onCreate`, keeps the rest
     * of the app on the normal timer instead of burning battery while they
     * browse universities.
     */
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            SCREEN_AWAKE_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "setKeepScreenOn" -> {
                    val enable = call.argument<Boolean>("enable") ?: false
                    // Window flags must be touched on the UI thread.
                    runOnUiThread {
                        if (enable) {
                            window.addFlags(
                                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                            )
                        } else {
                            window.clearFlags(
                                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                            )
                        }
                    }
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    // No onPause/onResume handling on purpose. FLAG_KEEP_SCREEN_ON is defined
    // to hold the screen on only "as long as this window is visible to the
    // user", so Android already stops honouring it the moment the activity
    // leaves the foreground and reinstates it on return. Clearing it manually
    // in onPause would drop the hold permanently for an interview that was
    // still connecting when a notification shade or the mic-permission dialog
    // briefly paused the activity — the one case where the interview keeps
    // running through a pause.
}
