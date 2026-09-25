import 'package:flutter/material.dart';

import '../../catalog/presentation/catalog_browser.dart';

/// Guest Explore — the university catalogue a visitor browses before they
/// have a magic code.
///
/// The catalogue is the CRM's "Universitetlar → Ma'lumotli" section: every
/// university staff have loaded a guideline Excel for (`catalogProvider`), so
/// an Excel uploaded in the CRM appears here without anyone editing the app.
/// Layout, filter and detail screens follow the "Universitetlar katalogi"
/// design; see `CatalogBrowser`.
///
/// The ♡ on a card adds it to Compare, as the "+" it replaced did.
class GuestExploreScreen extends StatelessWidget {
  const GuestExploreScreen({super.key, required this.onOpenCompare});

  /// Kept for the shell's wiring; Compare is reached from the dial.
  final VoidCallback onOpenCompare;

  @override
  Widget build(BuildContext context) {
    return const CustomScrollView(
      slivers: [CatalogBrowser(allowCompare: true, isGuest: true)],
    );
  }
}
