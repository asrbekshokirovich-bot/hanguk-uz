import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

/// Hands a file to the phone's share sheet (print, messenger, files…).
/// A provider so tests can see what would be shared.
abstract interface class FileSharer {
  Future<void> share({
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
    String? text,
  });
}

class SystemFileSharer implements FileSharer {
  const SystemFileSharer();

  @override
  Future<void> share({
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
    String? text,
  }) async {
    await SharePlus.instance.share(ShareParams(
      files: [XFile.fromData(bytes, name: fileName, mimeType: mimeType)],
      fileNameOverrides: [fileName],
      text: text,
    ));
  }
}

final fileSharerProvider = Provider<FileSharer>((ref) => const SystemFileSharer());
