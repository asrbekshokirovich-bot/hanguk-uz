import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import 'identity_links.dart';

/// Tells the person, once, that the link they opened the app with tied them
/// to their consultant ([IdentityLinks]).
class LinkWelcome extends StatefulWidget {
  const LinkWelcome({super.key, required this.child});

  final Widget child;

  @override
  State<LinkWelcome> createState() => _LinkWelcomeState();
}

class _LinkWelcomeState extends State<LinkWelcome> {
  @override
  void initState() {
    super.initState();
    IdentityLinks.justLinked.addListener(_show);
    WidgetsBinding.instance.addPostFrameCallback((_) => _show());
  }

  @override
  void dispose() {
    IdentityLinks.justLinked.removeListener(_show);
    super.dispose();
  }

  void _show() {
    if (!mounted || !IdentityLinks.justLinked.value) return;
    final l = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (l == null || messenger == null) return;
    IdentityLinks.justLinked.value = false;
    messenger.showSnackBar(SnackBar(content: Text(l.linkWelcome), duration: const Duration(seconds: 6)));
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
