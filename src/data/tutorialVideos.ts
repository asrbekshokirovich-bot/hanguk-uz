export interface TutorialVideo {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  youtubeId: string;
  duration: string;
  category: 'introduction' | 'structure' | 'grammar' | 'examples' | 'tips';
  documentType: 'study_plan' | 'personal_statement' | 'both';
  language: string;
  subtitles: string[];
  order: number;
}

export const tutorialVideos: TutorialVideo[] = [
  // Study Plan Videos
  {
    id: 'intro_study_plan',
    title: {
      en: 'What is a Study Plan?',
      uz: 'O\'qish rejasi nima?',
      ru: 'Что такое учебный план?',
      ko: '학업 계획서란 무엇인가?',
    },
    description: {
      en: 'Learn the basics of what a study plan is and why Korean universities require it.',
      uz: 'O\'qish rejasi nima va nima uchun Koreya universitetlari uni talab qilishini bilib oling.',
      ru: 'Узнайте основы того, что такое учебный план и почему корейские университеты его требуют.',
      ko: '학업 계획서가 무엇인지, 왜 한국 대학들이 요구하는지 기본을 배웁니다.',
    },
    youtubeId: 'placeholder_1', // Replace with actual video IDs
    duration: '5:30',
    category: 'introduction',
    documentType: 'study_plan',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 1,
  },
  {
    id: 'structure_study_plan',
    title: {
      en: 'How to Structure Your Study Plan',
      uz: 'O\'qish rejangizni qanday tuzish kerak',
      ru: 'Как структурировать ваш учебный план',
      ko: '학업 계획서 구조 만들기',
    },
    description: {
      en: 'Learn the essential sections every study plan should include.',
      uz: 'Har bir o\'qish rejasida bo\'lishi kerak bo\'lgan asosiy bo\'limlarni o\'rganing.',
      ru: 'Узнайте, какие разделы должен содержать каждый учебный план.',
      ko: '모든 학업 계획서에 포함되어야 할 필수 섹션을 배웁니다.',
    },
    youtubeId: 'placeholder_2',
    duration: '8:15',
    category: 'structure',
    documentType: 'study_plan',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 2,
  },
  {
    id: 'why_korea_section',
    title: {
      en: 'Writing the "Why Korea" Section',
      uz: '"Nega Koreya" bo\'limini yozish',
      ru: 'Написание раздела "Почему Корея"',
      ko: '"왜 한국인가" 섹션 작성하기',
    },
    description: {
      en: 'Tips for explaining your motivation for studying in Korea authentically.',
      uz: 'Koreyada o\'qishga bo\'lgan motivatsiyangizni haqiqiy tarzda tushuntirish bo\'yicha maslahatlar.',
      ru: 'Советы по объяснению вашей мотивации учиться в Корее.',
      ko: '한국 유학 동기를 진정성 있게 설명하는 팁.',
    },
    youtubeId: 'placeholder_3',
    duration: '6:45',
    category: 'tips',
    documentType: 'study_plan',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 3,
  },
  {
    id: 'academic_writing_basics',
    title: {
      en: 'Academic Writing Basics',
      uz: 'Akademik yozuv asoslari',
      ru: 'Основы академического письма',
      ko: '학술 작문 기초',
    },
    description: {
      en: 'Learn formal tone, sentence structure, and vocabulary for academic documents.',
      uz: 'Akademik hujjatlar uchun rasmiy ohang, gap tuzilishi va lug\'atni o\'rganing.',
      ru: 'Изучите формальный тон, структуру предложений и лексику для академических документов.',
      ko: '학술 문서를 위한 격식체, 문장 구조, 어휘를 배웁니다.',
    },
    youtubeId: 'placeholder_4',
    duration: '10:00',
    category: 'grammar',
    documentType: 'both',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 4,
  },
  {
    id: 'study_plan_example',
    title: {
      en: 'Study Plan Example Walkthrough',
      uz: 'O\'qish rejasi namunasi tahlili',
      ru: 'Разбор примера учебного плана',
      ko: '학업 계획서 예시 분석',
    },
    description: {
      en: 'Watch a detailed analysis of a successful study plan.',
      uz: 'Muvaffaqiyatli o\'qish rejasining batafsil tahlilini tomosha qiling.',
      ru: 'Посмотрите подробный анализ успешного учебного плана.',
      ko: '성공적인 학업 계획서의 상세 분석을 시청하세요.',
    },
    youtubeId: 'placeholder_5',
    duration: '12:30',
    category: 'examples',
    documentType: 'study_plan',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 5,
  },

  // Personal Statement Videos
  {
    id: 'intro_personal_statement',
    title: {
      en: 'Understanding Personal Statements',
      uz: 'Shaxsiy bayonotni tushunish',
      ru: 'Понимание личного заявления',
      ko: '자기소개서 이해하기',
    },
    description: {
      en: 'Learn what makes a personal statement different from a study plan.',
      uz: 'Shaxsiy bayonotni o\'qish rejasidan nimasi farq qilishini bilib oling.',
      ru: 'Узнайте, чем личное заявление отличается от учебного плана.',
      ko: '자기소개서가 학업 계획서와 어떻게 다른지 배웁니다.',
    },
    youtubeId: 'placeholder_6',
    duration: '6:00',
    category: 'introduction',
    documentType: 'personal_statement',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 1,
  },
  {
    id: 'telling_your_story',
    title: {
      en: 'Telling Your Unique Story',
      uz: 'O\'zingizning noyob hikoyangizni aytish',
      ru: 'Расскажите свою уникальную историю',
      ko: '나만의 이야기 들려주기',
    },
    description: {
      en: 'How to craft a compelling narrative about your background and experiences.',
      uz: 'O\'tmisingiz va tajribalaringiz haqida qiziqarli hikoya yaratish.',
      ru: 'Как создать убедительную историю о вашем прошлом и опыте.',
      ko: '배경과 경험에 대한 설득력 있는 이야기 만들기.',
    },
    youtubeId: 'placeholder_7',
    duration: '9:00',
    category: 'tips',
    documentType: 'personal_statement',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 2,
  },

  // Korean Language Videos
  {
    id: 'korean_study_plan_intro',
    title: {
      en: 'Writing Study Plan in Korean',
      uz: 'Koreys tilida o\'qish rejasini yozish',
      ru: 'Написание учебного плана на корейском',
      ko: '한국어로 학업 계획서 작성하기',
    },
    description: {
      en: 'Tips for students writing their documents in Korean language.',
      uz: 'Hujjatlarini koreys tilida yozayotgan talabalar uchun maslahatlar.',
      ru: 'Советы для студентов, пишущих документы на корейском языке.',
      ko: '한국어로 문서를 작성하는 학생들을 위한 팁.',
    },
    youtubeId: 'placeholder_8',
    duration: '11:00',
    category: 'grammar',
    documentType: 'both',
    language: 'ko',
    subtitles: ['ko', 'en'],
    order: 10,
  },
  {
    id: 'common_mistakes',
    title: {
      en: 'Common Mistakes to Avoid',
      uz: 'Oldini olish kerak bo\'lgan keng tarqalgan xatolar',
      ru: 'Распространенные ошибки, которых следует избегать',
      ko: '피해야 할 일반적인 실수들',
    },
    description: {
      en: 'Learn about the most common errors applicants make and how to avoid them.',
      uz: 'Ariza beruvchilar yo\'l qo\'yadigan eng keng tarqalgan xatolar va ulardan qanday qochish kerakligini bilib oling.',
      ru: 'Узнайте о наиболее распространенных ошибках заявителей и как их избежать.',
      ko: '지원자들이 하는 가장 흔한 실수와 이를 피하는 방법을 배웁니다.',
    },
    youtubeId: 'placeholder_9',
    duration: '7:30',
    category: 'tips',
    documentType: 'both',
    language: 'en',
    subtitles: ['en', 'ko', 'uz', 'ru'],
    order: 11,
  },
];

export function getVideosByDocumentType(
  documentType: 'study_plan' | 'personal_statement'
): TutorialVideo[] {
  return tutorialVideos
    .filter(v => v.documentType === documentType || v.documentType === 'both')
    .sort((a, b) => a.order - b.order);
}

export function getVideosByCategory(category: TutorialVideo['category']): TutorialVideo[] {
  return tutorialVideos
    .filter(v => v.category === category)
    .sort((a, b) => a.order - b.order);
}

export function getVideosByLanguage(language: string): TutorialVideo[] {
  return tutorialVideos
    .filter(v => v.language === language || v.subtitles.includes(language))
    .sort((a, b) => a.order - b.order);
}
