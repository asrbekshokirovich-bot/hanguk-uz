import '../../../l10n/app_localizations.dart';
import '../../catalog/presentation/catalog_format.dart' show groupThousands;
import '../domain/requirements_row.dart';
import '../domain/scholarship_row.dart';

/// Codes the uni_db tables store → the student's language.
///
/// Every function here maps a fixed database code to an ARB string. Free text
/// the guidelines carry (Korean names, prose) is not a code and passes
/// through untouched.

/// `₩4,134,000` grouped the way the student's language groups digits.
String uniDbKrw(AppLocalizations l, num amount) => '₩${groupThousands(amount, locale: l.localeName)}';

/// cycle_dates.event_type → label; an event type the app does not model yet
/// reads as a generic "key date" rather than an English identifier.
String uniDbEventLabel(AppLocalizations l, String eventType) => switch (eventType) {
  'apply_open' => l.eventApplyOpen,
  'apply_close' => l.eventApplyClose,
  'document_submission_deadline' => l.eventDocumentsDue,
  'first_stage_results' => l.eventFirstStageResults,
  'interview' => l.eventInterviewLabel,
  'practical_exam' => l.eventPracticalExam,
  'final_results' => l.eventFinalResults,
  'additional_admit' => l.eventAdditionalAdmit,
  'registration_open' => l.eventRegistrationOpen,
  'registration_close' => l.eventRegistrationClose,
  'orientation' => l.eventOrientation,
  'semester_start' => l.eventSemesterStart,
  _ => l.uniDbEventOther,
};

/// Whether [eventType] is one of the event codes [uniDbEventLabel] knows.
bool _isKnownEvent(String eventType) => const {
  'apply_open',
  'apply_close',
  'document_submission_deadline',
  'first_stage_results',
  'interview',
  'practical_exam',
  'final_results',
  'additional_admit',
  'registration_open',
  'registration_close',
  'orientation',
  'semester_start',
}.contains(eventType);

/// admission_cycles.cycle_track → label. Anything else (applicant_category is
/// free guideline text) passes through as written.
String? uniDbCycleLabel(AppLocalizations l, String? track) {
  if (track == null) return null;
  return switch (track) {
    'foreign' => l.cycleForeign,
    'overseas_korean_full' => l.cycleOverseasKoreanFull,
    'overseas_korean_partial' => l.cycleOverseasKoreanPartial,
    'susi' => l.cycleSusi,
    'jeongsi' => l.cycleJeongsi,
    'transfer' => l.cycleTransfer,
    'grad_general' => l.cycleGradGeneral,
    'grad_foreign' => l.cycleGradForeign,
    _ => track,
  };
}

/// "2027 Autumn" from admission_cycles.intake_year + intake_term.
String uniDbIntakeLabel(AppLocalizations l, int year, String term) {
  final season = switch (term) {
    'fall' || 'autumn' => l.catalogSeasonAutumn,
    'spring' => l.catalogSeasonSpring,
    _ => null,
  };
  return season == null ? '$year' : l.catalogSeasonLabel('$year', season);
}

/// tuition.faculty_group → label. The column holds codes (humanities, social,
/// medicine, arts_pe, …) or a Korean faculty name, which stays as written —
/// except "전체" / "전(全) 학과 동일", which mean every faculty.
String uniDbFacultyLabel(AppLocalizations l, String raw) {
  final v = raw.trim();
  switch (v) {
    case 'humanities':
      return l.facultyHumanities;
    case 'social' || 'social_science':
      return l.facultySocialScience;
    case 'natural_science':
      return l.facultyNaturalScience;
    case 'engineering':
      return l.facultyEngineering;
    case 'medicine' || 'medical':
      return l.uniDbFacultyMedicine;
    case 'pharmacy':
      return l.uniDbFacultyPharmacy;
    case 'arts_pe':
      return l.uniDbFacultyArtsPe;
    case 'arts':
      return l.facultyArts;
    case 'pe':
      return l.facultyPhysicalEducation;
    case 'theology':
      return l.uniDbFacultyTheology;
    case 'interdisciplinary':
      return l.uniDbFacultyInterdisciplinary;
  }
  if (v == '전체' || v.startsWith('전(全)') || v.startsWith('전 학과')) {
    return l.uniDbFacultyAll;
  }
  return raw;
}

/// institutions.ieqas_status → chip label.
String uniDbIeqasLabel(AppLocalizations l, String status) => switch (status) {
  'accredited' => l.ieqasAccredited,
  'outstanding' => l.ieqasOutstanding,
  _ => l.uniDbIeqasNone,
};

/// scholarships.scope → label.
String uniDbScholarshipScopeLabel(AppLocalizations l, String scope) => switch (scope) {
  'university' => l.uniDbScholarshipScopeUniversity,
  'national' => l.uniDbScholarshipScopeNational,
  'regional' => l.uniDbScholarshipScopeRegional,
  'foundation' => l.uniDbScholarshipScopeFoundation,
  'department' => l.uniDbScholarshipScopeDepartment,
  _ => l.uniDbScholarshipScopeUniversity,
};

