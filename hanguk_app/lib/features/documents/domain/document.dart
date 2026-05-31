import 'package:flutter/foundation.dart';

@immutable
class AppDocument {
  final String id;
  final String studentId;
  final String? applicationId;
  final String name;
  final String filePath;
  final String fileType;
  final int fileSize;
  final String status; // 'uploaded', 'approved', 'rejected'
  final DateTime createdAt;

  const AppDocument({
    required this.id,
    required this.studentId,
    this.applicationId,
    required this.name,
    required this.filePath,
    required this.fileType,
    required this.fileSize,
    required this.status,
    required this.createdAt,
  });
}
