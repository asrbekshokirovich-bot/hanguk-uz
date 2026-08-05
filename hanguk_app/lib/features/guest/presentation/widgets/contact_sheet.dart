import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/contact_links.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';

/// "Talk to Hanguk Consulting" — the sheet behind the lime header pill.
///
/// Every row hands off to an external app (Telegram, Instagram, the dialer),
/// so the sheet closes itself first: leaving it stacked behind the app switcher
/// means the visitor comes back to a modal they never asked to keep.
class ContactSheet extends StatelessWidget {
  const ContactSheet({super.key, this.onJoin});

  /// Optional last row: the magic-code login the pill used to open directly.
  final VoidCallback? onJoin;

  static Future<void> show(BuildContext context, {VoidCallback? onJoin}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ContactSheet(onJoin: onJoin),
    );
  }

  Future<void> _open(BuildContext context, Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    final l = AppLocalizations.of(context)!;
    Navigator.of(context).pop();
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      messenger.showSnackBar(
        SnackBar(content: Text(l.guestContactLaunchFailed)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    const corners = BorderRadius.vertical(
      top: Radius.circular(SeoulRadii.hero),
    );

    return Container(
      decoration: const BoxDecoration(
        gradient: SeoulGradients.appBackground,
        borderRadius: corners,
        border: Border(top: BorderSide(color: SeoulColors.glassBorder)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            SeoulSizes.screenPadding,
            10,
            SeoulSizes.screenPadding,
            16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: SeoulColors.textFaint,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                l.guestContactEyebrow,
                style: SeoulType.eyebrow.copyWith(color: SeoulColors.lime),
              ),
              const SizedBox(height: 4),
              HangulTag(
                en: l.guestContactTitle,
                ko: '문의',
                titleStyle: SeoulType.headline,
              ),
              const SizedBox(height: 4),
              Text(l.guestContactSubtitle, style: SeoulType.bodySecondary),
              const SizedBox(height: 16),
              _ContactRow(
                glyph: '텔',
                label: l.guestContactTelegramChannel,
                value: l.guestContactTelegramChannelHint,
                onTap: () => _open(context, ContactLinks.telegramChannelUri),
              ),
              _ContactRow(
                glyph: '톡',
                label: l.guestContactTelegramDirect,
                value: l.guestContactTelegramDirectHint,
                onTap: () => _open(context, ContactLinks.telegramDirectUri),
              ),
              _ContactRow(
                glyph: '인',
                label: l.guestContactInstagram,
                value: l.guestContactInstagramHint,
                onTap: () => _open(context, ContactLinks.instagramUri),
              ),
              _ContactRow(
                glyph: '전',
                label: l.guestContactCall,
                value: ContactLinks.phoneDisplay,
                onTap: () => _open(context, ContactLinks.phoneUri),
              ),
              if (onJoin != null) ...[
                const SizedBox(height: 8),
                _ContactRow(
                  glyph: '가',
                  label: l.guestJoinCta,
                  value: l.guestContactJoinHint,
                  highlight: true,
                  onTap: () {
                    Navigator.of(context).pop();
                    onJoin!();
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({
    required this.glyph,
    required this.label,
    required this.value,
    required this.onTap,
    this.highlight = false,
  });

  final String glyph;
  final String label;
  final String value;
  final VoidCallback onTap;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final accent = highlight ? SeoulColors.lime : SeoulColors.textPrimary;
    return Semantics(
      button: true,
      label: label,
      child: GlassCard(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        borderColor: highlight ? SeoulColors.lime : null,
        blur: false,
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: SeoulRadii.controlR,
                color: highlight
                    ? SeoulColors.limeFill
                    : SeoulColors.neutralFill,
              ),
              child: Text(
                glyph,
                style: SeoulType.hangulGlyph.copyWith(
                  fontSize: 18,
                  color: accent,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.body.copyWith(color: accent),
                  ),
                  Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.caption,
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: SeoulColors.textFaint,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
