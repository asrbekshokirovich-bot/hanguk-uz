import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/won.dart';
import '../../../data/models/business.dart';
import '../../../data/repositories/auth_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/pressable.dart';
import '../../worker/shift/shift_widgets.dart';
import '../biz.dart';
import '../language.dart';
import '../providers.dart';
import '../widgets.dart';

/// BA6 «프로필»: the owner's own page. Who the business is for the workers
/// (name, kind of work, area, how it is rated and checked), what it has done
/// this month, the favourite workers, the language, help — and signing out.
class Ba6ProfileScreen extends ConsumerWidget {
  const Ba6ProfileScreen({super.key, required this.onEdit, required this.onWorkers});

  /// «사업장 정보 수정»: the business form, filled in.
  final void Function(Business business) onEdit;

  /// The favourite workers (BA4).
  final VoidCallback onWorkers;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(employerLanguageProvider);
    final business = ref.watch(currentBusinessProvider).value;
    final month = ref.watch(reportProvider(ReportPeriod.thisMonth)).value;
    final workers = ref.watch(businessWorkersProvider).value;
    final top = HiInsets.top(context, 56);
    final navSpace = MediaQuery.paddingOf(context).bottom;
    final favorites = workers?.where((w) => w.favorite).length;

    return HiBackdrop(
      child: ListView(
        padding: EdgeInsets.only(bottom: navSpace + 24),
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(18, top, 22, 0),
            child: Semantics(
              header: true,
              child: HiText(Biz.ownerText('nav'), style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
            ),
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
            child: _BusinessCard(business: business),
          ),
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
            child: Semantics(header: true, child: HiText(Biz.ownerText('month'), style: hiStyle(17, FontWeight.w800))),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
            child: Row(
              children: [
                // «–» until the numbers have loaded (or when they cannot).
                _Tile(label: Biz.ownerText('statShifts'), value: month == null ? '–' : '${month.rows.length}'),
                const SizedBox(width: 8),
                _Tile(label: Biz.ownerText('statPeople'), value: month == null ? '–' : '${month.persons}'),
                const SizedBox(width: 8),
                _Tile(
                  label: Biz.ownerText('statPaid'),
                  value: month == null ? '–' : Won.employerDigits(month.total),
                  unit: month == null ? null : Biz.won,
                  flex: 3,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
            child: HiButton(
              label: Biz.ownerText('edit'),
              style: HiButtonStyle.white,
              icon: HiIcons.pencil,
              iconSize: 18,
              iconStroke: 2,
              iconGap: 8,
              height: 52,
              fontSize: 16,
              onPressed: business == null ? null : () => onEdit(business),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
            child: EmployerCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _Row(
                    icon: HiIcons.star,
                    label: Biz.ownerText('favorites'),
                    value: favorites == null ? '–' : '$favorites',
                    onTap: onWorkers,
                  ),
                  const _Rule(),
                  _Row(
                    icon: HiIcons.globe,
                    label: Biz.language,
                    value: language.label,
                    onTap: () => pickEmployerLanguage(context, ref),
                  ),
                  const _Rule(),
                  _Row(
                    icon: HiIcons.circleHelp,
                    label: Biz.ownerText('help'),
                    onTap: () => _help(context),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
            child: HiButton(
              label: Biz.ownerText('signOut'),
              style: HiButtonStyle.ghost,
              icon: HiIcons.user,
              iconSize: 18,
              iconStroke: 2,
              iconGap: 8,
              height: 52,
              fontSize: 16,
              onPressed: () => _signOut(context, ref),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 22, 0),
            child: HiButton(
              label: Biz.deleteAccount,
              style: HiButtonStyle.text,
              textColor: HiColors.redInk,
              fontSize: 15,
              height: 44,
              onPressed: () => deleteEmployerAccount(context, ref),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _help(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
        builder: (context) => const _HelpSheet(),
      );

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final sure = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
      builder: (context) => _Sheet(
        title: Biz.ownerText('signOutTitle'),
        children: [
          HiButton(
            label: Biz.ownerText('signOut'),
            style: HiButtonStyle.ink,
            height: 52,
            fontSize: 17,
            onPressed: () => Navigator.of(context).pop(true),
          ),
          const SizedBox(height: 8),
          HiButton(
            label: Biz.cancel,
            style: HiButtonStyle.text,
            textColor: HiColors.ink,
            height: 48,
            fontSize: 16,
            onPressed: () => Navigator.of(context).pop(false),
          ),
        ],
      ),
    );
    if (sure != true) return;
    try {
      // The session ending takes the app back to BA0 (see the router).
      await ref.read(authRepositoryProvider).signOut();
    } on Object catch (error) {
      if (context.mounted) {
        (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
      }
    }
  }
}

/// The blue card: avatar, name, kind of work and area, how 국세청 / the staff
/// stand, the rating the workers gave and the shifts done.
class _BusinessCard extends StatelessWidget {
  const _BusinessCard({required this.business});

  final Business? business;

  @override
  Widget build(BuildContext context) {
    final b = business;
    final place = b == null
        ? ''
        : [Biz.profileText(b.category.name), if (b.area.trim().isNotEmpty) b.area.trim()].join(' · ');
    final (status, statusColor, statusInk) = switch (b?.review) {
      BusinessReview.pending => (Biz.ownerText('pending'), HiColors.amberSoft, HiColors.ink),
      BusinessReview.rejected => (Biz.ownerText('rejected'), HiColors.redSoft, HiColors.redInk),
      _ => (Biz.ownerText('verified'), HiColors.greenSoft, HiColors.greenInk),
    };
    final rating = b?.rating;
    final done = b?.completedShifts ?? 0;
    return Semantics(
      container: true,
      label: b?.name,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: HiColors.blue,
          borderRadius: BorderRadius.circular(24),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (b != null) BusinessAvatar(business: b, size: 64) else const SizedBox(width: 64, height: 64),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      HiText(b?.name ?? '–', style: hiStyle(21, FontWeight.w800, height: 1.2)),
                      if (place.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        HiText(place, style: hiStyle(14, FontWeight.w600, color: HiColors.textSoft)),
                      ],
                      if (b != null) ...[
                        const SizedBox(height: 8),
                        EmployerChip(label: status, background: statusColor, foreground: statusInk, height: 26),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(height: 1, color: HiColors.white22),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _Stat(
                    label: Biz.ownerText('rating'),
                    child: RatingMark(rating: rating, starSize: 20, fontSize: 24),
                  ),
                ),
                Expanded(
                  child: _Stat(
                    label: Biz.ownerText('done'),
                    child: HiText(b == null ? '–' : '$done', style: hiStyle(24, FontWeight.w800, family: HiFamily.mono)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HiText(label, style: hiStyle(13, FontWeight.w700, color: HiColors.textSoft)),
        const SizedBox(height: 4),
        child,
      ],
    );
  }
}

/// One number of «Shu oy»: dark tile, big mono value, small unit.
class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.value, this.unit, this.flex = 2});

  final String label;
  final String value;
  final String? unit;
  final int flex;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      flex: flex,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: HiColors.white06,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: HiColors.white10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: HiText(label, maxLines: 1, softWrap: false, style: hiStyle(12, FontWeight.w700, color: HiColors.textSoft)),
            ),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  HiText(value, maxLines: 1, softWrap: false, style: hiStyle(20, FontWeight.w800, family: HiFamily.mono)),
                  if (unit != null) ...[
                    const SizedBox(width: 3),
                    HiText(unit!, style: hiStyle(12, FontWeight.w700, color: HiColors.textMuted)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Rule extends StatelessWidget {
  const _Rule();

  @override
  Widget build(BuildContext context) =>
      Container(height: HiBorders.width, color: HiColors.surface, margin: const EdgeInsets.symmetric(horizontal: 14));
}

/// A row of the white list: icon, label, the value, a chevron.
class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, this.value, required this.onTap});

  final HiIconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: value == null ? label : '$label: $value',
      builder: (context, pressed) => Container(
        constraints: const BoxConstraints(minHeight: 56),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: pressed ? HiColors.surface.withValues(alpha: 0.4) : null,
          borderRadius: BorderRadius.circular(HiRadii.card),
        ),
        child: Row(
          children: [
            HiIcon(icon, size: 20, strokeWidth: 2, color: HiColors.ink),
            const SizedBox(width: 12),
            Expanded(child: HiText(label, style: hiStyle(16, FontWeight.w800, color: HiColors.ink))),
            if (value != null) ...[
              const SizedBox(width: 12),
              Flexible(
                child: HiText(
                  value!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted),
                ),
              ),
            ],
            const SizedBox(width: 8),
            const HiIcon(HiIcons.chevronRight, size: 18, strokeWidth: 2.2, color: HiColors.inkMuted),
          ],
        ),
      ),
    );
  }
}

/// White sheet frame of the sign-out and help sheets.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: media.size.height * 0.88),
      child: Container(
        padding: EdgeInsets.fromLTRB(20, 24, 20, HiInsets.bottom(context, 24)),
        decoration: const BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(top: HiBorders.ink),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(header: true, child: HiText(title, style: hiStyle(22, FontWeight.w800, color: HiColors.ink))),
              const SizedBox(height: 16),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

class _HelpSheet extends StatelessWidget {
  const _HelpSheet();

  @override
  Widget build(BuildContext context) {
    return _Sheet(
      title: Biz.ownerText('help'),
      children: [
        for (final n in const ['1', '2', '3']) ...[
          HiText(Biz.ownerText('q$n'), style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
          const SizedBox(height: 6),
          HiText(Biz.ownerText('a$n'), style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
          const SizedBox(height: 16),
        ],
        HiButton(label: Biz.close, height: 52, fontSize: 17, onPressed: () => Navigator.of(context).pop()),
      ],
    );
  }
}
