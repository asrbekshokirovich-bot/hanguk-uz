import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/digit_mask.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/employer.dart';
import '../../../data/repositories/employer_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/controls.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../ko.dart';
import '../providers.dart';

/// BA2 «근무 올리기»: a new shift from a template — or, with [editShiftId],
/// the same form to change one (BA3 «수정»). With [inviteWorkerId] (BA4
/// «다시 요청») the worker is invited to the new shift.
class Ba2CreateScreen extends ConsumerStatefulWidget {
  const Ba2CreateScreen({
    super.key,
    required this.onClose,
    required this.onSaved,
    this.editShiftId,
    this.inviteWorkerId,
  });

  final VoidCallback onClose;
  final void Function(EmployerShift shift) onSaved;
  final String? editShiftId;
  final String? inviteWorkerId;

  @override
  ConsumerState<Ba2CreateScreen> createState() => _Ba2CreateScreenState();
}

class _Ba2CreateScreenState extends ConsumerState<Ba2CreateScreen> {
  final _wage = TextEditingController();
  final _scroll = ScrollController();
  bool _ready = false;
  bool _busy = false;
  EmployerShift? _editing;

  String? _templateId;
  String _title = '';
  String _duties = '';
  String _dress = '';
  String _address = '';

  /// The Korean date of the shift (its fields read like the date in Seoul).
  late DateTime _day;
  int _start = 14 * 60;
  int _end = 19 * 60;
  int _slots = 3;
  bool _auto = true;

  @override
  void dispose() {
    _wage.dispose();
    _scroll.dispose();
    super.dispose();
  }

  DateTime _todayDate(DateTime now) {
    final w = Kst.wallClock(now);
    return DateTime.utc(w.year, w.month, w.day);
  }

  /// Length in minutes; an end at or before the start is the next day.
  int get _minutes => _end > _start ? _end - _start : _end + 24 * 60 - _start;

  DateTime get _startsAt => Kst.instantOf(_day.year, _day.month, _day.day).add(Duration(minutes: _start));
  DateTime get _endsAt => _startsAt.add(Duration(minutes: _minutes));
  int get _wageValue => int.tryParse(_wage.text.replaceAll(',', '')) ?? 0;

  void _useTemplate(ShiftTemplate t, DateTime now) {
    _templateId = t.id;
    _title = t.title;
    _duties = t.duties;
    _dress = t.dress;
    _address = t.address;
    _start = t.startMinute ?? _start;
    _end = t.endMinute ?? _end;
    _slots = t.slots ?? _slots;
    if (t.hourlyWage != null) _wage.text = ThousandsFormatter.format('${t.hourlyWage}');
    if (!_ready) {
      // Today when the template's start is still ahead, otherwise tomorrow.
      final today = _todayDate(now);
      final startToday = Kst.instantOf(today.year, today.month, today.day).add(Duration(minutes: _start));
      _day = startToday.isAfter(now) ? today : today.add(const Duration(days: 1));
    }
  }

  void _useShift(EmployerShift s) {
    _editing = s;
    _templateId = s.templateId;
    _title = s.title;
    _duties = s.duties;
    _dress = s.dress;
    _address = s.address;
    final w = Kst.wallClock(s.startsAt);
    _day = DateTime.utc(w.year, w.month, w.day);
    _start = w.hour * 60 + w.minute;
    final e = Kst.wallClock(s.endsAt);
    _end = e.hour * 60 + e.minute;
    _slots = s.slots;
    _auto = s.autoConfirm;
    _wage.text = ThousandsFormatter.format('${s.hourlyWage}');
  }

  bool get _timeLocked => (_editing?.confirmed ?? 0) > 0;

