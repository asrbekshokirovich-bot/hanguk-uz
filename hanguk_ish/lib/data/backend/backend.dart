import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/shift_repository.dart';
import 'ish_names.dart';

export 'ish_names.dart';

/// Where the backend is, given at build time:
///
///     flutter build apk --dart-define=SUPABASE_URL=https://….supabase.co \
///                       --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
///
/// (a legacy `SUPABASE_ANON_KEY` works too).
///
/// Without both the apps run on demo data (nothing leaves the phone).
class BackendConfig {
  const BackendConfig({required this.url, required this.publishableKey});

  static const fromEnvironment = BackendConfig(
    url: String.fromEnvironment('SUPABASE_URL'),
    publishableKey: String.fromEnvironment(
      'SUPABASE_PUBLISHABLE_KEY',
      defaultValue: String.fromEnvironment('SUPABASE_ANON_KEY'),
    ),
  );

  /// No backend: demo data.
  static const none = BackendConfig(url: '', publishableKey: '');

  final String url;

  /// The project's public client key (safe in the app: RLS decides).
  final String publishableKey;

  bool get isConfigured => url.isNotEmpty && publishableKey.isNotEmpty;

  /// The public URL of [path] in a public Storage bucket; null for no file.
  String? publicUrl(String bucket, String? path) {
    if (path == null || path.isEmpty || !isConfigured) return null;
    final base = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    final segments = path.split('/').map(Uri.encodeComponent).join('/');
    return '$base/storage/v1/object/public/$bucket/$segments';
  }
}

/// Every API call goes to the schema `ish` of hanguk.uz's project (P48).
const ishPostgrestOptions = PostgrestClientOptions(schema: ishSchema);

/// The running app's backend settings (overridden in tests).
final backendConfigProvider = Provider<BackendConfig>((ref) => BackendConfig.fromEnvironment);

/// The Supabase client when a backend is configured (set up in `bootstrap`),
/// otherwise null.
final supabaseClientProvider = Provider<SupabaseClient?>((ref) => null);

/// Runs one backend call and turns its failures into the app's errors: the
/// stable code the database raised ('SHIFT_FULL', …) as a
/// [ShiftActionException], no connection as an [OfflineException].
Future<T> backendCall<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on PostgrestException catch (e) {
    throw ShiftActionException(backendErrorCode(e.message, e.code));
  } on AuthException catch (e) {
    if (e is AuthRetryableFetchException) throw const OfflineException();
    throw const ShiftActionException('NOT_AUTHENTICATED');
  } on StorageException catch (e) {
    throw ShiftActionException(e.statusCode == '403' || e.statusCode == '401' ? 'FORBIDDEN' : 'UPLOAD_FAILED');
  } on SocketException {
    throw const OfflineException();
  } on TimeoutException {
    throw const OfflineException();
  } on http.ClientException {
    throw const OfflineException();
  } on HandshakeException {
    throw const OfflineException();
  }
}

final _codePattern = RegExp(r'^[A-Z][A-Z0-9_]+$');

/// The app-level code for a database error: the function's own code when it
/// raised one, otherwise one for the kind of failure.
String backendErrorCode(String message, String? sqlState) {
  final text = message.trim();
  if (_codePattern.hasMatch(text)) return text;
  return switch (sqlState) {
    '23514' || '22P02' || '22023' || '22001' || '23502' => 'INVALID',
    '23505' => 'CONFLICT',
    '42501' => 'FORBIDDEN',
    '28000' || 'PGRST301' || 'PGRST302' => 'NOT_AUTHENTICATED',
    'PGRST116' => 'NOT_FOUND',
    _ => 'UNKNOWN',
  };
}
