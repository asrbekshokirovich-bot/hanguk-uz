-- Catalogue document names in the app's language.
--
-- The owner's rule (2026-09-30): once a language is chosen in the app,
-- everything it shows is in that language, except faculty, university and city
-- names. The admission documents of each university come from the guideline
-- Excel, which is filled in Uzbek (university_guideline_docs.hujjat_nomi), so
-- until now "Ariza formasi", "Bank spravkasi" … showed in every language.
--
--   * app_text_translations holds the English, Korean and Russian of each
--     Uzbek name. The names in the catalogue today are filled in below
--     (translated by hand); a name added later is translated by the
--     translate-app-texts edge function, which pg_cron runs every 30 minutes.
--   * v_app_university_docs gains hujjat_nomi_en / _ko / _ru; the app picks
--     the one for its language and falls back to the Uzbek name.
--   * Surveys are written in Uzbek in the CRM too: their title, description,
--     questions and options go through the same table, which the app reads
--     directly (it holds nothing but translations of texts the app shows).

create table if not exists public.app_text_translations (
  source        text primary key,
  en            text,
  ko            text,
  ru            text,
  translated_by text not null default 'manual',
  translated_at timestamptz not null default now()
);

alter table public.app_text_translations enable row level security;
revoke all on table public.app_text_translations from anon, authenticated;
grant select on table public.app_text_translations to anon, authenticated;

drop policy if exists "app_text_translations_read" on public.app_text_translations;
create policy "app_text_translations_read" on public.app_text_translations
  for select to anon, authenticated
  using (true);

-- As in 20260925180000_app_university_catalog_views.sql, plus the translations.
create or replace view public.v_app_university_docs as
select
  d.guideline_uuid as guideline_id,
  d.tartib,
  d.hujjat_nomi,
  d.kimlar_uchun,
  d.majburiy,
  d.apostil,
  t.en as hujjat_nomi_en,
  t.ko as hujjat_nomi_ko,
  t.ru as hujjat_nomi_ru
from public.university_guideline_docs d
left join public.app_text_translations t on t.source = d.hujjat_nomi;

revoke all on public.v_app_university_docs from public, anon, authenticated;
grant select on public.v_app_university_docs to anon, authenticated;

-- The Uzbek texts the app shows that nobody has translated yet, for
-- translate-app-texts: catalogue document names and survey texts.
create or replace function public.fn_app_texts_untranslated(p_limit integer default 40)
returns table(source text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select x.src
    from (
      select d.hujjat_nomi as src from public.university_guideline_docs d
      union select s.title from public.surveys s
      union select s.description from public.surveys s
      union select q.question_text from public.survey_questions q
      union select jsonb_array_elements_text(q.options) from public.survey_questions q
       where jsonb_typeof(q.options) = 'array'
    ) x
    left join public.app_text_translations t on t.source = x.src
   where coalesce(trim(x.src), '') <> ''
     and t.source is null
   order by 1
   limit greatest(coalesce(p_limit, 40), 1)
$$;

revoke all on function public.fn_app_texts_untranslated(integer) from public, anon, authenticated;
grant execute on function public.fn_app_texts_untranslated(integer) to service_role;

-- Every 30 minutes, with the project's secret key (same wiring as
-- infra-health-check-hourly).
select cron.schedule(
  'translate-app-texts-30min',
  '17,47 * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/translate-app-texts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)
  $cron$
);