  void _locked() =>
      (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(const SnackBar(content: Text(Ko.timeLocked)));

  Future<void> _pickTime({required bool start}) async {
    if (_timeLocked) return _locked();
    String label(int m) => '${(m ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
    final current = start ? _start : _end;
    final picked = await showHiPicker(
      context,
      title: start ? Ko.startTime : Ko.endTime,
      options: [for (var m = 0; m < 24 * 60; m += 30) HiPickerOption('$m', label(m))],
      searchHint: '',
      searchable: false,
      selected: '${current - current % 30}',
    );
    if (picked == null || !mounted) return;
    final minute = int.parse(picked);
    setState(() {
      if (start) {
        // Keep the length when the start moves.
        final length = _minutes;
        _start = minute;
        _end = (minute + length) % (24 * 60);
      } else {
        _end = minute;
      }
    });
  }

  Future<void> _pickOtherDay(DateTime now) async {
    if (_timeLocked) return _locked();
    final today = _todayDate(now);
    final picked = await showHiPicker(
      context,
      title: Ko.pickDate,
      options: [
        for (var i = 0; i < 30; i++)
          HiPickerOption('$i', Ko.dayWord(Kst.instantOf(today.year, today.month, today.day + i, 12), now)),
      ],
      searchHint: '',
      searchable: false,
      selected: '${_day.difference(today).inDays}',
    );
    if (picked == null || !mounted) return;
    setState(() => _day = today.add(Duration(days: int.parse(picked))));
  }

  Future<void> _editContent() async {
    final result = await showModalBottomSheet<(String, String, String, String)>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x99040716),
      builder: (context) => _ContentSheet(
        title: _title,
        duties: _duties,
        dress: _dress,
        address: _address,
        heading: _editing == null && _templateId != null ? Ko.editTemplate : Ko.shiftContent,
      ),
    );
    if (result == null || !mounted) return;
    final (title, duties, dress, address) = result;
    setState(() {
      _title = title;
      _duties = duties;
      _dress = dress;
      _address = address;
    });
    final templateId = _templateId;
    if (_editing != null || templateId == null) return;
    final templates = ref.read(templatesProvider).value ?? const [];
    final template = templates.where((t) => t.id == templateId).firstOrNull;
    if (template == null) return;
    final business = await ref.read(currentBusinessProvider.future);
    await ref.read(employerRepositoryProvider).saveTemplate(
          business.id,
          ShiftTemplate(
            id: template.id,
            title: _title,
            duties: _duties,
            dress: _dress,
            address: _address,
            startMinute: template.startMinute,
            endMinute: template.endMinute,
            hourlyWage: template.hourlyWage,
            slots: template.slots,
          ),
        );
    ref.invalidate(templatesProvider);
    if (mounted) (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(const SnackBar(content: Text(Ko.templateSaved)));
  }

