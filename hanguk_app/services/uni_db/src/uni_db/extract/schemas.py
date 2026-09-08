"""JSON schemas matching the §C tables.

Used by the LLM extraction layer in strict-JSON mode. Audit §5.3 /
plan §F.3. Each schema covers ONE field group (calendar, tuition,
requirements, scholarships, documents_required) so the LLM call is
narrow and the validator can pinpoint the failing field.
"""

from __future__ import annotations

from typing import Any

CALENDAR_SCHEMA: dict[str, Any] = {
    "type": "object",
    # Allow Claude to attach top-level meta fields like `is_correction_notice`,
    # `correction_text_ko` without invalidating the whole extraction. Per-row
    # strictness is preserved below.
    "additionalProperties": True,
    "properties": {
        # Recurring top-level meta fields the model reads out of real PDFs
        # (correction notices, the track/semester a calendar covers). Modelled
        # explicitly so schema-guided pruning keeps them.
        "is_correction_notice": {"type": "boolean"},
        "correction_text_ko":   {"type": ["string", "null"]},
        "admission_track":      {"type": ["string", "null"]},
        "target_semester":      {"type": ["string", "null"]},
        "notes_ko":             {"type": ["string", "null"]},
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                # Accept extra per-event fields (e.g. cycle_label,
                # is_correction_notice) instead of discarding the whole calendar
                # — a single unmodelled field used to fail the entire group.
                "additionalProperties": True,
                "required": ["event_type", "starts_at", "source_text_ko"],
                "properties": {
                    "event_type": {
                        "type": "string",
                        "enum": [
                            "apply_open", "apply_close",
                            "document_submission_deadline",
                            # Aliases Claude emits for the deadline above.
                            "documents_deadline", "document_submission_close",
                            "first_stage_results", "interview", "practical_exam",
                            "final_results", "additional_admit",
                            "offer_confirmation",
                            "registration_open", "registration_close",
                            "registration_withdrawal_open",
                            "registration_withdrawal_close",
                            "orientation", "semester_start",
                            "scholarship_application_close",
                            "language_test_deadline",
                            # Catch-all: normalize_output() maps any event type
                            # outside this list to "other" so a single odd label
                            # (e.g. "tuition_payment") never fails the whole extraction.
                            "other",
                        ],
                    },
                    "starts_at":     {"type": "string", "format": "date-time"},
                    "ends_at":       {"type": ["string", "null"], "format": "date-time"},
                    "is_tentative":  {"type": "boolean"},
                    "notes_ko":      {"type": ["string", "null"]},
                    # Per-event correction/track annotations the model emits
                    # when the PDF states them.
                    "is_correction_notice": {"type": "boolean"},
                    "correction_text_ko":   {"type": ["string", "null"]},
                    "admission_track":      {"type": ["string", "null"]},
                    "target_semester":      {"type": ["string", "null"]},
                    # Which application round these dates belong to (모집 차수),
                    # when the guideline distinguishes 1차/2차/3차/4차 모집 or
                    # 1st/2nd/3rd/4th Round with separate deadlines. Null when
                    # the document has only one round or does not label it.
                    "round_label":          {"type": ["string", "null"]},
                    # What that label actually IS. `round_label` is free text,
                    # and Korean guidelines number four different things with
                    # 차, so the label alone cannot be read as "another
                    # application round":
                    #
                    #   application   — a real 모집 차수, with its own 원서접수
                    #   supplementary — 추가합격 / 미등록 충원 / 추합: the waves
                    #                   that call up the next candidates after
                    #                   the main results. Numbered 1차/2차/3차/
                    #                   4차 and published by almost EVERY
                    #                   university, single-round ones included
                    #                   — which is why every card in the review
                    #                   queue looked like it had four rounds.
                    #   season        — 수시 / 정시: admission seasons
                    #   term          — 전기 / 후기: semesters
                    #
                    # Measured on the live corpus before this field existed: of
                    # 334 round-labelled events only 102 carried an N차 label at
                    # all — the other 232 were seasons, semesters or 충원 — and
                    # several of the 102 were 추가합격 waves too.
                    "round_kind": {
                        "type": ["string", "null"],
                        "enum": [None, "application", "supplementary", "season", "term"],
                    },
                    "source_text_ko":{"type": "string"},
                    "extractor_confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        },
        # Per admission cycle & language track — maps to
        # university_admission_periods. Dates are ISO strings (date or
        # date-time) or null. Additive: the events[] array above is unchanged.
        "periods": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": True,
                "properties": {
                    "language_track":  {"type": ["string", "null"], "enum": [None, "korean", "english"]},
                    "program_level":   {"type": ["string", "null"]},
                    # Same round label as events[].round_label — one periods[]
                    # entry per (language_track, program_level, round).
                    "round_label":     {"type": ["string", "null"]},
                    # Same vocabulary as events[].round_kind. A periods[] entry
                    # should normally be 'application': a 추가합격 wave has no
                    # application window of its own, so it does not describe a
                    # period a student can apply in.
                    "round_kind": {
                        "type": ["string", "null"],
                        "enum": [None, "application", "supplementary", "season", "term"],
                    },
                    "online_application_start":  {"type": ["string", "null"]},
                    "online_application_end":    {"type": ["string", "null"]},
                    "offline_application_start": {"type": ["string", "null"]},
                    "offline_application_end":   {"type": ["string", "null"]},
                    "interview_start": {"type": ["string", "null"]},
                    "interview_end":   {"type": ["string", "null"]},
                    "application_start":   {"type": ["string", "null"]},
                    "application_end":     {"type": ["string", "null"]},
                    "document_deadline":   {"type": ["string", "null"]},
                    "result_announcement": {"type": ["string", "null"]},
                    "application_fee_krw": {"type": ["number", "null"]},
                    "application_fee_usd": {"type": ["number", "null"]},
                    "source_text_ko":      {"type": ["string", "null"]},
                },
            },
        },
    },
    "required": ["events"],
}

