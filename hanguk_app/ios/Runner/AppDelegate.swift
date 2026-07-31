import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  /// Must match ScreenAwake in lib/core/platform/screen_awake.dart.
  private static let screenAwakeChannel = "com.hanguk.studentapp/screen_awake"

  /// Held for the life of the delegate. A channel that goes out of scope
  /// takes its handler with it, and the interview's screen-hold requests
  /// would then quietly stop arriving.
  private var screenAwakeMethodChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    registerScreenAwakeChannel(engineBridge)
  }

  /// Holds the screen on for the duration of a spoken interview.
  ///
  /// The student talks for minutes without touching the phone, so the idle
  /// timer would otherwise lock the screen mid-interview and take the End
  /// control with it. Scoped to the interview rather than set once at launch,
  /// so the rest of the app keeps the normal timer.
  ///
  /// iOS already clears `isIdleTimerDisabled` while the app is backgrounded
  /// and restores it on return, so there is nothing to undo around lifecycle
  /// transitions — only when the interview itself ends.
  private func registerScreenAwakeChannel(_ engineBridge: FlutterImplicitEngineBridge) {
    let channel = FlutterMethodChannel(
      name: AppDelegate.screenAwakeChannel,
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    screenAwakeMethodChannel = channel

    channel.setMethodCallHandler { call, result in
      guard call.method == "setKeepScreenOn" else {
        result(FlutterMethodNotImplemented)
        return
      }

      let arguments = call.arguments as? [String: Any]
      let enable = arguments?["enable"] as? Bool ?? false

      // UIApplication must only be touched on the main thread.
      DispatchQueue.main.async {
        UIApplication.shared.isIdleTimerDisabled = enable
        result(nil)
      }
    }
  }
}
