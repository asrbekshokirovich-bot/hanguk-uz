import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/analytics/contact_codes.dart';
import '../../../core/analytics/tracked.dart';
import '../../../core/config/contact_links.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../discover/presentation/discover_routes.dart';
import '../../guest/presentation/widgets/contact_sheet.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../data/assessment_controller.dart';
import '../domain/assessment.dart';
import 'assessment_widgets.dart';

/// "Qabul +12%": the report's gain, opening a line of its own here.
String _capitalized(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

/// "+998 90 123 45 67".
String prettyUzPhone(String e164) {
  final d = e164.replaceAll(RegExp(r'\D'), '');
  if (d.length != 12) return e164;
  return '+${d.substring(0, 3)} ${d.substring(3, 5)} ${d.substring(5, 8)} ${d.substring(8, 10)} ${d.substring(10)}';
}

/// Design screen 13, "Yuborildi — konsultant bog'lanadi": thanks by name,
/// the number the report went to, the agency's card with Telegram and a
/// call, "Shu orada" (the first university's documents, and the TOPIK step
/// when the report has one), and back to the universities.
class SentScreen extends ConsumerWidget {
  const SentScreen({super.key});

  Future<void> _telegram(BuildContext context, WidgetRef ref, String? linkCode) async {
    final message = AppLocalizations.of(context)!.contactTelegramMessage;
    Uri? uri;
    if (linkCode != null) {
      final bot = await ref.read(quizRepositoryProvider).botUsername();
      if (bot != null) uri = Uri.parse('https://t.me/$bot?start=L_$linkCode');
    }
    // No lead code (or no bot): the consultant, with this phone's code.
    uri ??= await ContactCodes.telegram(message, screen: 'sent');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final sent = ref.watch(assessmentSentProvider);
    final outcome = ref.watch(assessmentOutcomeProvider);
    final first = outcome?.chances.firstOrNull;
    final docs = first == null ? null : ref.watch(catalogDetailProvider(first.guideline.id)).value?.docs.length;
    final topik = outcome?.fixes.where((f) => f.kind == FixKind.topik).firstOrNull;
    final firstName = (sent?.name ?? '').split(' ').first;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          child: Stack(
            children: [
              Positioned(
                right: -12,
                top: -14,
                child: ExcludeSemantics(
                  child: Text('감사', style: fdText(104, FontWeight.w800, FdColors.ghost, height: 1, letterSpacing: -4)),
                ),
              ),
              LayoutBuilder(
                builder: (context, box) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: box.maxHeight),
                    child: IntrinsicHeight(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 72,
                                  height: 72,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: FdColors.lime,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: FdColors.ink, width: 1.5),
                                    boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
                                  ),
                                  child: Text('✓', style: fdText(32, FontWeight.w800, FdColors.onLime, height: 1)),
                                ),
                                const SizedBox(height: 12),
                                Wrap(
                                  children: [
                                    Text('${l.fdSentThanks}${firstName.isEmpty ? '' : ', '}', style: _big),
                                    if (firstName.isNotEmpty) LimeMark('$firstName!', style: _big),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  l.fdSentBody(prettyUzPhone(sent?.phone ?? '')),
                                  style: fdText(13, FontWeight.w400, FdColors.pageMuted, height: 1.5),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
                            child: _AgencyCard(
                              onTelegram: tracked('sent.agency_card_telegram', () => _telegram(context, ref, sent?.linkCode)),
                              onCall: tracked('sent.agency_card_call', () => launchUrl(ContactLinks.phoneUri)),
                            ),
                          ),
                          if (first != null || topik != null)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(l.fdSentMeanwhile, style: fdText(12, FontWeight.w800, FdColors.pageMuted)),
                                  if (first != null) ...[
                                    const SizedBox(height: 8),
                                    _NextRow(
                                      glyph: LucideIcons.fileText,
                                      title: l.fdSentDocsTitle,
                                      body: docs == null
                                          ? shortUniversityName(first.university.displayName)
                                          : l.fdSentDocsBody(shortUniversityName(first.university.displayName), docs),
                                      onTap: tracked('sent.docs_title', () => context.push(universityPath(first.university.institutionId)), props: {'institution_id': first.university.institutionId}),
                                    ),
                                  ],
                                  if (topik != null) ...[
                                    const SizedBox(height: 8),
                                    _NextRow(
                                      glyph: LucideIcons.languages,
                                      title: l.fdSentTopikTitle(topik.value),
                                      body: _capitalized(l.fdGainAdmission(topik.gain)),
                                      onTap: tracked('sent.topik_title', () => ContactSheet.show(context)),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          const Spacer(),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 24, 18, 12),
                            child: HardButton(
                              label: l.fdSentBack,
                              fill: FdColors.card,
                              onPressed: tracked('sent.back', () => context.go(kDiscoverPath)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static final TextStyle _big = fdText(32, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.96);
}

/// The agency's card: the logo, "Hanguk Consulting", and Telegram / call.
class _AgencyCard extends StatelessWidget {
  const _AgencyCard({required this.onTelegram, required this.onCall});

  final VoidCallback onTelegram;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const SignInLogoTile(size: 48, radius: 14, haloBleed: 0, shadowOffsetY: 0, shadowBlur: 0),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Hanguk Consulting', style: fdText(15, FontWeight.w800, FdColors.ink)),
                    const SizedBox(height: 2),
                    Text(l.fdSentConsultant, style: fdText(11, FontWeight.w400, FdColors.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _ContactButton(glyph: LucideIcons.send, label: 'Telegram', onTap: tracked('sent.agency_card_telegram', onTelegram))),
              const SizedBox(width: 8),
              Expanded(child: _ContactButton(glyph: LucideIcons.phone, label: l.fdSentCall, onTap: tracked('sent.agency_card_call', onCall))),
            ],
          ),
        ],
      ),
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({required this.glyph, required this.label, required this.onTap});

  final LucideGlyph glyph;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('sent.contact_button', onTap),
        child: Container(
          height: 42,
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Lucide(glyph, size: 15, color: FdColors.ink),
              const SizedBox(width: 7),
              Text(label, style: fdText(13, FontWeight.w800, FdColors.ink)),
            ],
          ),
        ),
      ),
    );
  }
}

class _NextRow extends StatelessWidget {
  const _NextRow({required this.glyph, required this.title, required this.body, required this.onTap});

  final LucideGlyph glyph;
  final String title;
  final String body;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('sent.next_row', onTap),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(9)),
                child: Lucide(glyph, size: 16, color: FdColors.navy),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: fdText(13, FontWeight.w800, FdColors.ink)),
                    Text(body, style: fdText(11, FontWeight.w400, FdColors.muted)),
                  ],
                ),
              ),
              const Lucide(LucideIcons.chevronRight, size: 16, color: FdColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
