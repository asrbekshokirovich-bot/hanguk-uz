-- Quote the fee a student pays to enrol, not the cheaper one they pay later.
--
-- Korean universities charge more for the FIRST semester than for the ones
-- after it, and the catalogue records both: `tuition.is_first_semester` is
-- true on 60 of 125 published rows and false on the other 65. Chung-Ang's
-- humanities faculty is 5,320,000원 on entry and 5,124,000원 from the second
-- semester on.
--
-- This view took min() and max() across every row for the institution, so the
-- bottom of the range was whichever faculty's LATER-semester fee was lowest —
-- 5,124,000 for Chung-Ang. A student reading the card is deciding whether they
-- can afford to start, and the number they were shown is one they cannot pay
-- until they already have.
--
-- So the range is now built from first-semester rows where the institution has
-- any, falling back to all rows where it does not (5 of 11 institutions with
-- tuition record only one kind, and dropping them would lose a real fee to a
-- distinction their guideline never drew). The fallback is per institution and
-- per year, not per row: mixing an entry fee for one faculty with a
-- later-semester fee for another would produce a spread that describes no
-- actual student.
--
-- `admission_fee_krw` is untouched — it is charged once, at entry, so the
-- semester split does not apply to it.

drop view if exists public.v_guest_approved_admissions;