-- The names in the catalogue on 2026-09-30, translated by hand.
insert into public.app_text_translations (source, en, ko, ru) values
  ('108-TOPIK ro''yxat kvitansiyasi', '108th TOPIK registration receipt', '제108회 TOPIK 접수증', 'Квитанция о регистрации на 108-й TOPIK'),
  ('9–11-sinflarni tugatganlik hujjati + 9-sinf baholari', 'Certificate of completion of grades 9–11 + grade 9 transcript', '9~11학년 이수증명서 + 9학년 성적증명서', 'Документ об окончании 9–11 классов + оценки за 9 класс'),
  ('ARC nusxasi', 'ARC copy', '외국인등록증 사본', 'Копия ARC'),
  ('Abituriyent deklaratsiyasi', 'Applicant declaration', '지원자 서약서', 'Декларация абитуриента'),
  ('Almashuv talabasi hujjatlari', 'Exchange student documents', '교환학생 재학·수료 증명서', 'Документы студента по обмену'),
  ('Amaliy imtihon ijrosi (USB)', 'Practical exam performance (USB)', '실기 과제곡 연주 (USB)', 'Исполнение для практического экзамена (USB)'),
  ('Amaliy imtihon materiallari', 'Practical exam materials', '실기고사 자료', 'Материалы для практического экзамена'),
  ('Amaliy sinov materiallari', 'Practical assessment materials', '실기 심사 자료', 'Материалы практического испытания'),
  ('Apostilli attestat', 'Apostilled high school diploma', '고등학교 졸업증명서 (아포스티유)', 'Аттестат с апостилем'),
  ('Apostilli diplom va transkript', 'Apostilled diploma and transcript', '학위증명서 및 성적증명서 (아포스티유)', 'Диплом и выписка оценок с апостилем'),
  ('Apostilli ta''lim hujjatlari', 'Apostilled academic documents', '학력 서류 (아포스티유)', 'Документы об образовании с апостилем'),
  ('Apostilli yakuniy hujjatlar', 'Apostilled final academic documents', '최종학력증명서 및 성적증명서 (아포스티유)', 'Итоговые документы об образовании с апостилем'),
  ('Ariza formasi', 'Application form', '입학원서', 'Анкета-заявление'),
  ('Ariza formasi va abituriyent kartasi', 'Application form and applicant record card', '입학원서 및 지원자 카드', 'Анкета-заявление и карточка абитуриента'),
  ('Ariza formasi va deklaratsiya', 'Application form and declaration', '입학원서 및 서약서', 'Анкета-заявление и декларация'),
  ('Ariza formasi va esselar', 'Application form and essays', '입학원서 및 에세이', 'Анкета-заявление и эссе'),
  ('Ariza formasi va hujjatlar ro''yxati', 'Application form and document checklist', '입학원서 및 제출서류 목록', 'Анкета-заявление и перечень документов'),
  ('Ariza formasi va ilova xatlar', 'Application form with pledge and consent forms', '입학원서, 서약서 및 개인정보 동의서', 'Анкета-заявление и сопроводительные формы'),
  ('Ariza formasi va pastor tavsiyanomasi', 'Application form and pastor''s recommendation', '입학원서 및 담임목사 추천서', 'Анкета-заявление и рекомендация пастора'),
  ('Ariza formasi va shaxsiy ma''lumotlar varaqasi', 'Application form and personal record sheet', '입학원서 및 개인신상기록표', 'Анкета-заявление и лист личных данных'),
  ('Ariza formasi va ta''lim yozuvi', 'Application form and academic record', '입학원서 및 학력기록표', 'Анкета-заявление и сведения об образовании'),
  ('Ariza formasi, o''qish rejasi va rozilik xatlari', 'Application form, study plan and consent forms', '입학원서, 학업계획서 및 동의서', 'Анкета-заявление, учебный план и формы согласия'),
  ('Ariza formasi, rozilik xati va muqova varaqasi', 'Application form, consent form and cover sheet', '입학원서, 학력조회 동의서 및 제출서류 표지', 'Анкета-заявление, согласие и титульный лист'),
  ('Ariza hujjatlari to''plami', 'Application document package', '입학신청서류 일체', 'Пакет документов для поступления'),
  ('Ariza kvitansiyasi', 'Application receipt', '원서 접수증', 'Квитанция о подаче заявления'),
  ('Asl hujjatlar', 'Original documents', '원본 서류', 'Оригиналы документов'),
  ('Asl nusxa: bank spravkasi', 'Original: bank statement', '원본: 은행 잔고증명서', 'Оригинал: банковская справка'),
  ('Asl nusxa: oila hujjatlari', 'Original: family relation documents', '원본: 가족관계증명서', 'Оригинал: документы о семье'),
  ('Asl nusxa: ta''lim hujjatlari (apostil bilan)', 'Original: academic documents (apostilled)', '원본: 학력 서류 (아포스티유)', 'Оригинал: документы об образовании (с апостилем)'),
  ('Asl nusxa: transkriptlar', 'Original: transcripts', '원본: 성적증명서', 'Оригинал: выписки оценок'),
  ('Asl nusxalar', 'Originals', '원본', 'Оригиналы'),
  ('Attestat', 'High school diploma', '고등학교 졸업증명서', 'Аттестат'),
  ('Attestat (yoki bitiruvchilik ma''lumotnomasi)', 'High school diploma (or graduation certificate)', '고등학교 졸업(예정)증명서', 'Аттестат (или справка об окончании)'),
  ('Attestat ilovasi (baholar)', 'Diploma supplement (grades)', '고등학교 성적증명서', 'Приложение к аттестату (оценки)'),
  ('Attestat ilovasi — baholar (skan)', 'Diploma supplement — grades (scan)', '고등학교 성적증명서 (스캔본)', 'Приложение к аттестату — оценки (скан)'),
  ('Attestat ilovasi — barcha yillar baholari', 'Diploma supplement — grades for all years', '고등학교 전 학년 성적증명서', 'Приложение к аттестату — оценки за все годы'),
  ('Attestat va maktab baholari', 'High school diploma and transcript', '고등학교 졸업(예정)증명서 및 성적증명서', 'Аттестат и школьные оценки'),
  ('Attestat yoki bitiruvchilik ma''lumotnomasi', 'High school diploma or graduation certificate', '고등학교 졸업(예정)증명서', 'Аттестат или справка об окончании'),
  ('Attestat yoki o''qish ma''lumotnomasi', 'High school diploma or certificate of enrollment', '고등학교 졸업(재학)증명서', 'Аттестат или справка об обучении'),
  ('Baholar varaqasi yoki maktab tabeli', 'Transcript or school record', '성적증명서 또는 학교생활기록부', 'Ведомость оценок или школьный табель'),
  ('Bakalavr diplomi', 'Bachelor''s diploma', '학사 졸업증명서', 'Диплом бакалавра'),
  ('Bakalavr diplomi (yoki bitiruvchilik ma''lumotnomasi)', 'Bachelor''s diploma (or graduation certificate)', '학사 졸업(예정)증명서', 'Диплом бакалавра (или справка об окончании)'),
  ('Bakalavr diplomi va bitiruvchilik guvohnomasi', 'Bachelor''s diploma and graduation certificate', '학사 졸업(예정)증명서 및 학위증명서', 'Диплом бакалавра и свидетельство об окончании'),
  ('Bakalavr diplomi va transkripti', 'Bachelor''s diploma and transcript', '학사 졸업증명서 및 성적증명서', 'Диплом бакалавра и выписка оценок'),
  ('Bakalavr diplomi yoki bitirish guvohnomasi', 'Bachelor''s diploma or graduation certificate', '학사 졸업(예정)증명서', 'Диплом бакалавра или свидетельство об окончании'),
  ('Bakalavr diplomi yoki bitirish ma''lumotnomasi', 'Bachelor''s diploma or graduation certificate', '학사 학위증명서 또는 졸업(예정)증명서', 'Диплом бакалавра или справка об окончании'),
  ('Bakalavr diplomi yoki bitiruvchilik ma''lumotnomasi', 'Bachelor''s diploma or graduation certificate', '학사 학위증명서 또는 졸업(예정)증명서', 'Диплом бакалавра или справка об окончании'),
  ('Bakalavr transkripti', 'Bachelor''s transcript', '학사 성적증명서', 'Выписка оценок бакалавриата'),
  ('Bakalavr transkripti (barcha semestrlar)', 'Bachelor''s transcript (all semesters)', '학사 전 학기 성적증명서', 'Выписка оценок бакалавриата (все семестры)'),
  ('Bank spravkasi', 'Bank statement', '은행 잔고증명서', 'Банковская справка'),
  ('Bank spravkasi (asl)', 'Bank statement (original)', '은행 잔고증명서 (원본)', 'Банковская справка (оригинал)'),
  ('Bank spravkasi va moliyaviy hujjatlar', 'Bank statement and financial documents', '은행 잔고증명서 및 재정입증서류', 'Банковская справка и финансовые документы'),
  ('Bank spravkasi va moliyaviy kafolat (Form 5)', 'Bank statement and financial guarantee (Form 5)', '은행 잔고증명서 및 재정보증서 (서식 5)', 'Банковская справка и финансовая гарантия (форма 5)'),
  ('Bank spravkasi yoki stipendiya guvohnomasi', 'Bank statement or scholarship certificate', '은행 잔고증명서 또는 장학금 증명서', 'Банковская справка или справка о стипендии'),
  ('Bank statement', 'Bank statement', '은행 잔고증명서', 'Банковская справка'),
  ('Barcha bosqich ta''lim hujjatlari', 'Academic documents for all levels of education', '전 과정 졸업증명서 및 성적증명서', 'Документы об образовании за все ступени'),
  ('Bitiruvchilarning yakuniy hujjatlari', 'Final documents for graduates', '졸업증명서 및 최종 성적증명서', 'Итоговые документы выпускников'),
  ('Bitiruvchilik ma''lumotnomasi', 'Graduation certificate', '졸업(예정)증명서', 'Справка об окончании'),
  ('Boshlang''ich, o''rta va yuqori maktab baholari', 'Elementary, middle and high school transcripts', '초·중·고 전 과정 성적증명서', 'Оценки начальной, средней и старшей школы'),
  ('Boshlang''ich, o''rta va yuqori maktab bitiruvchilik ma''lumotnomalari', 'Elementary, middle and high school graduation certificates', '초·중·고 전 과정 졸업증명서', 'Справки об окончании начальной, средней и старшей школы'),
  ('Boshqa oilaviy hujjatlar', 'Other family documents', '기타 가족관계 서류', 'Прочие семейные документы'),
  ('Boshqa til sertifikatlari', 'Other language certificates', '기타 어학성적증명서', 'Прочие языковые сертификаты'),
  ('Butun ta''lim hujjatlari', 'Complete academic records', '전 과정 졸업증명서 및 성적증명서', 'Все документы об образовании'),
  ('Chet el ta''lim hujjatlari apostili', 'Apostille for foreign academic documents', '해외 학력증명서 아포스티유', 'Апостиль на иностранные документы об образовании'),
  ('Chet ellik ro''yxatdan o''tganlik ma''lumotnomasi', 'Certificate of alien registration', '외국인등록사실증명', 'Справка о регистрации иностранца'),
  ('Chet ellik ro''yxatidan o''tganlik guvohnomasi', 'Alien registration card (ARC)', '외국인등록증', 'Карта регистрации иностранца (ARC)'),
  ('Chet ellik talaba sug''urtasi', 'International student insurance', '외국인 유학생 보험 가입증명서', 'Страховка иностранного студента'),
  ('Darsdan tashqari faoliyat ro''yxati', 'Extracurricular activities list', '교외 활동 목록', 'Список внеучебной деятельности'),
  ('Dastlabki qabul sertifikati', 'Preliminary admission certificate', '예비 합격증명서', 'Сертификат о предварительном зачислении'),
  ('Dietolog litsenziyasi', 'Dietitian license', '영양사 면허증', 'Лицензия диетолога'),
  ('Diplom (skan)', 'Diploma (scan)', '학위증명서 (스캔본)', 'Диплом (скан)'),
  ('Diplom va transkript tekshiruviga ruxsat (Form 4)', 'Diploma and transcript release authorization (Form 4)', '학위·성적 조회 동의서 (서식 4)', 'Разрешение на проверку диплома и выписки оценок (форма 4)'),
  ('Diplom yoki bitirish ma''lumotnomasi', 'Diploma or graduation certificate', '대학(원) 졸업(예정)증명서', 'Диплом или справка об окончании'),
  ('Diplom yoki bitiruvchilik ma''lumotnomasi', 'Diploma or graduation certificate', '학위증명서 또는 졸업(예정)증명서', 'Диплом или справка об окончании'),
  ('Diplomni tasdiqlash hujjati', 'Diploma verification certificate', '학위 인증서', 'Документ о подтверждении диплома'),
  ('Dissertatsiya', 'Thesis', '학위논문', 'Диссертация'),
  ('Fakultet qo''shimcha hujjatlari', 'Additional documents for specific majors', '학과별 추가 제출서류', 'Дополнительные документы факультета'),
  ('Faoliyat hujjatlari ro''yxati va nusxalari', 'Activity evidence list and copies', '활동증빙 목록표 및 증빙서류', 'Перечень и копии документов о деятельности'),
  ('Faoliyat va yutuqlar hujjatlari', 'Activities and achievements documents', '활동 및 수상 증빙자료', 'Документы о деятельности и достижениях'),
  ('Faoliyat yoki ijodiy ishlar (inglizcha, USB)', 'Activities or creative works (in English, USB)', '활동 증빙 또는 작품 (영문, USB)', 'Документы о деятельности или творческие работы (на английском, USB)'),
  ('Foto', 'Photo', '사진', 'Фото'),
  ('Fotosuratlar', 'Photos', '증명사진', 'Фотографии'),
  ('Fuqarolik ma''lumotlari (Form 5)', 'Nationality information (Form 5)', '국적 정보 (서식 5)', 'Сведения о гражданстве (форма 5)'),
  ('Fuqarolikdan chiqish hujjati', 'Proof of loss of nationality', '국적상실 입증서류', 'Документ о выходе из гражданства'),
  ('Fuqarolikni tasdiqlovchi hujjat', 'Proof of nationality', '국적 증명서', 'Документ, подтверждающий гражданство'),
  ('Fuqarolikni tasdiqlovchi hujjatlar', 'Proof of nationality documents', '국적 증명서류', 'Документы, подтверждающие гражданство'),
  ('G''ayrioddiy akademik holatlar bayonoti (Form 3)', 'Statement of unusual academic circumstances (Form 3)', '특이 학업사항 진술서 (서식 3)', 'Заявление об особых академических обстоятельствах (форма 3)'),
  ('GPA konvertatsiyasi', 'GPA conversion', '평점 환산 증명서', 'Пересчёт GPA'),
  ('GPA sertifikati (100 ballik tizimda)', 'GPA certificate (100-point scale)', '평점 증명서 (100점 만점 환산)', 'Сертификат GPA (по 100-балльной шкале)'),
  ('Grant (stipendiya) tasdiqnomasi', 'Scholarship award certificate', '장학금 수혜(예정) 증명서', 'Подтверждение гранта (стипендии)'),
  ('Hamshiralik litsenziyasi', 'Nursing license', '간호사 면허증', 'Лицензия медсестры'),
  ('Homiyning ish joyi va daromad ma''lumotnomalari', 'Sponsor''s employment and income certificates', '재정보증인 재직증명서 및 소득증명서', 'Справки с места работы и о доходах спонсора'),
  ('Hujjatlar cheklisti', 'Document checklist', '제출서류 체크리스트', 'Чек-лист документов'),
  ('Hujjatlar ro''yxati', 'List of documents', '제출서류 목록', 'Перечень документов'),
  ('Hujjatlar ro''yxati (Form 1)', 'Document checklist (Form 1)', '제출서류 체크리스트 (서식 1)', 'Перечень документов (форма 1)'),
  ('Hujjatlar ro''yxati (cheklist)', 'List of documents (checklist)', '제출서류 체크리스트', 'Перечень документов (чек-лист)'),
  ('ID karta (외국인 등록증) nusxasi — ikki tomoni', 'ARC copy — front and back', '외국인등록증 사본 (앞·뒷면)', 'Копия ID-карты (ARC) — с двух сторон'),
  ('ID karta nusxasi', 'ID card copy', '신분증(외국인등록증) 사본', 'Копия ID-карты'),
  ('ID karta nusxasi (ikki tomoni)', 'ID card copy (front and back)', '신분증(외국인등록증) 사본 (앞·뒷면)', 'Копия ID-карты (с двух сторон)'),
  ('Ijodiy ishlar', 'Creative works', '작품 실적 자료', 'Творческие работы'),
  ('Ijodiy ishlar (USB)', 'Creative works (USB)', '작품 (USB)', 'Творческие работы (USB)'),
  ('Ijodiy ishlar tasdiqnomasi', 'Artwork verification statement', '작품 확인서', 'Подтверждение авторства творческих работ'),
  ('Ijodiy material', 'Creative materials', '실기 심사 자료', 'Творческие материалы'),
  ('Ijodiy yoki sport materiallari', 'Artistic or athletic materials', '예체능 실기 자료', 'Творческие или спортивные материалы'),
  ('Ijro videosi', 'Performance video', '연주 동영상', 'Видео исполнения'),
  ('Ijro yozuvi', 'Performance recording', '연주 녹음·녹화본', 'Запись исполнения'),
  ('Ikkita tavsiyanoma', 'Two letters of recommendation', '추천서 2부', 'Два рекомендательных письма'),
  ('Ilmiy faoliyat hujjatlari', 'Research activity documents', '연구 실적 증빙자료', 'Документы о научной деятельности'),
  ('Ilmiy ishlar yoki portfolio', 'Research works or portfolio', '연구 실적물 또는 포트폴리오', 'Научные работы или портфолио'),
  ('Ilmiy rahbar tasdiqnomasi', 'Academic advisor confirmation', '지도교수 확인서', 'Подтверждение научного руководителя'),
  ('Ilmiy rahbar tavsiyanomasi', 'Academic advisor recommendation', '지도교수 추천서', 'Рекомендация научного руководителя'),
  ('Ilmiy-tadqiqot va turar joy rejasi', 'Research and settlement plan', '연구계획 및 정주 계획서', 'План исследований и проживания'),
  ('Imtihon varaqasi', 'Exam admission ticket', '수험표', 'Экзаменационный лист'),
  ('Ingliz tili hujjati', 'English proficiency document', '영어능력 증빙서류', 'Документ о знании английского языка'),
  ('Ingliz tili sertifikati', 'English proficiency certificate', '영어능력시험 성적증명서', 'Сертификат по английскому языку'),
  ('Ingliz tili sertifikati (게임융합학과)', 'English proficiency certificate (Dept. of Game Convergence)', '영어능력시험 성적증명서 (게임융합학과)', 'Сертификат по английскому языку (кафедра игровых технологий)'),
  ('Ingliz tili tasdiqnomasi (dekan va maslahatchi)', 'Certificate of English proficiency (dean and advisor)', '영어능력 확인서 (학장 및 지도교수)', 'Подтверждение знания английского языка (декан и научный руководитель)'),
  ('Intervyu videosi', 'Interview video', '면접 평가 영상', 'Видео интервью'),
  ('Ish joyidan ma''lumotnoma', 'Certificate of employment', '재직증명서', 'Справка с места работы'),
  ('Ish tajribasi hujjatlari', 'Work experience documents', '경력증명서 / 재직증명서', 'Документы об опыте работы'),
  ('Kirish-chiqish ma''lumotnomasi', 'Certificate of entry and exit', '출입국사실증명서', 'Справка о въезде и выезде'),
  ('Kirish-chiqish ma''lumotnomasi va unga ariza', 'Certificate of entry and exit with application form', '출입국사실증명서 및 발급신청서', 'Справка о въезде и выезде и заявление на её получение'),
  ('Kirish-chiqish ma''lumotnomasi yoki yashash guvohnomasi', 'Certificate of entry and exit or residence certificate', '출입국사실증명서 또는 체류증명서', 'Справка о въезде и выезде или справка о пребывании'),
  ('Koreya bank daftarchasi nusxasi', 'Korean bankbook copy', '국내 은행 통장 사본', 'Копия корейской банковской книжки'),
  ('Koreya fuqaroligi yo''qligini tasdiqlovchi hujjatlar', 'Proof of non-Korean nationality', '국적상실(이탈) 증명서류', 'Документы, подтверждающие отсутствие гражданства Кореи'),
  ('Koreya fuqaroligidan chiqqanlik hujjatlari', 'Proof of loss of Korean nationality', '국적상실 증빙서류', 'Документы о выходе из гражданства Кореи'),
  ('Koreya fuqaroligidan chiqqanlik yoki asrab olinganlik hujjatlari', 'Proof of loss of Korean nationality or adoption', '국적이탈·상실 증명서 또는 입양증명서', 'Документы о выходе из гражданства Кореи или об усыновлении'),
  ('Koreya fuqaroligidan voz kechish hujjati', 'Proof of renunciation of Korean nationality', '국적이탈 증명서', 'Документ об отказе от гражданства Кореи'),
  ('Koreya fuqaroligini yo''qotganlik hujjati', 'Certificate of loss of Korean nationality', '국적상실 증명서', 'Документ об утрате гражданства Кореи'),
  ('Koreyadagi maktab tabeli', 'School life record (Korea)', '학교생활기록부', 'Школьный табель (Корея)'),
  ('Koreyadagi ro''yxat hujjati', 'Certificate of foreign resident registration (Korea)', '외국인등록사실증명', 'Документ о регистрации в Корее'),
  ('Koreys tili hujjati', 'Korean language proficiency document', '한국어능력 증빙서류', 'Документ о знании корейского языка'),
  ('Koreys tili kursi hujjatlari', 'Korean language program documents', '한국어 연수과정 재학·성적증명서', 'Документы о курсах корейского языка'),
  ('Koreys tili kursida o''qiyotganlik ma''lumotnomasi', 'Certificate of enrollment in Korean language program', '한국어 연수과정 재학증명서', 'Справка об обучении на курсах корейского языка'),
  ('Koreys tili markazi davomat ma''lumotnomasi', 'Korean language institute attendance certificate', '한국어 어학원 출석증명서', 'Справка о посещаемости центра корейского языка'),
  ('Koreys tili markazi hujjatlari', 'Korean language institute documents', '국내 어학원 서류', 'Документы центра корейского языка'),
  ('Koreys tili sertifikati', 'Korean language certificate', '한국어능력 성적증명서', 'Сертификат по корейскому языку'),
  ('Ma''lumotnoma so''rash uchun ishonchnoma', 'Power of attorney for certificate requests', '사실증명 발급신청 위임장', 'Доверенность на запрос справок'),
  ('Maktab (va universitet) transkriptlari', 'High school (and university) transcripts', '고등학교 (및 대학) 성적증명서', 'Выписки оценок школы (и университета)'),
  ('Maktab baholari', 'High school transcript', '고등학교 성적증명서', 'Школьные оценки'),
  ('Maktab baholari (3 yil)', 'High school transcript (3 years)', '고등학교 3개년 성적증명서', 'Школьные оценки (3 года)'),
  ('Maktab baholari (barcha yillar)', 'High school transcript (all years)', '고등학교 전 학년 성적증명서', 'Школьные оценки (за все годы)'),
  ('Maktab baholari (boshlang''ich, o''rta, yuqori)', 'School transcripts (elementary, middle, high)', '초·중·고등학교 성적증명서', 'Школьные оценки (начальная, средняя, старшая школа)'),
  ('Maktab baholari (butun davr)', 'High school transcript (entire period)', '고등학교 전 학년 성적증명서', 'Школьные оценки (за весь период)'),
  ('Maktab baholari (to''liq)', 'High school transcript (complete)', '고등학교 전 학년 성적증명서', 'Школьные оценки (полностью)'),
  ('Maktab baholari varaqasi', 'High school transcript', '고등학교 성적증명서', 'Ведомость школьных оценок'),
  ('Maktab bitirganlik (bitiruvchilik) ma''lumotnomasi', 'High school graduation certificate', '고등학교 졸업(예정)증명서', 'Справка об окончании школы'),
  ('Maktab bitirganlik hujjati (attestat)', 'High school graduation certificate (diploma)', '고등학교 졸업증명서', 'Документ об окончании школы (аттестат)'),
  ('Maktab dasturini tasdiqlovchi hujjat', 'High school course completion certificate', '고등학교 이수과정 확인서', 'Документ, подтверждающий школьную программу'),
  ('Maktab direktorining tavsiyanomasi', 'Principal''s recommendation letter', '고등학교 교장 추천서', 'Рекомендация директора школы'),
  ('Maktab hujjatlari (boshlang''ich, o''rta, yuqori)', 'School documents (elementary, middle, high)', '초·중·고 재학·성적증명서', 'Школьные документы (начальная, средняя, старшая школа)'),
  ('Maktab ma''lumotnomasi (School Report)', 'School Report', '학교 보고서 (School Report)', 'Школьная характеристика (School Report)'),
  ('Maktab o''quv kalendari yoki ta''lim tizimi hujjati', 'School calendar or education system document', '학사일정표 또는 학제 확인서', 'Школьный учебный календарь или документ о системе образования'),
  ('Maktab profili', 'School profile', '학교 프로필', 'Профиль школы'),
  ('Maktab tabeli (Student Record Book)', 'School record (Student Record Book)', '학교생활기록부 (Student Record Book)', 'Школьный табель (Student Record Book)'),
  ('Maktab transkripti', 'High school transcript', '고등학교 성적증명서', 'Школьная выписка оценок'),
  ('Maktab transkripti (barcha yillar)', 'High school transcript (all years)', '고등학교 전 학년 성적증명서', 'Школьная выписка оценок (за все годы)'),
  ('Maktab transkriptlari (barcha yillar)', 'High school transcripts (all years)', '고등학교 전 학년 성적증명서', 'Школьные выписки оценок (за все годы)'),
  ('Maktabda o''qiganlik ma''lumotnomasi', 'Certificate of school enrollment', '고등학교 재학증명서', 'Справка об обучении в школе'),
  ('Maktabning barcha yillari baholari', 'Transcript of all high school years', '고등학교 전 학년 성적증명서', 'Оценки за все годы обучения в школе'),
  ('Maqsad bayoni', 'Statement of purpose', '지원동기서', 'Мотивационное письмо'),
  ('Maqsad bayoni va o''qish rejasi', 'Statement of purpose and study plan', '자기소개서 및 학업계획서', 'Мотивационное письмо и учебный план'),
  ('Maslahatchi professor ismi', 'Faculty advisor name', '희망 지도교수명', 'Имя научного руководителя'),
  ('Moliyaviy hujjat', 'Proof of funds', '재정능력 입증서류', 'Финансовый документ'),
  ('Moliyaviy hujjatlar', 'Financial documents', '재정능력 입증서류', 'Финансовые документы'),
  ('Moliyaviy imkoniyat hujjati', 'Proof of financial capacity', '재정능력 입증서류', 'Документ о финансовой состоятельности'),
  ('Moliyaviy kafolat bayonoti (Form 1)', 'Financial guarantee statement (Form 1)', '재정보증서 (서식 1)', 'Заявление о финансовой гарантии (форма 1)'),
  ('Moliyaviy kafolat formasi', 'Financial guarantee form', '재정보증서', 'Форма финансовой гарантии'),
  ('Moliyaviy kafolat hujjati', 'Financial guarantee document', '재정보증서', 'Документ о финансовой гарантии'),
  ('Moliyaviy kafolat hujjatlari', 'Financial guarantee documents', '재정보증 관련 서류', 'Документы о финансовой гарантии'),
  ('Moliyaviy kafolat tilxati', 'Financial guarantee pledge', '유학경비 부담 서약서', 'Письменное обязательство о финансовой гарантии'),
  ('Moliyaviy kafolat va bank spravkasi', 'Financial guarantee and bank statement', '재정보증서 및 은행 잔고증명서', 'Финансовая гарантия и банковская справка'),
  ('Moliyaviy kafolat xati', 'Letter of sponsorship', '재정보증 서신', 'Спонсорское письмо'),
  ('Moliyaviy kafolatchining tilxati', 'Financial sponsor''s pledge', '재정보증인의 유학경비 부담 서약서', 'Письменное обязательство спонсора'),
  ('Mukofot va yutuqlar', 'Honors and awards', '수상 실적', 'Награды и достижения'),
  ('O''qish davrlari jadvali', 'Academic history record sheet', '수학기간 기록표', 'Таблица периодов обучения'),
  ('O''qish rejasi', 'Study plan', '학업계획서', 'Учебный план'),
  ('O''qish rejasi va tarjimai hol', 'Study plan and self-introduction', '학업계획서 및 자기소개서', 'Учебный план и автобиография'),
  ('O''qish tarixi formasi', 'Educational history form', '수학기록표', 'Форма истории обучения'),
  ('O''qish va tadqiqot rejasi', 'Study and research plan', '학업 및 연구계획서', 'План обучения и исследований'),
  ('O''qish xarajatlari kafolat xati', 'Letter of guarantee for study expenses', '유학경비 부담 서약서', 'Гарантийное письмо об оплате расходов на обучение'),
  ('O''qish xarajatlari majburiyati', 'Pledge to cover study expenses', '유학경비 부담 서약서', 'Обязательство по оплате расходов на обучение'),
  ('O''zini tanishtirish videosi', 'Self-introduction video', '자기소개 영상', 'Видео-самопрезентация'),
  ('Oila holatiga oid qo''shimcha hujjatlar', 'Additional family status documents', '가족관계 관련 추가 서류', 'Дополнительные документы о семейном положении'),
  ('Oila hujjati', 'Family relation certificate', '가족관계증명서', 'Документ о составе семьи'),
  ('Oila hujjati va pasport nusxasi', 'Family relation certificate and passport copy', '가족관계증명서 및 여권 사본', 'Документ о составе семьи и копия паспорта'),
  ('Oila hujjati yoki tug''ilganlik guvohnomasi', 'Family relation certificate or birth certificate', '가족관계증명서 또는 출생증명서', 'Документ о составе семьи или свидетельство о рождении'),
  ('Oila hujjati, pasport va ota-onaning pasport nusxalari', 'Family relation certificate, passport and parents'' passport copies', '가족관계증명서, 본인 및 부모 여권 사본', 'Документ о составе семьи, копии паспорта и паспортов родителей'),
  ('Oila tarkibi haqida hujjat', 'Family relation certificate', '가족관계증명서', 'Документ о составе семьи'),
  ('Oila va fuqarolik hujjatlari', 'Family relation and nationality documents', '가족관계증명서 및 국적 증빙서류', 'Семейные документы и документы о гражданстве'),
  ('Oilaviy holat o''zgarishi hujjatlari', 'Proof of family status change', '가족관계·국적 변동 증빙서류', 'Документы об изменении семейного положения'),
  ('Oldingi o''qish joyi hujjatlari', 'Documents from previous institution', '이전 학교 수료·재학·성적증명서', 'Документы с предыдущего места учёбы'),
  ('Onlayn ariza formasi (chop etilgan)', 'Online application form (printed)', '온라인 입학원서 (출력본)', 'Онлайн-анкета (распечатанная)'),
  ('Onlayn yuklangan hujjatlarning asl nusxalari', 'Originals of documents uploaded online', '온라인 업로드 서류 원본', 'Оригиналы документов, загруженных онлайн'),
  ('Ota-ona ajrashgani yoki vafoti haqida hujjat', 'Proof of parents'' divorce or death', '부모 이혼 또는 사망 증명서', 'Документ о разводе или смерти родителей'),
  ('Ota-ona fuqaroligi va qarindoshlikni tasdiqlovchi hujjatlar', 'Proof of parents'' nationality and family relationship', '부모 국적 및 가족관계 증명서류', 'Документы о гражданстве родителей и родстве'),
  ('Ota-ona holatiga oid hujjatlar', 'Documents on parents'' status', '부모 관련 서류 (이혼·사망·재혼 등)', 'Документы о статусе родителей'),
  ('Ota-onaning ARC nusxasi', 'Parents'' ARC copies', '부모 외국인등록증 사본', 'Копии ARC родителей'),
  ('Ota-onaning ID yoki pasport nusxalari', 'Parents'' ID or passport copies', '부모 신분증 또는 여권 사본', 'Копии ID-карт или паспортов родителей'),
  ('Ota-onaning fuqaroligini tasdiqlovchi hujjatlar', 'Proof of parents'' nationality', '부모 국적 증명서', 'Документы, подтверждающие гражданство родителей'),
  ('Ota-onaning fuqarolik hujjatlari', 'Parents'' nationality documents', '부모 국적 증빙서류', 'Документы о гражданстве родителей'),
  ('Ota-onaning fuqarolik va qarindoshlik hujjatlari', 'Parents'' nationality and family relation documents', '부모 국적 및 가족관계증명서', 'Документы о гражданстве родителей и родстве'),
  ('Ota-onaning ish joyidan ma''lumotnomasi yoki biznes guvohnomasi', 'Parents'' certificate of employment or business registration', '부모 재직증명서 또는 사업자등록증', 'Справка с места работы родителей или свидетельство о регистрации бизнеса'),
  ('Ota-onaning nikoh yoki ajrashish hujjati', 'Parents'' marriage or divorce certificate', '부모 혼인관계증명서', 'Свидетельство о браке или разводе родителей'),
  ('Ota-onaning pasport nusxalari', 'Parents'' passport copies', '부모 여권 사본', 'Копии паспортов родителей'),
  ('Ota-onaning pasport yoki ID nusxalari', 'Parents'' passport or ID copies', '부모 여권 또는 신분증 사본', 'Копии паспортов или ID-карт родителей'),
  ('Ota-onaning shaxsini tasdiqlovchi hujjatlar', 'Parents'' identity documents', '부모 신분증명서', 'Документы, удостоверяющие личность родителей'),
  ('Oxirgi ta''lim darajasi guvohnomasi', 'Certificate of highest education', '최종학력 증명서', 'Документ о последнем уровне образования'),
  ('Oxirgi ta''lim darajasi haqida guvohnoma', 'Certificate of highest education', '최종학력 증명서', 'Свидетельство о последнем уровне образования'),
  ('Pasport nusxalari', 'Passport copies', '여권 사본', 'Копии паспортов'),
  ('Pasport nusxasi', 'Passport copy', '여권 사본', 'Копия паспорта'),
  ('Pasport nusxasi (ARC bo''lsa — u ham)', 'Passport copy (and ARC, if any)', '여권 사본 (외국인등록증 소지자는 함께 제출)', 'Копия паспорта (и ARC, если есть)'),
  ('Pasport va ARC nusxasi', 'Passport and ARC copies', '여권 사본 및 외국인등록증 사본', 'Копии паспорта и ARC'),
  ('Pasport va ota-onaning ID nusxalari', 'Passport and parents'' ID copies', '본인 여권 및 부모 신분증 사본', 'Копии паспорта и ID-карт родителей'),
  ('Pasport va ota-onaning fuqarolik hujjatlari', 'Passport and parents'' nationality documents', '여권 및 부모 국적 증빙서류', 'Паспорт и документы о гражданстве родителей'),
  ('Pasport yoki milliy ID nusxasi', 'Passport or national ID copy', '여권 또는 신분증 사본', 'Копия паспорта или национального ID'),
  ('Pastor xulosasi va rozilik xati', 'Pastor''s opinion and consent form', '목사 소견서 및 동의서', 'Заключение пастора и письмо-согласие'),
  ('Portfolio', 'Portfolio', '포트폴리오', 'Портфолио'),
  ('Portfolio / ijodiy ishlar (USB va h.k.)', 'Portfolio / creative works (USB, etc.)', '작품집 (포트폴리오, USB 등)', 'Портфолио / творческие работы (USB и т. д.)'),
  ('Portfolio va majburiyat xati', 'Portfolio and pledge', '포트폴리오 및 서약서', 'Портфолио и письменное обязательство'),
  ('Portfolio yoki amaliy imtihon materiallari', 'Portfolio or practical exam materials', '포트폴리오 또는 실기 자료', 'Портфолио или материалы практического экзамена'),
  ('Portfolio yoki ijodiy material', 'Portfolio or creative materials', '포트폴리오 또는 실기 자료', 'Портфолио или творческие материалы'),
  ('Portfolio yoki ijro', 'Portfolio or performance', '포트폴리오 또는 실기', 'Портфолио или исполнение'),
  ('Portfolio yoki ijro materiallari', 'Portfolio or performance materials', '포트폴리오 또는 실기곡 악보', 'Портфолио или материалы для исполнения'),
  ('Portfolio yoki ijro yozuvi', 'Portfolio or performance recording', '포트폴리오 또는 연주 녹음 (CD/USB)', 'Портфолио или запись исполнения'),
  ('Professor tavsiyanomasi', 'Professor''s recommendation letter', '교수 추천서', 'Рекомендация профессора'),
  ('Qarindoshlik hujjati', 'Family relation certificate', '가족관계증명서', 'Документ о родстве'),
  ('Qarindoshlik va fuqarolik hujjati', 'Proof of parenthood and nationality', '가족관계 및 국적 증빙서류', 'Документ о родстве и гражданстве'),
  ('Qarindoshlik yoki tug''ilganlik haqida guvohnoma', 'Family relation certificate or birth certificate', '가족관계증명서 또는 출생증명서', 'Свидетельство о родстве или о рождении'),
  ('Qarindoshlikni tasdiqlovchi hujjat', 'Proof of family relationship', '가족관계증명서', 'Документ, подтверждающий родство'),
  ('Qarindoshlikni tasdiqlovchi hujjatlar', 'Proof of family relationship documents', '가족관계 증빙서류', 'Документы, подтверждающие родство'),
  ('Qo''shimcha ball hujjatlari', 'Documents for bonus points', '가산점 증빙서류', 'Документы для дополнительных баллов'),
  ('Qo''shimcha faoliyat hujjatlari', 'Extracurricular activity documents', '교외 활동 증빙서류', 'Документы о дополнительной деятельности'),
  ('Qo''shimcha hujjatlar', 'Additional documents', '추가 제출서류', 'Дополнительные документы'),
  ('Qo''shimcha materiallar', 'Supplemental materials', '추가 자료', 'Дополнительные материалы'),
  ('Qo''shma dastur shartini tasdiqlash', 'Integrated program eligibility confirmation', '석·박사 통합과정 지원자격 확인서', 'Подтверждение соответствия требованиям интегрированной программы'),
  ('Ro''yxatdan o''tish niyati bayonnomasi (SIR)', 'Statement of Intent to Register (SIR)', '등록 의사 확인서 (SIR)', 'Заявление о намерении зачислиться (SIR)'),
  ('Rozilik xati', 'Letter of consent', '동의서', 'Письмо-согласие'),
  ('Shaxsiy bayonot', 'Personal statement', '자기소개서', 'Личное заявление'),
  ('Shaxsiy bayonot va o''qish rejasi', 'Personal statement and study plan', '자기소개서 및 학업계획서', 'Личное заявление и учебный план'),
  ('Shaxsiy ma''lumotlar varaqasi', 'Personal information sheet', '개인신상기록표', 'Лист личных данных'),
  ('Shaxsiy ma''lumotlardan foydalanishga rozilik', 'Consent to use of personal information', '개인정보 활용 동의서', 'Согласие на использование персональных данных'),
  ('Shaxsiy ma''lumotlarga rozilik', 'Personal information consent form', '개인정보 수집·이용 동의서', 'Согласие на обработку персональных данных'),
  ('Shaxsiy ma''lumotlarga rozilik (Form 6)', 'Personal information consent form (Form 6)', '개인정보 수집·이용 동의서 (서식 6)', 'Согласие на обработку персональных данных (форма 6)'),
  ('Shaxsiy ma''lumotlarni berishga rozilik', 'Consent to release of personal information', '개인정보 제공 동의서', 'Согласие на передачу персональных данных'),
  ('Sil kasalligi tekshiruvi natijasi', 'Tuberculosis test result', '결핵 검사 결과지', 'Результат обследования на туберкулёз'),
  ('So''rovnoma', 'Questionnaire', '설문지', 'Анкета-опросник'),
  ('Sog''liq haqida ma''lumotnoma', 'Health certificate', '건강진단서', 'Медицинская справка'),
  ('Sport faoliyati hujjatlari', 'Sports achievement documents', '체육 경력 및 대회 실적 증빙서류', 'Документы о спортивной деятельности'),
  ('Standart imtihon natijalari', 'Standardized exam scores', '표준화 시험 성적', 'Результаты стандартизированных экзаменов'),
  ('Standart test natijalari', 'Standardized test scores', '표준화 시험 성적', 'Результаты стандартизированных тестов'),
  ('Stipendiya arizasi', 'Scholarship application', '장학금 신청서', 'Заявление на стипендию'),
  ('Stipendiya arizasi va maqola majburiyati', 'Scholarship application and publication pledge', '장학금 신청서 및 논문게재 서약서', 'Заявление на стипендию и обязательство о публикации статьи'),
  ('Stipendiya guvohnomasi', 'Scholarship certificate', '장학금 지급(예정) 증명서', 'Справка о назначении стипендии'),
  ('Stipendiya sertifikati', 'Certificate of scholarship', '장학금 증명서', 'Сертификат о стипендии'),
  ('Stipendiya yoki homiylik xati', 'Scholarship or sponsorship letter', '장학금 또는 후원 증명서', 'Письмо о стипендии или спонсорстве'),
  ('TOPIK ro''yxatdan o''tganlik varaqasi', 'TOPIK registration slip', 'TOPIK 접수증', 'Подтверждение регистрации на TOPIK'),
  ('TOPIK sertifikati', 'TOPIK certificate', 'TOPIK 성적증명서', 'Сертификат TOPIK'),
  ('TOPIK yoki Koreyadagi universitet til kursi sertifikati', 'TOPIK or Korean university language program certificate', 'TOPIK 성적증명서 또는 국내 대학 한국어과정 수료증', 'Сертификат TOPIK или курсов корейского языка при университете в Корее'),
  ('Ta''lim hujjati tasdig''i (apostil yoki konsullik)', 'Academic document authentication (apostille or consular)', '학력인증서류 (아포스티유 또는 영사확인)', 'Легализация документа об образовании (апостиль или консульская)'),
  ('Ta''lim hujjati tasdig''i (apostil)', 'Academic document authentication (apostille)', '학력인증서 (아포스티유)', 'Легализация документа об образовании (апостиль)'),
  ('Ta''lim hujjatini tasdiqlash', 'Academic document verification', '학력인증서', 'Подтверждение документа об образовании'),
  ('Ta''lim hujjatlari', 'Academic documents', '학력 서류', 'Документы об образовании'),
  ('Ta''lim hujjatlarini tekshirishga rozilik', 'Consent for academic record verification', '학력조회 동의서', 'Согласие на проверку документов об образовании'),
  ('Ta''lim ma''lumotlari (Form 2)', 'Education background (Form 2)', '학력사항 (서식 2)', 'Сведения об образовании (форма 2)'),
  ('Ta''lim ma''lumotlariga rozilik (Form 2)', 'Academic records consent form (Form 2)', '학력조회 동의서 (서식 2)', 'Согласие на проверку сведений об образовании (форма 2)'),
  ('Ta''lim ma''lumotlarini tekshirish formalari', 'Academic verification forms', '학력조회 서식', 'Формы проверки сведений об образовании'),
  ('Ta''lim ma''lumotlarini tekshirishga rozilik', 'Consent for academic record verification', '학력조회 동의서', 'Согласие на проверку сведений об образовании'),
  ('Ta''lim va shartlar hisob-kitob jadvali', 'Education and eligibility calculation sheet', '학력 및 지원자격 계산표', 'Расчётная таблица образования и требований'),
  ('Tadqiqot rejasi', 'Research plan', '연구계획서', 'План исследования'),
  ('Talaba pasporti va ota-onaning shaxsini tasdiqlovchi hujjatlar', 'Applicant''s passport and parents'' identity documents', '본인 여권 및 부모 신분증명서', 'Паспорт студента и документы, удостоверяющие личность родителей'),
  ('Talaba va ota-ona munosabatini tasdiqlovchi davlat hujjati', 'Government-issued proof of applicant–parent relationship', '정부 발행 지원자·부모 관계증명서', 'Государственный документ о родстве студента и родителей'),
  ('Talaba va ota-ona qarindoshligini tasdiqlovchi hujjat', 'Proof of applicant–parent relationship', '지원자와 부모의 관계증명서', 'Документ, подтверждающий родство студента и родителей'),
  ('Talaba va ota-onaning ID nusxalari', 'Applicant''s and parents'' ID copies', '지원자 및 부모 신분증 사본', 'Копии ID-карт студента и родителей'),
  ('Talaba va ota-onaning fuqarolik hamda qarindoshlik hujjatlari', 'Applicant''s and parents'' nationality and family relation documents', '지원자 및 부모 국적·가족관계 증명서류', 'Документы о гражданстве и родстве студента и родителей'),
  ('Talaba va ota-onaning fuqarolik hujjatlari', 'Applicant''s and parents'' proof of nationality', '지원자 및 부모 국적 증명서', 'Документы о гражданстве студента и родителей'),
  ('Talaba va ota-onaning pasport nusxalari', 'Applicant''s and parents'' passport copies', '지원자 및 부모 여권 사본', 'Копии паспортов студента и родителей'),
  ('Talaba va ota-onaning pasport va ID nusxalari', 'Applicant''s and parents'' passport and ID copies', '지원자 및 부모 여권·신분증 사본', 'Копии паспортов и ID-карт студента и родителей'),
  ('Talaba va ota-onaning qarindoshlik hujjati', 'Applicant–parent family relation certificate', '지원자와 부모의 가족관계증명서', 'Документ о родстве студента и родителей'),
  ('Talaba va ota-onaning shaxsini tasdiqlovchi hujjatlar', 'Applicant''s and parents'' identity documents', '본인 및 부모 신분증', 'Документы, удостоверяющие личность студента и родителей'),
  ('Talaba, ota va onaning ID nusxalari', 'ID copies of applicant, father and mother', '지원자 및 부·모 신분증 사본', 'Копии ID-карт студента, отца и матери'),
  ('Talabaning fuqaroligini tasdiqlovchi hujjat', 'Applicant''s proof of nationality', '지원자 국적 증명서', 'Документ, подтверждающий гражданство студента'),
  ('Talabaning pasport nusxasi', 'Applicant''s passport copy', '본인 여권 사본', 'Копия паспорта студента'),
  ('Talabaning shaxsini tasdiqlovchi hujjat', 'Applicant''s identity document', '본인 신분증명서', 'Документ, удостоверяющий личность студента'),
  ('Tarjimai hol', 'Personal statement', '자기소개서', 'Автобиография'),
  ('Tarjimai hol (CV)', 'Curriculum vitae (CV)', '이력서 (CV)', 'Резюме (CV)'),
  ('Tarjimai hol va o''qish (tadqiqot) rejasi', 'Personal statement and study (research) plan', '자기소개서 및 수학(연구)계획서', 'Автобиография и план обучения (исследований)'),
  ('Tarjimai hol va o''qish rejasi', 'Personal statement and study plan', '자기소개서 및 학업계획서', 'Автобиография и учебный план'),
  ('Tarjimon tasdiqnomasi + tarjimon diplomi', 'Translator''s confirmation + translator''s diploma', '번역자 확인서 + 번역자 졸업증명서', 'Подтверждение переводчика + диплом переводчика'),
  ('Tashkilot rahbarining tavsiyanomasi', 'Recommendation from head of institution', '소속 기관장 추천서', 'Рекомендация руководителя организации'),
  ('Tashkilot tavsiyanomasi', 'Institutional recommendation letter', '기관 추천서', 'Рекомендация организации'),
  ('Tavsiyanoma', 'Letter of recommendation', '추천서', 'Рекомендательное письмо'),
  ('Tavsiyanomalar', 'Letters of recommendation', '추천서', 'Рекомендательные письма'),
  ('Til hujjati', 'Language proficiency document', '어학능력 증빙서류', 'Документ о знании языка'),
  ('Til hujjatini topshirish va''dasi', 'Pledge to submit language certificate', '어학성적 제출 확약서', 'Обязательство предоставить языковой сертификат'),
  ('Til kursi ma''lumotnomasi va baholari', 'Language program enrollment certificate and transcript', '어학연수 재학(수료)증명서 및 성적증명서', 'Справка о языковых курсах и оценки'),
  ('Til sertifikati', 'Language certificate', '어학성적증명서', 'Языковой сертификат'),
  ('Til sertifikati (TOEIC, TOEFL, IELTS, JLPT, HSK)', 'Language certificate (TOEIC, TOEFL, IELTS, JLPT, HSK)', '공인어학성적증명서 (TOEIC, TOEFL, IELTS, JLPT, HSK)', 'Языковой сертификат (TOEIC, TOEFL, IELTS, JLPT, HSK)'),
  ('Til sertifikati (asl)', 'Language certificate (original)', '어학성적증명서 (원본)', 'Языковой сертификат (оригинал)'),
  ('Transkript', 'Transcript', '성적증명서', 'Выписка оценок'),
  ('Transkript (skan)', 'Transcript (scan)', '성적증명서 (스캔본)', 'Выписка оценок (скан)'),
  ('Transkript(lar)', 'Transcript(s)', '성적증명서', 'Выписка(и) оценок'),
  ('Tug''ilganlik guvohnomasi yoki oila hujjati', 'Birth certificate or family relation certificate', '출생증명서 또는 가족관계증명서', 'Свидетельство о рождении или документ о составе семьи'),
  ('Tug''ilganlik haqida guvohnoma', 'Birth certificate', '출생증명서', 'Свидетельство о рождении'),
  ('Tug''ilganlik haqida guvohnoma (oila hujjati)', 'Birth certificate (family relation certificate)', '출생증명서 (가족관계증명서)', 'Свидетельство о рождении (документ о составе семьи)'),
  ('Tug''ilganlik yoki oila tarkibi haqida guvohnoma', 'Birth certificate or family relation certificate', '출생증명서 또는 가족관계증명서', 'Свидетельство о рождении или о составе семьи'),
  ('Tushuntirish xati va dalillar', 'Explanatory statement and supporting documents', '소명서 및 증빙서류', 'Объяснительное письмо и подтверждающие документы'),
  ('Universitet akkreditatsiyasi tasdig''i', 'University accreditation confirmation', '인가대학 확인서', 'Подтверждение аккредитации университета'),
  ('Ustunliklarni tasdiqlovchi hujjatlar', 'Proof of excellence', '우수성 입증자료', 'Документы, подтверждающие достижения'),
  ('Won-Buddhism jamoasining tavsiyanomasi', 'Recommendation from the Won Buddhism order', '원불교 교단 추천서', 'Рекомендация общины вон-буддизма'),
  ('Yakuniy diplom', 'Final diploma', '최종 졸업증명서', 'Итоговый диплом'),
  ('Yakuniy hujjatlar', 'Final documents', '최종 서류', 'Итоговые документы'),
  ('Yakuniy ta''lim hujjatining asli', 'Original certificate of highest education', '최종학력 증명서 원본', 'Оригинал документа о последнем образовании'),
  ('Yakuniy ta''lim hujjatlari', 'Final academic documents', '최종학력 서류', 'Документы о последнем образовании'),
  ('Yakuniy ta''lim hujjatlari (apostil bilan)', 'Final academic documents (apostilled)', '최종학력 서류 (아포스티유)', 'Документы о последнем образовании (с апостилем)'),
  ('Yashash xarajatlari rejasi', 'Living expenses plan', '체재비 지급신청서', 'План расходов на проживание'),
  ('Yotoqxona arizasi', 'Dormitory application', '기숙사 입사 신청서', 'Заявление на общежитие'),
  ('Yutuqlarni tasdiqlovchi hujjatlar', 'Proof of achievements', '우수 실적 증빙서류', 'Документы, подтверждающие достижения')
