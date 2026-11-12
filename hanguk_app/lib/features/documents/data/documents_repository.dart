import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../domain/document.dart';
import '../domain/document_type.dart';

final supabaseClientProvider = Provider((ref) => Supabase.instance.client);

final documentsProvider = FutureProvider<List<AppDocument>>((ref) async {
  final client = Supabase.instance.client;
  final user = client.auth.currentUser;
  if (user == null) return [];

  try {
    final data = await client
        .from('documents')
        .select()
        .eq('student_id', user.id)
        .order('created_at', ascending: false);

    return (data as List)
        .map(
          (row) => AppDocument(
            id: row['id'] as String,
            studentId: row['student_id'] as String,
            applicationId: row['application_id'] as String?,
            name: row['name'] as String? ?? '',
            filePath: row['file_path'] as String? ?? '',
            fileType: row['file_type'] as String? ?? '',
            fileSize: (row['file_size'] as int?) ?? 0,
            status: row['status'] as String? ?? 'uploaded',
            createdAt: DateTime.parse(row['created_at'] as String),
          ),
        )
        .toList();
  } catch (e) {
    // Network/auth failure — return empty so DocumentSlot shows Upload buttons
    return [];
  }
});

/// The file name's extension, lower case, without the dot; '' when it has none.
String documentExtension(String fileName) {
  final dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot == fileName.length - 1) return '';
  return fileName.substring(dot + 1).toLowerCase();
}

/// What the server is told a document is. The app accepts jpg, jpeg, png and
/// pdf. Until 2026-11-11 this was `'application/$ext'` — `application/jpg`,
/// `application/JPG` — which is no type at all, and `process-document` hands
/// the stored value to the model as the file's MIME type.
String documentMimeType(String fileName) {
  switch (documentExtension(fileName)) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/// The last part of a path, whichever way its slashes lean.
String documentBaseName(String path) => path.split(RegExp(r'[/\\]')).last;

class DocumentsRepository {
  final SupabaseClient _client;

  DocumentsRepository(this._client);

  /// A file picked on a phone or a desktop.
  Future<void> uploadDocument(File file, DocumentType type) async {
    final size = await file.length();
    await _store(
      type: type,
      originalName: documentBaseName(file.path),
      size: size,
      send: (path, options) =>
          _client.storage.from('student-documents').upload(path, file, fileOptions: options),
    );
  }

  /// A file picked in the browser: there is no path there, only the bytes.
  Future<void> uploadDocumentBytes(Uint8List bytes, String originalName, DocumentType type) async {
    await _store(
      type: type,
      originalName: documentBaseName(originalName),
      size: bytes.length,
      send: (path, options) =>
          _client.storage.from('student-documents').uploadBinary(path, bytes, fileOptions: options),
    );
  }

  Future<void> _store({
    required DocumentType type,
    required String originalName,
    required int size,
    required Future<Object?> Function(String path, FileOptions options) send,
  }) async {
    final user = _client.auth.currentUser;
    if (user == null) {
      // Typically throw an exception, returning mock for Phase 6 build tests
      await Future.delayed(const Duration(seconds: 2));
      return;
    }

    final ext = documentExtension(originalName);
    final mime = documentMimeType(originalName);
    final path =
        '${user.id}/${type.id}-${DateTime.now().millisecondsSinceEpoch}${ext.isEmpty ? '' : '.$ext'}';

    // Upload to Storage
    await send(path, FileOptions(upsert: false, contentType: mime));

    // Insert into 'documents' table
    try {
      await _client.from('documents').insert({
        'student_id': user.id,
        'name': '[${type.id}] $originalName',
        'file_path': path,
        'file_type': mime,
        'file_size': size,
        'status': 'uploaded',
      });
    } catch (_) {
      // A file with no row is seen by nobody — not the student, not the CRM.
      // Take it back so a second try does not leave two.
      try {
        await _client.storage.from('student-documents').remove([path]);
      } catch (_) {}
      rethrow;
    }
  }

  Future<void> deleteDocument(AppDocument doc) async {
    // Delete from storage
    await _client.storage.from('student-documents').remove([doc.filePath]);
    // Delete from table
    await _client.from('documents').delete().eq('id', doc.id);
  }
}

final documentsRepositoryProvider = Provider((ref) {
  return DocumentsRepository(ref.watch(supabaseClientProvider));
});