create view public.v_guest_approved_admissions as
  with cyc as (
    select distinct
           c.institution_id,
           c.intake_year,
           c.intake_term
      from public.admission_cycles c
     where c.status <> 'superseded'
       -- Sanity bound, not a business rule: universities publish an intake a
       -- year or so ahead, never three. `+ 2` leaves the real horizon well
       -- clear while catching a mis-parsed year.
       and c.intake_year <= extract(year from now())::int + 2
  ),
  -- Korean guidelines quote the CURRENT year's fees as a reference, so a 2027
  -- 모집요강 carries a table stamped 2026 — every tuition row in the catalogue
  -- today is academic_year 2026 while most cycles are 2027. Matching the years
  -- strictly showed a fee on 2 of 70 rows. Take the newest year at or below the
  -- intake instead, and carry that year out so the card can say which year's
  -- fee it is showing rather than implying it is the intake's.
  --
  -- `distinct` because this is keyed by (institution, year) while `cyc` is
  -- keyed by (institution, year, term), and it is joined on the first two.
  tuition_year as (
    select distinct
           cy.institution_id,
           cy.intake_year,
           (select max(t.academic_year) from public.tuition t
             where t.institution_id = cy.institution_id
               and t.academic_year <= cy.intake_year) as ty
      from cyc cy
  ),
  -- The fee range per (institution, academic year), preferring the entry
  -- semester. `has_first` decides once per institution-year so a single range
  -- never mixes an entry fee with a later-semester one.
  fees as (
    select t.institution_id,
           t.academic_year,
           bool_or(t.is_first_semester) as has_first,
           min(t.amount_krw) filter (where t.is_first_semester) as first_min,
           max(t.amount_krw) filter (where t.is_first_semester) as first_max,
           min(t.amount_krw) as any_min,
           max(t.amount_krw) as any_max,
           -- Charged once, on entry — no semester split to respect.
           max(t.admission_fee_krw) as admission_fee_krw
      from public.tuition t
     group by 1, 2
  ),
  -- Requirements per (institution, intake year), split by whether the cycle
  -- holding them is still live. The floor across tracks for TOPIK, because a
  -- student wants the lowest bar that gets them in, not the highest.
  req as (
    select c.institution_id,
           c.intake_year,
           min(r.topik_min_level)
             filter (where c.status <> 'superseded') as topik_live,
           min(r.topik_min_level)
             filter (where c.status =  'superseded') as topik_sup,
           bool_or(r.interview_required)
             filter (where c.status <> 'superseded') as interview_live,
           bool_or(r.interview_required)
             filter (where c.status =  'superseded') as interview_sup,
           -- `english_test` is jsonb, not text: "an English test is named
           -- anywhere in this year's requirements", which is what the card
           -- claims. Not a promise that English alone suffices.
           bool_or(r.english_test is not null
                   and jsonb_typeof(r.english_test) = 'object'
                   and r.english_test <> '{}'::jsonb)
             filter (where c.status <> 'superseded') as english_live,
           bool_or(r.english_test is not null
                   and jsonb_typeof(r.english_test) = 'object'
                   and r.english_test <> '{}'::jsonb)
             filter (where c.status =  'superseded') as english_sup
      from public.requirements r
      join public.admission_cycles c on c.id = r.cycle_id
     group by 1, 2
  ),
  -- The same three facts across ALL of an institution's years, newest first.
  -- Used only to fill a year that states nothing: one document's cycles can
  -- land in different years, and the facts should not be lost to that.
  req_any as (
    select institution_id,
           (array_agg(coalesce(topik_live, topik_sup)
                      order by intake_year desc)
              filter (where coalesce(topik_live, topik_sup) is not null)
           )[1] as topik_any,
           (array_agg(coalesce(interview_live, interview_sup)
                      order by intake_year desc)
              filter (where coalesce(interview_live, interview_sup) is not null)
           )[1] as interview_any,
           (array_agg(coalesce(english_live, english_sup)
                      order by intake_year desc)
              filter (where coalesce(english_live, english_sup) is not null)
           )[1] as english_any
      from req
     group by 1
  ),
  -- Required documents per (institution, intake year). Counted by distinct
  -- `document_type` rather than by row: the table carries one row per
  -- (applicant category, document), so a raw count would read as a longer list
  -- than a student actually files.
  docs as (
    select c.institution_id,
           c.intake_year,
           count(distinct dr.document_type)
             filter (where dr.is_required) as required_document_count,
           bool_or(dr.is_apostille_required) as apostille_required
      from public.documents_required dr
      join public.admission_cycles c on c.id = dr.cycle_id
     where c.status <> 'superseded'
     group by 1, 2
  ),
  admissions as (
  select cy.institution_id,
         cy.intake_year,
         cy.intake_term,

         -- Display fields, so Guest Explore builds its list from THIS view
         -- rather than from v_institutions_for_map, whose is_visible_on_map
         -- gate hides 10 institutions that do have published data.
         i.name_ko,
         i.name_ko_short,
         coalesce(i.display_names ->> 'en', i.name_en) as name_en,
         coalesce(i.display_names ->> 'uz', i.name_en, i.name_ko) as name_uz,
         i.city_ko,
         i.tier,
         i.ieqas_status,
         i.is_partner,
         i.primary_domain,
         i.logo_url,

         ty.ty as tuition_academic_year,
         case when f.has_first then f.first_min else f.any_min end
           as tuition_min_krw,
         case when f.has_first then f.first_max else f.any_max end
           as tuition_max_krw,
         f.admission_fee_krw,

         -- Periods are keyed by (institution, year, semester). Earliest open
         -- and latest close across rounds, so the window covers the whole
         -- intake rather than whichever round happens to sort first.
         --
         -- NO cross-year fallback on these three. A borrowed requirement is
         -- still true; a borrowed deadline has already passed.
         (select min(p.application_start) from public.university_admission_periods p
           where p.institution_id = cy.institution_id
             and p.year = cy.intake_year
             and p.semester = cy.intake_term) as application_start,
         (select max(p.application_end) from public.university_admission_periods p
           where p.institution_id = cy.institution_id
             and p.year = cy.intake_year
             and p.semester = cy.intake_term) as application_end,
         (select max(p.document_deadline) from public.university_admission_periods p
           where p.institution_id = cy.institution_id
             and p.year = cy.intake_year
             and p.semester = cy.intake_term) as document_deadline,

         -- Live cycle, then superseded cycle, then any other year of the same
         -- institution. Each step only fills what the one before left null.
         coalesce(rq.topik_live, rq.topik_sup, ra.topik_any) as topik_min_level,
         coalesce(rq.interview_live, rq.interview_sup, ra.interview_any)
           as interview_required,
         coalesce(rq.english_live, rq.english_sup, ra.english_any)
           as english_accepted,

         coalesce(dc.required_document_count, 0) as required_document_count,
         dc.apostille_required
    from cyc cy
    join tuition_year ty
      on ty.institution_id = cy.institution_id
     and ty.intake_year = cy.intake_year
    join public.institutions i
      on i.id = cy.institution_id
    left join fees f
      on f.institution_id = cy.institution_id
     and f.academic_year = ty.ty
    left join req rq
      on rq.institution_id = cy.institution_id
     and rq.intake_year = cy.intake_year
    left join req_any ra
      on ra.institution_id = cy.institution_id
    left join docs dc
      on dc.institution_id = cy.institution_id
     and dc.intake_year = cy.intake_year
  )
  -- Drop the hollow rows: an approved cycle with not one extracted field. A
  -- university on a screen that promises researched ones, opening onto a card
  -- of dashes, is worse than one that is absent.
  select *
    from admissions
   where tuition_min_krw is not null
      or application_start is not null
      or application_end is not null
      or document_deadline is not null
      or topik_min_level is not null
      or interview_required is not null
      or english_accepted is not null
      or required_document_count > 0;

comment on view public.v_guest_approved_admissions is
  'Guest Explorer''s list AND its per-card detail, one row per (institution, '
  'intake year) the review queue has published. SECURITY DEFINER on purpose: '
  'Guest Explore runs before login, as anon, and the base tables'' RLS is '
  'internal-only (fn_is_app_user). The tuition range is the FIRST-semester fee '
  'where the institution records one — Korean universities charge more on '
  'entry, and the number a student needs is the one they must pay to start; it '
  'falls back to all rows only for institutions whose guideline never drew the '
  'distinction. Intake years beyond the current year + 2 are excluded as parse '
  'errors. TOPIK, interview and English fall back per field — superseded '
  'cycles first, then any other year of the same institution. Dates never fall '
  'back: a borrowed deadline has already passed. Rows with no extracted field '
  'at all are excluded.';

grant select on public.v_guest_approved_admissions to anon, authenticated;
