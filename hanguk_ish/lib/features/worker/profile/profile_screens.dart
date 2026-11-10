import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../data/catalog/places.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/forms.dart';
import '../../../design/widgets/layout.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../settings/app_language.dart';
import 'worker_profile_draft.dart';
import 'worker_profile_repository.dart';

/// Picks a photo from the camera or gallery; returns the file path. A
/// provider so tests can answer without the platform.
final photoPickerProvider = Provider<Future<String?> Function(ImageSource)>(
  (ref) => (source) async {
    final file = await ImagePicker().pickImage(
      source: source,
      maxWidth: 1080,
      maxHeight: 1080,
      imageQuality: 85,
      preferredCameraDevice: CameraDevice.front,
    );
    return file?.path;
  },
);

/// The frame shared by the three A02 steps: back button, «Profil · n / 3»,
/// progress, scrolling content and the lime button pinned to the bottom.
class _ProfileStepFrame extends StatelessWidget {
  const _ProfileStepFrame({
    required this.step,
    required this.onBack,
    required this.children,
    required this.action,
    required this.onAction,
  });

  final int step;
  final VoidCallback onBack;
  final List<Widget> children;
  final String action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: HiPinnedBottomLayout(
          top: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 22, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    HiTopBar(title: l10n.profileStepOf(step, 3), onBack: onBack),
                    const SizedBox(height: 14),
                    HiStepProgress(count: 3, current: step),
                  ],
                ),
              ),
              ...children,
            ],
          ),
          // The prototype pins the button with `position:absolute`; the 16 px
          // only keeps it off the content on phones too short for both.
          bottom: Padding(
            padding: EdgeInsets.fromLTRB(18, 16, 22, HiInsets.bottom(context, 30)),
            child: HiButton(label: action, onPressed: onAction),
          ),
        ),
      ),
    );
  }
}

/// `16px / 800` section heading of A02.
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: HiText(text, style: hiStyle(16, FontWeight.w800)),
    );
  }
}

// ---------------------------------------------------------------------------
// A02 · 1/3 — name and photo
// ---------------------------------------------------------------------------

class ProfileNameScreen extends ConsumerStatefulWidget {
  const ProfileNameScreen({super.key, required this.onBack, required this.onNext});

  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  ConsumerState<ProfileNameScreen> createState() => _ProfileNameScreenState();
}

class _ProfileNameScreenState extends ConsumerState<ProfileNameScreen> {
  late final TextEditingController _first;
  late final TextEditingController _last;

