import 'package:flutter/material.dart';

import '../../catalog/presentation/catalog_browser.dart';

/// Guest Explore — the university catalogue a visitor browses before they
/// have a magic code.
///
/// The catalogue is the CRM's "Universitetlar → Ma'lumotli" section: every
/// university staff have loaded a guideline Excel for (`catalogProvider`), so
/// an Excel uploaded in the CRM appears here without anyone editing the app.
/// Layout, filter and detail screens follow the "Universitetlar katalogi"
/// design; see `CatalogBrowser`, which also carries compare mode.
class GuestExploreScreen extends StatelessWidget {
  const GuestExploreScreen({super.key, required this.header});

  /// The guest shell's header. It scrolls away with the list, as in the
  /// design.
  final Widget header;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: header),
        const CatalogBrowser(isGuest: true),
      ],
    );
  }
}