  Future<void> _submit(int minimum) async {
    if (_busy) return;
    final messenger = ScaffoldMessenger.of(context);
    if (_title.trim().isEmpty) {
      await _editContent();
      return;
    }
    if (_wageValue < minimum) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Ko.minimumWageLow(minimum))));
      return;
    }
    setState(() => _busy = true);
    final repo = ref.read(employerRepositoryProvider);
    try {
      final business = await ref.read(currentBusinessProvider.future);
      final draft = ShiftDraft(
        businessId: business.id,
        templateId: _templateId,
        title: _title.trim(),
        duties: _duties.trim(),
        dress: _dress.trim(),
        address: _address.trim(),
        startsAt: _startsAt,
        endsAt: _endsAt,
        hourlyWage: _wageValue,
        slots: _slots,
        autoConfirm: _auto,
      );
      final editing = _editing;
      final shift = editing == null ? await repo.createShift(draft) : await repo.updateShift(editing.id, draft);
      var message = editing == null ? Ko.posted : Ko.saved;
      final invite = widget.inviteWorkerId;
      if (invite != null) {
        try {
          await repo.requestAgain(shift.id, invite);
          final workers = ref.read(businessWorkersProvider).value ?? const [];
          final name = workers.where((w) => w.id == invite).firstOrNull?.fullName;
          if (name != null) message = Ko.requested(name);
        } on Object catch (error) {
          message = Ko.error(error);
        }
      }
      refreshShifts(ref, shift.id);
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(message)));
      widget.onSaved(shift);
    } on Object catch (error) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Ko.error(error))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = ref.watch(clockProvider)();
    final templates = ref.watch(templatesProvider).value;
    final editId = widget.editShiftId;
    final editing = editId == null ? null : ref.watch(employerShiftProvider(editId)).value;
    if (!_ready) {
      if (editId != null && editing != null) {
        _useShift(editing);
        _ready = true;
      } else if (editId == null && templates != null) {
        _day = _todayDate(now);
        if (templates.isNotEmpty) {
          _useTemplate(templates.first, now);
        } else {
          _wage.text = ThousandsFormatter.format('${ref.read(minimumWageProvider(_day)).value ?? 0}');
        }
        _ready = true;
      }
    }
    final top = HiInsets.top(context, 56);
    final bottomPad = HiInsets.bottom(context, 30);

    return Scaffold(
      backgroundColor: HiColors.navy,
      resizeToAvoidBottomInset: false,
      body: HiBackdrop(
        child: !_ready
            ? const Center(child: CircularProgressIndicator(color: HiColors.lime))
            : _form(context, now, templates ?? const [], top, bottomPad),
      ),
    );
  }

  Widget _form(BuildContext context, DateTime now, List<ShiftTemplate> templates, double top, double bottomPad) {
    final minimum = ref.watch(minimumWageProvider(_day)).value ?? 0;
    final wageOk = _wageValue >= minimum;
    final today = _todayDate(now);
    final dayIndex = _day.difference(today).inDays;
    final labelStyle = hiStyle(15, FontWeight.w700, color: HiColors.textSoft);
    final cost = _slots * Pay.forMinutes(_wageValue, _minutes);
    final isEdit = _editing != null;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    // The pinned bar: 12 + line + 10 + 56 + bottom padding + 1 px border.
    final barHeight = 12 + hiCssLineHeight(labelStyle) + 10 + 56 + bottomPad + 1;

    return Stack(
      children: [
        Positioned.fill(
          child: ListView(
            controller: _scroll,
            padding: EdgeInsets.only(bottom: barHeight + 16 + keyboard),
            children: [
              Padding(
                padding: EdgeInsets.fromLTRB(18, top, 18, 0),
                child: Row(
                  children: [
                    HiGlassIconButton(
                      icon: HiIcons.x,
                      size: 44,
                      radius: 14,
                      iconSize: 22,
                      semanticsLabel: Ko.close,
                      onTap: widget.onClose,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: HiText(
                          isEdit ? Ko.editTitle : Ko.createTitle,
                          textAlign: TextAlign.center,
                          style: hiStyle(18, FontWeight.w800),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const SizedBox(width: 44),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (!isEdit && templates.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: HiText(Ko.template, style: labelStyle),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    itemCount: templates.length,
                    separatorBuilder: (context, i) => const SizedBox(width: 8),
                    itemBuilder: (context, i) => HiToggleChip(
                      label: templates[i].title,
                      selected: templates[i].id == _templateId,
                      onTap: () => setState(() => _useTemplate(templates[i], now)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                child: _ContentCard(
                  heading: isEdit || _templateId == null ? Ko.shiftContent : Ko.templateContent,
                  title: isEdit || _templateId == null ? _title : null,
                  duties: _duties,
                  dress: _dress,
                  address: _address,
                  onEdit: _editContent,
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: HiText(Ko.date, style: labelStyle),
              ),
              const SizedBox(height: 8),
              Opacity(
                opacity: _timeLocked ? 0.55 : 1,
                // `overflow:hidden` at 44 px, as in the prototype: the chosen
                // chip's shadow shows on the right only.
                child: SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    children: [
                      for (var i = 0; i < 3; i++) ...[
                        _DayChip(
                          word: switch (i) {
                            0 => Ko.today,
                            1 => Ko.tomorrow,
                            _ => Ko.weekdayShort(Kst.instantOf(today.year, today.month, today.day + i, 12)),
                          },
                          date: Ko.dotDate(Kst.instantOf(today.year, today.month, today.day + i, 12)),
                          selected: dayIndex == i,
                          onTap: () {
                            if (_timeLocked) return _locked();
                            setState(() => _day = today.add(Duration(days: i)));
                          },
                        ),
                        const SizedBox(width: 8),
                      ],
                      _DayChip(
                        icon: HiIcons.calendar,
                        word: dayIndex > 2 ? Ko.weekdayShort(_startsAt) : Ko.otherDay,
                        date: dayIndex > 2 ? Ko.dotDate(_startsAt) : null,
                        selected: dayIndex > 2,
                        onTap: () => _pickOtherDay(now),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    HiText(Ko.time, style: labelStyle),
                    const SizedBox(height: 8),
                    Opacity(
                      opacity: _timeLocked ? 0.55 : 1,
                      child: Row(
                        children: [
                          _TimeBox(minute: _start, label: Ko.startTime, onTap: () => _pickTime(start: true)),
                          const SizedBox(width: 10),
                          HiText('~', style: hiStyle(17, FontWeight.w700, color: HiColors.textMuted)),
                          const SizedBox(width: 10),
                          _TimeBox(minute: _end, label: Ko.endTime, onTap: () => _pickTime(start: false)),
                          const Spacer(),
                          HiText(Ko.duration(_minutes), style: hiStyle(15, FontWeight.w700, color: HiColors.textSoft)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          HiText(Ko.wage, style: labelStyle),
                          const SizedBox(height: 8),
                          _WageField(controller: _wage, onChanged: () => setState(() {})),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              HiIcon(wageOk ? HiIcons.check : HiIcons.x,
                                  size: 14, strokeWidth: 3, color: wageOk ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5)),
                              const SizedBox(width: 5),
                              Flexible(
                                child: HiText(
                                  wageOk ? Ko.minimumWageOk(minimum) : Ko.minimumWageLow(minimum),
                                  style: hiStyle(13, FontWeight.w700,
                                      color: wageOk ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          HiText(Ko.headcount, style: labelStyle),
                          const SizedBox(height: 8),
                          _Stepper(
                            value: _slots,
                            min: _editing == null ? 1 : (_editing!.confirmed < 1 ? 1 : _editing!.confirmed),
                            onChanged: (v) => setState(() => _slots = v),
                            onBelowMin: () => (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(
                                SnackBar(content: Text(Ko.slotsLocked(_editing?.confirmed ?? 0)))),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                child: _AutoConfirm(value: _auto, onChanged: (v) => setState(() => _auto = v)),
              ),
            ],
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: EdgeInsets.fromLTRB(18, 12, 22, bottomPad),
            decoration: const BoxDecoration(
              color: HiColors.navy,
              border: Border(top: BorderSide(color: HiColors.white12)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                HiRichText(
                  TextSpan(
                    text: Ko.costLead(_slots, _minutes),
                    children: [
                      TextSpan(
                        text: Won.employer(cost),
                        style: hiStyle(15, FontWeight.w700, family: HiFamily.mono),
                      ),
                    ],
                  ),
                  style: labelStyle,
                  also: [hiStyle(15, FontWeight.w700, family: HiFamily.mono)],
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                HiButton(
                  label: isEdit ? Ko.save : Ko.post,
                  height: 56,
                  fontSize: 18,
                  onPressed: _busy ? null : () => _submit(minimum),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// «템플릿 내용 [수정]» with 업무 / 복장 / 주소.
class _ContentCard extends StatelessWidget {
  const _ContentCard({
    required this.heading,
    required this.title,
    required this.duties,
    required this.dress,
    required this.address,
    required this.onEdit,
  });

  final String heading;

  /// Shown as a row when there is no template chip carrying the name.
  final String? title;
  final String duties;
  final String dress;
  final String address;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final label = hiStyle(15, FontWeight.w800, height: 1.45, color: HiColors.inkMuted);
    final value = hiStyle(15, FontWeight.w600, height: 1.45, color: HiColors.ink);
    Widget row(String name, String text) => Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 34, child: HiText(name, softWrap: false, overflow: TextOverflow.visible, style: label)),
              const SizedBox(width: 10),
              Expanded(child: HiText(text.isEmpty ? '–' : text, style: value)),
            ],
          ),
        );
    final name = title;
    return Semantics(
      container: true,
      label: heading,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 14),
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: HiText(heading, style: hiStyle(14, FontWeight.w800, color: HiColors.inkMuted))),
                HiPressable(
                  onTap: onEdit,
                  builder: (context, pressed) => Container(
                    constraints: const BoxConstraints(minWidth: 44),
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    child: HiText(Ko.edit,
                        style: hiStyle(15, FontWeight.w800, color: pressed ? HiColors.blueDeep : HiColors.blue)),
                  ),
                ),
              ],
            ),
            if (name != null) row(Ko.shiftName, name),
            row(Ko.duties, duties),
            row(Ko.dress, dress),
            row(Ko.address, address),
          ],
        ),
      ),
    );
  }
}

/// «오늘 11.10»: a date choice; white with a hard shadow when chosen.
class _DayChip extends StatelessWidget {
  const _DayChip({required this.word, required this.date, required this.selected, required this.onTap, this.icon});

  final String word;
  final String? date;
  final bool selected;
  final VoidCallback onTap;
  final HiIconData? icon;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? HiColors.ink : HiColors.white;
    final style = hiStyle(15, selected ? FontWeight.w800 : FontWeight.w700, color: fg);
    final mono = style.copyWith(fontFamily: HiFamily.mono.family, fontFamilyFallback: HiFamily.mono.fallback);
    final d = date;
    final glyph = icon;
    return HiPressable(
      onTap: onTap,
      selected: selected,
      builder: (context, pressed) => Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: selected ? HiColors.white : (pressed ? HiColors.white12 : HiColors.white06),
          borderRadius: BorderRadius.circular(HiRadii.button),
          border: selected ? const Border.fromBorderSide(HiBorders.ink) : Border.all(color: HiColors.white18),
          boxShadow: selected ? HiShadows.hardSmall : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (glyph != null && !selected) ...[
              HiIcon(glyph, size: 16, strokeWidth: 2, color: fg),
              const SizedBox(width: 6),
            ],
            d == null
                ? HiText(word, style: style)
                : HiRichText(
                    TextSpan(text: '$word ', children: [TextSpan(text: d, style: mono)]),
                    style: style,
                    also: [mono],
                  ),
          ],
        ),
      ),
    );
  }
}

/// «14:00» in a white box; opens the time list.
class _TimeBox extends StatelessWidget {
  const _TimeBox({required this.minute, required this.label, required this.onTap});

  final int minute;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = '${(minute ~/ 60).toString().padLeft(2, '0')}:${(minute % 60).toString().padLeft(2, '0')}';
    return HiPressable(
      onTap: onTap,
      semanticsLabel: '$label $text',
      builder: (context, pressed) => Container(
        width: 104,
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: pressed ? HiColors.surface : HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.field),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        alignment: Alignment.centerLeft,
        child: HiText(text, style: hiStyle(18, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono)),
      ),
    );
  }
}

/// «10,500 원»: the hourly wage, typed with thousands separators.
class _WageField extends StatelessWidget {
  const _WageField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final text = hiStyle(18, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono);
    return Container(
      height: 52,
      padding: const EdgeInsets.only(left: 14, right: 14),
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(HiRadii.field),
        border: const Border.fromBorderSide(HiBorders.ink),
        boxShadow: HiShadows.hard,
      ),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              label: Ko.wage,
              textField: true,
              child: TextField(
                controller: controller,
                style: text,
                strutStyle: hiStrut(text),
                cursorColor: HiColors.ink,
                keyboardType: TextInputType.number,
                inputFormatters: [ThousandsFormatter()],
                onChanged: (_) => onChanged(),
                maxLines: 1,
                decoration: const InputDecoration.collapsed(hintText: null),
              ),
            ),
          ),
          const SizedBox(width: 6),
          HiText(Ko.won, style: hiStyle(15, FontWeight.w700, color: HiColors.inkMuted)),
        ],
      ),
    );
  }
}

/// «− 3명 +».
class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, required this.min, required this.onChanged, required this.onBelowMin});

  final int value;
  final int min;
  final ValueChanged<int> onChanged;
  final VoidCallback onBelowMin;

  static const max = 50;

  @override
  Widget build(BuildContext context) {
    Widget button(HiIconData icon, String label, VoidCallback? onTap) => HiPressable(
          onTap: onTap,
          semanticsLabel: label,
          builder: (context, pressed) => Container(
            width: 44,
            height: 52,
            decoration: BoxDecoration(
              color: pressed ? HiColors.white16 : HiColors.white08,
              borderRadius: BorderRadius.circular(HiRadii.button),
              border: Border.all(color: HiColors.white20),
            ),
            alignment: Alignment.center,
            child: HiIcon(icon, size: 18, strokeWidth: 2.6, color: HiColors.white),
          ),
        );
    return Row(
      children: [
        button(HiIcons.minus, Ko.fewer, () => value > min ? onChanged(value - 1) : onBelowMin()),
        const SizedBox(width: 6),
        Expanded(
          child: Semantics(
            liveRegion: true,
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                color: HiColors.white,
                borderRadius: BorderRadius.circular(HiRadii.button),
                border: const Border.fromBorderSide(HiBorders.ink),
              ),
              alignment: Alignment.center,
              child: HiText(Ko.people(value), style: hiStyle(18, FontWeight.w800, color: HiColors.ink)),
            ),
          ),
        ),
        const SizedBox(width: 6),
        button(HiIcons.plus, Ko.more, value < max ? () => onChanged(value + 1) : null),
      ],
    );
  }
}

