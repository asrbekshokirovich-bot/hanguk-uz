import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../domain/eligibility_engine.dart';
import '../onboarding_routes.dart';
import 'contact_sheet_s04.dart';
import 'result_tariff_ui.dart';
import 'result_texts.dart';

/// The contract sample S06 links to. There is no approved PDF yet, so the
/// "Shartnoma namunasi (PDF)" button stays hidden until this is set.
const String? kContractSampleUrl = null;

/// How many services a tariff has ("5 xizmat"); null where the design shows
/// no count (Hanbox).
int? tariffServiceCount(Tariff t) => switch (t) {
  Tariff.standart => 5,
  Tariff.premium => 9,
  Tariff.noRisk => 14,
  Tariff.hanbox => null,
};

/// S06 — Tarif tafsiloti for [code] ('standart', 'premium', 'no_risk',
/// 'hanbox'): when you pay, what is and is not included, questions and
/// answers, and the call to action.
class TariffDetailScreen extends ConsumerStatefulWidget {
  const TariffDetailScreen({super.key, required this.code});

  final String code;

  @override
  ConsumerState<TariffDetailScreen> createState() => _TariffDetailScreenState();
}

class _PayRow {
  const _PayRow(this.title, this.amount, {this.notes = const []});

  final String title;
  final String amount;
  final List<String> notes;
}

class _Faq {
  const _Faq(this.q, this.a);

  final String q;
  final String a;
}

class _Detail {
  const _Detail({
    required this.rows,
    required this.footer,
    required this.included,
    required this.excluded,
    required this.faq,
  });

  final List<_PayRow> rows;
  final String? footer;
  final List<String> included;
  final List<String> excluded;
  final List<_Faq> faq;
}

_Detail _detailFor(AppLocalizations l, Tariff t) {
  final visaNotes = [l.onbTariffPayVisaWhen, l.onbTariffPayVisaDays];
  final excludedAll = [
    l.onbTariffExContract,
    l.onbTariffExApplicationFee,
    l.onbTariffExBankStatement,
    l.onbTariffExFlight,
    l.onbTariffExVisaFee,
    l.onbTariffExLiving,
  ];
  List<_Faq> twoStepFaq(int afterVisaMln) {
    // The question as the design writes it ("10 mln"), the answer in full.
    return [
      _Faq(
        l.onbTariffFaqNoVisaQ(l.onbTariffMln(afterVisaMln)),
        l.onbTariffFaqNoVisaA(l.onbTariffMlnSom(afterVisaMln)),
      ),
      _Faq(l.onbTariffFaqWhenQ, l.onbTariffFaqWhenA),
      _Faq(l.onbTariffFaqContractQ, l.onbTariffFaqContractA),
    ];
  }

  return switch (t) {
    Tariff.standart => _Detail(
      rows: [
        _PayRow(l.onbTariffPayContract, l.onbTariffMln(2), notes: [l.onbTariffPayContractWhen]),
        _PayRow(l.onbTariffPayVisa, l.onbTariffMln(5), notes: visaNotes),
      ],
      footer: l.onbTariffOrOnceStandart,
      included: [
        l.onbTariffIncApplyUpTo3,
        l.onbTariffIncInterviewQuestions,
        l.onbTariffIncDocsPrep,
        l.onbTariffIncPost,
        l.onbTariffIncSimBank,
      ],
      excluded: excludedAll,
      faq: twoStepFaq(5),
    ),
    Tariff.premium => _Detail(
      rows: [
        _PayRow(l.onbTariffPayContract, l.onbTariffMln(3), notes: [l.onbTariffPayContractWhen]),
        _PayRow(l.onbTariffPayVisa, l.onbTariffMln(10), notes: visaNotes),
      ],
      footer: l.onbTariffOrOncePremium,
      included: [
        l.onbTariffIncUniChoice,
        l.onbTariffIncDocsList,
        l.onbTariffIncTranslation,
        l.onbTariffIncStudyPlan,
        l.onbTariffIncApply,
        l.onbTariffIncInterview,
        l.onbTariffIncVisaDocs,
        l.onbTariffIncDorm,
        l.onbTariffIncFirstWeek,
      ],
      excluded: excludedAll,
      faq: twoStepFaq(10),
    ),
    Tariff.noRisk => _Detail(
      rows: [
        _PayRow(l.onbTariffPayContract, usd(5000), notes: [l.onbTariffPayContractWhen]),
      ],
      footer: l.onbTariffPriceNoRisk,
      included: [
        l.onbTariffIncApplyUpTo3,
        l.onbTariffIncInterviewAi,
        l.onbTariffIncDocsPrep,
        l.onbTariffIncPost,
        l.onbTariffIncBankShot1Day,
        l.onbTariffIncBankShot1Month,
        l.onbTariffIncSimBank,
        l.onbTariffIncEmbassyDocs,
        l.onbTariffIncStudyPlanAi,
        l.onbTariffIncPickup,
        l.onbTariffIncContractPaid,
        l.onbTariffIncFlightTicket,
        l.onbTariffIncFlatMonth,
        l.onbTariffIncAppFee,
      ],
      excluded: [l.onbTariffExVisaFee],
      faq: [_Faq(l.onbTariffFaqContractQ, l.onbTariffFaqContractANoRisk)],
    ),
    Tariff.hanbox => _Detail(
      rows: [_PayRow(l.onbTariffPayStart, usd(400)), _PayRow(l.onbTariffPayMonthly, usd(200))],
      footer: l.onbTariffOrOnceHanbox,
      included: [
        l.onbTariffIncHanboxLessons,
        l.onbTariffIncHanboxLaptop,
        l.onbTariffIncHanboxFirstLesson,
        l.onbTariffIncHanboxStandart,
      ],
      excluded: [
        l.onbTariffExContract,
        l.onbTariffExBankStatement,
        l.onbTariffExFlight,
        l.onbTariffExVisa,
        l.onbTariffExLiving,
      ],
      faq: [_Faq(l.onbTariffFaqContractQ, l.onbTariffFaqContractA)],
    ),
  };
}

