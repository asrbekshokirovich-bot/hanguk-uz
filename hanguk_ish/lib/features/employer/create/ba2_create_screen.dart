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
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../biz.dart';
import '../providers.dart';
import '../widgets.dart';

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

  /// The times to save. While the form still shows the edited shift's own
  /// day and times, those are sent as they are: they may hold seconds the
  /// form does not, and rounded ones would read as a move (refused once a
  /// worker is confirmed).
  (DateTime, DateTime) get _times {
    final s = _editing;
    if (s != null) {
      final w = Kst.wallClock(s.startsAt);
      final e = Kst.wallClock(s.endsAt);
      if (_day == DateTime.utc(w.year, w.month, w.day) &&
          _start == w.hour * 60 + w.minute &&
          _end == e.hour * 60 + e.minute) {
        return (s.startsAt, s.endsAt);
      }
    }
    return (_startsAt, _endsAt);
  }
  int get _wageValue => int.tryParse(_wage.text.replaceAll(',', '')) ?? 0;

  /// The quick hours: opening, lunch, daytime, closing (start, end, name key).
  static const _presets = [
    (8 * 60, 13 * 60, 'slotOpen'),
    (11 * 60, 15 * 60, 'slotLunch'),
    (14 * 60, 19 * 60, 'slotDay'),
    (18 * 60, 23 * 60, 'slotClose'),
  ];

  void _applyPreset(int start, int end) {
    if (_timeLocked) return _locked();
    setState(() {
      _start = start;
      _end = end;
    });
  }

  void _setWage(int value) => setState(() => _wage.text = ThousandsFormatter.format('${value < 0 ? 0 : value}'));

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
      (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.timeLocked)));

  Future<void> _pickTime({required bool start}) async {
    if (_timeLocked) return _locked();
    String label(int m) => '${(m ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
    final current = start ? _start : _end;
    final picked = await showHiPicker(
      context,
      title: start ? Biz.startTime : Biz.endTime,
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
      title: Biz.pickDate,
      options: [
        for (var i = 0; i < 30; i++)
          HiPickerOption('$i', Biz.dayWord(Kst.instantOf(today.year, today.month, today.day + i, 12), now)),
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
        heading: _editing == null && _templateId != null ? Biz.editTemplate : Biz.shiftContent,
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
    await _saveTemplateIfAny();
  }

  /// The form's texts go back into the template they came from (new shifts only).
  Future<void> _saveTemplateIfAny() async {
    final templateId = _templateId;
    if (_editing != null || templateId == null) return;
    final templates = ref.read(templatesProvider).value ?? const [];
    final template = templates.where((t) => t.id == templateId).firstOrNull;
    if (template == null) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
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
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.templateSaved)));
    } on Object catch (error) {
      // The form keeps the new texts; only the template stays as it was.
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
    }
  }

  /// «Shablon [O'zgartirish ›]»: another template, or the content of this one.
  Future<void> _pickTemplate(List<ShiftTemplate> templates, DateTime now) async {
    if (_editing != null || templates.isEmpty) return _editContent();
    final picked = await showHiPicker(
      context,
      title: Biz.template,
      searchHint: '',
      searchable: false,
      selected: _templateId,
      options: [for (final t in templates) HiPickerOption(t.id, t.title)],
      action: HiPickerAction(_editValue, Biz.editTemplate),
    );
    if (picked == null || !mounted) return;
    if (picked == _editValue) return _editContent();
    final template = templates.where((t) => t.id == picked).firstOrNull;
    if (template != null) setState(() => _useTemplate(template, now));
  }

  static const _editValue = '__edit__';

  /// «Manzil [O'zgartirish]»: the street address of this shift.
  Future<void> _editAddress() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x99040716),
      builder: (context) => _AddressSheet(address: _address),
    );
    if (result == null || !mounted) return;
    setState(() => _address = result);
    await _saveTemplateIfAny();
  }

  /// [minimum] is null while it is not known; the database checks it anyway.
  Future<void> _submit(int? minimum) async {
    if (_busy) return;
    final messenger = ScaffoldMessenger.of(context);
    if (_title.trim().isEmpty) {
      await _editContent();
      return;
    }
    if (minimum != null && _wageValue < minimum) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.minimumWageLow(minimum))));
      return;
    }
    setState(() => _busy = true);
    final repo = ref.read(employerRepositoryProvider);
    try {
      final business = await ref.read(currentBusinessProvider.future);
      final (startsAt, endsAt) = _times;
      final draft = ShiftDraft(
        businessId: business.id,
        templateId: _templateId,
        title: _title.trim(),
        duties: _duties.trim(),
        dress: _dress.trim(),
        address: _address.trim(),
        startsAt: startsAt,
        endsAt: endsAt,
        hourlyWage: _wageValue,
        slots: _slots,
        autoConfirm: _auto,
      );
      final editing = _editing;
      final shift = editing == null ? await repo.createShift(draft) : await repo.updateShift(editing.id, draft);
      var message = editing == null ? Biz.posted : Biz.saved;
      final invite = widget.inviteWorkerId;
      if (invite != null) {
        try {
          await repo.requestAgain(shift.id, invite);
          final workers = ref.read(businessWorkersProvider).value ?? const [];
          final name = workers.where((w) => w.id == invite).firstOrNull?.fullName;
          if (name != null) message = Biz.requested(name);
        } on Object catch (error) {
          message = Biz.error(error);
        }
      }
      refreshShifts(ref, shift.id);
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(message)));
      widget.onSaved(shift);
    } on Object catch (error) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = ref.watch(clockProvider)();
    final templatesLoad = ref.watch(templatesProvider);
    // Templates only fill the form in: without them (offline) it starts empty.
    final templates = templatesLoad.value ??
        (templatesLoad.hasError && !templatesLoad.isLoading ? const <ShiftTemplate>[] : null);
    final editId = widget.editShiftId;
    final editLoad = editId == null ? null : ref.watch(employerShiftProvider(editId));
    final editing = editLoad?.value;
    if (!_ready) {
      if (editId != null && editing != null) {
        _useShift(editing);
        _ready = true;
      } else if (editId == null && templates != null) {
        _day = _todayDate(now);
        if (templates.isNotEmpty) {
          _useTemplate(templates.first, now);
          _ready = true;
        } else {
          // No template yet: the wage starts at the legal minimum once it is
          // known, and empty when it cannot be; the address is the store's
          // (what workers see when a shift has none of its own).
          final minimum = ref.watch(minimumWageProvider(_day.year));
          final store = ref.watch(currentBusinessProvider);
          if ((!minimum.isLoading || minimum.hasValue) && (!store.isLoading || store.hasValue)) {
            final value = minimum.value ?? 0;
            if (value > 0) _wage.text = ThousandsFormatter.format('$value');
            if (store.value case final b?) {
              _address = [b.address.trim(), b.addressDetail.trim()].where((p) => p.isNotEmpty).join(', ');
            }
            _ready = true;
          }
        }
      }
    }
    final top = HiInsets.top(context, 56);
    final bottomPad = HiInsets.bottom(context, 30);
    // The shift to edit did not load, or is gone.
    final cannotEdit = !_ready && editLoad != null && !editLoad.isLoading && (editLoad.hasError || editLoad.hasValue);

    return Scaffold(
      backgroundColor: HiColors.navy,
      resizeToAvoidBottomInset: false,
      body: HiBackdrop(
        child: _ready
            ? _form(context, now, templates ?? const [], top, bottomPad)
            : cannotEdit
                ? _cannotEdit(editLoad, top)
                : const Center(child: CircularProgressIndicator(color: HiColors.lime)),
      ),
    );
  }

  Widget _cannotEdit(AsyncValue<EmployerShift?> loaded, double top) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
                semanticsLabel: Biz.close,
                onTap: widget.onClose,
              ),
            ],
          ),
        ),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 44),
              child: loaded.hasError
                  ? EmployerLoadError(
                      error: loaded.error!,
                      onRetry: () => reloadAfterError(ref, employerShiftProvider(widget.editShiftId!)),
                    )
                  : HiStatusMessage(icon: HiIcons.info, title: Biz.shiftNotFound, text: ''),
            ),
          ),
        ),
      ],
    );
  }

  Widget _form(BuildContext context, DateTime now, List<ShiftTemplate> templates, double top, double bottomPad) {
    // Unknown (not loaded, or no row for the year) shows no hint.
    final minimumValue = ref.watch(minimumWageProvider(_day.year)).value;
    final minimum = minimumValue != null && minimumValue > 0 ? minimumValue : null;
    // What shifts around here pay (null: too few to say — dashes).
    final market = ref.watch(marketWageProvider).value;
    final today = _todayDate(now);
    final dayIndex = _day.difference(today).inDays;
    final cost = _slots * Pay.forMinutes(_wageValue, _minutes);
    final isEdit = _editing != null;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    // The pinned bar: 12 + the cost line + 10 + 56 + bottom padding + 1 px border.
    final barHeight = 12 + 34 + 10 + 56 + bottomPad + 1;
    const side = EdgeInsets.fromLTRB(18, 0, 22, 0);
    final label = hiStyle(14, FontWeight.w700, color: HiColors.textSoft);

    DateTime dayAt(int i) => Kst.instantOf(today.year, today.month, today.day + i, 12);
    String dayWord(int i) => switch (i) {
          0 => Biz.today,
          1 => Biz.tomorrow,
          _ => Biz.weekdayShort(dayAt(i)),
        };

    Widget section(String text, {Widget? trailing}) => Padding(
          padding: side,
          child: Row(
            children: [
              Expanded(child: HiText(text, style: label)),
              ?trailing,
            ],
          ),
        );

    return Stack(
      children: [
        Positioned.fill(
          // Not a lazy list: the whole form is in the tree, so what is below
          // the fold is there for screen readers and tests too.
          child: SingleChildScrollView(
            controller: _scroll,
            padding: EdgeInsets.only(bottom: barHeight + 16 + keyboard),
            child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
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
                      semanticsLabel: Biz.close,
                      onTap: widget.onClose,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: HiText(
                          isEdit ? Biz.editTitle : Biz.createTitle,
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
              Padding(
                padding: side,
                child: _TemplateCard(
                  heading: isEdit || _templateId == null ? Biz.shiftContent : Biz.template,
                  title: _title,
                  duties: _duties,
                  dress: _dress,
                  onChange: () => _pickTemplate(templates, now),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: side,
                child: _AddressCard(address: _address, onChange: _editAddress),
              ),
              const SizedBox(height: 14),
              section(
                Biz.date,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (dayIndex > 6)
                      HiText(Biz.dotDate(_startsAt), style: hiStyle(14, FontWeight.w800, family: HiFamily.mono)),
                    HiPressable(
                      onTap: () => _pickOtherDay(now),
                      semanticsLabel: Biz.otherDay,
                      builder: (context, pressed) => Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.centerRight,
                        child: const HiIcon(HiIcons.calendar, size: 18, strokeWidth: 2, color: HiColors.textSoft),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Padding(
                padding: side,
                child: Opacity(
                  opacity: _timeLocked ? 0.55 : 1,
                  child: Row(
                    children: [
                      for (var i = 0; i < 7; i++) ...[
                        if (i > 0) const SizedBox(width: 5),
                        Expanded(
                          child: _DayTile(
                            word: dayWord(i),
                            number: '${Kst.wallClock(dayAt(i)).day}',
                            label: '${dayWord(i)} ${Biz.dotDate(dayAt(i))}',
                            selected: dayIndex == i,
                            onTap: () {
                              if (_timeLocked) return _locked();
                              setState(() => _day = today.add(Duration(days: i)));
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              section(
                Biz.time,
                trailing: _TimeRange(
                  start: _start,
                  end: _end,
                  minutes: _minutes,
                  onStart: () => _pickTime(start: true),
                  onEnd: () => _pickTime(start: false),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: side,
                child: Opacity(
                  opacity: _timeLocked ? 0.55 : 1,
                  child: Row(
                    children: [
                      for (var i = 0; i < _presets.length; i++) ...[
                        if (i > 0) const SizedBox(width: 8),
                        Expanded(
                          child: _PresetTile(
                            name: Biz.createText(_presets[i].$3),
                            range: '${_presets[i].$1 ~/ 60}–${_presets[i].$2 ~/ 60}',
                            selected: _start == _presets[i].$1 && _end == _presets[i].$2,
                            onTap: () => _applyPreset(_presets[i].$1, _presets[i].$2),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Padding(
                padding: side,
                child: _WagePanel(
                  controller: _wage,
                  wage: _wageValue,
                  minimum: minimum,
                  market: market,
                  onChanged: () => setState(() {}),
                  onSet: _setWage,
                  onStep: (delta) => _setWage(_wageValue + delta),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: side,
                child: _HeadcountPanel(
                  value: _slots,
                  // Relative to the current value, so two quick taps count twice.
                  onStep: (delta) {
                    final min = _editing == null || _editing!.confirmed < 1 ? 1 : _editing!.confirmed;
                    final next = _slots + delta;
                    if (next < min) {
                      (ScaffoldMessenger.of(context)..hideCurrentSnackBar())
                          .showSnackBar(SnackBar(content: Text(Biz.slotsLocked(_editing?.confirmed ?? 0))));
                      return;
                    }
                    if (next > _Stepper.max) return;
                    setState(() => _slots = next);
                  },
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: side,
                child: _AutoConfirm(value: _auto, onChanged: (v) => setState(() => _auto = v)),
              ),
            ],
            ),
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
                SizedBox(
                  height: 34,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: HiText(
                          '${Biz.headcountValue(_slots)} × ${Biz.duration(_minutes)} × ${Won.employerDigits(_wageValue)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted),
                        ),
                      ),
                      const SizedBox(width: 10),
                      HiText(Won.employerDigits(cost), style: hiStyle(26, FontWeight.w800, family: HiFamily.mono)),
                      const SizedBox(width: 6),
                      HiText(Biz.won, style: hiStyle(13, FontWeight.w700, color: HiColors.textMuted)),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                HiButton(
                  label: isEdit ? Biz.save : Biz.post,
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

/// A dark card of the form: the faint fill and hairline of the prototype.
BoxDecoration _darkCard({double radius = 20}) => BoxDecoration(
      color: HiColors.white06,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: HiColors.white10),
    );

/// «Shablon [O'zgartirish ›]»: the name, the duties and the dress.
class _TemplateCard extends StatelessWidget {
  const _TemplateCard({
    required this.heading,
    required this.title,
    required this.duties,
    required this.dress,
    required this.onChange,
  });

  final String heading;
  final String title;
  final String duties;
  final String dress;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    String dash(String text) => text.trim().isEmpty ? '–' : text;
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: heading,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
        decoration: _darkCard(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: HiText(heading, style: hiStyle(13, FontWeight.w700, color: HiColors.textMuted))),
                _ChangeLink(label: '${Biz.createText('change')} ›', onTap: onChange),
              ],
            ),
            HiText(dash(title), style: hiStyle(18, FontWeight.w800)),
            const SizedBox(height: 6),
            HiText(dash(duties), style: hiStyle(14, FontWeight.w600, height: 1.4, color: HiColors.textSoft)),
            const SizedBox(height: 4),
            HiText('${Biz.dress}: ${dash(dress)}',
                style: hiStyle(13, FontWeight.w600, height: 1.4, color: HiColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

/// «Manzil [O'zgartirish]».
class _AddressCard extends StatelessWidget {
  const _AddressCard({required this.address, required this.onChange});

  final String address;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: Biz.address,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 6, 10),
        decoration: _darkCard(radius: 18),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(Biz.address, style: hiStyle(13, FontWeight.w700, color: HiColors.textMuted)),
                  const SizedBox(height: 2),
                  HiText(address.trim().isEmpty ? '–' : address, style: hiStyle(15, FontWeight.w800)),
                ],
              ),
            ),
            _ChangeLink(label: Biz.createText('change'), onTap: onChange),
          ],
        ),
      ),
    );
  }
}

/// The lime «O'zgartirish ›» link, a 44 px target.
class _ChangeLink extends StatelessWidget {
  const _ChangeLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: label,
      builder: (context, pressed) => Container(
        constraints: const BoxConstraints(minWidth: 44),
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        child: HiText(label, style: hiStyle(14, FontWeight.w800, color: pressed ? const Color(0xFFB8E600) : HiColors.lime)),
      ),
    );
  }
}

/// One of the seven days: the word over the number; white when chosen.
class _DayTile extends StatelessWidget {
  const _DayTile({
    required this.word,
    required this.number,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String word;
  final String number;

  /// «목 11.12» for screen readers.
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? HiColors.ink : HiColors.white;
    return HiPressable(
      onTap: onTap,
      selected: selected,
      semanticsLabel: label,
      builder: (context, pressed) => Container(
        height: 62,
        padding: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: selected ? HiColors.surface : (pressed ? HiColors.white12 : HiColors.white06),
          borderRadius: BorderRadius.circular(14),
          border: selected ? const Border.fromBorderSide(HiBorders.ink) : Border.all(color: HiColors.white10),
        ),
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: HiText(word, maxLines: 1, softWrap: false, style: hiStyle(11, FontWeight.w700, color: fg)),
            ),
            const SizedBox(height: 2),
            HiText(number, style: hiStyle(18, FontWeight.w800, color: fg, family: HiFamily.mono)),
          ],
        ),
      ),
    );
  }
}

/// «14:00–19:00 · 5 soat»: each time opens its list.
class _TimeRange extends StatelessWidget {
  const _TimeRange({
    required this.start,
    required this.end,
    required this.minutes,
    required this.onStart,
    required this.onEnd,
  });

  final int start;
  final int end;
  final int minutes;
  final VoidCallback onStart;
  final VoidCallback onEnd;

  static String _hm(int m) => '${(m ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final style = hiStyle(14, FontWeight.w800, family: HiFamily.mono);
    Widget time(String text, String semantic, VoidCallback onTap) => HiPressable(
          onTap: onTap,
          semanticsLabel: semantic,
          builder: (context, pressed) => Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            alignment: Alignment.center,
            child: HiText(text, style: style.copyWith(color: pressed ? HiColors.textSoft : HiColors.white)),
          ),
        );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        time(_hm(start), '${Biz.startTime} ${_hm(start)}', onStart),
        HiText('–', style: style),
        time(_hm(end), '${Biz.endTime} ${_hm(end)}', onEnd),
        const SizedBox(width: 4),
        HiText('·', style: style),
        const SizedBox(width: 6),
        HiText(Biz.duration(minutes), style: hiStyle(14, FontWeight.w800)),
      ],
    );
  }
}

/// «Ochish 8–13»: a quick choice of the shift's hours; lime when chosen.
class _PresetTile extends StatelessWidget {
  const _PresetTile({required this.name, required this.range, required this.selected, required this.onTap});

  final String name;
  final String range;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: selected,
      semanticsLabel: '$name $range',
      builder: (context, pressed) => Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: selected ? HiColors.lime : (pressed ? HiColors.white12 : HiColors.white06),
          borderRadius: BorderRadius.circular(14),
          border: selected ? null : Border.all(color: HiColors.white10),
        ),
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: HiText(
                name,
                maxLines: 1,
                softWrap: false,
                style: hiStyle(14, FontWeight.w800, color: selected ? HiColors.onLime : HiColors.white),
              ),
            ),
            HiText(
              range,
              style: hiStyle(12, FontWeight.w700,
                  color: selected ? const Color(0xFF5B6B00) : HiColors.textMuted, family: HiFamily.mono),
            ),
          ],
        ),
      ),
    );
  }
}

/// «Soatlik maosh»: the wage, big, with − / +, a slider marking the legal
/// minimum and the average, the four quick amounts and what the wage means.
class _WagePanel extends StatelessWidget {
  const _WagePanel({
    required this.controller,
    required this.wage,
    required this.minimum,
    required this.market,
    required this.onChanged,
    required this.onSet,
    required this.onStep,
  });

  final TextEditingController controller;
  final int wage;

  /// The legal minimum (null while unknown) and the average (null: too few
  /// shifts to say).
  final int? minimum;
  final int? market;
  final VoidCallback onChanged;
  final ValueChanged<int> onSet;

  /// ±100 won from the wage as it is now, so two quick taps count twice.
  final ValueChanged<int> onStep;

  static const step = 100;

  @override
  Widget build(BuildContext context) {
    final avg = market;
    final low = minimum != null && wage < minimum!;
    final above = avg != null && wage >= avg;
    const green = Color(0xFF86EFAC);
    const red = Color(0xFFFCA5A5);
    const amber = Color(0xFFFCD34D);
    final base = minimum ?? (wage ~/ 1000) * 1000;
    final lo = (base ~/ 1000) * 1000;
    var hi = lo + 4000;
    if (avg != null && avg + 2000 > hi) hi = ((avg + 2000 + 999) ~/ 1000) * 1000;

    Widget quick(String name, int? value) {
      final chosen = value != null && value == wage;
      return Expanded(
        child: HiPressable(
          onTap: value == null ? null : () => onSet(value),
          selected: chosen,
          semanticsLabel: value == null ? name : '$name ${Won.employerDigits(value)}',
          builder: (context, pressed) => Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              color: pressed ? HiColors.white08 : (chosen ? HiColors.white06 : null),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: chosen ? HiColors.white : HiColors.white14, width: chosen ? 1.5 : 1),
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                HiText(
                  value == null ? '–' : Won.employerDigits(value),
                  style: hiStyle(13, FontWeight.w800, family: HiFamily.mono),
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: HiText(name, maxLines: 1, softWrap: false, style: hiStyle(11, FontWeight.w700, color: HiColors.textSoft)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final String hint;
    final Color hintColor;
    if (low) {
      hint = Biz.minimumWageLow(minimum!);
      hintColor = red;
    } else if (avg == null) {
      hint = minimum == null ? '' : Biz.minimumWageOk(minimum!);
      hintColor = green;
    } else if (above) {
      hint = Biz.createText('hintAbove');
      hintColor = green;
    } else {
      hint = Biz.hintBelow(Won.employerDigits(avg - wage));
      hintColor = amber;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _darkCard(radius: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: HiText(Biz.wage, style: hiStyle(14, FontWeight.w700, color: HiColors.textSoft))),
              if (avg != null)
                Container(
                  height: 28,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: above ? HiColors.greenSoft : HiColors.amberSoft,
                    borderRadius: BorderRadius.circular(HiRadii.pill),
                  ),
                  child: HiText(
                    Biz.createText(above ? 'attractive' : 'usual'),
                    style: hiStyle(12, FontWeight.w800, color: HiColors.ink),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _SquareButton(
                  icon: HiIcons.minus, label: '${Biz.wage} −', lime: false, onTap: () => onStep(-step)),
              Expanded(
                child: Column(
                  children: [
                    SizedBox(
                      height: 48,
                      child: Semantics(
                        label: Biz.wage,
                        textField: true,
                        child: TextField(
                          controller: controller,
                          textAlign: TextAlign.center,
                          style: hiStyle(36, FontWeight.w800, family: HiFamily.mono),
                          strutStyle: hiStrut(hiStyle(36, FontWeight.w800, family: HiFamily.mono)),
                          cursorColor: HiColors.lime,
                          keyboardType: TextInputType.number,
                          inputFormatters: [ThousandsFormatter()],
                          onChanged: (_) => onChanged(),
                          expands: true,
                          maxLines: null,
                          textAlignVertical: TextAlignVertical.center,
                          decoration: const InputDecoration.collapsed(hintText: null),
                        ),
                      ),
                    ),
                    HiText(Biz.createText('perHour'), style: hiStyle(13, FontWeight.w600, color: HiColors.textMuted)),
                  ],
                ),
              ),
              _SquareButton(icon: HiIcons.plus, label: '${Biz.wage} +', lime: true, onTap: () => onStep(step)),
            ],
          ),
          const SizedBox(height: 10),
          _WageSlider(value: wage, min: lo, max: hi, floor: minimum, average: avg, onChanged: onSet),
          const SizedBox(height: 6),
          Row(
            children: [
              quick(Biz.createText('minimum'), minimum),
              const SizedBox(width: 8),
              quick(Biz.createText('average'), avg),
              const SizedBox(width: 8),
              quick(Biz.createText('fast'), avg == null ? null : avg + 800),
              const SizedBox(width: 8),
              quick(Biz.createText('urgent'), avg == null ? null : avg + 1800),
            ],
          ),
          if (hint.isNotEmpty) ...[
            const SizedBox(height: 12),
            Semantics(
              liveRegion: true,
              child: HiText(hint, style: hiStyle(14, FontWeight.w700, height: 1.35, color: hintColor)),
            ),
          ],
        ],
      ),
    );
  }
}

/// The 52 px − / + of the wage: dark, or lime for «+».
class _SquareButton extends StatelessWidget {
  const _SquareButton({required this.icon, required this.label, required this.lime, required this.onTap});

  final HiIconData icon;
  final String label;
  final bool lime;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: label,
      builder: (context, pressed) => Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: lime ? (pressed ? const Color(0xFFB8E600) : HiColors.lime) : (pressed ? HiColors.white16 : HiColors.white12),
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.center,
        child: HiIcon(icon, size: 22, strokeWidth: 3, color: lime ? HiColors.onLime : HiColors.white),
      ),
    );
  }
}

