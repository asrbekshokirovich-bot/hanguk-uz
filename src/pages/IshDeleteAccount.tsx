import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createClient } from '@supabase/supabase-js';
import { NativeContainer } from '@/components/native/NativeContainer';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePageTitle } from '@/hooks/usePageTitle';
import { SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/keys';

// Hanguk Ish apps: delete your account on the web (Google Play's
// account-deletion rule; linked from Data safety and /ish/privacy).
// The user proves the number with an SMS code (an existing account only —
// shouldCreateUser: false), then the edge function `ish-delete-account`
// deletes it with their own token. A separate client that keeps no session,
// so a CRM sign-in in the same browser is never touched.

type Lang = 'uz' | 'en' | 'ru' | 'ko';

const t: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Hanguk Ish — akkauntni o\'chirish',
    intro: '«Hanguk Ish» yoki «Hanguk Ish 사장님» ilovasidagi akkauntingizni o\'chirishingiz mumkin.',
    what: 'Profilingiz, ishchi ma\'lumotlaringiz, arizalaringiz, xabarlaringiz, baholaringiz, bildirishnomalaringiz va profil rasmingiz o\'chiriladi. Korxona egasi bo\'lsangiz, korxonangiz va uning smenalari ham o\'chiriladi. Zaxira nusxalarda ular qisqa muddat qolishi mumkin.',
    inApp: 'Ilovada: Profil → Yordam → «Akkauntni o\'chirish».',
    web: 'Yoki shu yerda — akkaunt ochilgan telefon raqamingizni kiriting, SMS kod keladi.',
    phone: 'Telefon raqam (010-0000-0000)',
    send: 'Kod yuborish',
    code: 'SMS kod (6 raqam)',
    confirm: 'Akkauntni butunlay o\'chirish',
    done: 'Akkauntingiz o\'chirildi.',
    badPhone: 'Koreya mobil raqamini kiriting: 010-0000-0000.',
    badCode: 'Kod noto\'g\'ri yoki eskirgan.',
    noAccount: 'Bu raqam bilan akkaunt topilmadi yoki SMS yuborib bo\'lmadi.',
    failed: 'Xatolik yuz berdi. Qayta urinib ko\'ring.',
  },
  en: {
    title: 'Hanguk Ish — delete your account',
    intro: 'You can delete your account in the «Hanguk Ish» or «Hanguk Ish 사장님» app.',
    what: 'Your profile, worker details, applications, messages, ratings, notifications and profile photo are deleted. If you own a business, the business and its shifts are deleted too. Copies may remain in backups for a short period.',
    inApp: 'In the app: Profile → Help → «Delete account».',
    web: 'Or here — enter the phone number of your account and we will text you a code.',
    phone: 'Phone number (010-0000-0000)',
    send: 'Send code',
    code: 'SMS code (6 digits)',
    confirm: 'Delete my account permanently',
    done: 'Your account has been deleted.',
    badPhone: 'Enter a Korean mobile number: 010-0000-0000.',
    badCode: 'The code is wrong or has expired.',
    noAccount: 'No account with this number, or the SMS could not be sent.',
    failed: 'Something went wrong. Please try again.',
  },
  ru: {
    title: 'Hanguk Ish — удаление аккаунта',
    intro: 'Вы можете удалить аккаунт в приложении «Hanguk Ish» или «Hanguk Ish 사장님».',
    what: 'Удаляются профиль, данные работника, заявки, сообщения, оценки, уведомления и фото профиля. Если вы владелец компании, удаляются также компания и её смены. Копии могут недолго оставаться в резервных копиях.',
    inApp: 'В приложении: Профиль → Помощь → «Удалить аккаунт».',
    web: 'Или здесь — введите номер телефона аккаунта, мы отправим SMS-код.',
    phone: 'Номер телефона (010-0000-0000)',
    send: 'Отправить код',
    code: 'SMS-код (6 цифр)',
    confirm: 'Удалить аккаунт навсегда',
    done: 'Ваш аккаунт удалён.',
    badPhone: 'Введите корейский мобильный номер: 010-0000-0000.',
    badCode: 'Код неверный или устарел.',
    noAccount: 'Аккаунт с этим номером не найден или SMS не отправлено.',
    failed: 'Произошла ошибка. Попробуйте ещё раз.',
  },
  ko: {
    title: 'Hanguk Ish — 계정 삭제',
    intro: '"Hanguk Ish" 또는 "Hanguk Ish 사장님" 앱의 계정을 삭제할 수 있습니다.',
    what: '프로필, 근로자 정보, 지원 내역, 메시지, 평가, 알림, 프로필 사진이 삭제됩니다. 사업장 소유자인 경우 사업장과 등록한 근무도 함께 삭제됩니다. 백업에는 짧은 기간 남아 있을 수 있습니다.',
    inApp: '앱에서: 프로필 → 도움말 → "계정 삭제".',
    web: '또는 여기에서 — 계정의 휴대폰 번호를 입력하면 인증번호를 보내드립니다.',
    phone: '휴대폰 번호 (010-0000-0000)',
    send: '인증번호 받기',
    code: '인증번호 (6자리)',
    confirm: '계정 영구 삭제',
    done: '계정이 삭제되었습니다.',
    badPhone: '한국 휴대폰 번호를 입력하세요: 010-0000-0000.',
    badCode: '인증번호가 틀렸거나 만료되었습니다.',
    noAccount: '이 번호의 계정이 없거나 SMS를 보낼 수 없습니다.',
    failed: '오류가 발생했습니다. 다시 시도해 주세요.',
  },
};

