import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../design/tokens.dart';
import '../widgets.dart';

/// The employer app's three tabs (홈, 근무자, 리포트) with the bottom menu;
/// the lime button in the middle opens «근무 올리기» (BA2).
class EmployerShell extends StatelessWidget {
  const EmployerShell({super.key, required this.shell, required this.onCreate});

  final StatefulNavigationShell shell;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HiColors.navy,
      // The screens run under the menu, as in the prototype; their lists
      // keep clear of it with MediaQuery's bottom padding.
      extendBody: true,
      body: shell,
      bottomNavigationBar: EmployerNav(
        current: shell.currentIndex,
        onSelect: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        onCreate: onCreate,
      ),
    );
  }
}