/// «자동 확정 · 지원하면 바로 확정돼요» with the switch.
class _AutoConfirm extends StatelessWidget {
  const _AutoConfirm({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: value,
      label: '${Ko.autoConfirm}, ${Ko.autoConfirmHint}',
      excludeSemantics: true,
      child: HiPressable(
        onTap: () => onChanged(!value),
        button: false,
        builder: (context, pressed) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: pressed ? HiColors.white10 : HiColors.white06,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: HiColors.white14),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    HiText(Ko.autoConfirm, style: hiStyle(16, FontWeight.w800)),
                    const SizedBox(height: 2),
                    HiText(Ko.autoConfirmHint, style: hiStyle(14, FontWeight.w500, color: HiColors.textMuted)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 52,
                height: 32,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        decoration: BoxDecoration(
                          color: value ? HiColors.blue : HiColors.white14,
                          borderRadius: BorderRadius.circular(HiRadii.pill),
                          border: value ? const Border.fromBorderSide(HiBorders.ink) : Border.all(color: HiColors.white30),
                        ),
                      ),
                    ),
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 150),
                      top: 4,
                      left: value ? 24 : 4,
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: const BoxDecoration(color: HiColors.white, shape: BoxShape.circle),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Edits the name, duties, dress and address.
class _ContentSheet extends StatefulWidget {
  const _ContentSheet({
    required this.title,
    required this.duties,
    required this.dress,
    required this.address,
    required this.heading,
  });