/// scholarships.award_type + award_value → "50% tuition waiver",
/// "₩300,000 monthly stipend", …
String uniDbAwardLabel(AppLocalizations l, ScholarshipRow s) {
  final v = s.awardValue;
  return switch (s.awardType) {
    'tuition_waiver_pct' => v != null ? l.uniDbAwardTuitionPct(v.toStringAsFixed(0)) : l.uniDbAwardTuition,
    'tuition_waiver_krw' => v != null ? l.uniDbAwardTuitionKrw(uniDbKrw(l, v.round())) : l.uniDbAwardTuition,
    'stipend_monthly' => v != null ? l.uniDbAwardStipendMonthly(uniDbKrw(l, v.round())) : l.uniDbAwardStipend,
    'airfare' => v != null ? l.uniDbAwardAirfare(uniDbKrw(l, v.round())) : l.uniDbAwardAirfareCovered,
    _ => l.uniDbAwardOther,
  };
}

/// "TOPIK 4+" or "TOPIK 4+ (can be submitted later)".
String? uniDbTopikLabel(AppLocalizations l, RequirementsRow r) {
  final level = r.topikMinLevel;
  if (level == null) return null;
  final base = 'TOPIK $level+';
  return r.topikDeferred ? l.uniDbTopikDeferred(base) : base;
}

/// change_events field_name / entity_type → what changed, in words. A field
/// that is an event type names the event; otherwise the table it lives in
/// names the section.
String uniDbChangeLabel(AppLocalizations l, String? fieldName, String entityType) {
  final field = fieldName ?? '';
  if (_isKnownEvent(field)) return uniDbEventLabel(l, field);
  if (_isKnownEvent(entityType)) return uniDbEventLabel(l, entityType);
  return switch (entityType) {
    'admission_cycles' => l.uniDbChangeAdmissionCycle,
    'cycle_dates' => l.uniDbChangeDates,
    'tuition' => l.uniDbTuitionHeading,
    'scholarships' => l.uniDbScholarshipsHeading,
    'requirements' => l.uniDbRequirementsHeading,
    'documents_required' => l.uniDbDocumentChecklistHeading,
    _ => l.uniDbChangeUpdated,
  };
}

final RegExp _codePattern = RegExp(r'^[a-z0-9_]+$');

/// documents_required.document_type → label. The column mixes snake_case
/// codes (hundreds of spellings for a few dozen documents) with Korean text
/// copied from the guideline. Codes are grouped by the document they name;
/// a code no group covers reads as "additional document"; Korean text stays.
String uniDbDocumentTypeLabel(AppLocalizations l, String raw) {
  final c = raw.trim();
  if (!_codePattern.hasMatch(c)) return raw;
  bool has(String s) => c.contains(s);
  if (has('apostille')) return l.uniDbDocApostille;
  if (has('consent')) return l.uniDbDocConsent;
  if (has('passport')) return l.uniDbDocPassport;
  if (has('topik')) return l.uniDbDocTopik;
  if (has('language') || has('english') || has('korean_proficiency') || has('toefl')) {
    return l.uniDbDocLanguage;
  }
  if (has('transcript') ||
      c.startsWith('school_record') ||
      c.startsWith('academic_record') ||
      c == 'school_report' ||
      c == 'school_life_record') {
    return l.uniDbDocTranscript;
  }
  if (has('diploma') || has('graduation') || c.endsWith('completion_certificate')) {
    return l.uniDbDocDiploma;
  }
  if (c.startsWith('enrollment_cert')) return l.uniDbDocEnrollment;
  if (has('family_rel') ||
      c.startsWith('family_cert') ||
      has('family_register') ||
      has('household_register') ||
      has('family_status')) {
    return l.uniDbDocFamily;
  }
  if (has('power_of_attorney') || c == 'poa_form' || c == 'proxy_authorization' || c == 'authorization_letter') {
    return l.uniDbDocPowerOfAttorney;
  }
  if (has('financial') || c.startsWith('bank_') || c == 'sponsor_bank_statement' || c == 'income_proof') {
    return l.uniDbDocFinance;
  }
  if (has('immigration_record') || has('entry_exit') || c == 'immigration_certificate') {
    return l.uniDbDocEntryExit;
  }
  if (has('employment') || c == 'career_certificate' || c.startsWith('work_experience')) {
    return l.uniDbDocEmployment;
  }
  if (c == 'lor' || has('recommendation_letter')) return l.uniDbDocRecommendation;
  if (has('citizenship') ||
      c.startsWith('nationality_proof') ||
      c == 'nationality_certificate' ||
      has('naturalization')) {
    return l.uniDbDocCitizenship;
  }
  if (c == 'sop' || c == 'personal_statement' || c == 'study_plan') return l.uniDbDocStatement;
  if (has('alien_registration') ||
      has('foreign_registration') ||
      has('foreigner_registration') ||
      has('foreign_resident_registration') ||
      c == 'residence_card' ||
      c == 'residency_card') {
    return l.uniDbDocAlienRegistration;
  }
  if (c == 'id_copy' || c.startsWith('id_card') || c == 'foreign_id_copy' || c == 'national_id_card') {
    return l.uniDbDocIdCard;
  }
  if (c == 'photo') return l.uniDbDocPhoto;
  if (c == 'portfolio' || c == 'activity_portfolio') return l.uniDbDocPortfolio;
  if (c == 'health_check') return l.uniDbDocHealth;
  if (has('calendar')) return l.uniDbDocCalendar;
  if (has('tax_')) return l.uniDbDocTax;
  if (has('business_registration')) return l.uniDbDocBusinessRegistration;
  if (has('award') || has('honors')) return l.uniDbDocAward;
  if (c == 'application_form') return l.uniDbDocApplicationForm;
  return l.uniDbDocOther;
}
