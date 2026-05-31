import 'dart:io' show Platform;
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

/// Cross-platform bottom navigation that renders an iOS-native
/// [CupertinoTabBar] on iOS (real device, not web) and the Material 3
/// [NavigationBar] everywhere else (Android, web, desktop).
///
/// The [kIsWeb] guard is required: `dart:io`'s [Platform] is a no-op on
/// web and `Platform.isIOS` throws `Unsupported operation`. Checking
/// [kIsWeb] first short-circuits before the throwing access.
class AdaptiveBottomNavigation extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<AdaptiveNavigationItem> items;

  const AdaptiveBottomNavigation({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    if (!kIsWeb && Platform.isIOS) {
      return CupertinoTabBar(
        currentIndex: currentIndex,
        onTap: onTap,
        items: items
            .map(
              (item) => BottomNavigationBarItem(
                icon: Icon(item.icon),
                label: item.label,
              ),
            )
            .toList(),
      );
    }

    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      destinations: items
          .map(
            (item) =>
                NavigationDestination(icon: Icon(item.icon), label: item.label),
          )
          .toList(),
    );
  }
}

class AdaptiveNavigationItem {
  final String label;
  final IconData icon;

  const AdaptiveNavigationItem({required this.label, required this.icon});
}
