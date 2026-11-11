import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/links/share.dart';
import '../../../core/money/won.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/employer.dart';
import '../../../data/repositories/employer_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../biz.dart';
import '../providers.dart';
import '../widgets.dart';

/// «1,262,500» + «원» with the prototype's `margin-left` before the unit:
/// the gap is added to the last digit's advance, like CSS spacing after it.
InlineSpan amountSpan(int amount, TextStyle number, TextStyle unit, double gap) {
  final digits = Won.employerDigits(amount);
  return TextSpan(children: [
    TextSpan(text: digits.substring(0, digits.length - 1), style: number),
    TextSpan(
      text: digits.substring(digits.length - 1),
      style: number.copyWith(letterSpacing: (number.letterSpacing ?? 0) + gap),
    ),
    TextSpan(text: Biz.won, style: unit),
  ]);
}

/// The report as a CSV file (UTF-8 with a byte order mark, so Excel reads
/// the Korean).
String reportCsv(BusinessReport report) {
  String cell(String v) => v.contains(',') || v.contains('"') ? '"${v.replaceAll('"', '""')}"' : v;
  final lines = [
    Biz.csvHeader,
    for (final r in report.rows)
      [
        () {
          final w = Kst.wallClock(r.startsAt);
          return '${w.year}-${w.month.toString().padLeft(2, '0')}-${w.day.toString().padLeft(2, '0')}';
        }(),
        Biz.weekdayLong(r.startsAt),
        cell(r.title),
        '${r.workers}',
        (r.minutes / 60).toStringAsFixed(r.minutes % 60 == 0 ? 0 : 1),
        '${r.amount}',
        r.paid ? Biz.paid : Biz.pending,
      ].join(','),
  ];
  return '﻿${lines.join('\r\n')}\r\n';
}

/// BA5 «리포트»: what the business paid and owes for completed shifts.
class Ba5ReportScreen extends ConsumerWidget {
  const Ba5ReportScreen({super.key});

  Future<void> _togglePaid(BuildContext context, WidgetRef ref, ReportRow row) async {
    final messenger = ScaffoldMessenger.of(context);
    final choice = await showHiActions(context, actions: [
      row.paid ? (HiIcons.refreshCw, Biz.markPending) : (HiIcons.check, Biz.markPaid),
    ]);
    if (choice != 0) return;
    try {
      await ref.read(employerRepositoryProvider).setShiftPaid(row.shiftId, paid: !row.paid);
      refreshShifts(ref, row.shiftId);
    } on Object catch (error) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
    }
  }

  Future<void> _exportCsv(BuildContext context, WidgetRef ref, BusinessReport report) async {
    final messenger = ScaffoldMessenger.of(context);
    final from = report.from;
    try {
      final business = await ref.read(currentBusinessProvider.future);
      await ref.read(fileSharerProvider).share(
            bytes: Uint8List.fromList(utf8.encode(reportCsv(report))),
            fileName:
                'hanguk-ish-report-${from.year}-${from.month.toString().padLeft(2, '0')}-${from.day.toString().padLeft(2, '0')}.csv',
            mimeType: 'text/csv',
            text: Biz.csvTitle(business.name, report.from, report.to),
          );
    } on Object catch (error) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(reportPeriodProvider);
    final loaded = ref.watch(reportProvider(period));
    final report = loaded.value;
    final top = HiInsets.top(context, 56);
    final navSpace = MediaQuery.paddingOf(context).bottom;

    return HiBackdrop(
      child: ListView(
        padding: EdgeInsets.only(bottom: navSpace + 24),
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(18, top, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: HiText(Biz.reportTitle,
                            style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    _CsvButton(onTap: report == null || report.rows.isEmpty ? null : () => _exportCsv(context, ref, report)),
                  ],
                ),
                const SizedBox(height: 12),
                HiSegmentedTabs(
                  labels: [Biz.thisWeek, Biz.thisMonth, Biz.lastMonth],
                  current: period.index,
                  onSelect: (i) => ref.read(reportPeriodProvider.notifier).select(ReportPeriod.values[i]),
                  semanticsLabel: Biz.period,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (report == null && loaded.hasError && !loaded.isLoading)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 40, 22, 0),
              child: Center(
                child: EmployerLoadError(
                  error: loaded.error!,
                  onRetry: () => reloadAfterError(ref, reportProvider(period)),
                ),
              ),
            )
          else if (report == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Center(child: CircularProgressIndicator(color: HiColors.lime)),
            )
          else ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
              child: _Summary(report: report, period: period),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 22, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Expanded(
                    child: Semantics(header: true, child: HiText(Biz.byShift, style: hiStyle(17, FontWeight.w800))),
                  ),
                  HiText(Biz.count(report.rows.length), style: hiStyle(14, FontWeight.w700, color: HiColors.textMuted)),
                ],
              ),
            ),
            if (report.rows.isEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 20, 22, 0),
                child: HiText(Biz.noReport,
                    textAlign: TextAlign.center, style: hiStyle(15, FontWeight.w600, color: HiColors.textSoft)),
              )
            else
              for (final (i, row) in report.rows.indexed)
                Padding(
                  padding: EdgeInsets.fromLTRB(18, i == 0 ? 0 : 10, 22, 0),
                  child: _ReportRowView(row: row, onTap: () => _togglePaid(context, ref, row)),
                ),
          ],
        ],
      ),
    );
  }
}

