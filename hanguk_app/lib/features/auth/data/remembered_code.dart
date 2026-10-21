import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The client code the student last signed in with on this phone. The
/// sign-in page shows it as the consultant's SMS ("qo'yish →") and builds
/// its keypad from its characters — only once it has worked here before.
class RememberedCode {
  const RememberedCode._();

  static const _key = 'client_code_v1';
  static const _storage = FlutterSecureStorage();

  static Future<String?> read() async {
    try {
      final code = await _storage.read(key: _key);
      return code == null || code.isEmpty ? null : code;
    } catch (e) {
      debugPrint('[RememberedCode] $e');
      return null;
    }
  }

  static Future<void> save(String code) async {
    try {
      await _storage.write(key: _key, value: code);
    } catch (e) {
      debugPrint('[RememberedCode] $e');
    }
  }
}
