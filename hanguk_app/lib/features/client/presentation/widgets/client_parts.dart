import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/analytics/app_events.dart';
import '../../../../core/analytics/tracked.dart';
import '../../../../core/config/contact_links.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';

/// The title of a client screen (prototype 9, 10): the name in white, a line
/// under it, a lime count chip ("3 / 6") and the account button. The account
/// screen is where the student signs out or deletes the account.
class ClientHeader extends StatelessWidget {
  const ClientHeader({super.key, required this.title, this.subtitle, this.badge});

  final String title;
  final String? subtitle;

  /// The lime pill on the right: "3 / 6", "2 / 4 tayyor".
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: fdText(24, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.5)),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(12, FontWeight.w400, FdColors.pageMuted)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (badge != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(999)),
              child: Text(badge!, style: fdText(14, FontWeight.w800, FdColors.onLime, height: 1.1)),
            ),
            const SizedBox(width: 10),
          ],
          HardIconButton(
            glyph: LucideIcons.userRound,
            semanticLabel: l.accountTooltip,
            onTap: tracked('client_parts.account', () => context.push('/account')),
          ),
        ],
      ),
    );
  }
}

/// A thin dashed rule (the prototype's divider between the journey's steps).
class DashedDivider extends StatelessWidget {
  const DashedDivider({super.key, this.color = const Color(0xFFD5DCEA)});

  final Color color;

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _DashPainter(color),
    child: const SizedBox(height: 1.5, width: double.infinity),
  );
}

class _DashPainter extends CustomPainter {
  const _DashPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5;
    for (var x = 0.0; x < size.width; x += 8) {
      canvas.drawLine(Offset(x, 0.75), Offset((x + 4).clamp(0, size.width), 0.75), paint);
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}

/// The agency's card at the foot of the application screen (prototype 9): a
/// blue card with a lime kicker, the line about answering, and "Yozish" (the
/// Telegram chat) beside a round call button.
class ConsultantRow extends StatelessWidget {
  const ConsultantRow({super.key});

  Future<void> _open(Uri uri) => launchUrl(uri, mode: LaunchMode.externalApplication);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      margin: const EdgeInsets.fromLTRB(18, 0, 18, 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
      decoration: BoxDecoration(color: FdColors.blue, borderRadius: BorderRadius.circular(18)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('HANGUK CONSULTING', style: fdText(12, FontWeight.w800, FdColors.lime, letterSpacing: 0.4)),
                const SizedBox(height: 3),
                Text(l.fdConsultantRole, maxLines: 3, overflow: TextOverflow.ellipsis, style: fdText(14, FontWeight.w800, Colors.white, height: 1.3)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: tracked('client_parts.consultant_write', () {
              AppEvents.track('contact_tap', screen: 'application', props: {'channel': 'telegram'});
              _open(ContactLinks.telegramDirectUri);
            }),
            child: Semantics(
              button: true,
              label: 'Telegram',
              excludeSemantics: true,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Text(l.fdConsultantWrite, style: fdText(14, FontWeight.w800, FdColors.onLime, height: 1.1)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          HardIconButton(
            glyph: LucideIcons.phone,
            semanticLabel: l.fdSentCall,
            size: 40,
            radius: 20,
            iconSize: 16,
            onTap: tracked('client_parts.sent_call', () {
              AppEvents.track('contact_tap', screen: 'application', props: {'channel': 'phone'});
              _open(ContactLinks.phoneUri);
            }),
          ),
        ],
      ),
    );
  }
}
