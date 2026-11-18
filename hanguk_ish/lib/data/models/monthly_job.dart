import 'package:flutter/foundation.dart';

import '../../core/money/won.dart';

/// A job paid by the month (A03's «Oylik ishlar»), as the worker app shows it:
/// no day or time slot, only the pay, the days a week and the place.
@immutable
class MonthlyJob {
  const MonthlyJob({
    required this.id,
    required this.title,
    required this.company,
    this.area = '',
    this.address = '',
    required this.monthlyWage,
    this.daysPerWeek,
    this.hoursPerDay,
    this.description = '',
    this.translations = const {},
    this.applied = false,
  });

  final String id;

  /// Korean originals, written by the staff.
  final String title;
  final String company;
  final String area;
  final String address;

  /// Whole won a month.
  final int monthlyWage;
  final int? daysPerWeek;
  final int? hoursPerDay;
  final String description;

  /// {'uz': {'title': …, 'company': …, 'description': …, 'area': …}, …}
  final Map<String, Map<String, String>> translations;

  /// The signed-in worker said «Qiziqaman».
  final bool applied;

  String _t(String lang, String key, String original) {
    final translated = translations[lang]?[key];
    return translated != null && translated.isNotEmpty ? translated : original;
  }

  String displayTitle(String lang) => _t(lang, 'title', title);
  String displayCompany(String lang) => _t(lang, 'company', company);
  String displayArea(String lang) => _t(lang, 'area', area);
  String displayDescription(String lang) => _t(lang, 'description', description);

  /// «2 300 000 ₩».
  String get wageText => Won.worker(monthlyWage);

  MonthlyJob copyWith({bool? applied}) => MonthlyJob(
        id: id,
        title: title,
        company: company,
        area: area,
        address: address,
        monthlyWage: monthlyWage,
        daysPerWeek: daysPerWeek,
        hoursPerDay: hoursPerDay,
        description: description,
        translations: translations,
        applied: applied ?? this.applied,
      );
}
