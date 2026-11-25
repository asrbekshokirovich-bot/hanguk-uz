import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { CalendarCheck, Check, Loader2, MapPin, Search } from 'lucide-react';
import { NativeContainer } from '@/components/native/NativeContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ISH_SCHEMA } from '@/lib/ish/api';
import {
  NO_FILTER,
  WAGE_OPTIONS,
  filterJobs,
  jobText,
  koreanE164,
  openMonthlyJobs,
  publicIshClient,
  splitName,
  wonText,
  type JobFilter,
  type PublicLang,
} from '@/lib/ish/publicJobs';
import type { IshMonthlyJob } from '@/lib/ish/types';

// HanPyol: the public page of the open monthly jobs (hanguk.uz/ish). Anyone
// reads them; «Qiziqaman» asks for a phone number and an SMS code (the same
// sign-in as the app), then the staff call both sides. Texts are inline in the
// four languages, like the other public HanPyol pages.

const ANY = '__any__';

const CATEGORY_KEYS = ['cafe', 'restaurant', 'retail', 'logistics', 'event', 'office', 'other'] as const;

const TEXT: Record<PublicLang, Record<string, string> & { categories: string }> = {
  uz: {
    title: 'HanPyol — oylik ishlar',
    h1: 'Koreyada oylik ishlar',
    sub: 'Oyiga maosh to\'lanadigan doimiy ishlar. "Qiziqaman" ni bossangiz, Hanguk xodimi siz bilan bog\'lanadi.',
    app: 'Kunlik smenalar uchun ilovani yuklab oling',
    search: 'Qidirish (ish, kompaniya, joy)',
    pay: 'Oylik maosh',
    anyPay: 'Farqi yo\'q',
    field: 'Soha',
    anyField: 'Barchasi',
    time: 'Ish vaqti',
    anyTime: 'Farqi yo\'q',
    day: 'Kunduzgi',
    night: 'Kechgi',
    perMonth: '/ oy',
    daysHours: 'Haftasiga {days} kun · kuniga {hours} soat',
    daysOnly: 'Haftasiga {days} kun',
    interested: 'Qiziqaman',
    sent: 'Qiziqish bildirildi. Hanguk xodimi siz bilan bog\'lanadi.',
    withdraw: 'Bekor qilish',
    empty: 'Hozircha mos oylik ish yo\'q',
    emptyText: 'Filtrni o\'zgartiring yoki keyinroq qaytib keling.',
    failed: 'Ishlarni yuklab bo\'lmadi. Keyinroq urinib ko\'ring.',
    count: '{n} ta ish',
    signInTitle: 'Telefon raqamingiz',
    signInIntro: 'Hanguk xodimi shu raqamga qo\'ng\'iroq qiladi. SMS kod yuboramiz.',
    name: 'Ism va familiya',
    phone: 'Telefon raqam (010-0000-0000)',
    send: 'Kod yuborish',
    code: 'SMS kod (6 raqam)',
    confirm: 'Tasdiqlash va qiziqish bildirish',
    badPhone: 'Koreya raqamini kiriting: 010-0000-0000',
    badCode: 'Kod noto\'g\'ri yoki eskirgan.',
    smsFailed: 'Kod yuborib bo\'lmadi. Keyinroq urinib ko\'ring.',
    signedIn: 'Kirdingiz',
    signOut: 'Chiqish',
    categories: 'Kafe|Restoran|Do\'kon|Logistika|Tadbir|Ofis|Boshqa',
  },
  ru: {
    title: 'HanPyol — работа на месяц',
    h1: 'Работа на месяц в Корее',
    sub: 'Постоянная работа с оплатой за месяц. Нажмите «Мне интересно» — сотрудник Hanguk свяжется с вами.',
    app: 'Скачайте приложение для смен на один день',
    search: 'Поиск (работа, компания, место)',
    pay: 'Зарплата в месяц',
    anyPay: 'Любая',
    field: 'Сфера',
    anyField: 'Все',
    time: 'Время работы',
    anyTime: 'Любое',
    day: 'Дневная',
    night: 'Вечерняя и ночная',
    perMonth: '/ мес.',
    daysHours: '{days} дн. в неделю · {hours} ч в день',
    daysOnly: '{days} дн. в неделю',
    interested: 'Мне интересно',
    sent: 'Интерес отправлен. Сотрудник Hanguk свяжется с вами.',
    withdraw: 'Отменить',
    empty: 'Подходящей работы пока нет',
    emptyText: 'Измените фильтр или загляните позже.',
    failed: 'Не удалось загрузить работу. Попробуйте позже.',
    count: 'Работ: {n}',
    signInTitle: 'Ваш номер телефона',
    signInIntro: 'Сотрудник Hanguk позвонит на этот номер. Мы пришлём код по SMS.',
    name: 'Имя и фамилия',
    phone: 'Номер телефона (010-0000-0000)',
    send: 'Отправить код',
    code: 'Код из SMS (6 цифр)',
    confirm: 'Подтвердить и отправить интерес',
    badPhone: 'Введите корейский номер: 010-0000-0000',
    badCode: 'Код неверный или устарел.',
    smsFailed: 'Не удалось отправить код. Попробуйте позже.',
    signedIn: 'Вы вошли',
    signOut: 'Выйти',
    categories: 'Кафе|Ресторан|Магазин|Логистика|Мероприятия|Офис|Другое',
  },
  en: {
    title: 'HanPyol — monthly jobs',
    h1: 'Monthly jobs in Korea',
    sub: 'Long-term jobs paid by the month. Tap “I\'m interested” and a Hanguk staff member will contact you.',
    app: 'Get the app for one-day shifts',
    search: 'Search (job, company, place)',
    pay: 'Monthly pay',
    anyPay: 'Any',
    field: 'Field',
    anyField: 'All',
    time: 'Working hours',
    anyTime: 'Any',
    day: 'Daytime',
    night: 'Evening and night',
    perMonth: '/ month',
    daysHours: '{days} days a week · {hours} h a day',
    daysOnly: '{days} days a week',
    interested: 'I\'m interested',
    sent: 'Interest sent. A Hanguk staff member will contact you.',
    withdraw: 'Withdraw',
    empty: 'No matching monthly jobs yet',
    emptyText: 'Change the filter or come back later.',
    failed: 'The jobs could not be loaded. Try again later.',
    count: '{n} jobs',
    signInTitle: 'Your phone number',
    signInIntro: 'A Hanguk staff member will call this number. We will text you a code.',
    name: 'Full name',
    phone: 'Phone number (010-0000-0000)',
    send: 'Send code',
    code: 'SMS code (6 digits)',
    confirm: 'Confirm and send interest',
    badPhone: 'Enter a Korean number: 010-0000-0000',
    badCode: 'The code is wrong or has expired.',
    smsFailed: 'The code could not be sent. Try again later.',
    signedIn: 'Signed in',
    signOut: 'Sign out',
    categories: 'Café|Restaurant|Shop|Logistics|Event|Office|Other',
  },
  ko: {
    title: 'HanPyol — 월급 일자리',
    h1: '한국 월급 일자리',
    sub: '월급으로 지급되는 장기 일자리예요. \'관심 있어요\'를 누르면 Hanguk 담당자가 연락드려요.',
    app: '하루 단위 근무는 앱에서 확인하세요',
    search: '검색 (일자리, 회사, 지역)',
    pay: '월급',
    anyPay: '전체',
    field: '분야',
    anyField: '전체',
    time: '근무 시간대',
    anyTime: '무관',
    day: '주간',
    night: '야간',
    perMonth: '/ 월',
    daysHours: '주 {days}일 · 하루 {hours}시간',
    daysOnly: '주 {days}일',
    interested: '관심 있어요',
    sent: '관심을 보냈어요. Hanguk 담당자가 연락드려요.',
    withdraw: '취소',
    empty: '맞는 월급 일자리가 아직 없어요',
    emptyText: '필터를 바꾸거나 나중에 다시 확인해 주세요.',
    failed: '일자리를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    count: '{n}건',
    signInTitle: '전화번호',
    signInIntro: 'Hanguk 담당자가 이 번호로 전화드려요. 문자로 인증번호를 보내요.',
    name: '이름',
    phone: '전화번호 (010-0000-0000)',
    send: '인증번호 받기',
    code: '문자 인증번호 (6자리)',
    confirm: '확인하고 관심 보내기',
    badPhone: '한국 번호를 입력해 주세요: 010-0000-0000',
    badCode: '인증번호가 틀렸거나 만료됐어요.',
    smsFailed: '인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
    signedIn: '로그인됨',
    signOut: '로그아웃',
    categories: '카페|음식점|매장|물류|행사|사무|기타',
  },
};