class _TariffDetailScreenState extends ConsumerState<TariffDetailScreen> {
  int? _openFaq;

  Tariff get _tariff => Tariff.values.where((t) => t.code == widget.code).firstOrNull ?? Tariff.premium;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final t = _tariff;
    final d = _detailFor(l, t);
    final count = tariffServiceCount(t);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    final children = <Widget>[
      // Header.
      Row(
        children: [
          OnbBackTile(onTap: () => context.canPop() ? context.pop() : context.go(kTariffsPath)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.onbTariffDetailEyebrow, style: onbText(12, FontWeight.w600, color: OnbColors.white64)),
                Text(tariffName(l, t).toUpperCase(), style: onbText(22, FontWeight.w800, spacingEm: 0.04)),
              ],
            ),
          ),
          if (count != null)
            Container(
              height: 26,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: OnbColors.chipFill, borderRadius: BorderRadius.circular(999)),
              child: Text(l.onbTariffServices(count), style: onbText(12, FontWeight.w600)),
            ),
        ],
      ),
      _PaymentCard(rows: d.rows, footer: d.footer),
      OnbCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: onbGapped([
            Text(l.onbTariffIncludedTitle, style: onbText(15, FontWeight.w700)),
            for (final x in d.included) _IncludedRow(x),
          ], 10),
        ),
      ),
      OnbCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: onbGapped([
            Text(l.onbTariffExcludedTitle, style: onbText(15, FontWeight.w700)),
            for (final x in d.excluded)
              Row(
                children: [
                  const OnbSignBadge(sign: '−', color: OnbColors.red, size: 20),
                  const SizedBox(width: 10),
                  Expanded(child: Text(x, style: onbText(14, FontWeight.w400))),
                ],
              ),
          ], 10),
        ),
      ),
      if (d.faq.isNotEmpty)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: onbGapped([
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
              child: Text(l.onbTariffFaqTitle, style: onbText(15, FontWeight.w700)),
            ),
            for (var i = 0; i < d.faq.length; i++)
              _FaqItem(
                faq: d.faq[i],
                open: _openFaq == i,
                onTap: () => setState(() => _openFaq = _openFaq == i ? null : i),
              ),
          ], 8),
        ),
      if (kContractSampleUrl != null)
        Align(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
            child: Text(l.onbTariffContractPdf, style: onbText(14, FontWeight.w600, color: OnbColors.lime)),
          ),
        ),
    ];

    return OnbScaffold(
      child: Stack(
        children: [
          Positioned.fill(
            child: SingleChildScrollView(
              padding: onbScrollPadding(context, bottom: 110),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: onbGapped(children, 14),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset > 30 ? bottomInset : 30),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x000A0A1A), Color(0xFF0A0A1A)],
                  stops: [0, 0.45],
                ),
              ),
              child: OnbPrimaryButton(
                label: l.onbTariffCta,
                onTap: () => showContactSheet(context, ref, openTelegramAfter: false),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.rows, required this.footer});

  final List<_PayRow> rows;
  final String? footer;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    const dot = 12.0;
    final rail = Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Column(
        children: [
          Container(
            width: dot,
            height: dot,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: OnbColors.lime),
          ),
          if (rows.length > 1) ...[
            Expanded(
              child: Container(
                width: 2,
                margin: const EdgeInsets.symmetric(vertical: 4),
                color: OnbColors.chipBorder,
              ),
            ),
            Container(
              width: dot,
              height: dot,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: OnbColors.lime, width: 2),
              ),
            ),
          ],
        ],
      ),
    );

    return OnbCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.onbTariffPayTitle, style: onbText(15, FontWeight.w700)),
          const SizedBox(height: 14),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                rail,
                const SizedBox(width: 12),
                Expanded(
                  child: Column(children: onbGapped([for (final r in rows) _PayRowView(row: r)], 18)),
                ),
              ],
            ),
          ),
          if (footer != null) ...[
            const SizedBox(height: 14),
            Text(footer!, style: onbText(12.5, FontWeight.w400, color: OnbColors.white64)),
          ],
        ],
      ),
    );
  }
}

