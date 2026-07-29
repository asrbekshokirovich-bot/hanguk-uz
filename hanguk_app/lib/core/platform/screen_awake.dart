import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Keeps the device screen on while a spoken interview is running.
///
/// A practice interview is several minutes of the student *talking*, not
/// touching the phone. Left alone, the OS dims and locks the screen on its
/// usual idle timer: the interview is interrupted, the End control is no
/// longer reachable, and on Android the activity can be paused — which this
/// app treats as "end the session".
///
/// Implemented as a method channel rather than a package because the effect
/// must be scoped to the interview. Setting `android:keepScreenOn` in the
/// layout, or the window flag in `MainActivity.onCreate`, would hold the
/// screen awake for the *entire* app and quietly drain a student's battery
/// while they browse universities.
///
/// Every call is best-effort. The channel only exists on Android and iOS; on
/// web and desktop the invocation raises [MissingPluginException], which is
/// swallowed here so a platform without the feature simply behaves as before
/// rather than breaking the interview.
class ScreenAwake {
  const ScreenAwake._();

  static const MethodChannel _channel = MethodChannel(
    'com.hanguk.studentapp/screen_awake',
  );

  /// Mirrors what we last asked the platform for, so a redundant call is
  /// dropped instead of crossing the channel again.
  static bool _enabled = false;

  /// Whether the screen is currently being held awake by this app.
  @visibleForTesting
  static bool get isEnabled => _enabled;

  /// Ask the OS to keep the screen on. Safe to call more than once.
  static Future<void> enable() => _set(true);

  /// Release the hold and let the normal idle timer resume.
  ///
  /// This must run on every exit from the interview — ended, abandoned,
  /// errored, or backed out of — or the student's screen stays lit until they
  /// notice. [InterviewActiveView.dispose] is the single place that covers
  /// all of those.
  static Future<void> disable() => _set(false);

  static Future<void> _set(bool keepOn) async {
    if (_enabled == keepOn) return;
    // Record the intent before awaiting: if the platform call throws, the
    // flag still reflects what we asked for, so a later `disable()` is not
    // skipped as a no-op and the screen can never be left pinned on.
    _enabled = keepOn;
    try {
      await _channel.invokeMethod<void>('setKeepScreenOn', {'enable': keepOn});
    } on MissingPluginException {
      // Web / desktop: no implementation registered. Nothing to undo.
    } on PlatformException catch (e) {
      debugPrint('ScreenAwake.setKeepScreenOn($keepOn) failed: $e');
    }
  }

  /// Drops the cached state. Tests only — the platform is not touched.
  @visibleForTesting
  static void resetForTest() => _enabled = false;
}
