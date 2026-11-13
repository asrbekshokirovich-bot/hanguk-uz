import { useTranslation } from 'react-i18next';
import { NativeContainer } from '@/components/native/NativeContainer';
import { BackButton } from '@/components/BackButton';
import { usePageTitle } from '@/hooks/usePageTitle';

// Privacy policy of the Hanguk Ish apps (worker: uz.hanguk.ish, employer:
// uz.hanguk.ish.biz). Google Play links to it from the store listing.
// It describes only what the apps actually store: the ish.* tables, the
// CAMERA (QR check-in) and ACCESS_COARSE_LOCATION (nearby shifts) permissions.

type Section = { title: string; content: string };
type Content = { title: string; lastUpdated: string; intro: string; sections: Section[] };

const content: Record<'uz' | 'en' | 'ru' | 'ko', Content> = {
  uz: {
    title: 'Hanguk Ish — Maxfiylik siyosati',
    lastUpdated: 'Oxirgi yangilanish: 2026-yil 13-noyabr',
    intro:
      '«HANGUK» MCHJ («biz») Koreyada kunlik va qisqa smenali ishlar uchun «Hanguk Ish» (ishchilar) va «Hanguk Ish 사장님» (ish beruvchilar) ilovalarini yuritadi. Ushbu siyosat ilovalar qaysi ma\'lumotlarni to\'plashi, nima uchun ishlatishi, kim bilan bo\'lishishi va ularni qanday o\'chirish mumkinligini tushuntiradi.',
    sections: [
      {
        title: '1. Qaysi ma\'lumotlarni to\'playmiz',
        content: `• Telefon raqami — kirish uchun SMS kod yuboriladi
• Ism, familiya va profil rasmi (ixtiyoriy)
• Ilova tili
• Ishchi profili: bilgan tillar, TOPIK darajasi, universitet, tuman, bo'sh vaqtlar, viza turi
• Taxminiy joylashuv — faqat ruxsat bersangiz, yaqin atrofdagi ishlarni ko'rsatish uchun
• Arizalar va smenalar: qaysi ishga yozilganingiz, ishga kelish va ketish vaqti, ishonchlilik ko'rsatkichi
• Ilova ichidagi xabarlar, baholar va shikoyatlar
• Ish beruvchilar uchun: korxona nomi, manzili, aloqa ma'lumotlari va e'lon qilingan smenalar

Kamera faqat ish joyidagi QR kodni o'qish (kelganini tasdiqlash) va profil rasmini olish uchun ishlatiladi. Kamera tasvirlari saqlanmaydi.`,
      },
      {
        title: '2. Ma\'lumotlardan qanday foydalanamiz',
        content: `• Akkauntingizni yaratish va kirishni tasdiqlash
• Sizga mos va yaqin ishlarni ko'rsatish
• Ishchi va ish beruvchini bog'lash, smena va ishga kelishni hisobga olish
• Xabar almashish va bildirishnomalar yuborish
• Firibgarlik va qoidabuzarliklarning oldini olish, shikoyatlarni ko'rib chiqish`,
      },
      {
        title: '3. Kim bilan bo\'lishamiz',
        content: `• Ish beruvchi: siz ariza bergan yoki taklif olgan korxona ismingiz, rasmingiz, tillaringiz, TOPIK darajangiz, viza turingiz va ishonchlilik ko'rsatkichingizni ko'radi.
• Ishchi: ish beruvchining korxona nomi, manzili va smena ma'lumotlarini ko'radi.
• Xizmat ko'rsatuvchilar: Supabase (ma'lumotlar bazasi va fayllar, serverlar Koreya Respublikasi, Seulda), Twilio (SMS kod yuborish).

Ma'lumotlaringizni sotmaymiz va reklama uchun bermaymiz. Ilovada reklama yo'q.`,
      },
      {
        title: '4. Saqlash va xavfsizlik',
        content:
          'Ma\'lumotlar shifrlangan ulanish (HTTPS) orqali uzatiladi. Har bir foydalanuvchi faqat o\'ziga tegishli va ish jarayoni uchun kerakli ma\'lumotlarni ko\'radi. Ma\'lumotlar akkauntingiz bor ekan saqlanadi.',
      },
      {
        title: '5. Akkaunt va ma\'lumotlarni o\'chirish',
        content: `Akkauntingizni va unga bog'liq ma'lumotlarni istalgan vaqtda o'chirishingiz mumkin:
• Ilovada: Profil → Akkauntni o'chirish
• Veb sahifada: https://hanguk.uz/ish/delete-account

O'chirilganda profilingiz, ishchi ma'lumotlaringiz, arizalaringiz, xabarlaringiz, baholaringiz va bildirishnomalaringiz o'chiriladi. Zaxira nusxalarda ular qisqa muddat qolishi mumkin.`,
      },
      {
        title: '6. Bolalar',
        content: 'Ilovalar 18 yoshdan katta foydalanuvchilar uchun mo\'ljallangan.',
      },
      {
        title: '7. Biz bilan bog\'lanish',
        content: '«HANGUK» MCHJ, Toshkent shahri, Yunusobod tumani. Elektron pochta: privacy@hanguk.uz',
      },
    ],
  },
  en: {
    title: 'Hanguk Ish — Privacy Policy',
    lastUpdated: 'Last updated: 13 November 2026',
    intro:
      '"HANGUK" LLC ("we") operates the "Hanguk Ish" (workers) and "Hanguk Ish 사장님" (employers) apps for daily and short-shift jobs in Korea. This policy explains what data the apps collect, why we use it, who we share it with and how you can delete it.',
    sections: [
      {
        title: '1. Data we collect',
        content: `• Phone number — used to send a sign-in code by SMS
• First name, last name and profile photo (optional)
• App language
• Worker profile: languages, TOPIK level, university, district, availability, visa type
• Approximate location — only if you allow it, to show jobs near you
• Applications and shifts: the jobs you apply for, check-in and check-out times, reliability score
• In-app messages, ratings and reports
• For employers: business name, address, contact details and posted shifts

The camera is used only to scan the QR code at the workplace (to confirm arrival) and to take a profile photo. Camera images are not stored.`,
      },
      {
        title: '2. How we use data',
        content: `• Create your account and verify sign-in
• Show jobs that suit you and are near you
• Connect workers and employers, record shifts and attendance
• Deliver messages and notifications
• Prevent fraud and abuse and review reports`,
      },
      {
        title: '3. Who we share data with',
        content: `• Employers: a business you apply to or receive an offer from sees your name, photo, languages, TOPIK level, visa type and reliability score.
• Workers: see the employer's business name, address and shift details.
• Service providers: Supabase (database and file storage, servers in Seoul, Republic of Korea), Twilio (sending SMS codes).

We do not sell your data or share it for advertising. The apps contain no ads.`,
      },
      {
        title: '4. Storage and security',
        content:
          'Data is transmitted over encrypted connections (HTTPS). Each user can see only their own data and the data needed for the job process. Data is kept for as long as your account exists.',
      },
      {
        title: '5. Deleting your account and data',
        content: `You can delete your account and its data at any time:
• In the app: Profile → Delete account
• On the web: https://hanguk.uz/ish/delete-account

Deletion removes your profile, worker details, applications, messages, ratings and notifications. Copies may remain in backups for a short period.`,
      },
      {
        title: '6. Children',
        content: 'The apps are intended for users aged 18 and over.',
      },
      {
        title: '7. Contact us',
        content: '"HANGUK" LLC, Yunusobod district, Tashkent, Uzbekistan. Email: privacy@hanguk.uz',
      },
    ],
  },
  ru: {
    title: 'Hanguk Ish — Политика конфиденциальности',
    lastUpdated: 'Последнее обновление: 13 ноября 2026 г.',
    intro:
      'ООО «HANGUK» («мы») управляет приложениями «Hanguk Ish» (для работников) и «Hanguk Ish 사장님» (для работодателей) для подработки и коротких смен в Корее. Эта политика объясняет, какие данные собирают приложения, зачем мы их используем, кому передаём и как их удалить.',
    sections: [
      {
        title: '1. Какие данные мы собираем',
        content: `• Номер телефона — для отправки кода входа по SMS
• Имя, фамилия и фото профиля (необязательно)
• Язык приложения
• Профиль работника: языки, уровень TOPIK, университет, район, свободное время, тип визы
• Приблизительное местоположение — только с вашего разрешения, чтобы показывать работу рядом
• Заявки и смены: на какую работу вы откликнулись, время прихода и ухода, показатель надёжности
• Сообщения в приложении, оценки и жалобы
• Для работодателей: название компании, адрес, контакты и опубликованные смены

Камера используется только для сканирования QR-кода на месте работы (подтверждение прихода) и для фото профиля. Изображения с камеры не сохраняются.`,
      },
      {
        title: '2. Как мы используем данные',
        content: `• Создание аккаунта и подтверждение входа
• Показ подходящей работы рядом с вами
• Связь работников и работодателей, учёт смен и посещаемости
• Доставка сообщений и уведомлений
• Предотвращение мошенничества и нарушений, рассмотрение жалоб`,
      },
      {
        title: '3. Кому мы передаём данные',
        content: `• Работодателю: компания, в которую вы откликнулись или от которой получили предложение, видит ваше имя, фото, языки, уровень TOPIK, тип визы и показатель надёжности.
• Работнику: видны название компании, адрес и данные смены.
• Поставщикам услуг: Supabase (база данных и файлы, серверы в Сеуле, Республика Корея), Twilio (отправка SMS-кодов).

Мы не продаём ваши данные и не передаём их для рекламы. В приложениях нет рекламы.`,
      },
      {
        title: '4. Хранение и безопасность',
        content:
          'Данные передаются по зашифрованному соединению (HTTPS). Каждый пользователь видит только свои данные и данные, нужные для работы. Данные хранятся, пока существует ваш аккаунт.',
      },
      {
        title: '5. Удаление аккаунта и данных',
        content: `Вы можете удалить аккаунт и связанные с ним данные в любое время:
• В приложении: Профиль → Удалить аккаунт
• На сайте: https://hanguk.uz/ish/delete-account

При удалении стираются профиль, данные работника, заявки, сообщения, оценки и уведомления. Копии могут недолго оставаться в резервных копиях.`,
      },
      {
        title: '6. Дети',
        content: 'Приложения предназначены для пользователей старше 18 лет.',
      },
      {
        title: '7. Контакты',
        content: 'ООО «HANGUK», Узбекистан, г. Ташкент, Юнусабадский район. Эл. почта: privacy@hanguk.uz',
      },
    ],
  },
  ko: {
    title: 'Hanguk Ish — 개인정보 처리방침',
    lastUpdated: '최종 수정일: 2026년 11월 13일',
    intro:
      '"HANGUK" LLC("당사")는 한국의 일일·단기 아르바이트를 위한 "Hanguk Ish"(근로자용) 및 "Hanguk Ish 사장님"(사업주용) 앱을 운영합니다. 본 방침은 앱이 수집하는 정보, 이용 목적, 제공 대상 및 삭제 방법을 설명합니다.',
    sections: [
      {
        title: '1. 수집하는 정보',
        content: `• 휴대폰 번호 — 로그인 인증번호 SMS 발송
• 이름, 성 및 프로필 사진(선택)
• 앱 언어
• 근로자 프로필: 사용 언어, TOPIK 등급, 대학교, 지역, 근무 가능 시간, 비자 종류
• 대략적인 위치 — 허용한 경우에만, 주변 일자리 표시용
• 지원 및 근무 기록: 지원한 일자리, 출근·퇴근 시간, 신뢰도 점수
• 앱 내 메시지, 평가 및 신고
• 사업주: 사업장 이름, 주소, 연락처 및 등록한 근무

카메라는 근무지 QR 코드 스캔(출근 확인)과 프로필 사진 촬영에만 사용되며, 카메라 영상은 저장되지 않습니다.`,
      },
      {
        title: '2. 이용 목적',
        content: `• 계정 생성 및 로그인 인증
• 적합하고 가까운 일자리 표시
• 근로자와 사업주 연결, 근무 및 출근 기록
• 메시지 및 알림 전달
• 사기·부정 이용 방지 및 신고 처리`,
      },
      {
        title: '3. 정보 제공 대상',
        content: `• 사업주: 지원하거나 제안을 받은 사업장은 이름, 사진, 사용 언어, TOPIK 등급, 비자 종류, 신뢰도 점수를 볼 수 있습니다.
• 근로자: 사업장 이름, 주소 및 근무 정보를 볼 수 있습니다.
• 서비스 제공업체: Supabase(데이터베이스 및 파일 저장, 서버 위치: 대한민국 서울), Twilio(SMS 인증번호 발송).

당사는 개인정보를 판매하거나 광고 목적으로 제공하지 않으며, 앱에는 광고가 없습니다.`,
      },
      {
        title: '4. 보관 및 보안',
        content:
          '정보는 암호화된 연결(HTTPS)로 전송됩니다. 각 사용자는 본인의 정보와 근무에 필요한 정보만 볼 수 있습니다. 정보는 계정이 유지되는 동안 보관됩니다.',
      },
      {
        title: '5. 계정 및 정보 삭제',
        content: `언제든지 계정과 관련 정보를 삭제할 수 있습니다:
• 앱에서: 프로필 → 계정 삭제
• 웹에서: https://hanguk.uz/ish/delete-account

삭제 시 프로필, 근로자 정보, 지원 내역, 메시지, 평가 및 알림이 삭제됩니다. 백업에는 짧은 기간 남아 있을 수 있습니다.`,
      },
      {
        title: '6. 아동',
        content: '본 앱은 만 18세 이상 사용자를 대상으로 합니다.',
      },
      {
        title: '7. 문의',
        content: '"HANGUK" LLC, 우즈베키스탄 타슈켄트시 유누사바드구. 이메일: privacy@hanguk.uz',
      },
    ],
  },
};

export default function IshPrivacy() {
  const { i18n } = useTranslation();
  // The apps open this page with ?lang= in their own language.
  const queryLang = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
  const lang = (queryLang || i18n.language || 'en').slice(0, 2);
  const c = content[lang as keyof typeof content] || content.en;
  usePageTitle(c.title);

  return (
    <NativeContainer className="bg-background">
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pt-[env(safe-area-inset-top)]">
          <div className="container mx-auto px-4 h-16 flex items-center gap-2">
            <BackButton />
            <h1 className="text-lg font-semibold truncate">{c.title}</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-3xl">
          <nav className="flex gap-3 text-sm mb-4" aria-label="Language">
            {(Object.keys(content) as (keyof typeof content)[]).map((code) => (
              <a key={code} href={`?lang=${code}`} className={code === lang ? 'font-semibold underline' : 'text-muted-foreground'}>
                {code.toUpperCase()}
              </a>
            ))}
          </nav>
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