TUITION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": True,  # root-level meta fields allowed
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                # Extra per-row fields (notes_ko, is_correction_notice, …) are
                # kept rather than failing the whole tuition group.
                "additionalProperties": True,
                # `faculty_ko` carries the identity, `faculty_group` is only a
                # filter. Requiring the bucket forced a one-of-eleven guess on
                # lines that genuinely span two faculties — "공학·예능"
                # (engineering AND arts) has no single right answer, so the
                # model picked differently on each run and the same printed
                # line surfaced twice under different buckets. Measured on 219
                # production rows: 23 buckets were contradicted by the Korean
                # in their own source text, and one line was tagged both
                # arts_pe and engineering.
                "required": ["faculty_ko", "academic_year",
                             "semester_number", "amount_krw", "source_text_ko"],
                "properties": {
                    # The faculty exactly as printed — Korean, English, or a
                    # mix of both. Never translated, never normalised.
                    "faculty_ko":         {"type": "string"},
                    "faculty_uz":         {"type": ["string", "null"]},
                    # Nullable and no longer required: a line that covers two
                    # faculties, or none of the eleven, reports no bucket
                    # rather than a guess.
                    "faculty_group":      {"type": ["string", "null"]},
                    "academic_year":      {"type": "integer"},
                    "semester_number":    {"type": "integer", "minimum": 1, "maximum": 12},
                    "amount_krw":         {"type": "integer", "minimum": 0},
                    "admission_fee_krw":  {"type": ["integer", "null"], "minimum": 0},
                    "is_first_semester":  {"type": "boolean"},
                    "source_text_ko":     {"type": "string"},
                    "extractor_confidence":{"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        },
    },
    "required": ["rows"],
}