on conflict (source) do nothing;

-- Survey texts (title, description, questions, options) on 2026-09-30,
-- translated by hand. Matched on the text with its spacing tidied, and stored
-- under the exact text the survey holds.
insert into public.app_text_translations (source, en, ko, ru)
select distinct s.src, v.en, v.ko, v.ru
  from (values
  ('UNIVERSITETGA ARIZA TOPSHIRISH UCHUN MAXSUS SO''ROVNOMA', 'SPECIAL SURVEY FOR THE UNIVERSITY APPLICATION', '대학 지원을 위한 특별 설문', 'СПЕЦИАЛЬНАЯ АНКЕТА ДЛЯ ПОДАЧИ ЗАЯВЛЕНИЯ В УНИВЕРСИТЕТ'),
  ('Universtet tanlash uchun so''rovnoma', 'Survey for choosing a university', '대학 선택을 위한 설문', 'Анкета для выбора университета'),
  ('Universitetga ariza topshirayotganda shaxsiy ma''lumotlaringiz kerak bo''ladi. Shu sababli shaxsiy ma''lumotlaringizni batafsil va to''g''ri kiritishingiz talab qilinadi.', 'Your personal details are needed for the university application, so please fill them in fully and accurately.', '대학 지원 시 개인정보가 필요합니다. 개인정보를 자세하고 정확하게 입력해 주세요.', 'Для подачи заявления в университет понадобятся ваши личные данные, поэтому заполните их подробно и точно.'),
  ('ushbu so''rovnomani to''ldirganingizdan keyin siz uchun mos keladigan universtetlarni aniqlaymiz va siz bilan birga eng to''g''ri variantlarni tanlab olamiz !', 'Once you fill in this survey, we will find the universities that suit you and choose the best options together with you!', '설문을 작성해 주시면 잘 맞는 대학을 찾아 함께 가장 좋은 선택지를 고르겠습니다!', 'После заполнения анкеты мы подберём подходящие вам университеты и вместе выберем лучшие варианты!'),
  ('2 ta telefon raqamingizni yozing. ( ex: 1. +998901234567 2. +998991234567 )', 'Enter two phone numbers. (e.g. 1. +998901234567 2. +998991234567)', '전화번호 2개를 입력하세요. (예: 1. +998901234567 2. +998991234567)', 'Укажите два номера телефона. (напр.: 1. +998901234567 2. +998991234567)'),
  ('Email manzilingizni yozing. ( ex: hangukuz@gmail.com )', 'Enter your email address. (e.g. hangukuz@gmail.com)', '이메일 주소를 입력하세요. (예: hangukuz@gmail.com)', 'Укажите адрес электронной почты. (напр.: hangukuz@gmail.com)'),
  ('Ingliz tilida uy manzilingizni to''liq yozing. Zip code ham yozilishi talab qilinadi. ( ex: 264-house, Milliy bog street, Barkamol MSG, Mirzo Ulugbek district, Tashkent city, 111221, Uzbekistan. )', 'Enter your full home address in English, including the zip code. (e.g. 264-house, Milliy bog street, Barkamol MSG, Mirzo Ulugbek district, Tashkent city, 111221, Uzbekistan.)', '집 주소를 영어로 우편번호까지 모두 입력하세요. (예: 264-house, Milliy bog street, Barkamol MSG, Mirzo Ulugbek district, Tashkent city, 111221, Uzbekistan.)', 'Укажите полный домашний адрес на английском, включая почтовый индекс. (напр.: 264-house, Milliy bog street, Barkamol MSG, Mirzo Ulugbek district, Tashkent city, 111221, Uzbekistan.)'),
  ('Yotoqxona olasizmi?', 'Will you stay in the dormitory?', '기숙사에 입사하시겠어요?', 'Будете жить в общежитии?'),
  ('Otangizning telefon raqamini yozing. ( ex: 1. +998901234567 )', 'Enter your father''s phone number. (e.g. 1. +998901234567)', '아버지의 전화번호를 입력하세요. (예: 1. +998901234567)', 'Укажите номер телефона отца. (напр.: 1. +998901234567)'),
  ('Otangizning kasbini yozing. Ingliz yoki koreys tilida yozing.', 'Enter your father''s occupation, in English or Korean.', '아버지의 직업을 영어나 한국어로 입력하세요.', 'Укажите профессию отца на английском или корейском.'),
  ('Onangizning telefon raqamini yozing. ( ex: 1. +998901234567 )', 'Enter your mother''s phone number. (e.g. 1. +998901234567)', '어머니의 전화번호를 입력하세요. (예: 1. +998901234567)', 'Укажите номер телефона матери. (напр.: 1. +998901234567)'),
  ('Onangizning kasbini yozing. Ingliz yoki koreys tilida yozing.', 'Enter your mother''s occupation, in English or Korean.', '어머니의 직업을 영어나 한국어로 입력하세요.', 'Укажите профессию матери на английском или корейском.'),
  ('Janubiy koreada asosiy maqsadingiz', 'Your main goal in South Korea', '한국에서의 주된 목표', 'Ваша главная цель в Южной Корее'),
  ('koreada tanishingiz bormi?', 'Do you know anyone in Korea?', '한국에 아는 사람이 있나요?', 'Есть ли у вас знакомые в Корее?'),
  ('o''zingiz tanlagan universtetingiz bormi? ( quyida barchasini yozib o''ting )', 'Do you have universities you have chosen yourself? (list them all below)', '직접 고른 대학이 있나요? (아래에 모두 적어 주세요)', 'Есть ли университеты, которые вы выбрали сами? (перечислите все ниже)'),
  ('Janubiy koreaning aynan qaysidir shahrida o''qishni xoxlaysizmi? agar ha bo''lsa quyida shahar nomini yozib qo''ying !', 'Do you want to study in a particular city in South Korea? If so, write the city below!', '한국의 특정 도시에서 공부하고 싶으신가요? 그렇다면 아래에 도시 이름을 적어 주세요!', 'Хотите учиться в каком-то определённом городе Южной Кореи? Если да, напишите его ниже!'),
  ('Ota onangiz rasmiy daromatga ekami? ( agar ha bo''lsa yiliga taxminan qancha )', 'Do your parents have an official income? (if so, roughly how much per year)', '부모님께서 공식 소득이 있으신가요? (있다면 연간 대략 얼마인지)', 'Есть ли у ваших родителей официальный доход? (если да, примерно сколько в год)'),
  ('Ota onangiz nomida uy joy yoki avtomoshina bormi ?', 'Do your parents own a home or a car in their name?', '부모님 명의의 집이나 자동차가 있나요?', 'Есть ли у ваших родителей жильё или автомобиль в собственности?'),
  ('Oldin Janubiy koreaga o''qishga topshirib ko''rganmisiz', 'Have you applied to study in South Korea before?', '이전에 한국 유학에 지원해 본 적이 있나요?', 'Подавали ли вы раньше документы на учёбу в Южную Корею?'),
  ('Janubiy korea elchixonasiga xujjat topshirib rad javobi olganmisiz?', 'Have you ever been refused after applying at the South Korean embassy?', '한국 대사관에 서류를 제출했다가 거절된 적이 있나요?', 'Получали ли вы отказ после подачи документов в посольство Южной Кореи?'),
  ('HA', 'YES', '예', 'ДА'),
  ('ha', 'yes', '예', 'да'),
  ('YO''Q', 'NO', '아니요', 'НЕТ'),
  ('yo''q', 'no', '아니요', 'нет'),
  ('Ishlash', 'Working', '일', 'Работа'),
  ('O''qish', 'Studying', '공부', 'Учёба'),
  ('ikkalasi ham lekin ishlash ustunroq', 'Both, but mainly working', '둘 다, 하지만 일이 우선', 'И то и другое, но в основном работа'),
  ('ikkalasi ham lekin o''qish ustunroq', 'Both, but mainly studying', '둘 다, 하지만 공부가 우선', 'И то и другое, но в основном учёба')
  ) as v(key, en, ko, ru)
  join (
    select title as src from public.surveys
    union select description from public.surveys
    union select question_text from public.survey_questions
    union select jsonb_array_elements_text(options) from public.survey_questions
     where jsonb_typeof(options) = 'array'
  ) s on regexp_replace(btrim(s.src), '\s+', ' ', 'g') = v.key
on conflict (source) do nothing;