class _PayRowView extends StatelessWidget {
  const _PayRowView({required this.row});

  final _PayRow row;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: onbGapped([
              Text(row.title, style: onbText(14, FontWeight.w600)),
              for (final n in row.notes)
                Text(n, style: onbText(12, FontWeight.w400, color: OnbColors.white64)),
            ], 2),
          ),
        ),
        const SizedBox(width: 8),
        Text(row.amount, style: onbText(17, FontWeight.w800)),
      ],
    );
  }
}

class _IncludedRow extends StatelessWidget {
  const _IncludedRow(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          margin: const EdgeInsets.only(top: 1),
          decoration: BoxDecoration(shape: BoxShape.circle, color: OnbColors.green.withValues(alpha: 0.16)),
          child: const Center(
            child: CustomPaint(size: Size(11, 11), painter: _CheckPainter()),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: onbText(14, FontWeight.w400, height: 1.45))),
      ],
    );
  }
}

/// The design's check: `M5 12l5 5L20 7` in a 24 box, stroke 3.4, round caps.
class _CheckPainter extends CustomPainter {
  const _CheckPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    final paint = Paint()
      ..color = OnbColors.green
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.4 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(5 * s, 12 * s)
      ..lineTo(10 * s, 17 * s)
      ..lineTo(20 * s, 7 * s);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _FaqItem extends StatelessWidget {
  const _FaqItem({required this.faq, required this.open, required this.onTap});

  final _Faq faq;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      onTap: onTap,
      child: OnbCard(
        radius: 18,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(faq.q, style: onbText(14, FontWeight.w600, height: 1.4))),
                const SizedBox(width: 10),
                Text(open ? '−' : '+', style: onbText(18, FontWeight.w400, color: OnbColors.lime)),
              ],
            ),
            if (open) ...[
              const SizedBox(height: 8),
              Text(faq.a, style: onbText(13, FontWeight.w400, color: OnbColors.white64, height: 1.5)),
            ],
          ],
        ),
      ),
    );
  }
}
