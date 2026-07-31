import 'package:flutter/material.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/university.dart';
import 'university_detail_sheet.dart';

import 'map_view/map_platform.dart'
    if (dart.library.html) 'map_view/map_web.dart'
    if (dart.library.io) 'map_view/map_mobile.dart'
    as map_impl;

class UniversityMapView extends StatefulWidget {
  final List<University> universities;

  const UniversityMapView({super.key, required this.universities});

  @override
  State<UniversityMapView> createState() => _UniversityMapViewState();
}

class _UniversityMapViewState extends State<UniversityMapView> {
  void _showDetail(University u) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => UniversityDetailSheet(university: u),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Stack(
      children: [
        Positioned.fill(
          child: map_impl.buildMap(
            context: context,
            universities: widget.universities,
            onMarkerClick: _showDetail,
          ),
        ),
        // Info overlay
        Positioned(
          bottom: 16,
          left: 0,
          right: 0,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: SeoulColors.glass,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: SeoulColors.glassBorder),
              ),
              child: Text(
                l.mapUniversitiesMapped(
                  widget.universities.where((u) => u.latitude != null).length,
                ),
                style: SeoulType.hangulStatus.copyWith(
                  color: SeoulColors.textSecondary,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
