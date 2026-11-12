import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// What the worker fills in on A02 (three steps), before it is saved.
@immutable
class WorkerProfileDraft {
  const WorkerProfileDraft({
    this.firstName = '',
    this.lastName = '',
    this.photoPath,
    this.languages = const {},
    this.topik = 0,
    this.university,
    this.district,
    this.availability = 0,
    this.visa,
  });

  final String firstName;
  final String lastName;

  /// The photo: a file just picked on the phone, or the URL of the one saved
  /// before (loaded from the server).
  final String? photoPath;

  /// Language codes: uz, ru, en, ko, kk, ky, tg.
  final Set<String> languages;

  /// TOPIK level 0–6 (0 = no certificate).
  final int topik;

  /// Code from `seoulUniversities`, `notAStudentCode`, or typed text.
  final String? university;

  /// Code from `seoulDistricts` or typed text.
  final String? district;

  /// Bit `day * 4 + slot` (day 0 = Monday, slot 0 = 06–12 … 3 = 00–06),
  /// the same mask the database stores.
  final int availability;

  /// 'D-2', 'D-4', 'other' or null (not given — optional).
  final String? visa;

  static const languageCodes = ['uz', 'ru', 'en', 'ko', 'kk', 'ky', 'tg'];
  static const visas = ['D-2', 'D-4', 'other'];

  static int bit(int day, int slot) => 1 << (day * 4 + slot);

  bool isAvailable(int day, int slot) => availability & bit(day, slot) != 0;

  bool get namesValid => firstName.trim().isNotEmpty && lastName.trim().isNotEmpty;

  bool get languagesValid => languages.isNotEmpty && (district ?? '').isNotEmpty;

  WorkerProfileDraft copyWith({
    String? firstName,
    String? lastName,
    String? photoPath,
    Set<String>? languages,
    int? topik,
    String? university,
    String? district,
    int? availability,
    String? visa,
    bool clearVisa = false,
  }) {
    return WorkerProfileDraft(
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      photoPath: photoPath ?? this.photoPath,
      languages: languages ?? this.languages,
      topik: topik ?? this.topik,
      university: university ?? this.university,
      district: district ?? this.district,
      availability: availability ?? this.availability,
      visa: clearVisa ? null : (visa ?? this.visa),
    );
  }
}

final workerProfileDraftProvider =
    NotifierProvider<WorkerProfileDraftController, WorkerProfileDraft>(
  WorkerProfileDraftController.new,
);

class WorkerProfileDraftController extends Notifier<WorkerProfileDraft> {
  @override
  WorkerProfileDraft build() => const WorkerProfileDraft();

  void setNames({String? firstName, String? lastName}) =>
      state = state.copyWith(firstName: firstName, lastName: lastName);

  void setPhoto(String path) => state = state.copyWith(photoPath: path);

  void toggleLanguage(String code) {
    final next = {...state.languages};
    if (!next.remove(code)) next.add(code);
    state = state.copyWith(languages: next);
  }

  void setTopik(int level) => state = state.copyWith(topik: level);

  void setUniversity(String value) => state = state.copyWith(university: value);

  void setDistrict(String value) => state = state.copyWith(district: value);

  void toggleSlot(int day, int slot) =>
      state = state.copyWith(availability: state.availability ^ WorkerProfileDraft.bit(day, slot));

  /// Tapping the chosen visa again clears it (the field is optional).
  void toggleVisa(String visa) => state = state.visa == visa
      ? state.copyWith(clearVisa: true)
      : state.copyWith(visa: visa);

  void replace(WorkerProfileDraft draft) => state = draft;
}

/// The image of a [WorkerProfileDraft.photoPath]: the saved photo from the
/// network, a newly picked one from the phone.
ImageProvider profilePhoto(String path) =>
    path.startsWith('http://') || path.startsWith('https://') ? NetworkImage(path) : FileImage(File(path));
