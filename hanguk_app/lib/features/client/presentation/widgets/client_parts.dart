import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/analytics/app_events.dart';
import '../../../../core/config/contact_links.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/presentation/widgets/sign_in_chrome.dart' show SignInLogoTile;

/// The title of a client screen (design 15, 15b): the name, a line under it,
/// and the account button where the design has the client code chip. The
/// account screen is where the student signs out or deletes the account.
class ClientHeader extends StatelessWidget {
  const ClientHeader({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

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
                Text(title, style: fdText(22, FontWeight.w800, FdColors.ink, height: 1.1, letterSpacing: -0.44)),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(11, FontWeight.w400, FdColors.muted)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          HardIconButton(
            glyph: LucideIcons.userRound,
            semanticLabel: l.accountTooltip,
            onTap: () => context.push('/account'),
          ),
        ],
      ),
    );
  }
}

/// The navy card at the top of a client screen: a label and a headline, the
/// count in lime on the right, a row of segments, and a note.
class NavySummary extends StatelessWidget {
  const NavySummary({
    super.key,
    required this.kicker,
    required this.headline,
    required this.value,
    required this.of,
    required this.segments,
    this.note,
  });

  final String kicker;
  final String headline;

  /// The big lime number and the "/N" after it.
  final String value;
  final String of;

  /// One colour per segment.
  final List<Color> segments;
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FdColors.navy,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(kicker, style: fdText(11, FontWeight.w700, FdColors.onNavyMuted)),
                    const SizedBox(height: 3),
                    Text(headline, style: fdText(20, FontWeight.w800, Colors.white, height: 1.1, letterSpacing: -0.4)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: value),
                    TextSpan(text: of, style: fdText(14, FontWeight.w700, FdColors.onNavyMuted)),
                  ],
                ),
                style: fdText(30, FontWeight.w800, FdColors.lime, height: 1, letterSpacing: -1.2),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 0; i < segments.length; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                Expanded(
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(color: segments[i], borderRadius: BorderRadius.circular(3)),
                  ),
                ),
              ],
            ],
          ),
          if (note != null) ...[
            const SizedBox(height: 10),
            Text(note!, style: fdText(12, FontWeight.w400, FdColors.onNavyMuted, height: 1.35)),
          ],
        ],
      ),
    );
  }
}

/// The agency's card at the foot of the application screen: the logo, who it
/// is, and a Telegram and a call button (design 15's consultant card).
class ConsultantRow extends StatelessWidget {
  const ConsultantRow({super.key});

  Future<void> _open(Uri uri) => launchUrl(uri, mode: LaunchMode.externalApplication);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Row(
        children: [
          const SignInLogoTile(size: 40, radius: 12, haloBleed: 0, shadowOffsetY: 0, shadowBlur: 0),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hanguk Consulting', style: fdText(13, FontWeight.w800, FdColors.ink)),
                const SizedBox(height: 1),
                Text(l.fdConsultantRole, maxLines: 2, overflow: TextOverflow.ellipsis, style: fdText(11, FontWeight.w400, FdColors.muted, height: 1.3)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          HardIconButton(
            glyph: LucideIcons.send,
            semanticLabel: 'Telegram',
            size: 36,
            radius: 10,
            iconSize: 15,
            onTap: () {
              AppEvents.track('contact_tap', screen: 'application', props: {'channel': 'telegram'});
              _open(ContactLinks.telegramDirectUri);
            },
          ),
          const SizedBox(width: 8),
          HardIconButton(
            glyph: LucideIcons.phone,
            semanticLabel: l.fdSentCall,
            size: 36,
            radius: 10,
            iconSize: 15,
            fill: FdColors.lime,
            iconColor: FdColors.onLime,
            onTap: () {
              AppEvents.track('contact_tap', screen: 'application', props: {'channel': 'phone'});
              _open(ContactLinks.phoneUri);
            },
          ),
        ],
      ),
    );
  }
}
