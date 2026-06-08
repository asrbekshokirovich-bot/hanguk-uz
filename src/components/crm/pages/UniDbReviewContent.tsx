import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCanReviewUniDb } from '@/hooks/useCanReviewUniDb';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldAlert,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

/**
 * University-data review is now FULLY AUTOMATED — there is no human accept /
 * reject / edit step. The pipeline (services/uni_db) auto-approves every
 * content-bearing extraction and the publish worker writes it straight into the
 * applicant-facing tables; low-confidence / difficult-field rows are still
 * published but flagged `needs_attention`.
 *
 * This page is therefore READ-ONLY: it surfaces the auto-published rows that
 * were flagged, grouped by institution + section, so staff can spot-check them.
 * Nothing here blocks data from reaching applicants.
 */

const SECTION_LABEL: Record<string, string> = {
  requirements: 'Admission tracks (전형)',
  documents_required: 'Required documents',
  tuition: 'Tuition',
  scholarships: 'Scholarships',
  admission_cycles: 'Admission cycle',
  admission_periods: 'Admission timeline & fees',
};

interface NeedsAttentionRow {
  section: string;
  id: string;
  institution_id: string;
  name_ko: string | null;
  name_en: string | null;
  attention_reason: string | null;
  created_at: string;
}

const NEEDS_ATTENTION_KEY = ['uni_db', 'needs_attention'] as const;

function useNeedsAttention() {
  return useQuery<NeedsAttentionRow[], Error>({
    queryKey: NEEDS_ATTENTION_KEY,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        // @ts-expect-error - view not in generated types yet
        .from('v_needs_attention')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NeedsAttentionRow[];
    },
  });
}

interface UniGroup {
  key: string;
  nameKo: string | null;
  nameEn: string | null;
  rows: NeedsAttentionRow[];
}

function groupByInstitution(rows: NeedsAttentionRow[]): UniGroup[] {
  const map = new Map<string, UniGroup>();
  for (const row of rows) {
    const key = row.institution_id;
    let g = map.get(key);
    if (!g) {
      g = { key, nameKo: row.name_ko, nameEn: row.name_en, rows: [] };
      map.set(key, g);
    }
    g.rows.push(row);
  }
  return [...map.values()].sort((a, b) => b.rows.length - a.rows.length);
}

function institutionName(g: UniGroup): string {
  return g.nameEn || g.nameKo || 'Unknown institution';
}

function NeedsAttentionView() {
  const { data: rows = [], isLoading, error, refetch, isRefetching } =
    useNeedsAttention();
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            (r.name_en ?? '').toLowerCase().includes(q) ||
            (r.name_ko ?? '').toLowerCase().includes(q) ||
            r.section.toLowerCase().includes(q) ||
            (r.attention_reason ?? '').toLowerCase().includes(q),
        )
      : rows;
    return groupByInstitution(filtered);
  }, [rows, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground">
          Could not load the needs-attention feed: {error.message}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            University data — needs attention
          </h2>
          <p className="text-sm text-muted-foreground">
            Review is automated. These rows were auto-published but flagged for a
            low extractor confidence — they are already live for applicants; this
            list is for spot-checking only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by institution, section, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Empty state — the happy path under automation */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-success mb-3" />
            <h3 className="font-medium">Nothing needs attention</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? 'No flagged rows match your filter.'
                : 'Every auto-published row passed the confidence bar.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-16rem)]">
          <div className="space-y-4 pr-3">
            {groups.map((g) => (
              <Card key={g.key}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{institutionName(g)}</div>
                      {g.nameKo && g.nameEn && (
                        <div className="text-xs text-muted-foreground">{g.nameKo}</div>
                      )}
                    </div>
                    <Badge variant="secondary">{g.rows.length} flagged</Badge>
                  </div>
                  <div className="space-y-2">
                    {g.rows.map((r) => (
                      <div
                        key={`${r.section}:${r.id}`}
                        className="flex items-start gap-3 rounded-md border border-border/60 p-2.5"
                      >
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {SECTION_LABEL[r.section] ?? r.section}
                          </div>
                          {r.attention_reason && (
                            <div className="text-xs text-muted-foreground break-words">
                              {r.attention_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function UniDbReviewContent() {
  const { allowed, loading } = useCanReviewUniDb();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Access restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You don't have permission to view university data.
        </p>
      </div>
    );
  }

  return <NeedsAttentionView />;
}
