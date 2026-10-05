import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../domain/eligibility_engine.dart';
import '../onboarding_routes.dart';
import 'result_tariff_ui.dart';
import 'result_texts.dart';
import 'tariff_detail_s06_screen.dart';

/// S05 — Narxlar va shartlar: the four tariff cards, each opening S06.
class TariffsScreen extends StatelessWidget {
  const TariffsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final cards = [
      (Tariff.standart, l.onbTariffPriceStandart),
      (Tariff.premium, l.onbTariffPricePremium),
      (Tariff.noRisk, l.onbTariffPriceNoRisk),
      (Tariff.hanbox, l.onbTariffPriceHanbox),
    ];

    final children = <Widget>[
      Row(
        children: [
          OnbBackTile(onTap: () => context.canPop() ? context.pop() : context.go('/')),
          const SizedBox(width: 12),
          Flexible(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Flexible(
                  child: Text(l.onbTariffsTitle, style: onbText(22, FontWeight.w800, spacingEm: -0.02)),
                ),
                const SizedBox(width: 8),
                const OnbHangulAccent('요금'),
              ],
            ),
          ),
        ],
      ),
      Text(l.onbTariffsSubtitle, style: onbText(14, FontWeight.w400, color: OnbColors.white64, height: 1.5)),
      for (final (t, price) in cards) _TariffCard(tariff: t, price: price),
      // The comparison table is not designed yet; the button has no target.
      OnbPrimaryButton(label: l.onbTariffsCompare, onTap: null),
      OnbCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.onbTariffExcludedTitle, style: onbText(15, FontWeight.w700)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final x in [
                  l.onbTariffExContract,
                  l.onbTariffExApplicationFee,
                  l.onbTariffExBankStatement,
                  l.onbTariffExFlight,
                  l.onbTariffExVisaFee,
                  l.onbTariffExLiving,
                ])
                  _ExcludedChip(x),
              ],
            ),
          ],
        ),
      ),
    ];

    return OnbScaffold(
      child: SingleChildScrollView(
        padding: onbScrollPadding(context),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: onbGapped(children, 14)),
      ),
    );
  }
}

class _TariffCard extends StatelessWidget {
  const _TariffCard({required this.tariff, required this.price});

  final Tariff tariff;
  final String price;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final count = tariffServiceCount(tariff);
    return OnbCard(
      borderColor: tariff == Tariff.premium ? OnbColors.lime.withValues(alpha: 0.6) : OnbColors.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: count == null ? null : 24,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    tariffName(l, tariff).toUpperCase(),
                    style: onbText(13, FontWeight.w800, spacingEm: 0.08),
                  ),
                ),
                if (count != null) ...[
                  const SizedBox(width: 8),
                  Container(
                    height: 24,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: OnbColors.chipFill,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(l.onbTariffServices(count), style: onbText(11.5, FontWeight.w600)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(price, style: onbText(17, FontWeight.w700, height: 1.35)),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: OnbTap(
              onTap: () => context.push(tariffDetailPath(tariff.code)),
              child: Text(
                l.onbTariffMore,
                strutStyle: onbStrut(13),
                style: onbText(13, FontWeight.w600, color: OnbColors.lime),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ExcludedChip extends StatelessWidget {
  const _ExcludedChip(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: OnbColors.chipBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('−', style: onbText(13, FontWeight.w800, color: OnbColors.red)),
          const SizedBox(width: 6),
          Text(text, style: onbText(13, FontWeight.w400)),
        ],
      ),
    );
  }
}