/// «⤓ CSV 다운로드»: white, ink outline, 3 px shadow.
class _CsvButton extends StatelessWidget {
  const _CsvButton({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null ? 0.45 : 1,
      child: HiPressable(
        onTap: onTap,
        builder: (context, pressed) => Transform.translate(
          offset: pressed ? const Offset(2, 2) : Offset.zero,
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: HiColors.white,
              borderRadius: BorderRadius.circular(HiRadii.button),
              border: const Border.fromBorderSide(HiBorders.ink),
              boxShadow: [BoxShadow(color: HiColors.ink, offset: pressed ? const Offset(1, 1) : const Offset(3, 3))],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const HiIcon(HiIcons.download, size: 18, strokeWidth: 2.2, color: HiColors.ink),
                const SizedBox(width: 6),
                HiText(Biz.csv, style: hiStyle(15, FontWeight.w800, color: HiColors.ink)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Summary extends ConsumerWidget {
  const _Summary({required this.report, required this.period});

  final BusinessReport report;
  final ReportPeriod period;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final soft15 = hiStyle(15, FontWeight.w700, color: HiColors.textSoft);
    final big = hiStyle(32, FontWeight.w800, height: 1.15, letterSpacingEm: -0.02, family: HiFamily.mono);
    final bigUnit = hiStyle(18, FontWeight.w800, height: 1.15, family: HiFamily.korean);
    final tileNumber = hiStyle(18, FontWeight.w800, family: HiFamily.mono);
    final tileUnit = hiStyle(13, FontWeight.w700, family: HiFamily.korean);
    Widget tile(String label, int amount) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color.fromRGBO(6, 13, 43, 0.32),
              borderRadius: BorderRadius.circular(HiRadii.button),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HiText(label, style: hiStyle(13, FontWeight.w700, color: HiColors.textSoft)),
                const SizedBox(height: 3),
                HiRichText(amountSpan(amount, tileNumber, tileUnit, 2), style: tileNumber, also: [tileUnit]),
              ],
            ),
          ),
        );
    final label = switch (period) {
      ReportPeriod.thisWeek => Biz.thisWeek,
      ReportPeriod.thisMonth => Biz.thisMonth,
      ReportPeriod.lastMonth => Biz.lastMonth,
    };
    return Semantics(
      container: true,
      label: Biz.periodSummary(label),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: HiColors.blue,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            HiText(Biz.totalPaid(report.from, report.to), style: soft15),
            const SizedBox(height: 4),
            HiRichText(amountSpan(report.total, big, bigUnit, 3), style: big, also: [bigUnit]),
            const SizedBox(height: 4),
            HiText(
              Biz.reportCounts(report.rows.length, report.minutes, report.persons),
              style: hiStyle(15, FontWeight.w600, color: HiColors.textSoft),
            ),
            const SizedBox(height: 4 + 10),
            Row(
              children: [
                tile(Biz.paidCount(report.paidRows.length), report.paidAmount),
                const SizedBox(width: 8),
                tile(Biz.pendingCount(report.pendingRows.length), report.pendingAmount),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportRowView extends StatelessWidget {
  const _ReportRowView({required this.row, required this.onTap});

  final ReportRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final number = hiStyle(15, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono);
    final unit = hiStyle(13, FontWeight.w700, color: HiColors.ink, family: HiFamily.korean);
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Container(
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: pressed ? const Color(0xFFF4F7FC) : HiColors.white,
          borderRadius: BorderRadius.circular(18),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Row(
          children: [
            SizedBox(
              width: 52,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(Biz.dotDate(row.startsAt),
                      style: hiStyle(15, FontWeight.w800, height: 1.3, color: HiColors.ink, family: HiFamily.mono)),
                  HiText(Biz.weekdayLong(row.startsAt),
                      style: hiStyle(13, FontWeight.w600, height: 1.3, color: HiColors.inkMuted)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(row.title, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                  const SizedBox(height: 2),
                  HiText(Biz.rowCrew(row.workers, row.minutes),
                      style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                HiRichText(amountSpan(row.amount, number, unit, 1), style: number, also: [unit]),
                const SizedBox(height: 4),
                row.paid
                    ? EmployerChip(label: Biz.paid, background: HiColors.surface, height: 24, padding: 8)
                    : EmployerChip(label: Biz.pending, background: HiColors.amberSoft, height: 24, padding: 8),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
