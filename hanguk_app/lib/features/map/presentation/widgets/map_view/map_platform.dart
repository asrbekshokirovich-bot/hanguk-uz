import 'package:flutter/material.dart';
import '../../../domain/university.dart';

Widget buildMap({
  required BuildContext context,
  required List<University> universities,
  required void Function(University u) onMarkerClick,
}) {
  throw UnsupportedError('Cannot build map without a platform implementation');
}
