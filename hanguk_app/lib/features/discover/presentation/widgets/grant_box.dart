import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/hard_slider.dart';
import '../../../../l10n/app_localizations.dart';

/// "Grant / stipendiya" (design 2026-10-21): the student's scores first —
/// TOPIK and IELTS — then the grant wanted. A university stays only if its
/// scholarship table gives at least that much for those scores.
class GrantBox extends StatelessWidget {
  const GrantBox({
    super.key,
    required this.topik,
    required this.ielts,
    required this.grant,
    required this.onTopik,
    required this.onIelts,
    required this.onGrant,
  });

  final int topik;
  final double ielts;

  /// The grant wanted, in percent; 0 for any.
  final int grant;
  final ValueChanged<int> onTopik;
  final ValueChanged<double> onIelts;
  final ValueChanged<int> onGrant;

  static const List<double> _ieltsBands = [0, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5];

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    Widget step(String text) => Text(text, style: fdText(11, FontWeight.w800, FdColors.lime, letterSpacing: 0.4));
    Widget test(String text) => Text(text, style: fdText(10, FontWeight.w800, FdColors.pageMuted, letterSpacing: 0.4));
    Widget row<T>(List<(T, String)> options, T value, ValueChanged<T> onTap) => Row(
      children: [
        for (final (i, (v, label)) in options.indexed) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: HardChoice(
              label: label,
              height: 36,
              radius: 9,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              selected: v == value,
              onTap: () => onTap(v),
            ),
          ),
        ],
      ],
    );
    // The band at or under the student's IELTS.
    final band = _ieltsBands.lastWhere((b) => b <= ielts, orElse: () => 0);

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(
        color: const Color(0x14FFFFFF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FdColors.navRule, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          step(l.fdGrantStepScores),
          const SizedBox(height: 8),
          test('TOPIK'),
          const SizedBox(height: 6),
          row([for (var t = 0; t <= 6; t++) (t, t == 0 ? '—' : '$t')], topik, onTopik),
          const SizedBox(height: 10),
          test('IELTS'),
          const SizedBox(height: 6),
          row(
            [for (final b in _ieltsBands) (b, b == 0 ? '—' : (b == 7.5 ? '7.5+' : b.toStringAsFixed(1)))],
            band,
            onIelts,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: step(l.fdGrantStepWanted)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(999)),
                child: Text(
                  grant == 0 ? l.fdGrantAny : l.fdGrantAtLeast(grant),
                  style: fdText(12, FontWeight.w800, FdColors.onLime),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          HardSlider(
            value: grant / 100,
            semanticLabel: l.fdGrantStepWanted,
            onChanged: (v) => onGrant(((v * 100) / 10).round() * 10),
          ),
        ],
      ),
    );
  }
}
