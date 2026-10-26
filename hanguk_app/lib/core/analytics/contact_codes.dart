import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/contact_links.dart';
import 'app_events.dart';

/// The short code the app writes into a Telegram message to the consultant
/// ("… (HK-7Q2MXA)"): when the person sends it, the chat — a lead — is tied
/// to this phone (app_contact_code, fn_contact_code_link; app analytics
/// stage 2). It ties the person only; it is never the source (S3).
abstract final class ContactCodes {
  static final _shape = RegExp(r'^[A-HJKMNP-Z2-9]{6}$');

  /// This phone's open code, or null (offline, recording not started, or the
  /// server not ready): the message then goes without one.
  static Future<String?> code() async {
    final id = AppEvents.installId;
    if (id == null) return null;
    try {
      final res = await Supabase.instance.client
          .rpc('app_contact_code', params: {'p_install_id': id})
          .timeout(const Duration(seconds: 4));
      return res is String && _shape.hasMatch(res) ? res : null;
    } catch (_) {
      return null;
    }
  }

  /// [message] with the code after it, as the person will send it.
  static String withCode(String message, String? code) => code == null ? message : '$message (HK-$code)';

  /// The consultant's Telegram chat with [message] typed in, code included;
  /// records the tap (`contact_tap`, `coded`).
  static Future<Uri> telegram(String message, {String? screen}) async {
    final c = await code();
    AppEvents.track('contact_tap', screen: screen, props: {'channel': 'telegram', 'coded': c != null});
    final text = withCode(message, c);
    return Uri.parse('${ContactLinks.telegramDirect}?text=${Uri.encodeComponent(text)}');
  }
}
