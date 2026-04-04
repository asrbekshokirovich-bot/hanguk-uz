import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'locales');
const newKeys = {
  en: {
    navigation: {
      communication: "Communication",
      management: "Management",
      finance: "Finance",
      admin: "Admin",
      leads: "Leads",
      liveCall: "Live Call",
      formFinder: "Form Finder",
      aiTranslation: "AI Translation",
      kakaoMap: "Kakao Map",
      overview: "Overview",
      budgets: "Budgets",
      monthly: "Monthly",
      scheduled: "Scheduled",
      transactions: "Transactions",
      distribution: "Distribution",
      bonuses: "Bonuses",
      voiceChat: "Voice Chat",
      voiceChatDesc: "Instant radio communication"
    }
  },
  uz: {
    navigation: {
      communication: "Aloqa",
      management: "Boshqaruv",
      finance: "Moliya",
      admin: "Admin",
      leads: "Lidlar",
      liveCall: "Jonli Qo'ng'iroq",
      formFinder: "Ariza Topish",
      aiTranslation: "AI Tarjima",
      kakaoMap: "Kakao Map",
      overview: "Umumiy",
      budgets: "Budjetlar",
      monthly: "Oylik",
      scheduled: "Rejali",
      transactions: "Tranzaksiyalar",
      distribution: "Taqsimlash",
      bonuses: "Bonuslar",
      voiceChat: "Ovozli aloqa",
      voiceChatDesc: "Tezkor radio aloqa"
    }
  },
  ko: {
    navigation: {
      communication: "의사소통",
      management: "관리",
      finance: "재무",
      admin: "관리자",
      leads: "리드",
      liveCall: "실시간 통화",
      formFinder: "신청서 찾기",
      aiTranslation: "AI 번역",
      kakaoMap: "카카오 맵",
      overview: "개요",
      budgets: "예산",
      monthly: "월별",
      scheduled: "예약됨",
      transactions: "거래",
      distribution: "분배",
      bonuses: "보너스",
      voiceChat: "음성 채팅",
      voiceChatDesc: "즉각적인 무전기 통신"
    }
  },
  ru: {
    navigation: {
      communication: "Связь",
      management: "Управление",
      finance: "Финансы",
      admin: "Админ",
      leads: "Лиды",
      liveCall: "Живой звонок",
      formFinder: "Поиск форм",
      aiTranslation: "AI перевод",
      kakaoMap: "Kakao Map",
      overview: "Обзор",
      budgets: "Бюджеты",
      monthly: "Ежемесячно",
      scheduled: "Запланировано",
      transactions: "Транзакции",
      distribution: "Распределение",
      bonuses: "Бонусы",
      voiceChat: "Голосовой чат",
      voiceChatDesc: "Мгновенная радиосвязь"
    }
  }
};

for (const [lang, translations] of Object.entries(newKeys)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${lang}, file not found.`);
    continue;
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!content.navigation) content.navigation = {};
  
  for (const [key, value] of Object.entries(translations.navigation)) {
    content.navigation[key] = value;
  }
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`Updated ${lang}.json`);
}