  final String title;
  final String duties;
  final String dress;
  final String address;
  final String heading;

  @override
  State<_ContentSheet> createState() => _ContentSheetState();
}

class _ContentSheetState extends State<_ContentSheet> {
  late final _title = TextEditingController(text: widget.title);
  late final _duties = TextEditingController(text: widget.duties);
  late final _dress = TextEditingController(text: widget.dress);
  late final _address = TextEditingController(text: widget.address);

  @override
  void dispose() {
    _title.dispose();
    _duties.dispose();
    _dress.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = hiStyle(16, FontWeight.w600, color: HiColors.ink);
    Widget field(String label, TextEditingController c, {int lines = 1, int max = 80}) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HiText(label, style: hiStyle(14, FontWeight.w800, color: HiColors.inkMuted)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: HiColors.white,
                  borderRadius: BorderRadius.circular(HiRadii.field),
                  border: const Border.fromBorderSide(HiBorders.ink),
                ),
                child: Semantics(
                  label: label,
                  textField: true,
                  child: TextField(
                    controller: c,
                    style: text,
                    cursorColor: HiColors.ink,
                    minLines: lines,
                    maxLines: lines + 2,
                    maxLength: max,
                    decoration: const InputDecoration.collapsed(hintText: null).copyWith(counterText: ''),
                  ),
                ),
              ),
            ],
          ),
        );
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        padding: EdgeInsets.fromLTRB(20, 20, 20, HiInsets.bottom(context, 24)),
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
              Semantics(header: true, child: HiText(widget.heading, style: hiStyle(20, FontWeight.w800, color: HiColors.ink))),
              field(Ko.shiftName, _title),
              field(Ko.duties, _duties, lines: 2, max: 600),
              field(Ko.dress, _dress, max: 300),
              field(Ko.address, _address, max: 200),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: HiButton(
                      label: Ko.cancel,
                      style: HiButtonStyle.outline,
                      height: 52,
                      fontSize: 16,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: HiButton(
                      label: Ko.save,
                      height: 52,
                      fontSize: 16,
                      onPressed: () {
                        final title = _title.text.trim();
                        if (title.isEmpty) return;
                        Navigator.of(context).pop((title, _duties.text.trim(), _dress.text.trim(), _address.text.trim()));
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