/// The wage slider: a lime fill up to the white thumb, an orange mark at the
/// legal minimum and a grey one at the average. Drag or tap; it moves in
/// 100 won; arrows (screen readers) move it by 100.
class _WageSlider extends StatelessWidget {
  const _WageSlider({
    required this.value,
    required this.min,
    required this.max,
    required this.floor,
    required this.average,
    required this.onChanged,
  });

  final int value;
  final int min;
  final int max;
  final int? floor;
  final int? average;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      slider: true,
      label: Biz.wage,
      value: Won.employerDigits(value),
      increasedValue: Won.employerDigits(value + 100),
      decreasedValue: Won.employerDigits(value - 100),
      onIncrease: () => onChanged(value + 100),
      onDecrease: () => onChanged(value - 100),
      child: LayoutBuilder(
        builder: (context, box) {
          void at(double dx) {
            const pad = 10.0;
            final t = ((dx - pad) / (box.maxWidth - 2 * pad)).clamp(0.0, 1.0);
            onChanged(((min + t * (max - min)) / 100).round() * 100);
          }

          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => at(d.localPosition.dx),
            onHorizontalDragUpdate: (d) => at(d.localPosition.dx),
            child: SizedBox(
              height: 44,
              width: double.infinity,
              child: CustomPaint(painter: _WageSliderPainter(value, min, max, floor, average)),
            ),
          );
        },
      ),
    );
  }
}

