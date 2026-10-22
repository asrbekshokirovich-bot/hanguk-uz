import 'dart:async';
import 'dart:convert';

import 'package:daily_flutter/daily_flutter.dart';

import '../../vapi_call_interface.dart';
import '../../shared/exceptions.dart';
import '../../shared/vapi_event.dart';
import '../../shared/vapi_audio_device.dart';
import '../../shared/vapi_call_status.dart';
import '../../shared/vapi_call_monitor.dart';
import '../../shared/vapi_call_transport.dart';

/// Represents an active voice AI call session.
///
/// This class encapsulates a single call and provides methods to interact
/// with the assistant, manage audio settings, and handle call lifecycle events.
///
/// Example usage:
/// ```dart
/// final vapiClient = VapiClient('your-public-key');
///
/// // Start a call and return immediately
/// final call = await vapiClient.start(assistantId: 'assistant-id');
///
/// // Or start a call and wait until the assistant is actively listening
/// final activeCall = await vapiClient.start(
///   assistantId: 'assistant-id',
///   waitUntilActive: true,
/// );
///
/// // Access call information
/// print('Call ID: ${call.id}');
/// print('Assistant ID: ${call.assistantId}');
/// print('Status: ${call.status}');
///
/// // Listen to events
/// call.onEvent.listen((event) {
///   print('Event: ${event.label}');
/// });
///
/// // Send a message during the call
/// await call.send({'message': 'Hello'});
///
/// // Check if call is still active
/// if (call.status == VapiCallStatus.active) {
///   await call.stop(); // This will trigger a 'call-end' event
/// }
///
/// // Clean up resources
/// call.dispose();
/// ```
class VapiMobileCall implements VapiCall {
  /// The underlying Daily call client for this call.
  final CallClient _call;

  /// Stream controller for broadcasting Vapi events for this call
  final _streamController = StreamController<VapiEvent>.broadcast();

  /// Completer for waiting until the call becomes active
  final Completer<void> _activeCallCompleter = Completer<void>();

  /// The one leave() in flight, shared by everyone who asks to leave.
  ///
  /// When the assistant hangs up, the remote participant leaves and this
  /// class calls leave() itself; the app, seeing the end, calls stop() and
  /// then dispose(). Two leave() calls racing, and destroying the native
  /// client while a leave() was still running, killed the whole app at the
  /// end of every interview. Now there is one leave, and the native client
  /// is destroyed only after it settles.
  Future<void>? _leaving;

  /// Set once dispose() starts: no more native calls, no more events.
  bool _disposed = false;

  StreamSubscription<dynamic>? _eventSub;

  /// Stream of Vapi events that occur during this call's lifecycle
  ///
  /// Events include:
  /// - `call-start`: When the assistant connects and starts listening
  /// - `call-end`: When the call ends (automatically emitted for all termination scenarios)
  /// - `call-error`: When an error occurs during the call
  /// - `message`: When a message is received from the assistant
  ///
  /// The `call-end` event is guaranteed to be emitted whenever the call terminates,
  /// regardless of whether it was ended by calling [stop], network disconnection,
  /// or any other termination cause.
  @override
  Stream<VapiEvent> get onEvent => _streamController.stream;

  /// Current status of the call (starting, active, ended)
  VapiCallStatus _status = VapiCallStatus.starting;

  /// The current status of this call
  ///
  /// Starts as [VapiCallStatus.starting], progresses to [VapiCallStatus.active]
  /// when the assistant connects, and becomes [VapiCallStatus.ended] when the
  /// call terminates. Once ended, no operations can be performed on this call instance.
  @override
  VapiCallStatus get status => _status;

  // Call metadata from Vapi API response
  /// Unique identifier for this call.
  @override
  final String id;

  /// Organization ID associated with this call
  @override
  final String orgId;

  /// Timestamp when this call was created
  @override
  final DateTime createdAt;

  /// Timestamp when this call was last updated
  @override
  final DateTime updatedAt;

  /// Type of the call (e.g., "webCall")
  @override
  final String type;

  /// Monitor configuration for this call
  @override
  final VapiCallMonitor monitor;

  /// Transport configuration for this call
  @override
  final VapiCallTransport transport;

  /// Web call URL for joining the call
  @override
  final String webCallUrl;

  /// ID of the assistant handling this call
  @override
  final String assistantId;

  /// Assistant configuration overrides for this call
  @override
  final Map<String, dynamic> assistantOverrides;

  /// Creates a new VapiCall instance
  ///
  /// This constructor is typically called internally by [VapiClient.start]
  VapiMobileCall._(
    this._call,
    this.id,
    this.orgId,
    this.createdAt,
    this.updatedAt,
    this.type,
    this.monitor,
    this.transport,
    this.webCallUrl,
    this.assistantId,
    this.assistantOverrides,
  ) {
    _setupEventListeners();
  }

