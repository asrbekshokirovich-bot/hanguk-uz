import 'package:flutter/foundation.dart';
import '../../map/domain/university.dart';

@immutable
class StudentApplication {
  final String id;
  final String universityId;
  final String studentId;
  final String status;
  final String program;
  final DateTime createdAt;
  final University? university;

  const StudentApplication({
    required this.id,
    required this.universityId,
    required this.studentId,
    required this.status,
    required this.program,
    required this.createdAt,
    this.university,
  });
}
