import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, Gift, Loader2, Search, X } from 'lucide-react';
import { EMPTY_PANEL, isPanelActive, SORT_OPTIONS, type PanelFilter, type SortKey } from './sorting';

/** Radix Select bo'sh qiymatni qabul qilmaydi. */
const ANY = '__any__';

const TOPIK_LEVELS = [1, 2, 3, 4, 5, 6];
const IELTS_SCORES = [4.5, 5, 5.5, 6, 6.5, 7, 7.5];

interface Props {
  value: PanelFilter;
  onChange: (next: PanelFilter) => void;
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
  cities: string[];
  /** Fakultet nomlari va grantlar hali yuklanmoqda. */
  extrasLoading: boolean;
}

/**
 * Operator va admin uchun saralash paneli: talabaning til darajasi, shahar,
 * yo'nalish, grant va saralash tartibi. Daraja (bakalavr / magistr / kasbiy)
 * katalogning o'zidagi tugmalarda.
 */
export function SortPanel({ value, onChange, sort, onSortChange, cities, extrasLoading }: Props) {
  const set = (patch: Partial<PanelFilter>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="panel-topik" className="text-xs text-muted-foreground">
            Talabaning TOPIK darajasi
          </Label>
          <Select
            value={value.topik === null ? ANY : String(value.topik)}
            onValueChange={(v) => set({ topik: v === ANY ? null : Number(v) })}
          >
            <SelectTrigger id="panel-topik" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Farqi yo'q</SelectItem>
              {TOPIK_LEVELS.map((l) => (
                <SelectItem key={l} value={String(l)}>
                  TOPIK {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="panel-ielts" className="text-xs text-muted-foreground">
            Talabaning IELTS bali
          </Label>
          <Select
            value={value.ielts === null ? ANY : String(value.ielts)}
            onValueChange={(v) => set({ ielts: v === ANY ? null : Number(v) })}
          >
            <SelectTrigger id="panel-ielts" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Farqi yo'q</SelectItem>
              {IELTS_SCORES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  IELTS {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="panel-city" className="text-xs text-muted-foreground">
            Shahar
          </Label>
          <Select value={value.city ?? ANY} onValueChange={(v) => set({ city: v === ANY ? null : v })}>
            <SelectTrigger id="panel-city" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Hammasi</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="panel-sort" className="text-xs text-muted-foreground">
            Saralash
          </Label>
          <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
            <SelectTrigger id="panel-sort" className="h-9">
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-80">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.direction}
            onChange={(e) => set({ direction: e.target.value })}
            placeholder="Yo'nalish: IT, hamshiralik, biznes..."
            className="pl-8"
            aria-label="Yo'nalish qidirish"
          />
          {extrasLoading && value.direction.trim() !== '' && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          variant={value.grantOnly ? 'default' : 'outline'}
          size="sm"
          aria-pressed={value.grantOnly}
          onClick={() => set({ grantOnly: !value.grantOnly })}
        >
          <Gift className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Granti borlar
        </Button>
        {(isPanelActive(value) || sort !== 'nom') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(EMPTY_PANEL);
              onSortChange('nom');
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Tozalash
          </Button>
        )}
      </div>
      {value.topik !== null && value.ielts !== null && (
        <p className="text-xs text-muted-foreground">
          TOPIK yoki IELTS bo'yicha mos keladiganlar ko'rsatiladi.
        </p>
      )}
    </div>
  );
}