  /// Factory method to create a VapiCall with an initialized client and API response data
  ///
  /// This method parses the API response, sets up the call client and joins the call.
  /// If [waitUntilActive] is true, it will wait until the assistant starts listening
  static Future<VapiMobileCall> create(
    CallClient callClient,
    Map<String, dynamic> apiResponse, {
    bool waitUntilActive = false,
  }) async {
    // Parse the API response with null-safety
    final id = apiResponse['id'] as String? ?? 'mobile_call_id';
    final orgId = apiResponse['orgId'] as String? ?? '';
    final createdAt = DateTime.tryParse(apiResponse['createdAt']?.toString() ?? '') ?? DateTime.now();
    final updatedAt = DateTime.tryParse(apiResponse['updatedAt']?.toString() ?? '') ?? DateTime.now();
    final type = apiResponse['type'] as String? ?? 'webCall';
    
    final monitorTmp = apiResponse['monitor'] is Map ? Map<String, dynamic>.from(apiResponse['monitor']) : <String, dynamic>{};
    final monitor = VapiCallMonitor.fromJson(monitorTmp);
    
    final transportTmp = apiResponse['transport'] is Map ? Map<String, dynamic>.from(apiResponse['transport']) : <String, dynamic>{};
    final transport = VapiCallTransport.fromJson(transportTmp);
    
    final webCallUrl = apiResponse['webCallUrl'] as String? ?? '';
    final assistantId = apiResponse['assistantId'] as String? ?? '';
    final overridesRaw = apiResponse['assistantOverrides'];
    final assistantOverrides = overridesRaw is Map
        ? Map<String, dynamic>.from(overridesRaw)
        : <String, dynamic>{};

    final call = VapiMobileCall._(
      callClient,
      id,
      orgId,
      createdAt,
      updatedAt,
      type,
      monitor,
      transport,
      webCallUrl,
      assistantId,
      assistantOverrides,
    );

    await call._joinCall(webCallUrl);

    // Wait for the call to become active if requested
    if (waitUntilActive) {
      await call._activeCallCompleter.future;
    }

    return call;
  }

  /// Sets up event listeners for the call client
  void _setupEventListeners() {
    _eventSub = _call.events.listen((event) {
      if (_disposed) return;
      event.whenOrNull(
        callStateUpdated: (stateData) {
          switch (stateData.state) {
            case CallState.left:
              _status = VapiCallStatus.ended;
              _emit(const VapiEvent("call-end"));
              break;
            case CallState.joined:
              break;
            default:
              break;
          }
        },
        participantLeft: (participantData) {
          if (participantData.info.isLocal) return;
          if (_status == VapiCallStatus.ended) return;
          unawaited(_leave());
        },
        appMessageReceived: (messageData, id) {
          _onAppMessage(messageData);
        },
        participantUpdated: (participantData) {
          if (participantData.info.username == "Vapi Speaker" &&
              participantData.media?.microphone.state == MediaState.playable) {
            if (!_disposed && _status != VapiCallStatus.ended) {
              _call.sendAppMessage(jsonEncode({'message': "playable"}), null);
            }
          }
        },
        participantJoined: (participantData) {
          if (participantData.info.username == "Vapi Speaker" &&
              participantData.media?.microphone.state == MediaState.playable) {
            if (!_disposed && _status != VapiCallStatus.ended) {
              _call.sendAppMessage(jsonEncode({'message': "playable"}), null);
            }
          }
        },
      );
    });
  }

  /// Joins the call using the provided web call URL
  Future<void> _joinCall(String webCallUrl) async {
    const clientSettings = ClientSettingsUpdate.set(
        inputs: InputSettingsUpdate.set(
      microphone:
          MicrophoneInputSettingsUpdate.set(isEnabled: BoolUpdate.set(true)),
      camera: CameraInputSettingsUpdate.set(isEnabled: BoolUpdate.set(false)),
    ));

    await _call
        .join(
      url: Uri.parse(webCallUrl),
      clientSettings: clientSettings,
    )
        .catchError((e) {
      throw VapiStartCallException(e);
    });
  }

  /// Sends a message to the assistant during this call
  ///
  /// [message] can be any serializable object that will be JSON encoded
  /// and sent to the assistant.
  ///
  /// Throws [VapiCallEndedException] if this call has ended.
  @override
  Future<void> send(dynamic message) async {
    if (_status == VapiCallStatus.ended) {
      throw const VapiCallEndedException();
    }
    await _call.sendAppMessage(jsonEncode(message), null);
  }