class _WageSliderPainter extends CustomPainter {
  _WageSliderPainter(this.value, this.min, this.max, this.floor, this.average);

  final int value;
  final int min;
  final int max;
  final int? floor;
  final int? average;

  @override
  void paint(Canvas canvas, Size size) {
    const pad = 10.0;
    final y = size.height / 2;
    double x(int v) => pad + ((v - min) / (max - min)).clamp(0.0, 1.0) * (size.width - 2 * pad);
    final track = RRect.fromLTRBR(0, y - 4, size.width, y + 4, const Radius.circular(4));
    canvas.drawRRect(track, Paint()..color = const Color(0x660A1240));
    final thumb = x(value);
    canvas.drawRRect(RRect.fromLTRBR(0, y - 4, thumb, y + 4, const Radius.circular(4)), Paint()..color = HiColors.lime);
    void tick(int? v, Color color) {
      if (v == null || v < min || v > max) return;
      canvas.drawRRect(
        RRect.fromLTRBR(x(v) - 1.25, y - 8, x(v) + 1.25, y + 8, const Radius.circular(1)),
        Paint()..color = color,
      );
    }

    tick(floor, const Color(0xFFFB923C));
    tick(average, HiColors.white45);
    canvas.drawCircle(Offset(thumb, y), 12, Paint()..color = const Color(0x33FFFFFF));
    canvas.drawCircle(Offset(thumb, y), 9, Paint()..color = HiColors.surface);
  }

