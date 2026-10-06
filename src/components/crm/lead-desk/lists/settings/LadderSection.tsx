import type { LeadSettings } from '../../types';
import {
  buildLadder,
  describeStep,
  LADDER_KIND_LABEL,
  ladderToForm,
  validateLadder,
  type LadderForm,
  type LadderKind,
  type LadderStepForm,
} from '../settingsModel';
import { fieldClass } from '../FilterControls';
import { SectionShell, TextField } from './SectionShell';
import { useSettingsSection } from './useSettingsSection';

/**
 * Zinapoya (spec §9): when the next call is due after each miss. Attempt 1 is
 * the first call, so step N schedules attempt N+1. Operators cannot edit these
 * times; only the boss can, here.
 */
export default function LadderSection({ settings }: { settings: LeadSettings }) {
  const s = useSettingsSection<LadderForm>({
    id: 'ladder',
    server: ladderToForm(settings.ladder),
    build: (f) => ({ ladder: buildLadder(f) }),
    validate: validateLadder,
  });
  const f = s.draft;

  const setStep = (i: number, patch: Partial<LadderStepForm>) =>
    s.setDraft((d) => ({ ...d, steps: d.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) }));

  return (
    <SectionShell
      id="ladder"
      title="Zinapoya"
      description={
        <>
          «Ko'tarmadi» natijasidan keyin keyingi qo'ng'iroq qachon bo'lishi. 1-urinish — yangi lidning o'zi (10 daqiqa ichida). Vaqtlar ish soatlariga
          suriladi. Shu qadamlar bo'yicha lid HOZIR'da paydo bo'ladi.
        </>
      }
      section={s}
    >
      <ol className="space-y-2">
        {f.steps.map((st, i) => (
          <li key={i} className="grid grid-cols-[6rem_11rem_7rem_8rem_1fr] items-end gap-3">
            <div className="pb-2 text-[13px] font-medium">{i + 2}-urinish</div>
            <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
              Qachon
              <select
                aria-label={`${i + 2}-urinish turi`}
                className={`${fieldClass} h-9 text-foreground`}
                value={st.kind}
                onChange={(e) => setStep(i, { kind: e.target.value as LadderKind })}
              >
                {(Object.keys(LADDER_KIND_LABEL) as LadderKind[]).map((k) => (
                  <option key={k} value={k}>
                    {LADDER_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {st.kind === 'next_day' ? (
              <span />
            ) : (
              <TextField
                label={st.kind === 'minutes' ? 'Daqiqa' : 'Kun'}
                inputMode="numeric"
                value={st.value}
                onChange={(value) => setStep(i, { value })}
                inputClassName="font-normal"
              />
            )}
            {st.kind === 'minutes' ? (
              <span />
            ) : (
              <TextField label="Soat" type="time" value={st.at} onChange={(at) => setStep(i, { at })} />
            )}
            <div className="pb-2 text-[12px] text-muted-foreground">{describeStep(st)}</div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-4 border-t pt-3">
        <TextField
          label="Oyna (kun)"
          inputMode="numeric"
          value={f.windowDays}
          onChange={(windowDays) => s.setDraft((d) => ({ ...d, windowDays }))}
          hint="Shu kunlar ichida hamma urinish javobsiz qolsa lid «aloqa yo'q» bo'ladi (standart 7)"
          className="w-64"
        />
        <TextField
          label="DM qoralamasi: urinishdan keyin"
          inputMode="numeric"
          value={f.dmAfter}
          onChange={(dmAfter) => s.setDraft((d) => ({ ...d, dmAfter }))}
          hint="«Qo'ng'iroq qildik, qachon qulay?» qoralamasi shu urinishdan boshlab (standart 2)"
          className="w-72"
        />
      </div>
    </SectionShell>
  );
}