  /// Handles incoming app messages from the assistant
  ///
  /// Parses JSON messages and emits appropriate events.
  void _onAppMessage(String msg) {
    try {
      final parsedMessage = jsonDecode(msg);

      if (parsedMessage == "listening") {
        _status = VapiCallStatus.active;

        if (!_activeCallCompleter.isCompleted) {
          _activeCallCompleter.complete();
        }

        _emit(const VapiEvent("call-start"));
        return;
      }

      // TODO: look into this double json decode as apparently msg gets wrapped in double quotes
      final messageMap = jsonDecode(jsonDecode(msg));
      if (messageMap['type'] == "speech-update") {
        if (messageMap['status'] == "started") {
          _emit(const VapiEvent("speech-start"));
        } else if (messageMap['status'] == "stopped") {
          _emit(const VapiEvent("speech-end"));
        }
        return;
      }

      _emit(VapiEvent("message", messageMap));
    } catch (parseError) {
      // Silently ignore parse errors for non-JSON messages
    }
  }

  /// Stops this call and leaves the session
  ///
  /// After calling this method, the call will be marked as ended and
  /// no further operations can be performed on this call instance.
  ///
  /// Throws [VapiCallEndedException] if this call has already ended.
  @override
  Future<void> stop() async {
    if (_status == VapiCallStatus.ended || _disposed) {
      throw const VapiCallEndedException();
    }
    await _leave();
  }

  /// Leaves the Daily room once; later callers share the same future.
  Future<void> _leave() {
    if (_disposed) return Future.value();
    return _leaving ??= _call.leave().catchError((_) {});
  }

  /// Adds an event unless this call has been torn down.
  void _emit(VapiEvent event) {
    if (_disposed || _streamController.isClosed) return;
    _streamController.add(event);
  }

  /// Mutes or unmutes the microphone during this call
  ///
  /// [muted] - true to mute the microphone, false to unmute.
  ///
  /// Throws [VapiCallEndedException] if this call has ended.
  @override
  void setMuted(bool muted) {
    if (_status == VapiCallStatus.ended) {
      throw const VapiCallEndedException();
    }
    _call.updateInputs(
        inputs: InputSettingsUpdate.set(
      microphone:
          MicrophoneInputSettingsUpdate.set(isEnabled: BoolUpdate.set(!muted)),
    ));
  }

  /// Returns true if the microphone is currently muted
  ///
  /// Throws [VapiCallEndedException] if this call has ended.
  @override
  bool get isMuted {
    if (_status == VapiCallStatus.ended) {
      throw const VapiCallEndedException();
    }
    return _call.inputs.microphone.isEnabled == false;
  }

  /// Sets the audio output device for this call using Vapi's audio device enum
  ///
  /// [device] - The VapiAudioDevice to use for audio output.
  /// Available options:
  /// - [VapiAudioDevice.speakerphone] - Use the device's speakerphone
  /// - [VapiAudioDevice.wired] - Use wired headphones/earphones
  /// - [VapiAudioDevice.earpiece] - Use the device's earpiece
  /// - [VapiAudioDevice.bluetooth] - Use connected Bluetooth audio device
  ///
  /// Throws [VapiCallEndedException] if this call has ended.
  @override
  void setAudioDevice({VapiAudioDevice? device}) {
    if (_status == VapiCallStatus.ended) {
      throw const VapiCallEndedException();
    }
    _call.setAudioDevice(
      deviceId: switch (device) {
        VapiAudioDevice.speakerphone => DeviceId.speakerPhone,
        VapiAudioDevice.wired => DeviceId.wired,
        VapiAudioDevice.earpiece => DeviceId.earpiece,
        VapiAudioDevice.bluetooth => DeviceId.bluetooth,
        null => throw const VapiException("Invalid audio device"),
      },
    );
  }

  /// Disposes of resources used by this VapiCall instance
  ///
  /// Call this method when you're done using the VapiCall instance to
  /// clean up the event stream and prevent memory leaks.
  ///
  /// Note: This will also dispose of the underlying call client.
  @override
  void dispose() {
    if (_disposed) return;
    // Leave first (or wait for the leave already running), give the native
    // side a moment to finish its teardown events, and only then destroy the
    // client. Never throws: this runs from widget dispose().
    final leaving = _status == VapiCallStatus.ended ? _leaving : _leave();
    _disposed = true;
    unawaited(() async {
      try {
        await leaving?.timeout(const Duration(seconds: 5));
      } catch (_) {}
      await Future<void>.delayed(const Duration(milliseconds: 800));
      try {
        await _eventSub?.cancel();
      } catch (_) {}
      try {
        await _call.dispose();
      } catch (_) {}
      if (!_streamController.isClosed) await _streamController.close();
    }());
  }
}