REQUIREMENTS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": True,  # root-level meta fields allowed
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                # Per-row strictness: reject wrong-group field drift
                # (`document_type`, `institution`, `program_level`,
                # `admission_cycles`, etc. — these were the historical
                # hallucinations on KAIST archetype-G runs).
                "additionalProperties": False,
                # applicant_category is often absent on a row (the guideline
                # states it once at section level); make it optional/nullable
                # rather than failing the extraction.
                "required": ["source_text_ko"],
                "properties": {
                    "applicant_category":      {"type": ["string", "null"]},
                    "topik_min_level":         {"type": ["integer", "null"], "minimum": 1, "maximum": 6},
                    "topik_deferred":          {"type": "boolean"},
                    "english_test": {
                        # Tightened from `["object", "null"]` to a closed shape.
                        # Common test scores Claude has emitted historically;
                        # `other_ko` is the escape hatch for any test outside
                        # this list (e.g. CEFR, DELE) so we capture the prose
                        # rather than dropping the signal.
                        "type": ["object", "null"],
                        "additionalProperties": False,
                        "properties": {
                            "toefl_ibt": {"type": ["integer", "null"], "minimum": 0, "maximum": 120},
                            "toefl_pbt": {"type": ["integer", "null"], "minimum": 0, "maximum": 700},
                            "ielts":     {"type": ["number",  "null"], "minimum": 0, "maximum": 9.0},
                            "teps":      {"type": ["integer", "null"], "minimum": 0, "maximum": 600},
                            "duolingo":  {"type": ["integer", "null"], "minimum": 0, "maximum": 160},
                            "cambridge": {"type": ["string",  "null"]},
                            "other_ko":  {"type": ["string",  "null"]},
                            # Normalised primary test + its numeric threshold
                            # (e.g. test="ielts", min_score=6.0). Keep the
                            # per-test fields above as well.
                            "test":      {"type": ["string", "null"],
                                          "enum": [None, "ielts", "toefl_ibt", "toefl_pbt",
                                                   "teps", "duolingo", "topik", "cambridge", "other"]},
                            "min_score": {"type": ["number", "null"]},
                            "deferred":  {"type": "boolean"},
                        },
                    },
                    "gpa_floor_pct":           {"type": ["number", "null"], "minimum": 0, "maximum": 100},
                    # Minimum Korean-language study hours (한국어 연수 시간) —
                    # some guidelines accept N hours at a language institute in
                    # lieu of / alongside a TOPIK level. A key eligibility
                    # minimum the app must surface.
                    "korean_hours_min":        {"type": ["integer", "null"], "minimum": 0},
                    # Explicit presence sentinels — distinguish "the source
                    # explicitly waives this" (not_required, e.g. 재외국민/탈북민
                    # TOPIK 면제) from "this excerpt is silent" (not_stated).
                    # Without these, the UI cannot tell "not required" from
                    # "not specified" — both collapse to a null value field.
                    "topik_status":   {"type": ["string", "null"],
                                       "enum": [None, "required", "not_required", "not_stated"]},
                    "english_status": {"type": ["string", "null"],
                                       "enum": [None, "required", "not_required", "not_stated"]},
                    "gpa_status":     {"type": ["string", "null"],
                                       "enum": [None, "required", "not_required", "not_stated"]},
                    # Whether this row is a complete track definition (eligibility
                    # + selection) or just a narrow notice that mentions a track
                    # (e.g. an interview-day announcement). "partial" routes it to
                    # a softer review state instead of shipping as a full track.
                    "completeness":   {"type": ["string", "null"],
                                       "enum": [None, "full", "partial"]},
                    # Which applicant audience this track serves, so the UI can
                    # filter to our cohort. The product serves FOREIGN
                    # applicants (외국인전형); 재외국민/북한이탈/국외이수/귀화 are
                    # different audiences and should be tagged, not surfaced as
                    # the foreign track.
                    "audience":       {"type": ["string", "null"],
                                       "enum": [None, "foreign", "overseas_korean",
                                                "defector", "naturalized", "domestic"]},
                    # Majors offered to this track (programs.name_ko on publish).
                    "majors":                  {"type": ["array", "null"], "items": {"type": "string"}},
                    # Per-track tuition (maps to the tuition table on publish).
                    "tuition": {
                        "type": ["object", "null"],
                        "additionalProperties": False,
                        "properties": {
                            "amount_krw":        {"type": ["integer", "null"], "minimum": 0},
                            "admission_fee_krw": {"type": ["integer", "null"], "minimum": 0},
                            "academic_year":     {"type": ["integer", "null"]},
                            "semester_number":   {"type": ["integer", "null"], "minimum": 1, "maximum": 12},
                        },
                    },
                    "interview_required":      {"type": "boolean"},
                    "practical_exam_required": {"type": "boolean"},
                    "prose_ko":                {"type": ["string", "null"]},
                    "notes_ko":                {"type": ["string", "null"]},
                    "is_correction_notice":    {"type": "boolean"},
                    "correction_text_ko":      {"type": ["string", "null"]},
                    "source_text_ko":          {"type": "string"},
                    # Uzbek siblings for the review UI (additive — the `_ko`
                    # fields above stay verbatim Korean). See the "Uzbek
                    # translations" prompt addendum in prompt_assembler.py.
                    "applicant_category_uz":   {"type": ["string", "null"]},
                    "majors_uz":               {"type": ["array", "null"], "items": {"type": "string"}},
                    "prose_uz":                {"type": ["string", "null"]},
                    "notes_uz":                {"type": ["string", "null"]},
                    "correction_text_uz":      {"type": ["string", "null"]},
                    "source_text_uz":          {"type": ["string", "null"]},
                    "extractor_confidence":    {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        },
    },
    # Critical: empty case is `{"rows": []}` — no required field rejection
    # (this fixed the 2/3 KAIST archetype-A failures where the section had
    # no requirements info but the old schema demanded `applicant_category`).
    "required": ["rows"],
}

