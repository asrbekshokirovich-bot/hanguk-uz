import 'package:flutter/material.dart';

import '../../../data/models/business.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/forms.dart';
import '../biz.dart';

/// Right after the first sign-in: the owner's business profile. The name,
/// the kind of work, the neighbourhood and the address are what workers read
/// on every shift; the business opens as «사업장 XXXX» until this is saved.
class Ba0ProfileScreen extends StatefulWidget {
  const Ba0ProfileScreen({super.key, required this.onSave, this.onSkip});

  /// «Saqlash»; the button waits while it runs.
  final Future<void> Function(String name, BusinessCategory category, String area, String address) onSave;

  /// «Keyinroq»: fill it in later.
  final VoidCallback? onSkip;

  static const _t = <String, Map<String, String>>{
    'title': {'ko': '사업장 정보', 'uz': 'Biznes profili', 'ru': 'Профиль заведения', 'en': 'Business profile'},
    'hint': {
      'ko': '근로자에게 보이는 정보예요.',
      'uz': 'Ish oluvchilar shuni ko\'radi.',
      'ru': 'Это видят работники.',
      'en': 'Workers see this.',
    },
    'name': {'ko': '사업장 이름', 'uz': 'Biznes nomi', 'ru': 'Название', 'en': 'Business name'},
    'kind': {'ko': '업종', 'uz': 'Soha', 'ru': 'Сфера', 'en': 'Kind of work'},
    'area': {'ko': '동네 (예: 신촌)', 'uz': 'Hudud (masalan: Sinchon)', 'ru': 'Район (напр. Sinchon)', 'en': 'Area (e.g. Sinchon)'},
    'address': {'ko': '주소', 'uz': 'Manzil', 'ru': 'Адрес', 'en': 'Address'},
    'save': {'ko': '저장하고 시작', 'uz': 'Saqlash va boshlash', 'ru': 'Сохранить и начать', 'en': 'Save and start'},
    'later': {'ko': '나중에', 'uz': 'Keyinroq', 'ru': 'Позже', 'en': 'Later'},
    'needName': {
      'ko': '사업장 이름을 입력해 주세요.',
      'uz': 'Biznes nomini kiriting.',
      'ru': 'Введите название.',
      'en': 'Enter the business name.',
    },
    'cafe': {'ko': '카페', 'uz': 'Kafe', 'ru': 'Кафе', 'en': 'Cafe'},
    'restaurant': {'ko': '식당', 'uz': 'Restoran', 'ru': 'Ресторан', 'en': 'Restaurant'},
    'retail': {'ko': '매장·편의점', 'uz': 'Do\'kon', 'ru': 'Магазин', 'en': 'Retail'},
    'logistics': {'ko': '물류', 'uz': 'Logistika', 'ru': 'Логистика', 'en': 'Logistics'},
    'event': {'ko': '행사', 'uz': 'Tadbir', 'ru': 'Мероприятие', 'en': 'Events'},
    'office': {'ko': '사무', 'uz': 'Ofis', 'ru': 'Офис', 'en': 'Office'},
    'other': {'ko': '기타', 'uz': 'Boshqa', 'ru': 'Другое', 'en': 'Other'},
  };

  static String text(String key) => _t[key]![Biz.lang] ?? _t[key]!['en']!;

  @override
  State<Ba0ProfileScreen> createState() => _Ba0ProfileScreenState();
}

class _Ba0ProfileScreenState extends State<Ba0ProfileScreen> {
  final _name = TextEditingController();
  final _area = TextEditingController();
  final _address = TextEditingController();
  BusinessCategory _category = BusinessCategory.cafe;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _area.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    final name = _name.text.trim();
    if (name.isEmpty) {
      (ScaffoldMessenger.of(context)..hideCurrentSnackBar())
          .showSnackBar(SnackBar(content: Text(Ba0ProfileScreen.text('needName'))));
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onSave(name, _category, _area.text.trim(), _address.text.trim());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Ba0ProfileScreen.text;
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.entry,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(22, HiInsets.top(context, 72), 22, HiInsets.bottom(context, 30)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(header: true, child: HiText(t('title'), style: hiStyle(28, FontWeight.w800, color: HiColors.white))),
              const SizedBox(height: 8),
              HiText(t('hint'), style: hiStyle(16, FontWeight.w600, color: HiColors.textSoft)),
              const SizedBox(height: 26),
              _label(t('name')),
              HiInputField(controller: _name, placeholder: '달빛카페 신촌점', maxLength: 80),
              const SizedBox(height: 18),
              _label(t('kind')),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final c in BusinessCategory.values)
                    HiChoiceChip(label: t(c.name), selected: c == _category, onTap: () => setState(() => _category = c)),
                ],
              ),
              const SizedBox(height: 18),
              _label(t('area')),
              HiInputField(controller: _area, maxLength: 40),
              const SizedBox(height: 18),
              _label(t('address')),
              HiInputField(
                controller: _address,
                maxLength: 200,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _save(),
              ),
              const SizedBox(height: 28),
              HiButton(label: t('save'), height: 56, fontSize: 18, onPressed: _saving ? null : _save),
              if (widget.onSkip != null) ...[
                const SizedBox(height: 8),
                HiButton(label: t('later'), style: HiButtonStyle.ghost, onPressed: widget.onSkip),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: HiText(text, style: hiStyle(15, FontWeight.w700, color: HiColors.textSoft)),
      );
}
