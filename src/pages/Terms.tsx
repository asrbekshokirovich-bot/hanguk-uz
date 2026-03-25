import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NativeContainer } from '@/components/native/NativeContainer';

export default function Terms() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;

  const content = {
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last Updated: January 2025',
      intro: 'Welcome to Hanguk Consulting. By using our mobile application and services, you agree to these Terms of Service. Please read them carefully.',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content: 'By accessing or using our services, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use our services.'
        },
        {
          title: '2. Description of Services',
          content: `Hanguk Consulting provides:
• University application assistance for South Korean institutions
• Document preparation and review services
• Interview preparation and coaching
• Translation services for academic documents
• Student portal for tracking applications`
        },
        {
          title: '3. User Responsibilities',
          content: `You agree to:
• Provide accurate and complete information
• Maintain the confidentiality of your account
• Not share your login credentials with others
• Use the service only for lawful purposes
• Not upload false or misleading documents`
        },
        {
          title: '4. Payment Terms',
          content: 'Services are provided based on your selected payment plan. All fees are non-refundable unless otherwise specified in writing. Payment schedules and amounts are agreed upon at the time of contract signing.'
        },
        {
          title: '5. Intellectual Property',
          content: 'All content, features, and functionality of our application are owned by Hanguk Consulting and are protected by international copyright, trademark, and other intellectual property laws.'
        },
        {
          title: '6. Limitation of Liability',
          content: 'Hanguk Consulting is not responsible for university admission decisions. We provide guidance and support services but cannot guarantee admission outcomes. Our liability is limited to the fees paid for services.'
        },
        {
          title: '7. Termination',
          content: 'We may terminate or suspend your account at any time for violation of these Terms. You may also terminate your account by contacting our support team.'
        },
        {
          title: '8. Changes to Terms',
          content: 'We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. Your continued use of the service constitutes acceptance of modified Terms.'
        },
        {
          title: '9. Contact Information',
          content: 'For questions about these Terms, contact us at support@hanguk.consulting'
        }
      ]
    },
    uz: {
      title: 'Foydalanish shartlari',
      lastUpdated: 'Oxirgi yangilanish: 2025-yil yanvar',
      intro: 'Hanguk Consulting\'ga xush kelibsiz. Mobil ilovamiz va xizmatlarimizdan foydalanib, siz ushbu Foydalanish shartlariga rozilik bildirasiz. Iltimos, ularni diqqat bilan o\'qing.',
      sections: [
        {
          title: '1. Shartlarni qabul qilish',
          content: 'Xizmatlarimizga kirish yoki ulardan foydalanish orqali siz ushbu Shartlar bilan bog\'lanishga rozilik bildirasiz. Agar siz ushbu Shartlarga rozi bo\'lmasangiz, xizmatlarimizdan foydalana olmaysiz.'
        },
        {
          title: '2. Xizmatlar tavsifi',
          content: `Hanguk Consulting quyidagilarni taqdim etadi:
• Janubiy Koreya universitetlariga ariza berishda yordam
• Hujjatlarni tayyorlash va ko'rib chiqish xizmatlari
• Intervyuga tayyorgarlik va murabbiylik
• Akademik hujjatlarni tarjima qilish xizmatlari
• Arizalarni kuzatish uchun talabalar portali`
        },
        {
          title: '3. Foydalanuvchi mas\'uliyati',
          content: `Siz quyidagilarga rozilik bildirasiz:
• Aniq va to'liq ma'lumot berish
• Hisobingizning maxfiyligini saqlash
• Login ma'lumotlaringizni boshqalar bilan almashmaslik
• Xizmatdan faqat qonuniy maqsadlarda foydalanish
• Yolg'on yoki chalg'ituvchi hujjatlarni yuklamaslik`
        },
        {
          title: '4. To\'lov shartlari',
          content: 'Xizmatlar tanlangan to\'lov rejangiz asosida taqdim etiladi. Barcha to\'lovlar yozma ravishda boshqacha ko\'rsatilmagan bo\'lsa, qaytarilmaydi. To\'lov jadvallari va miqdorlari shartnoma imzolash vaqtida kelishiladi.'
        },
        {
          title: '5. Intellektual mulk',
          content: 'Ilovamizning barcha kontenti, xususiyatlari va funksiyalari Hanguk Consulting\'ga tegishli va xalqaro mualliflik huquqi, savdo belgisi va boshqa intellektual mulk qonunlari bilan himoyalangan.'
        },
        {
          title: '6. Javobgarlikni cheklash',
          content: 'Hanguk Consulting universitetga qabul qilish qarorlari uchun javobgar emas. Biz yo\'l-yo\'riq va qo\'llab-quvvatlash xizmatlarini taqdim etamiz, lekin qabul natijalariga kafolat bera olmaymiz.'
        },
        {
          title: '7. Tugatish',
          content: 'Ushbu Shartlarni buzganlik uchun hisobingizni istalgan vaqtda to\'xtatishimiz yoki bekor qilishimiz mumkin. Siz ham qo\'llab-quvvatlash guruhimiz bilan bog\'lanib hisobingizni bekor qilishingiz mumkin.'
        },
        {
          title: '8. Shartlardagi o\'zgarishlar',
          content: 'Ushbu Shartlarni istalgan vaqtda o\'zgartirishga haqlimiz. O\'zgarishlar e\'lon qilinganidan so\'ng darhol kuchga kiradi. Xizmatdan foydalanishni davom ettirishingiz o\'zgartirilgan Shartlarni qabul qilganingizni bildiradi.'
        },
        {
          title: '9. Aloqa ma\'lumotlari',
          content: 'Ushbu Shartlar bo\'yicha savollar uchun biz bilan bog\'laning: support@hanguk.consulting'
        }
      ]
    },
    ru: {
      title: 'Условия использования',
      lastUpdated: 'Последнее обновление: Январь 2025',
      intro: 'Добро пожаловать в Hanguk Consulting. Используя наше мобильное приложение и услуги, вы соглашаетесь с настоящими Условиями использования. Пожалуйста, внимательно прочитайте их.',
      sections: [
        {
          title: '1. Принятие условий',
          content: 'Получая доступ к нашим услугам или используя их, вы соглашаетесь соблюдать настоящие Условия. Если вы не согласны с этими Условиями, вы не можете использовать наши услуги.'
        },
        {
          title: '2. Описание услуг',
          content: `Hanguk Consulting предоставляет:
• Помощь в подаче заявок в университеты Южной Кореи
• Услуги по подготовке и проверке документов
• Подготовка к собеседованию и коучинг
• Услуги перевода академических документов
• Студенческий портал для отслеживания заявок`
        },
        {
          title: '3. Обязанности пользователя',
          content: `Вы соглашаетесь:
• Предоставлять точную и полную информацию
• Сохранять конфиденциальность своей учётной записи
• Не передавать свои учётные данные другим
• Использовать сервис только в законных целях
• Не загружать ложные или вводящие в заблуждение документы`
        },
        {
          title: '4. Условия оплаты',
          content: 'Услуги предоставляются в соответствии с выбранным планом оплаты. Все платежи не подлежат возврату, если иное не указано в письменной форме. Графики и суммы платежей согласовываются при подписании договора.'
        },
        {
          title: '5. Интеллектуальная собственность',
          content: 'Весь контент, функции и функциональность нашего приложения принадлежат Hanguk Consulting и защищены международными законами об авторском праве, товарных знаках и интеллектуальной собственности.'
        },
        {
          title: '6. Ограничение ответственности',
          content: 'Hanguk Consulting не несёт ответственности за решения о приёме в университет. Мы предоставляем консультации и поддержку, но не можем гарантировать результаты приёма.'
        },
        {
          title: '7. Прекращение',
          content: 'Мы можем прекратить или приостановить действие вашей учётной записи в любое время за нарушение настоящих Условий. Вы также можете прекратить действие своей учётной записи, связавшись с нашей службой поддержки.'
        },
        {
          title: '8. Изменения условий',
          content: 'Мы оставляем за собой право изменять настоящие Условия в любое время. Изменения вступают в силу сразу после публикации. Продолжение использования сервиса означает принятие изменённых Условий.'
        },
        {
          title: '9. Контактная информация',
          content: 'По вопросам об этих Условиях обращайтесь: support@hanguk.consulting'
        }
      ]
    },
    ko: {
      title: '이용약관',
      lastUpdated: '최종 업데이트: 2025년 1월',
      intro: 'Hanguk Consulting에 오신 것을 환영합니다. 당사의 모바일 애플리케이션 및 서비스를 이용함으로써 귀하는 본 이용약관에 동의하게 됩니다. 주의 깊게 읽어주세요.',
      sections: [
        {
          title: '1. 약관 동의',
          content: '당사 서비스에 접속하거나 이용함으로써 귀하는 본 약관에 구속되는 것에 동의합니다. 본 약관에 동의하지 않으시면 서비스를 이용하실 수 없습니다.'
        },
        {
          title: '2. 서비스 설명',
          content: `Hanguk Consulting은 다음을 제공합니다:
• 한국 대학교 지원 지원
• 서류 준비 및 검토 서비스
• 면접 준비 및 코칭
• 학술 문서 번역 서비스
• 지원 현황 추적을 위한 학생 포털`
        },
        {
          title: '3. 사용자 책임',
          content: `귀하는 다음에 동의합니다:
• 정확하고 완전한 정보 제공
• 계정의 기밀 유지
• 로그인 자격 증명을 다른 사람과 공유하지 않음
• 합법적인 목적으로만 서비스 사용
• 허위 또는 오해의 소지가 있는 문서 업로드 금지`
        },
        {
          title: '4. 결제 조건',
          content: '서비스는 선택한 결제 플랜에 따라 제공됩니다. 서면으로 달리 명시되지 않는 한 모든 수수료는 환불되지 않습니다. 결제 일정과 금액은 계약 체결 시 합의됩니다.'
        },
        {
          title: '5. 지적 재산권',
          content: '애플리케이션의 모든 콘텐츠, 기능 및 기능성은 Hanguk Consulting의 소유이며 국제 저작권, 상표 및 기타 지적 재산권법에 의해 보호됩니다.'
        },
        {
          title: '6. 책임 제한',
          content: 'Hanguk Consulting은 대학 입학 결정에 대해 책임지지 않습니다. 당사는 안내 및 지원 서비스를 제공하지만 입학 결과를 보장할 수 없습니다.'
        },
        {
          title: '7. 해지',
          content: '당사는 본 약관 위반 시 언제든지 귀하의 계정을 해지하거나 정지할 수 있습니다. 귀하도 고객 지원팀에 연락하여 계정을 해지할 수 있습니다.'
        },
        {
          title: '8. 약관 변경',
          content: '당사는 언제든지 본 약관을 수정할 권리를 보유합니다. 변경 사항은 게시 즉시 효력이 발생합니다. 서비스를 계속 사용하면 수정된 약관에 동의하는 것입니다.'
        },
        {
          title: '9. 연락처',
          content: '본 약관에 대한 문의사항은 support@hanguk.consulting으로 연락해 주세요'
        }
      ]
    }
  };

  const c = content[lang as keyof typeof content] || content.en;

  return (
    <NativeContainer className="bg-background">
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pt-[env(safe-area-inset-top)]">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-2 text-lg font-semibold">{c.title}</h1>
          </div>
        </header>

        <main className="container py-6 max-w-3xl">
          <p className="text-sm text-muted-foreground mb-4">{c.lastUpdated}</p>
          <p className="mb-6">{c.intro}</p>

          <div className="space-y-6">
            {c.sections.map((section, index) => (
              <section key={index}>
                <h2 className="text-lg font-semibold mb-2">{section.title}</h2>
                <p className="whitespace-pre-line text-muted-foreground">{section.content}</p>
              </section>
            ))}
          </div>
        </main>
      </div>
    </NativeContainer>
  );
}