SCHOLARSHIPS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": True,  # root-level meta fields allowed
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                # Extra per-row fields (duration, …) are kept rather than
                # failing the whole scholarships group.
                "additionalProperties": True,
                "required": ["scope", "name_ko", "award_type", "source_text_ko"],
                "properties": {
                    "scope":      {"type": "string",
                                   "enum": ["national", "university", "department",
                                            "foundation", "regional"]},
                    "name_ko":    {"type": "string"},
                    "name_en":    {"type": ["string", "null"]},
                    "award_type": {"type": "string",
                                   "enum": ["tuition_waiver_pct", "tuition_waiver_krw",
                                            "stipend_monthly", "airfare", "other"]},
                    "award_value":{"type": ["number", "null"]},
                    "applicant_categories":  {"type": ["array", "null"], "items": {"type": "string"}},
                    # Tiered award grids foreign-student scholarships use.
                    # Preferred form is an array of per-band tiers; object/null
                    # still accepted for backward-compat.
                    "topik_tier_table": {
                        "type": ["array", "object", "null"],
                        "items": {
                            "type": "object",
                            "additionalProperties": True,
                            "properties": {
                                "topik_level": {"type": ["integer", "null"], "minimum": 1, "maximum": 6},
                                "award_type":  {"type": ["string", "null"]},
                                "award_value": {"type": ["number", "null"]},
                                "duration":    {"type": ["string", "null"],
                                                "enum": [None, "first_semester", "full_year", "all_years"]},
                            },
                        },
                    },
                    "ielts_tier_table": {
                        "type": ["array", "null"],
                        "items": {
                            "type": "object",
                            "additionalProperties": True,
                            "properties": {
                                "ielts_min":   {"type": ["number", "null"], "minimum": 0, "maximum": 9.0},
                                "award_type":  {"type": ["string", "null"]},
                                "award_value": {"type": ["number", "null"]},
                                "duration":    {"type": ["string", "null"],
                                                "enum": [None, "first_semester", "full_year", "all_years"]},
                            },
                        },
                    },
                    "eligibility_predicate": {"type": ["object", "null"]},
                    # How long the award lasts (e.g. first semester only, all
                    # years) — appears at row level in many guidelines, not
                    # only inside tier tables. Free string; the tier tables
                    # keep their closed enum.
                    "duration":              {"type": ["string", "null"]},
                    "prose_ko":              {"type": ["string", "null"]},
                    # Claude frequently adds a short note alongside prose; allow it.
                    "notes_ko":              {"type": ["string", "null"]},
                    "correction_text_ko":    {"type": ["string", "null"]},
                    "is_correction_notice":  {"type": "boolean"},
                    "source_text_ko":        {"type": "string"},
                    "extractor_confidence":  {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        },
    },
    "required": ["rows"],
}