  @override
  bool shouldRepaint(_WageSliderPainter old) =>
      old.value != value || old.min != min || old.max != max || old.floor != floor || old.average != average;
}

/// «Kishi soni  − 3 kishi +».
class _HeadcountPanel extends StatelessWidget {
  const _HeadcountPanel({required this.value, required this.onStep});

  final int value;
  final ValueChanged<int> onStep;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: _darkCard(radius: 18),
      child: Row(
        children: [
          Expanded(child: HiText(Biz.headcount, style: hiStyle(16, FontWeight.w800))),
          _Stepper(value: value, onStep: onStep),
        ],
      ),
    );
  }
}

/// «− 3명 +».
class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, required this.onStep});

  final int value;

  /// −1 or +1; the parent applies it to its current value.
  final ValueChanged<int> onStep;

  static const max = 50;

  @override
  Widget build(BuildContext context) {
    Widget button(HiIconData icon, String label, VoidCallback? onTap) => HiPressable(
          onTap: onTap,
          semanticsLabel: label,
          builder: (context, pressed) => Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: pressed ? HiColors.white16 : HiColors.white10,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: HiIcon(icon, size: 18, strokeWidth: 2.6, color: HiColors.white),
          ),
        );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        button(HiIcons.minus, Biz.fewer, () => onStep(-1)),
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 64),
          child: Semantics(
            liveRegion: true,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: HiText(Biz.headcountValue(value),
                  maxLines: 1, softWrap: false, textAlign: TextAlign.center, style: hiStyle(17, FontWeight.w800)),
            ),
          ),
        ),
        button(HiIcons.plus, Biz.more, value < max ? () => onStep(1) : null),
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
      label: '${Biz.autoConfirm}, ${Biz.autoConfirmHint}',
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
                    HiText(Biz.autoConfirm, style: hiStyle(16, FontWeight.w800)),
                    const SizedBox(height: 2),
                    HiText(Biz.autoConfirmHint, style: hiStyle(14, FontWeight.w500, color: HiColors.textMuted)),
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
              field(Biz.shiftName, _title),
              field(Biz.duties, _duties, lines: 2, max: 600),
              field(Biz.dress, _dress, max: 300),
              field(Biz.address, _address, max: 200),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: HiButton(
                      label: Biz.cancel,
                      style: HiButtonStyle.outline,
                      height: 52,
                      fontSize: 16,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: HiButton(
                      label: Biz.save,
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

/// Edits the shift's address.
class _AddressSheet extends StatefulWidget {
  const _AddressSheet({required this.address});

  final String address;

  @override
  State<_AddressSheet> createState() => _AddressSheetState();
}

class _AddressSheetState extends State<_AddressSheet> {
  late final TextEditingController _text = TextEditingController(text: widget.address);

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        padding: EdgeInsets.fromLTRB(20, 24, 20, HiInsets.bottom(context, 24)),
        decoration: const BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(top: HiBorders.ink),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(header: true, child: HiText(Biz.address, style: hiStyle(22, FontWeight.w800, color: HiColors.ink))),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: HiColors.white,
                borderRadius: BorderRadius.circular(HiRadii.field),
                border: const Border.fromBorderSide(HiBorders.ink),
              ),
              child: TextField(
                controller: _text,
                maxLength: 200,
                style: hiStyle(16, FontWeight.w600, color: HiColors.ink),
                cursorColor: HiColors.ink,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => Navigator.of(context).pop(_text.text.trim()),
                decoration: const InputDecoration.collapsed(hintText: null),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: HiButton(
                    label: Biz.cancel,
                    style: HiButtonStyle.outline,
                    height: 52,
                    fontSize: 16,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: HiButton(
                    label: Biz.save,
                    height: 52,
                    fontSize: 16,
                    onPressed: () => Navigator.of(context).pop(_text.text.trim()),
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