const LANGS = Object.keys(TEXT) as PublicLang[];

function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

export default function IshJobs() {
  const { i18n } = useTranslation();
  const queryLang = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
  const picked = (queryLang || i18n.language || 'uz').slice(0, 2) as PublicLang;
  const lang: PublicLang = LANGS.includes(picked) ? picked : 'uz';
  const c = TEXT[lang];
  usePageTitle(c.title);
  const client = useMemo(() => publicIshClient(), []);
  return <IshJobsView client={client} lang={lang} />;
}

/** The page on [client] (tests pass a fake one). */
export function IshJobsView({ client, lang }: { client: SupabaseClient; lang: PublicLang }) {
  const c = TEXT[lang];
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<JobFilter>(NO_FILTER);
  const [session, setSession] = useState<Session | null>(null);
  const [signIn, setSignIn] = useState<IshMonthlyJob | null>(null);

  useEffect(() => {
    let live = true;
    void client.auth.getSession().then(({ data }) => live && setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const jobs = useQuery({ queryKey: ['ish-public-jobs'], queryFn: () => openMonthlyJobs(client) });
  const mine = useQuery({
    queryKey: ['ish-public-interest', session?.user.id],
    enabled: session !== null,
    queryFn: async () => {
      const { data, error } = await client.schema(ISH_SCHEMA).from('monthly_applications').select('job_id');
      if (error) throw new Error(error.message);
      return new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id));
    },
  });
  const interested = mine.data ?? new Set<string>();

  const add = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await client.schema(ISH_SCHEMA).from('monthly_applications').insert({ job_id: jobId });
      // Already interested (a second tap): fine.
      if (error && error.code !== '23505') throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ish-public-interest'] }),
  });
  const withdraw = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await client.schema(ISH_SCHEMA).from('monthly_applications').delete().eq('job_id', jobId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ish-public-interest'] }),
  });

  const shown = filterJobs(jobs.data ?? [], filter);
  const categoryNames = c.categories.split('|');

  return (
    <NativeContainer className="bg-background">
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b bg-background/95 pt-[env(safe-area-inset-top)]">
          <div className="container mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <a href="/" className="text-lg font-bold">
              HanPyol
            </a>
            <nav className="flex gap-3 text-sm" aria-label="Language">
              {LANGS.map((code) => (
                <a key={code} href={`?lang=${code}`} className={code === lang ? 'font-semibold underline' : 'text-muted-foreground'}>
                  {code.toUpperCase()}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main className="container mx-auto max-w-3xl space-y-5 px-4 py-6">
          <section className="space-y-2">
            <h1 className="text-2xl font-bold sm:text-3xl">{c.h1}</h1>
            <p className="text-muted-foreground">{c.sub}</p>
            <a href="/app" className="inline-block text-sm font-medium text-primary underline">
              {c.app}
            </a>
          </section>

          <section className="grid gap-3 sm:grid-cols-4" aria-label="Filters">
            <div className="relative sm:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                aria-label={c.search}
                placeholder={c.search}
                value={filter.query}
                onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
              />
            </div>
            <Select
              value={filter.minWage === null ? ANY : String(filter.minWage)}
              onValueChange={(v) => setFilter((f) => ({ ...f, minWage: v === ANY ? null : Number(v) }))}
            >
              <SelectTrigger aria-label={c.pay}>
                <SelectValue placeholder={c.pay} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{`${c.pay}: ${c.anyPay}`}</SelectItem>
                {WAGE_OPTIONS.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    {`${wonText(w)}+`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.category ?? ANY}
              onValueChange={(v) => setFilter((f) => ({ ...f, category: v === ANY ? null : v }))}
            >
              <SelectTrigger aria-label={c.field}>
                <SelectValue placeholder={c.field} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{`${c.field}: ${c.anyField}`}</SelectItem>
                {CATEGORY_KEYS.map((key, i) => (
                  <SelectItem key={key} value={key}>
                    {categoryNames[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.workTime ?? ANY}
              onValueChange={(v) => setFilter((f) => ({ ...f, workTime: v === ANY ? null : (v as 'day' | 'night') }))}
            >
              <SelectTrigger aria-label={c.time}>
                <SelectValue placeholder={c.time} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{`${c.time}: ${c.anyTime}`}</SelectItem>
                <SelectItem value="day">{`${c.day} (06–18)`}</SelectItem>
                <SelectItem value="night">{`${c.night} (18–06)`}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
              {session ? (
                <>
                  <span>{c.signedIn}</span>
                  <button className="underline" onClick={() => void client.auth.signOut()}>
                    {c.signOut}
                  </button>
                </>
              ) : (
                <span>{jobs.data ? fill(c.count, { n: shown.length }) : ''}</span>
              )}
            </div>
          </section>

          {jobs.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : jobs.isError ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-destructive" role="alert">
                {c.failed}
              </CardContent>
            </Card>
          ) : shown.length === 0 ? (
            <Card>
              <CardContent className="space-y-1 p-8 text-center">
                <p className="font-semibold">{c.empty}</p>
                <p className="text-sm text-muted-foreground">{c.emptyText}</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-4">
              {shown.map((job) => (
                <li key={job.id}>
                  <JobCard
                    job={job}
                    lang={lang}
                    interested={interested.has(job.id)}
                    busy={add.isPending || withdraw.isPending}
                    onInterested={() => (session ? add.mutate(job.id) : setSignIn(job))}
                    onWithdraw={() => withdraw.mutate(job.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
      {signIn && (
        <SignInDialog
          client={client}
          lang={lang}
          onClose={() => setSignIn(null)}
          onSignedIn={async () => {
            const job = signIn;
            setSignIn(null);
            add.mutate(job.id);
          }}
        />
      )}
    </NativeContainer>
  );
}

function JobCard({
  job,
  lang,
  interested,
  busy,
  onInterested,
  onWithdraw,
}: {
  job: IshMonthlyJob;
  lang: PublicLang;
  interested: boolean;
  busy: boolean;
  onInterested: () => void;
  onWithdraw: () => void;
}) {
  const c = TEXT[lang];
  const area = jobText(job, lang, 'area');
  const description = jobText(job, lang, 'description');
  const schedule = job.days_per_week
    ? job.hours_per_day
      ? fill(c.daysHours, { days: job.days_per_week, hours: job.hours_per_day })
      : fill(c.daysOnly, { days: job.days_per_week })
    : null;
  return (
    <Card data-testid={`ish-job-${job.id}`}>
      <CardContent className="space-y-3 p-5">
        <div>
          <h2 className="text-lg font-semibold leading-snug">{jobText(job, lang, 'title')}</h2>
          <p className="text-sm text-muted-foreground">{jobText(job, lang, 'company')}</p>
        </div>
        <p className="font-mono text-2xl font-bold">
          {wonText(job.monthly_wage)} <span className="font-sans text-sm font-medium text-muted-foreground">{c.perMonth}</span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {schedule && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              {schedule}
            </span>
          )}
          {area && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {area}
            </span>
          )}
          {job.work_time && <Badge variant="secondary">{job.work_time === 'day' ? c.day : c.night}</Badge>}
        </div>
        {description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>}
        {interested ? (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              {c.sent}
            </p>
            <div>
              <Button variant="outline" size="sm" disabled={busy} onClick={onWithdraw}>
                {c.withdraw}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full sm:w-auto" disabled={busy} onClick={onInterested}>
            {c.interested}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Phone number and SMS code (the apps' sign-in); a new number becomes a worker account. */
function SignInDialog({
  client,
  lang,
  onClose,
  onSignedIn,
}: {
  client: SupabaseClient;
  lang: PublicLang;
  onClose: () => void;
  onSignedIn: () => void | Promise<void>;
}) {
  const c = TEXT[lang];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const e164 = koreanE164(phone);
    if (!e164) return setError(c.badPhone);
    setBusy(true);
    setError(null);
    // The apps' sign-up mark: hanguk.uz's own sign-up leaves the account alone.
    const { error: err } = await client.auth.signInWithOtp({ phone: e164, options: { data: { app: 'hanguk_ish' } } });
    setBusy(false);
    if (err) return setError(c.smsFailed);
    setStep('code');
  }

  async function confirm() {
    const e164 = koreanE164(phone);
    if (!e164 || !/^\d{6}$/.test(code.trim())) return setError(c.badCode);
    setBusy(true);
    setError(null);
    const { data, error: err } = await client.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    if (err || !data.session) {
      setBusy(false);
      return setError(c.badCode);
    }
    // The name the staff will ask for (the profile of a new number is empty).
    const { first, last } = splitName(name);
    if (first) {
      await client
        .schema(ISH_SCHEMA)
        .from('profiles')
        .update({ first_name: first.slice(0, 60), last_name: last.slice(0, 60) })
        .eq('id', data.session.user.id);
    }
    setBusy(false);
    await onSignedIn();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{c.signInTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{c.signInIntro}</p>
        <div className="space-y-3">
          <Input aria-label={c.name} placeholder={c.name} autoComplete="name" value={name} disabled={busy || step === 'code'} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-label={c.phone}
            placeholder={c.phone}
            value={phone}
            disabled={busy || step === 'code'}
            onChange={(e) => setPhone(e.target.value)}
          />
          {step === 'phone' ? (
            <Button className="w-full" disabled={busy} onClick={sendCode}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {c.send}
            </Button>
          ) : (
            <>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-label={c.code}
                placeholder={c.code}
                value={code}
                disabled={busy}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <Button className="w-full" disabled={busy} onClick={confirm}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {c.confirm}
              </Button>
            </>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