/** 010-1234-5678 → +821012345678 (the apps' rule, hanguk_ish/lib/core/format/phone.dart). */
function koreanE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!/^(010\d{8}|01[16789]\d{7,8})$/.test(digits)) return null;
  return `+82${digits.slice(1)}`;
}

export default function IshDeleteAccount() {
  const { i18n } = useTranslation();
  const queryLang = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
  const lang = ((queryLang || i18n.language || 'en').slice(0, 2) as Lang);
  const c = t[lang] ?? t.en;
  usePageTitle(c.title);

  const client = useMemo(
    () =>
      createClient(import.meta.env.VITE_SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: 'ish-delete-account' },
      }),
    [],
  );

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const e164 = koreanE164(phone);
    if (!e164) return setError(c.badPhone);
    setBusy(true);
    setError(null);
    const { error } = await client.auth.signInWithOtp({ phone: e164, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) return setError(c.noAccount);
    setStep('code');
  }

  async function confirm() {
    const e164 = koreanE164(phone);
    if (!e164 || !/^\d{6}$/.test(code.trim())) return setError(c.badCode);
    setBusy(true);
    setError(null);
    const { data, error } = await client.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    if (error || !data.session) {
      setBusy(false);
      return setError(c.badCode);
    }
    const { error: fnError } = await client.functions.invoke('ish-delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setBusy(false);
    if (fnError) return setError(c.failed);
    setStep('done');
  }

  return (
    <NativeContainer className="bg-background">
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pt-[env(safe-area-inset-top)]">
          <div className="container mx-auto px-4 h-16 flex items-center gap-2">
            <BackButton />
            <h1 className="text-lg font-semibold truncate">{c.title}</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-xl space-y-5">
          <nav className="flex gap-3 text-sm" aria-label="Language">
            {(Object.keys(t) as Lang[]).map((code) => (
              <a key={code} href={`?lang=${code}`} className={code === lang ? 'font-semibold underline' : 'text-muted-foreground'}>
                {code.toUpperCase()}
              </a>
            ))}
          </nav>
          <p>{c.intro}</p>
          <p className="text-muted-foreground">{c.what}</p>
          <p className="font-medium">{c.inApp}</p>

          {step === 'done' ? (
            <p className="rounded-md border p-4 font-semibold">{c.done}</p>
          ) : (
            <section className="space-y-3 rounded-md border p-4">
              <p className="text-sm text-muted-foreground">{c.web}</p>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={c.phone}
                aria-label={c.phone}
                value={phone}
                disabled={busy || step === 'code'}
                onChange={(e) => setPhone(e.target.value)}
              />
              {step === 'phone' ? (
                <Button className="w-full" disabled={busy} onClick={sendCode}>
                  {c.send}
                </Button>
              ) : (
                <>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder={c.code}
                    aria-label={c.code}
                    value={code}
                    disabled={busy}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <Button className="w-full" variant="destructive" disabled={busy} onClick={confirm}>
                    {c.confirm}
                  </Button>
                </>
              )}
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </section>
          )}
        </main>
      </div>
    </NativeContainer>
  );
}