DOCUMENTS_REQUIRED_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": True,  # root-level meta fields allowed
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                # The model names the document field many ways (document_name_ko,
                # name_ko, label_ko) and adds is_mandatory / is_notarization_required
                # / translation_required / copies … — accept them all instead of
                # discarding the whole group, and require only source_text_ko so a
                # naming variant on the doc field never fails the row. This was
                # dropping documents_required on ~every document.
                "additionalProperties": True,
                "required": ["source_text_ko"],
                "properties": {
                    "applicant_category":     {"type": ["string", "null"]},
                    "document_type":          {"type": "string"},
                    # Naming variants the model uses for the document label —
                    # modelled explicitly (see first_doc_name in the publisher).
                    "label_ko":               {"type": ["string", "null"]},
                    "label_en":               {"type": ["string", "null"]},
                    "is_required":            {"type": "boolean"},
                    "is_apostille_required":  {"type": "boolean"},
                    "is_notarization_required": {"type": "boolean"},
                    "is_translation_required":  {"type": "boolean"},
                    "country_specific":       {"type": ["object", "null"]},
                    # Per-document / per-round deadline when the guideline
                    # states one (e.g. KAIST's recommendation-letter
                    # Oct 29 / Jan 21). ISO date/date-time string or null.
                    "deadline":               {"type": ["string", "null"]},
                    "applies_to_round":       {"type": ["string", "null"]},
                    "notes_ko":               {"type": ["string", "null"]},
                    # Claude emits these in some shots — accept rather than reject.
                    "extractor_confidence":   {"type": "number", "minimum": 0, "maximum": 1},
                    "is_correction_notice":   {"type": "boolean"},
                    "source_text_ko":         {"type": "string"},
                },
            },
        },
    },
    "required": ["rows"],
}

RECRUITMENT_UNITS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["faculty_ko", "department_ko", "source_text_ko"],
                "properties": {
                    "external_code":  {"type": ["string", "null"]},
                    "faculty_ko":     {"type": "string"},
                    "division_ko":    {"type": ["string", "null"]},
                    "department_ko":  {"type": "string"},
                    "major_track_ko": {"type": ["string", "null"]},
                    "faculty_group":  {
                        "type": ["string", "null"],
                        "enum": [
                            None,
                            "humanities", "social", "natural_science", "engineering",
                            "arts_pe", "medicine", "dentistry", "veterinary",
                            "pharmacy", "theology", "interdisciplinary",
                        ],
                    },
                    "campus":               {"type": ["string", "null"]},
                    "quota":                {"type": ["integer", "string", "null"]},
                    "is_in_quota":          {"type": ["boolean", "null"]},
                    "applicant_category":   {"type": ["string", "null"]},
                    "is_correction_notice": {"type": "boolean"},
                    "correction_text_ko":   {"type": ["string", "null"]},
                    "notes_ko":             {"type": ["string", "null"]},
                    "source_text_ko":       {"type": "string"},
                    # Uzbek siblings for the review UI (additive — `_ko` stays
                    # verbatim Korean). See the Uzbek prompt addendum.
                    "faculty_uz":            {"type": ["string", "null"]},
                    "division_uz":           {"type": ["string", "null"]},
                    "department_uz":         {"type": ["string", "null"]},
                    "major_track_uz":        {"type": ["string", "null"]},
                    "applicant_category_uz": {"type": ["string", "null"]},
                    "correction_text_uz":    {"type": ["string", "null"]},
                    "notes_uz":              {"type": ["string", "null"]},
                    "source_text_uz":        {"type": ["string", "null"]},
                    "extractor_confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        },
    },
    "required": ["rows"],
}

FIELD_GROUP_SCHEMAS: dict[str, dict[str, Any]] = {
    "calendar":           CALENDAR_SCHEMA,
    "tuition":            TUITION_SCHEMA,
    "requirements":       REQUIREMENTS_SCHEMA,
    "scholarships":       SCHOLARSHIPS_SCHEMA,
    "documents_required": DOCUMENTS_REQUIRED_SCHEMA,
    "recruitment_units":  RECRUITMENT_UNITS_SCHEMA,
    # Phase 1 alias: 'basic_requirements' is the user-facing label,
    # 'requirements' is the table name. Same shape.
    "basic_requirements": REQUIREMENTS_SCHEMA,
    "document_checklist": DOCUMENTS_REQUIRED_SCHEMA,
}
