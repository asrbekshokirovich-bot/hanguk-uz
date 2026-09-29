import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Taqqoslash ekrani — the two universities picked in compare mode, side by
/// side. STUB: the real screen is being built.
class CatalogCompareScreen extends ConsumerWidget {
  const CatalogCompareScreen({super.key, required this.isGuest});

  /// Guest mode shows the "Bog'lanish" button at the bottom; a student does
  /// not get it.
  final bool isGuest;

  static Future<void> open(BuildContext context, {required bool isGuest}) =>
      Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => CatalogCompareScreen(isGuest: isGuest)),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) => const Scaffold();
}
