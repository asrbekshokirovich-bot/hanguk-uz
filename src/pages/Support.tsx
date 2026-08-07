import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, MessageCircle, Phone, Instagram } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { NativeContainer } from '@/components/native/NativeContainer';

/**
 * Public support page — the Support URL given to the App Store and Play.
 *
 * App Review cited guideline 1.5 on 2026-08-07 because the Support URL in App
 * Store Connect did not reach a page where a user can ask a question. That is
 * what this page is: reachable without an account, listing every channel the
 * company actually answers on, plus the answers to the questions support gets
 * asked most (the Magic Code login above all — a user who cannot get in cannot
 * reach any in-app help).
 *
 * Channels are kept in sync with `hanguk_app/lib/core/config/contact_links.dart`,
 * which drives the same list inside the mobile app.
 */

const CONTACTS = {
  email: 'support@hanguk.uz',
  telegramDirect: 'https://t.me/hangukuz_consulting',
  telegramChannel: 'https://t.me/hanguk_consulting',
  instagram: 'https://www.instagram.com/hanguk_consulting',
  phone: '+998505901530',
  phoneDisplay: '+998 50 590 15 30',
} as const;

export default function Support() {
  const { t: _t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;

  const content = {
    en: {
      title: 'Support',
      intro:
        'Need help with the Hanguk app or your university application? Write to us on any channel below — we answer in Uzbek, Russian, English and Korean, usually within one business day.',
      channelsTitle: 'Contact us',
      channels: {
        email: 'Email',
        telegram: 'Telegram (direct)',
        telegramChannel: 'Telegram channel',
        instagram: 'Instagram',
        phone: 'Phone',
      },
      hours: 'Working hours: Monday–Saturday, 09:00–18:00 (Tashkent, UTC+5).',
      faqTitle: 'Frequently asked questions',
      faq: [
        {
          q: 'How do I sign in? I do not have a password.',
          a: 'Hanguk uses a single-field Magic Code instead of a username and password. Your consultant gives you the code after you enrol; type it into the code field on the first screen. The code does not expire and works on every device.',
        },
        {
          q: 'I lost my Magic Code.',
          a: 'Write to us on Telegram or by email with your full name and phone number and we will resend it.',
        },
        {
          q: 'The app says my code is not valid.',
          a: 'Check that you typed all the characters and that the device is online. If it still fails, contact us — staff accounts cannot sign in through the student app, and we can check which account your code belongs to.',
        },
        {
          q: 'How do I delete my account and my data?',
          a: 'Open the Account screen in the app and choose Delete account, or email us at support@hanguk.uz from your registered address. Deletion removes your documents and application data.',
        },
        {
          q: 'Do I have to pay to use the app?',
          a: 'The app is free. It is provided to students working with Hanguk Consulting on their Korean university application.',
        },
      ],
      legalTitle: 'Legal',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    },
    uz: {
      title: "Yordam",
      intro:
        "Hanguk ilovasi yoki universitetga hujjat topshirish bo'yicha yordam kerakmi? Quyidagi istalgan kanal orqali yozing — o'zbek, rus, ingliz va koreys tillarida, odatda bir ish kuni ichida javob beramiz.",
      channelsTitle: "Biz bilan bog'lanish",
      channels: {
        email: 'Elektron pochta',
        telegram: "Telegram (to'g'ridan-to'g'ri)",
        telegramChannel: 'Telegram kanali',
        instagram: 'Instagram',
        phone: 'Telefon',
      },
      hours: 'Ish vaqti: dushanba–shanba, 09:00–18:00 (Toshkent, UTC+5).',
      faqTitle: "Ko'p so'raladigan savollar",
      faq: [
        {
          q: "Qanday kiraman? Parolim yo'q.",
          a: "Hanguk parol o'rniga bitta maydonli Magic Code'dan foydalanadi. Kodni ro'yxatdan o'tganingizdan keyin konsultantingiz beradi; uni birinchi ekrandagi kod maydoniga kiriting. Kod muddatsiz va har qanday qurilmada ishlaydi.",
        },
        {
          q: "Magic Code'imni yo'qotdim.",
          a: "Telegram yoki elektron pochta orqali to'liq ismingiz va telefon raqamingizni yozing — kodni qayta yuboramiz.",
        },
        {
          q: "Ilova kodim noto'g'ri deyapti.",
          a: "Barcha belgilarni to'g'ri kiritganingizni va internet borligini tekshiring. Baribir ishlamasa, biz bilan bog'laning — xodim akkauntlari talaba ilovasiga kira olmaydi, biz kodingiz qaysi akkauntga tegishli ekanini tekshiramiz.",
        },
        {
          q: "Akkauntimni va ma'lumotlarimni qanday o'chiraman?",
          a: "Ilovadagi Akkaunt ekranini oching va «Akkauntni o'chirish»ni tanlang, yoki ro'yxatdan o'tgan pochtangizdan support@hanguk.uz manziliga yozing. O'chirish hujjatlaringiz va ariza ma'lumotlaringizni ham olib tashlaydi.",
        },
        {
          q: 'Ilovadan foydalanish pullikmi?',
          a: "Ilova bepul. U Hanguk Consulting bilan Koreya universitetiga hujjat topshirayotgan talabalar uchun beriladi.",
        },
      ],
      legalTitle: 'Huquqiy',
      privacy: 'Maxfiylik siyosati',
      terms: 'Foydalanish shartlari',
    },
    ru: {
      title: 'Поддержка',
      intro:
        'Нужна помощь с приложением Hanguk или с поступлением в университет? Напишите нам в любой канал ниже — отвечаем на узбекском, русском, английском и корейском, обычно в течение одного рабочего дня.',
      channelsTitle: 'Связаться с нами',
      channels: {
        email: 'Электронная почта',
        telegram: 'Telegram (напрямую)',
        telegramChannel: 'Telegram-канал',
        instagram: 'Instagram',
        phone: 'Телефон',
      },
      hours: 'Часы работы: понедельник–суббота, 09:00–18:00 (Ташкент, UTC+5).',
      faqTitle: 'Частые вопросы',
      faq: [
        {
          q: 'Как войти? У меня нет пароля.',
          a: 'В Hanguk вместо логина и пароля используется Magic Code — одно поле. Код выдаёт ваш консультант после зачисления; введите его на первом экране. Код не истекает и работает на любом устройстве.',
        },
        {
          q: 'Я потерял Magic Code.',
          a: 'Напишите нам в Telegram или на почту, указав полное имя и номер телефона — мы вышлем код повторно.',
        },
        {
          q: 'Приложение пишет, что код неверный.',
          a: 'Проверьте, что введены все символы и есть интернет. Если не помогает — свяжитесь с нами: сотрудники не могут входить через студенческое приложение, и мы проверим, какому аккаунту принадлежит код.',
        },
        {
          q: 'Как удалить аккаунт и данные?',
          a: 'Откройте экран «Аккаунт» в приложении и выберите удаление аккаунта, либо напишите на support@hanguk.uz с зарегистрированного адреса. Удаление стирает ваши документы и данные заявки.',
        },
        {
          q: 'Приложение платное?',
          a: 'Нет, приложение бесплатное. Оно предоставляется студентам, которые поступают в корейский университет вместе с Hanguk Consulting.',
        },
      ],
      legalTitle: 'Правовая информация',
      privacy: 'Политика конфиденциальности',
      terms: 'Условия использования',
    },
    ko: {
      title: '고객 지원',
      intro:
        'Hanguk 앱이나 대학 지원 과정에서 도움이 필요하신가요? 아래 채널 중 어디로든 문의해 주세요. 우즈베크어, 러시아어, 영어, 한국어로 보통 영업일 기준 하루 안에 답변드립니다.',
      channelsTitle: '문의하기',
      channels: {
        email: '이메일',
        telegram: '텔레그램 (1:1)',
        telegramChannel: '텔레그램 채널',
        instagram: '인스타그램',
        phone: '전화',
      },
      hours: '운영 시간: 월–토 09:00–18:00 (타슈켄트, UTC+5).',
      faqTitle: '자주 묻는 질문',
      faq: [
        {
          q: '비밀번호가 없는데 어떻게 로그인하나요?',
          a: 'Hanguk은 아이디와 비밀번호 대신 한 칸짜리 매직 코드를 사용합니다. 등록 후 담당 컨설턴트가 코드를 알려드리며, 첫 화면의 코드 입력란에 입력하시면 됩니다. 코드는 만료되지 않고 모든 기기에서 사용할 수 있습니다.',
        },
        {
          q: '매직 코드를 잃어버렸습니다.',
          a: '텔레그램이나 이메일로 성함과 전화번호를 보내주시면 코드를 다시 보내드립니다.',
        },
        {
          q: '코드가 올바르지 않다고 나옵니다.',
          a: '모든 문자를 정확히 입력했는지, 인터넷에 연결되어 있는지 확인해 주세요. 그래도 안 되면 문의해 주세요. 직원 계정은 학생 앱으로 로그인할 수 없으며, 코드가 어느 계정의 것인지 확인해 드립니다.',
        },
        {
          q: '계정과 데이터를 삭제하려면 어떻게 하나요?',
          a: '앱의 계정 화면에서 계정 삭제를 선택하시거나, 등록된 주소에서 support@hanguk.uz로 메일을 보내주세요. 삭제 시 서류와 지원 데이터도 함께 삭제됩니다.',
        },
        {
          q: '앱은 유료인가요?',
          a: '무료입니다. Hanguk Consulting과 함께 한국 대학 지원을 준비하는 학생에게 제공됩니다.',
        },
      ],
      legalTitle: '법적 고지',
      privacy: '개인정보 처리방침',
      terms: '이용약관',
    },
  };

  const c = content[lang as keyof typeof content] || content.en;

  const rows = [
    {
      icon: Mail,
      label: c.channels.email,
      value: CONTACTS.email,
      href: `mailto:${CONTACTS.email}`,
    },
    {
      icon: MessageCircle,
      label: c.channels.telegram,
      value: '@hangukuz_consulting',
      href: CONTACTS.telegramDirect,
    },
    {
      icon: MessageCircle,
      label: c.channels.telegramChannel,
      value: '@hanguk_consulting',
      href: CONTACTS.telegramChannel,
    },
    {
      icon: Instagram,
      label: c.channels.instagram,
      value: '@hanguk_consulting',
      href: CONTACTS.instagram,
    },
    {
      icon: Phone,
      label: c.channels.phone,
      value: CONTACTS.phoneDisplay,
      href: `tel:${CONTACTS.phone}`,
    },
  ];

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
          <p className="mb-6">{c.intro}</p>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{c.channelsTitle}</h2>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.label}>
                  <a
                    href={row.href}
                    target={row.href.startsWith('http') ? '_blank' : undefined}
                    rel={row.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <row.icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <span className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className="font-medium break-all">{row.value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">{c.hours}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{c.faqTitle}</h2>
            <div className="space-y-5">
              {c.faq.map((item) => (
                <div key={item.q}>
                  <h3 className="font-medium mb-1">{item.q}</h3>
                  <p className="text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">{c.legalTitle}</h2>
            <div className="flex gap-4 text-sm">
              <Link to="/privacy" className="underline underline-offset-4">
                {c.privacy}
              </Link>
              <Link to="/terms" className="underline underline-offset-4">
                {c.terms}
              </Link>
            </div>
          </section>
        </main>
      </div>
    </NativeContainer>
  );
}
