import type { LeadSettings } from '../../types';
import {
  buildHours,
  buildTimer,
  hoursToForm,
  timerToForm,
  validateAnnounce,
  validateHours,
  validateQueueLimit,
  validateTimer,
  WEEKDAYS,
  type AnnounceForm,
  type HoursForm,
  type TimerForm,
} from '../settingsModel';
import { cn } from '@/lib/utils';
import { SectionShell, SwitchRow, TextField } from './SectionShell';
import { useSettingsSection } from './useSettingsSection';

interface Props {
  settings: LeadSettings;
}

// ---- Ish vaqti --------------------------------------------------------------------

export function HoursSection({ settings }: Props) {
  const s = useSettingsSection<HoursForm>({
    id: 'hours',
    server: hoursToForm(settings.work_hours),
    build: (f) => ({ work_hours: buildHours(f) }),
    validate: validateHours,
  });
  const f = s.draft;
  const toggle = (n: number) =>
    s.setDraft((d) => ({ ...d, days: d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n].sort((a, b) => a - b) }));
  return (
    <SectionShell
      id="hours"
      title="Ish vaqti"
      description="Taymer shu soatlarda ishlaydi. Tashqarida kelgan lid ertasi kuni ochilish vaqtida HOZIR'ning tepasida turadi (Toshkent vaqti)."
      section={s}
    >
      <div className="flex flex-wrap gap-4">
        <TextField label="Boshlanish" type="time" value={f.start} onChange={(start) => s.setDraft((d) => ({ ...d, start }))} className="w-32" />
        <TextField label="Tugash" type="time" value={f.end} onChange={(end) => s.setDraft((d) => ({ ...d, end }))} className="w-32" />
      </div>
      <div>
        <div className="mb-1 text-[13px] font-medium" id="hours-days">
          Ish kunlari
        </div>
        <div className="flex gap-1.5" role="group" aria-labelledby="hours-days">
          {WEEKDAYS.map((d) => (
            <button
              key={d.n}
              type="button"
              aria-pressed={f.days.includes(d.n)}
              onClick={() => toggle(d.n)}
              className={cn(
                'h-8 w-9 rounded-md border text-[13px]',
                f.days.includes(d.n) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

// ---- Taymer va eskalatsiya ----------------------------------------------------------

export function TimerSection({ settings }: Props) {
  const s = useSettingsSection<TimerForm>({
    id: 'timer',
    server: timerToForm(settings),
    build: buildTimer,
    validate: validateTimer,
  });
  return (
    <SectionShell
      id="timer"
      title="Taymer va eskalatsiya"
      description="Yangi lid javobsiz qolsa necha daqiqadan keyin buzilish hisoblanadi, va xabar qancha vaqtda takrorlanadi (javob berilgunicha)."
      section={s}
    >
      <div className="flex flex-wrap gap-4">
        <TextField
          label="Taymer (daqiqa)"
          inputMode="numeric"
          value={s.draft.timer}
          onChange={(timer) => s.setDraft((d) => ({ ...d, timer }))}
          hint="Standart 10"
          className="w-40"
        />
        <TextField
          label="Takror (daqiqa)"
          inputMode="numeric"
          value={s.draft.repeat}
          onChange={(repeat) => s.setDraft((d) => ({ ...d, repeat }))}
          hint="Standart 10"
          className="w-40"
        />
      </div>
    </SectionShell>
  );
}

// ---- Navbat kunlik limiti -------------------------------------------------------------

export function QueueLimitSection({ settings }: Props) {
  const s = useSettingsSection<{ limit: string }>({
    id: 'queue_limit',
    server: { limit: String(settings.queue_daily_limit) },
    build: (f) => ({ queue_daily_limit: Number(f.limit) }),
    validate: (f) => validateQueueLimit(f.limit),
  });
  return (
    <SectionShell
      id="queue_limit"
      title="Navbat kunlik limiti"
      description="Qayta faollashtirish navbati boshlanganda lidlar BUGUN'ga kuniga shuncha tadan tushadi."
      section={s}
    >
      <TextField
        label="Kuniga lidlar soni"
        inputMode="numeric"
        value={s.draft.limit}
        onChange={(limit) => s.setDraft({ limit })}
        hint="Standart 15"
        className="w-40"
      />
    </SectionShell>
  );
}

// ---- Hanbox / NO RISK ------------------------------------------------------------------

export function AnnounceSection({ settings }: Props) {
  const s = useSettingsSection<AnnounceForm>({
    id: 'announce',
    server: {
      hanbox_group_date: settings.hanbox_group_date,
      hanbox_announced: settings.hanbox_announced,
      no_risk_announced: settings.no_risk_announced,
    },
    build: (f) => ({
      hanbox_group_date: f.hanbox_group_date,
      hanbox_announced: f.hanbox_announced,
      no_risk_announced: f.no_risk_announced,
    }),
    validate: validateAnnounce,
  });
  const f = s.draft;
  return (
    <SectionShell
      id="announce"
      title="Hanbox va NO RISK e'lonlari"
      description="Navbatlar shu e'londan keyin boshlanadi: Hanbox — keyingi guruh e'lon qilinganda; NO RISK — sharti kartada e'lon qilingach (server shundan oldin NO RISK navbatini boshlamaydi)."
      section={s}
    >
      <TextField
        label="Hanbox guruh sanasi"
        type="date"
        value={f.hanbox_group_date}
        onChange={(hanbox_group_date) => s.setDraft((d) => ({ ...d, hanbox_group_date }))}
        className="w-48"
      />
      <SwitchRow
        label="Hanbox guruhi e'lon qilingan"
        hint="Yoqilgan bo'lsa «Sertifikat yo'q → Hanbox» navbati ishga tushishi mumkin."
        checked={f.hanbox_announced}
        onChange={(hanbox_announced) => s.setDraft((d) => ({ ...d, hanbox_announced }))}
      />
      <SwitchRow
        label="NO RISK sharti e'lon qilingan"
        hint="Qo'ng'iroq oynasi va karta NO RISK shartini ko'rsatganda yoqing. Rahbar tasdig'i belgisi shundan keyin olib tashlanadi."
        checked={f.no_risk_announced}
        onChange={(no_risk_announced) => s.setDraft((d) => ({ ...d, no_risk_announced }))}
      />
    </SectionShell>
  );
}

// ---- Chat javobi telefonli lidni to'xtatadimi -------------------------------------------------

export function PhoneRuleSection({ settings }: Props) {
  const s = useSettingsSection<{ on: boolean }>({
    id: 'phone_rule',
    server: { on: settings.chat_answers_phone_leads },
    build: (f) => ({ chat_answers_phone_leads: f.on }),
  });
  return (
    <SectionShell
      id="phone_rule"
      title="Chat javobi telefonli lidni to'xtatadimi"
      description="Telefon raqami bor lidga «avval qo'ng'iroq, keyin chat» deyiladi."
      section={s}
    >
      <SwitchRow
        label="Chatdagi javob taymerni to'xtatadi"
        hint="O'chiq (standart): telefonli lidda faqat tugallangan qo'ng'iroq, yoki ko'tarmagan qo'ng'iroq + chat taymerni to'xtatadi. Yoqilgan: odam chatga yozgan xabar ham yetadi."
        checked={s.draft.on}
        onChange={(on) => s.setDraft({ on })}
      />
    </SectionShell>
  );
}

// ---- Nazorat chizig'i, TV ----------------------------------------------------------------------

export function SwitchesSection({ settings }: Props) {
  const s = useSettingsSection<{ control: boolean; tv: boolean }>({
    id: 'switches',
    server: { control: settings.control_line_10min, tv: settings.tv_warning },
    build: (f) => ({ control_line_10min: f.control, tv_warning: f.tv }),
  });
  return (
    <SectionShell id="switches" title="Nazorat chizig'i va TV ogohlantirish" section={s}>
      <SwitchRow
        label="Nazorat chizig'i"
        hint="Hisobotda «10 daqiqa ichida javob %» ko'rsatiladi (KPI emas; faqat rahbar va senior ko'radi)."
        checked={s.draft.control}
        onChange={(control) => s.setDraft((d) => ({ ...d, control }))}
      />
      <SwitchRow
        label="TV ogohlantirish"
        hint="Yangi lid 10 daqiqada javobsiz qolsa, ofis TV ekranida username bilan ogohlantirish oynasi chiqadi."
        checked={s.draft.tv}
        onChange={(tv) => s.setDraft((d) => ({ ...d, tv }))}
      />
    </SectionShell>
  );
}
