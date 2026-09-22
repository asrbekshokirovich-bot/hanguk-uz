import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { FeeRosterEntry } from '@/hooks/useApplicationFeePayments';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

interface Props {
  entry: FeeRosterEntry;
  onOpen: (entry: FeeRosterEntry) => void;
}

/** Talaba kartochkasi — necha marta to'lov qilingani yashil belgida ko'rinadi. */
export function FeeStudentCard({ entry, onOpen }: Props) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(entry);
        }
      }}
      className="cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardContent className="flex items-center gap-3 p-4">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={entry.avatar_url || undefined} />
          <AvatarFallback className="text-xs font-semibold">{getInitials(entry.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-snug" title={entry.full_name ?? undefined}>
            {entry.full_name || '—'}
          </p>
          {entry.office_location && (
            <p className="truncate text-xs text-muted-foreground">{entry.office_location}</p>
          )}
        </div>
        {entry.paidCount > 0 ? (
          <Badge variant="successSoft" className="shrink-0">
            {entry.paidCount} to'langan
          </Badge>
        ) : (
          <Badge variant="neutral" className="shrink-0">
            To'lov yo'q
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
