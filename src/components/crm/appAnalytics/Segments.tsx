import { cn } from '@/lib/utils';
import { ANSWER_SEGS, SEG_KEYS, segText, type SegKey, type Segment, type SegmentOptions } from './marketing';

type T = (k: string, o?: Record<string, unknown>) => string;

/**
 * The cuts row above the panel (S4, «hamma kesimlar»): one select per cut,
 * «Kanal: hammasi» until one is picked. The answers and the cities list what
 * has been seen; a cut with nothing seen yet is left out.
 */
export default function Segments({
  seg,
  onChange,
  names,
  options,
  channels,
  t,
}: {
  seg: Segment;
  onChange: (seg: Segment) => void;
  names: Record<string, string>;
  options: SegmentOptions;
  /** The channel keys, in their order (the table's rows). */
  channels: string[];
  t: T;
}) {
  const values = (k: SegKey): string[] => {
    switch (k) {
      case 'who':
        return ['guest', 'client'];
      case 'channel':
        return channels;
      case 'platform':
        return ['android', 'ios', 'web'];
      case 'age':
        return ['new', 'returning'];
      case 'for_whom':
        return ['self', 'child', 'relative'];
      case 'region':
        return options.regions.map((r) => r.value);
      default:
        return (ANSWER_SEGS as readonly string[]).includes(k) ? (options.answers[k] ?? []).map((a) => a.band) : [];
    }
  };
  const set = (k: SegKey, v: string) => {
    const next = { ...seg };
    if (v) next[k] = v;
    else delete next[k];
    onChange(next);
  };
  const any = SEG_KEYS.some((k) => seg[k]);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('marketing.seg.title')}>
      <span className="text-[12px] font-semibold text-muted-foreground">{t('marketing.seg.title')}</span>
      {SEG_KEYS.map((k) => {
        const list = values(k);
        // a cut already picked stays, even if its value is no longer listed
        if (!list.length && !seg[k]) return null;
        const label = t(`marketing.seg.keys.${k}`);
        const all = seg[k] && !list.includes(seg[k] as string) ? [...list, seg[k] as string] : list;
        return (
          <select
            key={k}
            value={seg[k] ?? ''}
            onChange={(e) => set(k, e.target.value)}
            aria-label={label}
            className={cn(
              'max-w-[15rem] rounded-md border px-2 py-1 text-[12.5px]',
              seg[k] ? 'border-[#2447D6] bg-[#E3E9FB] font-semibold text-[#0A1A34] dark:border-[#93A7FF] dark:bg-[#17235F] dark:text-[#EEF2FB]' : 'border-border bg-background',
            )}
          >
            <option value="">{`${label}: ${t('marketing.seg.all')}`}</option>
            {all.map((v) => (
              <option key={v} value={v}>
                {segText(k, v, names, t)}
              </option>
            ))}
          </select>
        );
      })}
      {any && (
        <button type="button" onClick={() => onChange({})} className="px-1 text-[12px] font-semibold text-[#2447D6] underline dark:text-[#93A7FF]">
          {t('marketing.seg.clear')}
        </button>
      )}
    </div>
  );
}
