import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../data/catalog/places.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/forms.dart' show HiBackButton;
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../profile/profile_screens.dart' show photoPickerProvider;
import '../profile/worker_profile_draft.dart';
import '../profile/worker_profile_repository.dart';
import '../settings/app_language.dart';
import 'me_screen.dart' show formatPhone, shortDistrict;

/// «Profilni o'zgartirish»: the photo, the name, the phone (as signed in),
/// the area, the home address, how far the worker goes; «Saqlash».
class ProfileEditScreen extends ConsumerStatefulWidget {
  const ProfileEditScreen({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  late final TextEditingController _name;
  late final TextEditingController _home;
  late int _maxKm;
  late String? _district;
  late int _topik;
  String? _photo;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final d = ref.read(workerProfileDraftProvider);
    _name = TextEditingController(text: '${d.firstName} ${d.lastName}'.trim());
    _home = TextEditingController(text: d.homeAddress ?? '');
    _maxKm = d.maxKm;
    _district = d.district;
    _topik = d.topik;
    _photo = d.photoPath;
  }

  @override
  void dispose() {
    _name.dispose();
    _home.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final l10n = WorkerL10n.of(context);
    final choice = await showHiActions(context, actions: [
      (HiIcons.camera, l10n.photoFromCamera),
      (HiIcons.image, l10n.photoFromGallery),
    ]);
    if (choice == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final path = await ref.read(photoPickerProvider)(choice == 0 ? ImageSource.camera : ImageSource.gallery);
      if (path != null && mounted) setState(() => _photo = path);
    } on Object {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(l10n.photoFailed)));
    }
  }

  Future<void> _pickDistrict() async {
    final l10n = WorkerL10n.of(context);
    final lang = ref.read(appLanguageProvider).code;
    final value = await showHiPicker(
      context,
      title: l10n.fieldArea,
      searchHint: l10n.search,
      selected: _district,
      options: [for (final p in workAreas) HiPickerOption(p.code, p.name(lang))],
      allowTyped: (typed) => l10n.useTyped(typed),
    );
    if (value != null && mounted) setState(() => _district = value);
  }

  Future<void> _pickTopik() async {
    final l10n = WorkerL10n.of(context);
    final value = await showHiPicker(
      context,
      title: l10n.topikTitle,
      searchHint: l10n.search,
      searchable: false,
      selected: '$_topik',
      options: [
        HiPickerOption('0', l10n.topikMin),
        for (var level = 1; level <= 6; level++)
          HiPickerOption('$level', level == 6 ? 'TOPIK 6 · ${l10n.topikMax}' : 'TOPIK $level'),
      ],
    );
    if (value != null && mounted) setState(() => _topik = int.parse(value));
  }

  Future<void> _save() async {
    final l10n = WorkerL10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final parts = _name.text.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length < 2) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(l10n.nameRequired)));
      return;
    }
    final notifier = ref.read(workerProfileDraftProvider.notifier);
    final before = ref.read(workerProfileDraftProvider);
    final edited = before.copyWith(
      firstName: parts.first,
      lastName: parts.skip(1).join(' '),
      homeAddress: _home.text.trim(),
      maxKm: _maxKm,
      district: _district,
      topik: _topik,
      photoPath: _photo,
    );
    setState(() => _saving = true);
    try {
      await ref.read(workerProfileRepositoryProvider).save(edited);
      notifier.replace(edited);
      messenger.showSnackBar(SnackBar(content: Text(l10n.profileSaved)));
      widget.onClose();
    } on Object catch (error) {
      (messenger..hideCurrentSnackBar()).showSnackBar(
        SnackBar(content: Text(error is OfflineException ? l10n.errOffline : l10n.errorGeneric)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final draft = ref.watch(workerProfileDraftProvider);
    final initials = _name.text
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p.characters.first.toUpperCase())
        .join();
    final area = _district == null ? '' : shortDistrict(placeName(workAreas, _district, lang), lang);
    final photo = _photo;

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(16, HiInsets.top(context, 56), 16, 24),
                children: [
                  Row(
                    children: [
                      HiBackButton(onPressed: widget.onClose),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Semantics(
                          header: true,
                          child: HiText(l10n.profileEditTitle, style: hiStyle(20, FontWeight.w800)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  Center(
                    child: HiPressable(
                      onTap: _pickPhoto,
                      semanticsLabel: l10n.photoPut,
                      builder: (context, pressed) => Column(
                        children: [
                          Container(
                            width: 84,
                            height: 84,
                            alignment: Alignment.center,
                            clipBehavior: Clip.antiAlias,
                            decoration: const BoxDecoration(
                              color: HiColors.blueDeep,
                              shape: BoxShape.circle,
                              border: Border.fromBorderSide(BorderSide(color: HiColors.white14)),
                            ),
                            child: photo != null
                                ? Image(image: profilePhoto(photo), width: 84, height: 84, fit: BoxFit.cover)
                                : HiText(initials, style: hiStyle(28, FontWeight.w800)),
                          ),
                          const SizedBox(height: 8),
                          HiText(l10n.photoPut, style: hiStyle(14, FontWeight.w800, color: HiColors.lime)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  _Label(l10n.fieldFullName),
                  _DarkField(
                    child: TextField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      maxLength: 80,
                      onChanged: (_) => setState(() {}),
                      style: hiStyle(16, FontWeight.w700),
                      cursorColor: HiColors.lime,
                      decoration: const InputDecoration.collapsed(hintText: '').copyWith(counterText: ''),
                    ),
                  ),
                  _Label(l10n.fieldPhone),
                  _DarkField(
                    child: HiText(formatPhone(draft.phone), style: hiStyle(16, FontWeight.w700, color: HiColors.textSoft)),
                  ),
                  _Label(l10n.fieldArea),
                  HiPressable(
                    onTap: _pickDistrict,
                    semanticsLabel: '${l10n.fieldArea}: ${area.isEmpty ? '—' : area}',
                    builder: (context, pressed) => _DarkField(
                      pressed: pressed,
                      child: Row(
                        children: [
                          Expanded(child: HiText(area.isEmpty ? '—' : area, style: hiStyle(16, FontWeight.w700))),
                          const HiIcon(HiIcons.chevronDown, size: 18, strokeWidth: 2.2, color: HiColors.textMuted),
                        ],
                      ),
                    ),
                  ),
                  _Label(l10n.fieldHomeAddress),
                  _DarkField(
                    child: TextField(
                      controller: _home,
                      maxLength: 200,
                      style: hiStyle(16, FontWeight.w700),
                      cursorColor: HiColors.lime,
                      decoration: const InputDecoration.collapsed(hintText: '').copyWith(counterText: ''),
                    ),
                  ),
                  _Label(l10n.fieldMaxKm),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: HiColors.white07, borderRadius: BorderRadius.circular(14)),
                    child: Row(
                      children: [
                        for (final km in WorkerProfileDraft.distances)
                          Expanded(
                            child: HiPressable(
                              onTap: () => setState(() => _maxKm = km),
                              selected: km == _maxKm,
                              semanticsLabel: l10n.kmValue(km),
                              builder: (context, pressed) => Container(
                                height: 40,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: km == _maxKm ? HiColors.lime : (pressed ? HiColors.white10 : null),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: HiText(l10n.kmValue(km),
                                    style: hiStyle(14, FontWeight.w800,
                                        color: km == _maxKm ? HiColors.onLime : HiColors.white)),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  // The Korean level is not asked at sign-up; it is set here.
                  _Label(l10n.topikTitle),
                  HiPressable(
                    onTap: _pickTopik,
                    semanticsLabel: l10n.topikTitle,
                    builder: (context, pressed) => _DarkField(
                      pressed: pressed,
                      child: Row(
                        children: [
                          Expanded(
                            child: HiText(_topik == 0 ? l10n.topikMin : 'TOPIK $_topik',
                                style: hiStyle(16, FontWeight.w700)),
                          ),
                          const HiIcon(HiIcons.chevronDown, size: 18, strokeWidth: 2.2, color: HiColors.textMuted),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: EdgeInsets.fromLTRB(16, 12, 16, HiInsets.bottom(context, 20)),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: HiColors.white10))),
              child: HiButton(label: l10n.profileSave, onPressed: _saving ? null : _save),
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 6),
        child: HiText(text, style: hiStyle(13, FontWeight.w700, color: HiColors.textMuted)),
      );
}

class _DarkField extends StatelessWidget {
  const _DarkField({required this.child, this.pressed = false});

  final Widget child;
  final bool pressed;

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        alignment: Alignment.centerLeft,
        decoration: BoxDecoration(
          color: pressed ? HiColors.white12 : HiColors.white07,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: HiColors.white14),
        ),
        child: child,
      );
}
