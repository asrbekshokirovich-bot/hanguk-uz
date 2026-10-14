import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NativeContainer } from '@/components/native/NativeContainer';

export default function Privacy() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;

  const content = {
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last Updated: October 2026',
      intro: 'Hanguk Consulting ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application and services.',
      sections: [
        {
          title: '1. Information We Collect',
          content: `We collect information you provide directly to us, including:
• Personal information (name, email, phone number)
• Academic records and documents
• Application materials for universities
• Communication history with our staff
• Device information and usage data

In the app we record what you open and press (for example the screens you visit, the universities you view or save, and the steps you complete), together with a random installation identifier, the app version and the time. If you send us a request or sign in, this activity is linked to your request or your account so that your consultant can help you better and we can improve the app. We do not record what you type, your passwords or client codes, or the figures you enter in the assessment.`
        },
        {
          title: '2. How We Use Your Information',
          content: `We use the information we collect to:
• Process your university applications
• Communicate with you about our services
• Improve our application and services
• Send you notifications about deadlines and updates
• Provide customer support`
        },
        {
          title: '3. Data Storage and Security',
          content: 'Your data is stored securely using industry-standard encryption. We use Supabase for data storage, which provides enterprise-grade security. We implement appropriate technical and organizational measures to protect your personal information.'
        },
        {
          title: '4. Third-Party Services',
          content: `We use the following third-party services:
• Supabase (Database and Authentication)
• Firebase Cloud Messaging (Push Notifications)
• Mapbox (Maps and Location Services)
• ElevenLabs (Voice Services)
These services have their own privacy policies and data handling practices.`
        },
        {
          title: '5. Your Rights',
          content: `You have the right to:
• Access your personal data
• Request correction of your data
• Request deletion of your data
• Opt-out of marketing communications
• Export your data`
        },
        {
          title: '6. Contact Us',
          content: 'If you have any questions about this Privacy Policy, please contact us at support@hanguk.uz'
        }
      ]
    },
    uz: {
      title: 'Maxfiylik siyosati',
      lastUpdated: 'Oxirgi yangilanish: 2026-yil oktyabr',
      intro: 'Hanguk Consulting ("biz") sizning maxfiyligingizni himoya qilishga sodiqmiz. Ushbu Maxfiylik siyosati mobil ilovamiz va xizmatlarimizdan foydalanganingizda ma\'lumotlaringizni qanday to\'plashimiz, ishlatishimiz va himoya qilishimizni tushuntiradi.',
      sections: [
        {
          title: '1. Biz to\'playdigan ma\'lumotlar',
          content: `Biz sizdan to'g'ridan-to'g'ri oladigan ma'lumotlarni to'playmiz:
• Shaxsiy ma'lumotlar (ism, elektron pochta, telefon raqami)
• Akademik yozuvlar va hujjatlar
• Universitetlarga ariza materiallari
• Xodimlarimiz bilan aloqa tarixi
• Qurilma ma'lumotlari va foydalanish ma'lumotlari

Ilovada nimani ochganingiz va bosganingiz (masalan, qaysi ekranlarni ochganingiz, qaysi universitetlarni ko'rgan yoki saqlaganingiz, qaysi bosqichlarni bajarganingiz) tasodifiy o'rnatish identifikatori, ilova versiyasi va vaqt bilan birga yozib boriladi. Ariza yuborsangiz yoki tizimga kirsangiz, bu faollik arizangiz yoki hisobingizga bog'lanadi — konsultantingiz sizga yaxshiroq yordam berishi va ilovani yaxshilashimiz uchun. Siz yozgan matnlar, parol va mijoz kodlari hamda baholashga kiritgan raqamlaringiz yozilmaydi.`
        },
        {
          title: '2. Ma\'lumotlaringizdan qanday foydalanamiz',
          content: `Biz to'plagan ma'lumotlardan quyidagi maqsadlarda foydalanamiz:
• Universitetga arizalaringizni ko'rib chiqish
• Xizmatlarimiz haqida siz bilan bog'lanish
• Ilovamiz va xizmatlarimizni yaxshilash
• Muddatlar va yangilanishlar haqida bildirishnomalar yuborish
• Mijozlarni qo'llab-quvvatlash`
        },
        {
          title: '3. Ma\'lumotlarni saqlash va xavfsizlik',
          content: 'Ma\'lumotlaringiz sanoat standartidagi shifrlash yordamida xavfsiz saqlanadi. Ma\'lumotlarni saqlash uchun korxona darajasidagi xavfsizlikni ta\'minlovchi Supabase\'dan foydalanamiz.'
        },
        {
          title: '4. Uchinchi tomon xizmatlari',
          content: `Biz quyidagi uchinchi tomon xizmatlaridan foydalanamiz:
• Supabase (Ma'lumotlar bazasi va Autentifikatsiya)
• Firebase Cloud Messaging (Push bildirishnomalar)
• Mapbox (Xaritalar va Joylashuv xizmatlari)
• ElevenLabs (Ovozli xizmatlar)
Bu xizmatlar o'zlarining maxfiylik siyosatlariga ega.`
        },
        {
          title: '5. Sizning huquqlaringiz',
          content: `Sizda quyidagi huquqlar bor:
• Shaxsiy ma'lumotlaringizga kirish
• Ma'lumotlaringizni tuzatishni so'rash
• Ma'lumotlaringizni o'chirishni so'rash
• Marketing xabarlaridan voz kechish
• Ma'lumotlaringizni eksport qilish`
        },
        {
          title: '6. Biz bilan bog\'laning',
          content: 'Ushbu Maxfiylik siyosati bo\'yicha savollaringiz bo\'lsa, support@hanguk.uz manziliga murojaat qiling'
        }
      ]
    },
    ru: {
      title: 'Политика конфиденциальности',
      lastUpdated: 'Последнее обновление: Октябрь 2026',
      intro: 'Hanguk Consulting ("мы") стремится защитить вашу конфиденциальность. Эта Политика конфиденциальности объясняет, как мы собираем, используем и защищаем вашу информацию при использовании нашего мобильного приложения и услуг.',
      sections: [
        {
          title: '1. Информация, которую мы собираем',
          content: `Мы собираем информацию, которую вы предоставляете нам напрямую:
• Личная информация (имя, email, номер телефона)
• Академические записи и документы
• Материалы заявок в университеты
• История общения с нашими сотрудниками
• Информация об устройстве и данные использования

В приложении мы записываем, что вы открываете и нажимаете (например, какие экраны открываете, какие университеты просматриваете или сохраняете, какие шаги проходите), вместе со случайным идентификатором установки, версией приложения и временем. Если вы отправите заявку или войдёте в аккаунт, эта активность связывается с вашей заявкой или аккаунтом, чтобы консультант мог лучше вам помочь, а мы — улучшать приложение. Мы не записываем то, что вы печатаете, пароли и коды клиента, а также цифры, которые вы вводите в оценке.`
        },
        {
          title: '2. Как мы используем вашу информацию',
          content: `Мы используем собранную информацию для:
• Обработки ваших заявок в университеты
• Связи с вами по поводу наших услуг
• Улучшения нашего приложения и услуг
• Отправки уведомлений о сроках и обновлениях
• Предоставления поддержки клиентам`
        },
        {
          title: '3. Хранение и безопасность данных',
          content: 'Ваши данные надёжно хранятся с использованием шифрования по отраслевым стандартам. Мы используем Supabase для хранения данных, который обеспечивает корпоративный уровень безопасности.'
        },
        {
          title: '4. Сторонние сервисы',
          content: `Мы используем следующие сторонние сервисы:
• Supabase (База данных и Аутентификация)
• Firebase Cloud Messaging (Push-уведомления)
• Mapbox (Карты и Геолокация)
• ElevenLabs (Голосовые сервисы)
Эти сервисы имеют собственные политики конфиденциальности.`
        },
        {
          title: '5. Ваши права',
          content: `Вы имеете право:
• Получить доступ к своим персональным данным
• Запросить исправление данных
• Запросить удаление данных
• Отказаться от маркетинговых сообщений
• Экспортировать свои данные`
        },
        {
          title: '6. Свяжитесь с нами',
          content: 'Если у вас есть вопросы по этой Политике конфиденциальности, свяжитесь с нами: support@hanguk.uz'
        }
      ]
    },
    ko: {
      title: '개인정보 처리방침',
      lastUpdated: '최종 업데이트: 2026년 10월',
      intro: 'Hanguk Consulting("당사")은 귀하의 개인정보 보호를 위해 최선을 다하고 있습니다. 본 개인정보 처리방침은 귀하가 당사의 모바일 애플리케이션 및 서비스를 이용할 때 정보를 수집, 사용 및 보호하는 방법을 설명합니다.',
      sections: [
        {
          title: '1. 수집하는 정보',
          content: `귀하가 직접 제공하는 정보를 수집합니다:
• 개인 정보 (이름, 이메일, 전화번호)
• 학업 기록 및 서류
• 대학 지원 자료
• 직원과의 커뮤니케이션 기록
• 기기 정보 및 사용 데이터

앱에서는 귀하가 무엇을 열고 눌렀는지(예: 방문한 화면, 조회하거나 저장한 대학, 완료한 단계)를 임의의 설치 식별자, 앱 버전, 시간과 함께 기록합니다. 상담을 신청하거나 로그인하면 이 활동은 상담사가 더 잘 도울 수 있도록, 그리고 앱 개선을 위해 귀하의 신청 또는 계정과 연결됩니다. 입력한 글, 비밀번호와 고객 코드, 평가에 입력한 수치는 기록하지 않습니다.`
        },
        {
          title: '2. 정보 사용 방법',
          content: `수집된 정보는 다음 목적으로 사용됩니다:
• 대학 지원서 처리
• 서비스 관련 연락
• 애플리케이션 및 서비스 개선
• 마감일 및 업데이트 알림 전송
• 고객 지원 제공`
        },
        {
          title: '3. 데이터 저장 및 보안',
          content: '귀하의 데이터는 업계 표준 암호화를 사용하여 안전하게 저장됩니다. 엔터프라이즈급 보안을 제공하는 Supabase를 사용합니다.'
        },
        {
          title: '4. 제3자 서비스',
          content: `다음 제3자 서비스를 사용합니다:
• Supabase (데이터베이스 및 인증)
• Firebase Cloud Messaging (푸시 알림)
• Mapbox (지도 및 위치 서비스)
• ElevenLabs (음성 서비스)
이러한 서비스는 자체 개인정보 처리방침을 가지고 있습니다.`
        },
        {
          title: '5. 귀하의 권리',
          content: `귀하는 다음 권리가 있습니다:
• 개인 데이터에 대한 접근
• 데이터 수정 요청
• 데이터 삭제 요청
• 마케팅 커뮤니케이션 수신 거부
• 데이터 내보내기`
        },
        {
          title: '6. 문의하기',
          content: '본 개인정보 처리방침에 대한 문의사항은 support@hanguk.uz으로 연락해 주세요'
        }
      ]
    }
  };

  const c = content[lang as keyof typeof content] || content.en;

  return (
    <NativeContainer className="bg-background">
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pt-[env(safe-area-inset-top)]">
          <div className="container mx-auto px-4 h-16 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold truncate">{c.title}</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-3xl">
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
