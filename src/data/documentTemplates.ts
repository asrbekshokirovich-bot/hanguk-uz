export interface TemplatePrompt {
  id: string;
  label: Record<string, string>;
  placeholder: Record<string, string>;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  required?: boolean;
}

export interface TemplateSection {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  prompts: TemplatePrompt[];
  outputTemplate: Record<string, string>;
}

export interface DocumentTemplate {
  id: string;
  name: Record<string, string>;
  documentType: 'study_plan' | 'personal_statement';
  language: 'en' | 'ko';
  style: 'formal' | 'creative' | 'concise';
  sections: TemplateSection[];
}

export const studyPlanTemplates: DocumentTemplate[] = [
  {
    id: 'study_plan_formal_en',
    name: {
      en: 'Formal Study Plan',
      uz: 'Rasmiy o\'qish rejasi',
      ru: 'Формальный учебный план',
      ko: '공식 학업 계획서',
    },
    documentType: 'study_plan',
    language: 'en',
    style: 'formal',
    sections: [
      {
        id: 'introduction',
        title: { en: 'Introduction', uz: 'Kirish', ru: 'Введение', ko: '소개' },
        description: { 
          en: 'Briefly introduce yourself', 
          uz: 'O\'zingizni qisqacha tanishtiring',
          ru: 'Кратко представьтесь',
          ko: '자기소개를 해주세요'
        },
        prompts: [
          {
            id: 'name',
            label: { en: 'Your Name', uz: 'Ismingiz', ru: 'Ваше имя', ko: '이름' },
            placeholder: { en: 'Enter your full name', uz: 'To\'liq ismingizni kiriting', ru: 'Введите полное имя', ko: '성함을 입력하세요' },
            type: 'text',
            required: true,
          },
          {
            id: 'country',
            label: { en: 'Country', uz: 'Davlat', ru: 'Страна', ko: '국가' },
            placeholder: { en: 'e.g., Uzbekistan', uz: 'masalan, O\'zbekiston', ru: 'например, Узбекистан', ko: '예: 우즈베키스탄' },
            type: 'text',
            required: true,
          },
          {
            id: 'education',
            label: { en: 'Current/Previous Education', uz: 'Joriy/Oldingi ta\'lim', ru: 'Текущее/предыдущее образование', ko: '현재/이전 학력' },
            placeholder: { en: 'e.g., Bachelor in Economics from Tashkent University', uz: 'masalan, Toshkent universitetida iqtisodiyot bakalavri', ru: 'например, бакалавр экономики Ташкентского университета', ko: '예: 타슈켄트 대학교 경제학 학사' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: 'My name is {name}, and I am from {country}. {education}. I am writing this study plan to express my sincere interest in pursuing my academic goals in South Korea.',
          ko: '저는 {country}에서 온 {name}입니다. {education}. 한국에서 학업 목표를 이루고자 하는 진심어린 관심을 표현하기 위해 이 학업 계획서를 작성합니다.',
        },
      },
      {
        id: 'why_korea',
        title: { en: 'Why Korea', uz: 'Nega Koreya', ru: 'Почему Корея', ko: '왜 한국인가' },
        description: { 
          en: 'Explain your motivation for studying in Korea', 
          uz: 'Koreyada o\'qish sababingizni tushuntiring',
          ru: 'Объясните вашу мотивацию учиться в Корее',
          ko: '한국 유학 동기를 설명하세요'
        },
        prompts: [
          {
            id: 'interest_origin',
            label: { en: 'How did you become interested in Korea?', uz: 'Koreyaga qiziqish qanday paydo bo\'ldi?', ru: 'Как вы заинтересовались Кореей?', ko: '어떻게 한국에 관심을 갖게 되었나요?' },
            placeholder: { en: 'e.g., Through K-pop, Korean films, or academic interest', uz: 'masalan, K-pop, koreya filmlari yoki akademik qiziqish orqali', ru: 'например, через K-pop, корейские фильмы или академический интерес', ko: '예: K-pop, 한국 영화, 또는 학문적 관심을 통해' },
            type: 'textarea',
            required: true,
          },
          {
            id: 'korea_strengths',
            label: { en: 'What attracts you to Korea\'s education system?', uz: 'Koreya ta\'lim tizimida sizni nima jalb qiladi?', ru: 'Что привлекает вас в образовательной системе Кореи?', ko: '한국 교육 시스템의 어떤 점이 매력적인가요?' },
            placeholder: { en: 'e.g., Advanced technology, research facilities, global reputation', uz: 'masalan, Ilg\'or texnologiya, tadqiqot imkoniyatlari, jahon obro\'si', ru: 'например, передовые технологии, исследовательские возможности, мировая репутация', ko: '예: 첨단 기술, 연구 시설, 세계적 명성' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: 'My interest in South Korea began through {interest_origin}. I am particularly drawn to Korea because {korea_strengths}. The country\'s rapid development and commitment to innovation align perfectly with my academic aspirations.',
          ko: '저의 한국에 대한 관심은 {interest_origin}을(를) 통해 시작되었습니다. 특히 {korea_strengths} 때문에 한국에 끌립니다. 한국의 빠른 발전과 혁신에 대한 헌신은 저의 학문적 열망과 완벽하게 일치합니다.',
        },
      },
      {
        id: 'why_university',
        title: { en: 'Why This University', uz: 'Nega bu universitet', ru: 'Почему этот университет', ko: '왜 이 대학교인가' },
        description: { 
          en: 'Explain why you chose this specific university', 
          uz: 'Ushbu universitetni tanlash sababingizni tushuntiring',
          ru: 'Объясните, почему вы выбрали этот университет',
          ko: '이 대학교를 선택한 이유를 설명하세요'
        },
        prompts: [
          {
            id: 'university_name',
            label: { en: 'University Name', uz: 'Universitet nomi', ru: 'Название университета', ko: '대학교 이름' },
            placeholder: { en: 'e.g., Korea University', uz: 'masalan, Koreya universiteti', ru: 'например, Университет Корё', ko: '예: 고려대학교' },
            type: 'text',
            required: true,
          },
          {
            id: 'program',
            label: { en: 'Desired Program/Major', uz: 'Kerakli dastur/mutaxassislik', ru: 'Желаемая программа/специальность', ko: '희망 프로그램/전공' },
            placeholder: { en: 'e.g., International Business, Computer Science', uz: 'masalan, Xalqaro biznes, Kompyuter fanlari', ru: 'например, Международный бизнес, Компьютерные науки', ko: '예: 국제 비즈니스, 컴퓨터 과학' },
            type: 'text',
            required: true,
          },
          {
            id: 'specific_reason',
            label: { en: 'Specific reasons for choosing this university', uz: 'Ushbu universitetni tanlash uchun aniq sabablar', ru: 'Конкретные причины выбора этого университета', ko: '이 대학교를 선택한 구체적인 이유' },
            placeholder: { en: 'e.g., Renowned professors, specific research centers, exchange programs', uz: 'masalan, Mashhur professorlar, maxsus tadqiqot markazlari, almashinuv dasturlari', ru: 'например, известные профессора, исследовательские центры, программы обмена', ko: '예: 유명한 교수진, 특정 연구 센터, 교환 프로그램' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: 'I have chosen {university_name} specifically because {specific_reason}. The {program} program at this university is renowned for its excellence and will provide me with the knowledge and skills I need to achieve my goals.',
          ko: '저는 {specific_reason} 때문에 특별히 {university_name}을(를) 선택했습니다. 이 대학교의 {program} 프로그램은 우수성으로 유명하며, 목표 달성에 필요한 지식과 기술을 제공해 줄 것입니다.',
        },
      },
      {
        id: 'study_goals',
        title: { en: 'Study Goals', uz: 'O\'qish maqsadlari', ru: 'Цели обучения', ko: '학업 목표' },
        description: { 
          en: 'Describe your academic objectives', 
          uz: 'Akademik maqsadlaringizni tavsiflang',
          ru: 'Опишите ваши академические цели',
          ko: '학업 목표를 설명하세요'
        },
        prompts: [
          {
            id: 'short_term',
            label: { en: 'Short-term goals (during studies)', uz: 'Qisqa muddatli maqsadlar (o\'qish davomida)', ru: 'Краткосрочные цели (во время учебы)', ko: '단기 목표 (학업 중)' },
            placeholder: { en: 'e.g., Master the Korean language, participate in research projects', uz: 'masalan, Koreys tilini o\'zlashtirish, tadqiqot loyihalarida ishtirok etish', ru: 'например, освоить корейский язык, участвовать в исследовательских проектах', ko: '예: 한국어 습득, 연구 프로젝트 참여' },
            type: 'textarea',
            required: true,
          },
          {
            id: 'long_term',
            label: { en: 'Long-term academic goals', uz: 'Uzoq muddatli akademik maqsadlar', ru: 'Долгосрочные академические цели', ko: '장기 학업 목표' },
            placeholder: { en: 'e.g., Pursue a master\'s degree, contribute to academic research', uz: 'masalan, Magistratura olish, akademik tadqiqotlarga hissa qo\'shish', ru: 'например, получить степень магистра, внести вклад в исследования', ko: '예: 석사 학위 취득, 학술 연구에 기여' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: 'During my studies, my short-term goals include {short_term}. Looking further ahead, {long_term}. I am committed to making the most of every opportunity this program offers.',
          ko: '학업 중 저의 단기 목표는 {short_term}입니다. 더 나아가, {long_term}. 이 프로그램이 제공하는 모든 기회를 최대한 활용할 것입니다.',
        },
      },
      {
        id: 'career_plans',
        title: { en: 'Career Plans', uz: 'Karyera rejalari', ru: 'Карьерные планы', ko: '진로 계획' },
        description: { 
          en: 'Describe your future career aspirations', 
          uz: 'Kelajakdagi karyera rejalaringizni tavsiflang',
          ru: 'Опишите ваши карьерные устремления',
          ko: '미래 진로 목표를 설명하세요'
        },
        prompts: [
          {
            id: 'career_goal',
            label: { en: 'What career do you aspire to?', uz: 'Qanday karyerani istaysiz?', ru: 'Какую карьеру вы хотите построить?', ko: '어떤 직업을 원하시나요?' },
            placeholder: { en: 'e.g., Become a software engineer, start my own business', uz: 'masalan, Dasturiy ta\'minot muhandisi bo\'lish, o\'z biznesimni boshlash', ru: 'например, стать инженером-программистом, открыть свой бизнес', ko: '예: 소프트웨어 엔지니어가 되다, 창업하다' },
            type: 'textarea',
            required: true,
          },
          {
            id: 'contribution',
            label: { en: 'How will you contribute to your country?', uz: 'Vatani uchun qanday hissa qo\'shasiz?', ru: 'Как вы будете вносить вклад в развитие своей страны?', ko: '조국에 어떻게 기여하시겠습니까?' },
            placeholder: { en: 'e.g., Apply knowledge to develop local industry, train others', uz: 'masalan, Mahalliy sanoatni rivojlantirish uchun bilimlarni qo\'llash', ru: 'например, применять знания для развития местной промышленности', ko: '예: 지역 산업 발전에 지식 적용, 다른 사람들 교육' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: 'After completing my studies, I aspire to {career_goal}. I believe the education I receive in Korea will enable me to {contribution}, thereby bridging the gap between our countries.',
          ko: '학업을 마친 후, 저는 {career_goal}을(를) 목표로 합니다. 한국에서 받는 교육을 통해 {contribution}할 수 있을 것이며, 이를 통해 양국 간의 격차를 좁힐 수 있을 것입니다.',
        },
      },
      {
        id: 'conclusion',
        title: { en: 'Conclusion', uz: 'Xulosa', ru: 'Заключение', ko: '결론' },
        description: { 
          en: 'Summarize and express gratitude', 
          uz: 'Xulosa qiling va minnatdorchilik bildiring',
          ru: 'Подведите итог и выразите благодарность',
          ko: '요약하고 감사를 표하세요'
        },
        prompts: [
          {
            id: 'closing',
            label: { en: 'Final thoughts', uz: 'Yakuniy fikrlar', ru: 'Заключительные мысли', ko: '마무리 말씀' },
            placeholder: { en: 'Express your commitment and gratitude', uz: 'O\'z sadoqatingiz va minnatdorchiligingizni bildiring', ru: 'Выразите свою преданность и благодарность', ko: '헌신과 감사를 표현하세요' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: 'In conclusion, {closing}. I am deeply grateful for the opportunity to submit this study plan and sincerely hope for your favorable consideration.',
          ko: '결론적으로, {closing}. 이 학업 계획서를 제출할 수 있는 기회에 깊이 감사드리며, 긍정적인 검토를 부탁드립니다.',
        },
      },
    ],
  },
];

export const personalStatementTemplates: DocumentTemplate[] = [
  {
    id: 'personal_statement_formal_en',
    name: {
      en: 'Formal Personal Statement',
      uz: 'Rasmiy shaxsiy bayonot',
      ru: 'Формальное личное заявление',
      ko: '공식 자기소개서',
    },
    documentType: 'personal_statement',
    language: 'en',
    style: 'formal',
    sections: [
      {
        id: 'background',
        title: { en: 'Personal Background', uz: 'Shaxsiy ma\'lumot', ru: 'Личная информация', ko: '개인 배경' },
        description: { 
          en: 'Share your personal story', 
          uz: 'Shaxsiy hikoyangizni baham ko\'ring',
          ru: 'Поделитесь своей личной историей',
          ko: '개인적인 이야기를 공유하세요'
        },
        prompts: [
          {
            id: 'upbringing',
            label: { en: 'Tell us about your upbringing', uz: 'Tarbiyangiz haqida ayting', ru: 'Расскажите о своем воспитании', ko: '성장 과정에 대해 알려주세요' },
            placeholder: { en: 'Where did you grow up? What shaped your character?', uz: 'Qayerda o\'sdingiz? Xarakteringizni nima shakllantirdi?', ru: 'Где вы выросли? Что сформировало ваш характер?', ko: '어디서 자랐나요? 무엇이 성격을 형성했나요?' },
            type: 'textarea',
            required: true,
          },
          {
            id: 'defining_moment',
            label: { en: 'A defining moment in your life', uz: 'Hayotingizdagi muhim lahza', ru: 'Определяющий момент в вашей жизни', ko: '인생의 결정적인 순간' },
            placeholder: { en: 'An experience that changed your perspective', uz: 'Qarashingizni o\'zgartirgan tajriba', ru: 'Опыт, изменивший ваши взгляды', ko: '관점을 바꾼 경험' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: '{upbringing} This background has profoundly influenced who I am today. A particularly defining moment was when {defining_moment}.',
          ko: '{upbringing} 이러한 배경은 오늘날의 저에게 큰 영향을 미쳤습니다. 특히 결정적인 순간은 {defining_moment}였습니다.',
        },
      },
      {
        id: 'motivation',
        title: { en: 'Motivation & Passion', uz: 'Motivatsiya va ishtiyoq', ru: 'Мотивация и страсть', ko: '동기와 열정' },
        description: { 
          en: 'What drives you?', 
          uz: 'Sizni nima harakatga keltiradi?',
          ru: 'Что вами движет?',
          ko: '무엇이 당신을 움직이게 하나요?'
        },
        prompts: [
          {
            id: 'passion',
            label: { en: 'What are you passionate about?', uz: 'Nimaga qiziqasiz?', ru: 'Чем вы увлечены?', ko: '무엇에 열정을 가지고 있나요?' },
            placeholder: { en: 'Describe your passions and interests', uz: 'Qiziqishlaringiz va ishtiyoqlaringizni tasvirlang', ru: 'Опишите ваши увлечения и интересы', ko: '열정과 관심사를 설명하세요' },
            type: 'textarea',
            required: true,
          },
          {
            id: 'why_this_field',
            label: { en: 'Why this field of study?', uz: 'Nega bu soha?', ru: 'Почему эта область обучения?', ko: '왜 이 분야인가요?' },
            placeholder: { en: 'What draws you to this academic field?', uz: 'Sizni bu akademik sohaga nima jalb qiladi?', ru: 'Что привлекает вас в этой академической области?', ko: '이 학문 분야에 끌리는 이유는?' },
            type: 'textarea',
            required: true,
          },
        ],
        outputTemplate: {
          en: 'I am deeply passionate about {passion}. This passion naturally led me to pursue studies in this field because {why_this_field}.',
          ko: '저는 {passion}에 깊은 열정을 가지고 있습니다. 이 열정은 자연스럽게 {why_this_field} 때문에 이 분야의 학업을 추구하게 했습니다.',
        },
      },
    ],
  },
];

export function getTemplatesByType(documentType: 'study_plan' | 'personal_statement'): DocumentTemplate[] {
  return documentType === 'study_plan' ? studyPlanTemplates : personalStatementTemplates;
}

export function generateDocumentFromTemplate(
  template: DocumentTemplate,
  values: Record<string, Record<string, string>>,
  language: 'en' | 'ko' = 'en'
): string {
  const paragraphs: string[] = [];

  template.sections.forEach(section => {
    let output = section.outputTemplate[language] || section.outputTemplate.en;
    
    const sectionValues = values[section.id] || {};
    section.prompts.forEach(prompt => {
      const value = sectionValues[prompt.id] || '';
      output = output.replace(new RegExp(`\\{${prompt.id}\\}`, 'g'), value);
    });

    if (output.trim()) {
      paragraphs.push(output);
    }
  });

  return paragraphs.join('\n\n');
}
