import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/ai_report_repository.dart';

/// Opens the report sheet for one AI answer.
///
/// Call from any surface that renders generated text. [reportedText] is what
/// the student was actually looking at, stored verbatim so staff triaging the
/// report can see the answer rather than guess at it from a message id.
Future<void> showAiReportSheet(
  BuildContext context, {
  required AiSurface surface,
  required String reportedText,
  Map<String, dynamic> reportContext = const {},
}) {
  const corners = BorderRadius.vertical(top: Radius.circular(SeoulRadii.hero));

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => Padding(
      // Lift the sheet above the keyboard: the reason field is the point of
      // it, and a field under the keyboard is a field nobody fills in.
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          gradient: SeoulGradients.appBackground,
          borderRadius: corners,
          border: Border(top: BorderSide(color: SeoulColors.glassBorder)),
        ),
        child: ClipRRect(
          borderRadius: corners,
          child: _AiReportSheet(
            surface: surface,
            reportedText: reportedText,
            reportContext: reportContext,
          ),
        ),
      ),
    ),
  );
}

class _AiReportSheet extends ConsumerStatefulWidget {
  const _AiReportSheet({
    required this.surface,
    required this.reportedText,
    required this.reportContext,
  });

  final AiSurface surface;
  final String reportedText;
  final Map<String, dynamic> reportContext;

  @override
  ConsumerState<_AiReportSheet> createState() => _AiReportSheetState();
}

class _AiReportSheetState extends ConsumerState<_AiReportSheet> {
  final _reasonCtrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l10n = AppLocalizations.of(context)!;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    setState(() => _sending = true);
    final failure = await ref.read(aiReportRepositoryProvider).report(
      surface: widget.surface,
      reportedText: widget.reportedText,
      reason: _reasonCtrl.text,
      context: widget.reportContext,
    );
    if (!mounted) return;
    setState(() => _sending = false);

    // Close first, then confirm over whatever is underneath — a SnackBar
    // inside a sheet that is about to close is a SnackBar nobody reads.
    navigator.pop();
    messenger.showSnackBar(
      SnackBar(
        content: Text(failure == null ? l10n.aiReportThanks : l10n.aiReportFailed),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Grab handle.
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: SeoulColors.glassBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),

            Text(l10n.aiReportTitle, style: SeoulType.title),
            const SizedBox(height: 8),
            Text(l10n.aiReportBody, style: SeoulType.bodySecondary),
            const SizedBox(height: 16),

            // The answer being reported, so the student can see they picked
            // the right one. Capped — some AI answers are very long, and the
            // sheet is not a reader.
            GlassCard(
              radius: SeoulRadii.control,
              padding: const EdgeInsets.all(12),
              showShadow: false,
              blur: false,
              child: Text(
                widget.reportedText,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
                style: SeoulType.bodySecondary,
              ),
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _reasonCtrl,
              maxLines: 3,
              minLines: 2,
              maxLength: AiReportRepository.maxReason,
              style: SeoulType.body,
              cursorColor: SeoulColors.lime,
              decoration: InputDecoration(
                hintText: l10n.aiReportReasonHint,
                hintStyle: SeoulType.bodySecondary,
                filled: true,
                fillColor: SeoulColors.glass,
                counterText: '',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(SeoulRadii.control),
                  borderSide: const BorderSide(color: SeoulColors.glassBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(SeoulRadii.control),
                  borderSide: const BorderSide(color: SeoulColors.glassBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(SeoulRadii.control),
                  borderSide: const BorderSide(color: SeoulColors.lime),
                ),
              ),
            ),
            const SizedBox(height: 16),

            LimeButton(
              label: l10n.aiReportSubmit,
              loading: _sending,
              onPressed: _sending ? null : _send,
            ),
          ],
        ),
      ),
    );
  }
}