  @override
  void initState() {
    super.initState();
    final draft = ref.read(workerProfileDraftProvider);
    _first = TextEditingController(text: draft.firstName);
    _last = TextEditingController(text: draft.lastName);
  }

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final l10n = WorkerL10n.of(context);
    final choice = await showHiActions(context, actions: [
      (HiIcons.camera, l10n.photoFromCamera),
      (HiIcons.image, l10n.photoFromGallery),
    ]);
    if (choice == null || !mounted) return;
    final path = await ref.read(photoPickerProvider)(
      choice == 0 ? ImageSource.camera : ImageSource.gallery,
    );
    if (path != null) ref.read(workerProfileDraftProvider.notifier).setPhoto(path);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final draft = ref.watch(workerProfileDraftProvider);
    final controller = ref.read(workerProfileDraftProvider.notifier);
    final photo = draft.photoPath;
    return _ProfileStepFrame(
      step: 1,
      onBack: widget.onBack,
      action: l10n.continueButton,
      onAction: draft.namesValid ? widget.onNext : null,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 24, 22, 0),
          child: HiStepHeader(
            step: l10n.stepNumber(1),
            title: l10n.profileNameTitle,
            subtitle: l10n.profileNameSubtitle,
            titleSize: 26,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 24, 22, 0),
          child: Column(
            children: [
              Semantics(
                button: true,
                label: l10n.photoUpload,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: _pickPhoto,
                  child: Column(
                    children: [
                      HiPhotoCircle(image: photo == null ? null : FileImage(File(photo))),
                      const SizedBox(height: 10),
                      ExcludeSemantics(
                        child: HiText(l10n.photoUpload, style: hiStyle(16, FontWeight.w800)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              HiText(
                l10n.photoHint,
                textAlign: TextAlign.center,
                style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 26, 22, 0),
          child: AutofillGroup(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                HiFieldLabel(l10n.firstName),
                const SizedBox(height: 8),
                HiInputField(
                  controller: _first,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.givenName],
                  maxLength: 60,
                  onChanged: (v) => controller.setNames(firstName: v),
                ),
                const SizedBox(height: 16),
                HiFieldLabel(l10n.lastName),
                const SizedBox(height: 8),
                HiInputField(
                  controller: _last,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.familyName],
                  maxLength: 60,
                  textInputAction: TextInputAction.done,
                  onChanged: (v) => controller.setNames(lastName: v),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// A02 · 2/3 — languages, TOPIK, university, district
// ---------------------------------------------------------------------------

/// Names of the spoken-language codes in the current UI language.
String spokenLanguageName(WorkerL10n l10n, String code) => switch (code) {
      'uz' => l10n.langUzbek,
      'ru' => l10n.langRussian,
      'en' => l10n.langEnglish,
      'ko' => l10n.langKorean,
      'kk' => l10n.langKazakh,
      'ky' => l10n.langKyrgyz,
      'tg' => l10n.langTajik,
      _ => code,
    };

class ProfileLanguagesScreen extends ConsumerWidget {
  const ProfileLanguagesScreen({super.key, required this.onBack, required this.onNext});

  final VoidCallback onBack;
  final VoidCallback onNext;

  Future<void> _pick(
    BuildContext context, {
    required String title,
    required List<Place> places,
    required String? current,
    required String languageCode,
    required ValueChanged<String> onPicked,
    List<HiPickerOption> extra = const [],
  }) async {
    final l10n = WorkerL10n.of(context);
    final value = await showHiPicker(
      context,
      title: title,
      searchHint: l10n.search,
      selected: current,
      options: [
        ...extra,
        for (final p in places) HiPickerOption(p.code, p.name(languageCode)),
      ],
      allowTyped: (typed) => l10n.useTyped(typed),
    );
    if (value != null) onPicked(value);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final draft = ref.watch(workerProfileDraftProvider);
    final controller = ref.read(workerProfileDraftProvider.notifier);
    final lang = ref.watch(appLanguageProvider).code;
    final university = draft.university == notAStudentCode
        ? l10n.notAStudent
        : placeName(seoulUniversities, draft.university, lang);
    final district = placeName(seoulDistricts, draft.district, lang);
    return _ProfileStepFrame(
      step: 2,
      onBack: onBack,
      action: l10n.continueButton,
      onAction: draft.languagesValid ? onNext : null,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 24, 22, 0),
          child: HiStepHeader(step: l10n.stepNumber(2), title: l10n.profileLanguagesTitle),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 22, 22, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionTitle(l10n.spokenLanguagesQuestion),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final code in WorkerProfileDraft.languageCodes)
                    HiChoiceChip(
                      label: spokenLanguageName(l10n, code),
                      selected: draft.languages.contains(code),
                      onTap: () => controller.toggleLanguage(code),
                    ),
                ],
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 22, 22, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SectionTitle(l10n.topikTitle),
              const SizedBox(height: 10),
              HiNumberChoice(
                values: const [0, 1, 2, 3, 4, 5, 6],
                selected: draft.topik,
                onSelect: controller.setTopik,
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  HiText(l10n.topikMin, style: hiStyle(13, FontWeight.w600, color: HiColors.textMuted)),
                  HiText(l10n.topikMax, style: hiStyle(13, FontWeight.w600, color: HiColors.textMuted)),
                ],
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 22, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HiFieldLabel(l10n.university),
              const SizedBox(height: 8),
              HiSelectField(
                icon: HiIcons.graduationCap,
                value: university.isEmpty ? null : university,
                placeholder: l10n.choose,
                onTap: () => _pick(
                  context,
                  title: l10n.university,
                  places: seoulUniversities,
                  current: draft.university,
                  languageCode: lang,
                  onPicked: controller.setUniversity,
                  extra: [HiPickerOption(notAStudentCode, l10n.notAStudent)],
                ),
              ),
              const SizedBox(height: 14),
              HiFieldLabel(l10n.district),
              const SizedBox(height: 8),
              HiSelectField(
                icon: HiIcons.mapPin,
                value: district.isEmpty ? null : district,
                placeholder: l10n.choose,
                onTap: () => _pick(
                  context,
                  title: l10n.district,
                  places: seoulDistricts,
                  current: draft.district,
                  languageCode: lang,
                  onPicked: controller.setDistrict,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// A02 · 3/3 — weekly availability and visa
// ---------------------------------------------------------------------------

class ProfileScheduleScreen extends ConsumerStatefulWidget {
  const ProfileScheduleScreen({super.key, required this.onBack, required this.onDone});

  final VoidCallback onBack;
  final VoidCallback onDone;

  @override
  ConsumerState<ProfileScheduleScreen> createState() => _ProfileScheduleScreenState();
}

class _ProfileScheduleScreenState extends ConsumerState<ProfileScheduleScreen> {
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(workerProfileRepositoryProvider).save(ref.read(workerProfileDraftProvider));
      if (mounted) widget.onDone();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(WorkerL10n.of(context).errorGeneric)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final draft = ref.watch(workerProfileDraftProvider);
    final controller = ref.read(workerProfileDraftProvider.notifier);
    final visaLabels = {'D-2': 'D-2', 'D-4': 'D-4', 'other': l10n.visaOther};
    return _ProfileStepFrame(
      step: 3,
      onBack: widget.onBack,
      action: l10n.saveAndStart,
      onAction: _saving ? null : _save,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 24, 22, 0),
          child: HiStepHeader(
            step: l10n.stepNumber(3),
            title: l10n.profileScheduleTitle,
            subtitle: l10n.profileScheduleSubtitle,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 22, 0),
          child: HiScheduleGrid(
            dayLabels: [
              l10n.dayShortMon, l10n.dayShortTue, l10n.dayShortWed, l10n.dayShortThu,
              l10n.dayShortFri, l10n.dayShortSat, l10n.dayShortSun,
            ],
            dayNames: [
              l10n.dayMon, l10n.dayTue, l10n.dayWed, l10n.dayThu,
              l10n.dayFri, l10n.daySat, l10n.daySun,
            ],
            slotLabels: [l10n.slotMorning, l10n.slotDay, l10n.slotEvening, l10n.slotNight],
            slotRanges: const ['06–12', '12–18', '18–24', '00–06'],
            isOn: draft.isAvailable,
            onToggle: controller.toggleSlot,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 22, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _SectionTitle(l10n.visaType),
                  const SizedBox(width: 8),
                  HiTag(l10n.optional),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (final visa in WorkerProfileDraft.visas) ...[
                    if (visa != WorkerProfileDraft.visas.first) const SizedBox(width: 8),
                    HiChoiceChip(
                      label: visaLabels[visa]!,
                      selected: draft.visa == visa,
                      horizontalPadding: 16,
                      onTap: () => controller.toggleVisa(visa),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
