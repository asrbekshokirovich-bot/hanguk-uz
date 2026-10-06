import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { decidePromise, fetchPendingPromises } from '../api';
import { ago } from '../time';
import { Empty, Panel } from './ReportParts';
import { explainLeadError, PROMISE_KIND_LABEL } from './labels';
import { useStaffNames } from './useStaffNames';

/**
 * "Tasdiq kutayotgan va'dalar" (spec §11): the boss approves or rejects a
 * discount / special-terms request an operator raised. Boss only: the page
 * mounts it for `isAdmin`, and `lead_decide_promise` checks it again.
 */
export default function PromisesPanel({ onOpenLead }: { onOpenLead?: (leadId: string) => void }) {
  const qc = useQueryClient();
  const { nameOf } = useStaffNames();
  const pending = useQuery({ queryKey: ['lead-v2', 'promises', 'pending'], queryFn: fetchPendingPromises });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    setErrors((e) => {
      const rest = { ...e };
      delete rest[id];
      return rest;
    });
    try {
      await decidePromise(id, approve);
      toast.success(approve ? "Va'da tasdiqlandi" : "Va'da rad etildi");
      await qc.invalidateQueries({ queryKey: ['lead-v2', 'promises'] });
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: explainLeadError(e) }));
    } finally {
      setBusyId(null);
    }
  };

  const rows = pending.data ?? [];
  return (
    <Panel
      title="Tasdiq kutayotgan va'dalar"
      hint="Operator so'ragan chegirma / maxsus shartlar. Tasdiqlangunicha operator mijozga bu shartni yoza olmaydi."
    >
      {pending.isLoading ? (
        <Empty>Yuklanmoqda…</Empty>
      ) : pending.error ? (
        <div role="alert" className="flex items-center justify-between gap-2 text-[13px]">
          <span>{explainLeadError(pending.error)}</span>
          <Button size="sm" variant="outline" onClick={() => void pending.refetch()}>
            Qayta urinish
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <Empty>Tasdiq kutayotgan so'rov yo'q</Empty>
      ) : (
        <ul className="divide-y">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-2 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  {onOpenLead ? (
                    <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => onOpenLead(p.lead_id)}>
                      {p.leads?.full_name ?? 'Lid'}
                    </button>
                  ) : (
                    <span className="font-medium">{p.leads?.full_name ?? 'Lid'}</span>
                  )}
                  <span className="rounded border px-1.5 text-[11px] text-muted-foreground">{PROMISE_KIND_LABEL[p.kind] ?? p.kind}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {nameOf(p.operator_id) ?? 'Operator'} · {ago(p.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{p.text}</p>
                {p.reason && <p className="text-[12px] text-muted-foreground">Sabab: {p.reason}</p>}
                {errors[p.id] && (
                  <p role="alert" className="mt-1 text-[12px] text-destructive">
                    {errors[p.id]}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" disabled={busyId === p.id} onClick={() => void decide(p.id, true)}>
                  Tasdiqlash
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => void decide(p.id, false)}>
                  Rad etish
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
