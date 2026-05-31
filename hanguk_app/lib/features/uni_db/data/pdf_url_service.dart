import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Result of a successful signed-URL grant.
class PdfSignedUrl {
  const PdfSignedUrl({required this.signedUrl, required this.expiresAt});
  final String signedUrl;
  final DateTime expiresAt;
}

/// Calls the `get-pdf-url` Edge Function to mint a 15-minute signed URL
/// for a guideline blob. Audit row is written server-side; the client
/// never writes to `pdf_access_log` directly.
class PdfUrlService {
  PdfUrlService(this._client);
  final SupabaseClient _client;

  Future<PdfSignedUrl> getSignedUrl(
    String documentId, {
    String reason = 'open_original',
  }) async {
    final res = await _client.functions.invoke(
      'get-pdf-url',
      body: {'document_id': documentId, 'reason': reason},
    );
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw StateError('get-pdf-url returned non-object: $data');
    }
    final signedUrl = data['signed_url'] as String?;
    final expiresAt = data['expires_at'] as String?;
    if (signedUrl == null || expiresAt == null) {
      throw StateError(
        'get-pdf-url response missing fields: signed_url=$signedUrl, expires_at=$expiresAt',
      );
    }
    return PdfSignedUrl(
      signedUrl: signedUrl,
      expiresAt:
          DateTime.tryParse(expiresAt) ??
          DateTime.now().add(const Duration(minutes: 15)),
    );
  }
}

final pdfUrlServiceProvider = Provider<PdfUrlService>(
  (ref) => PdfUrlService(Supabase.instance.client),
);
