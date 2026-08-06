import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useActiveIntake } from '@/contexts/IntakeContext';

type StudentProfile = Tables<'profiles'>;

interface TransferStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProfile | null;
  onSuccess: () => void;
}

/**
 * Moves a student from the CRM's active season to the following one.
 *
 * "Following" is Spring → Fall of the same year, Fall → Spring of the next.
 * The target intake has to already exist (Manage intakes) — this dialog never
 * creates one.
 *
 * What moves: the roster membership (`student_intakes`) plus the work that is
 * still ahead of the student — applications, documents, tasks, scheduled
 * payments and the season budget. What stays: `payments`. Those record money
 * that actually changed hands during the old season, and the investor P&L is
 * reported per season, so re-stamping them would rewrite finished books.
 */
export function TransferStudentDialog({ open, onOpenChange, student, onSuccess }: TransferStudentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeIntakeId, season, year, intakeFor } = useActiveIntake();
  const [loading, setLoading] = useState(false);

  const nextSeason = season === 'spring' ? 'fall' : 'spring';
  const nextYear = season === 'spring' ? (year ?? 0) : (year ?? 0) + 1;
  const target = season && year ? intakeFor(nextSeason, nextYear) : undefined;

  const label = (s: string, y: number) => `${t(`intake.season.${s}`)} ${y}`;
  const fromLabel = season && year ? label(season, year) : '';
  const toLabel = label(nextSeason, nextYear);

  const handleTransfer = async () => {
    if (!student || !activeIntakeId || !target) return;
    setLoading(true);
    try {
      // Already on the target season? Then the membership row would collide
      // with the existing one — drop the old one instead of re-pointing it.
      const { data: existing } = await supabase
        .from('student_intakes')
        .select('id')
        .eq('student_id', student.user_id)
        .eq('intake_id', target.id)
        .maybeSingle();

      const scoped = { student_id: student.user_id, intake_id: activeIntakeId };
      const move = (table: 'applications' | 'documents' | 'tasks' | 'scheduled_payments' | 'student_budgets') =>
        supabase.from(table).update({ intake_id: target.id }).match(scoped);

      await move('applications');
      await move('documents');
      await move('tasks');
      await move('scheduled_payments');
      await move('student_budgets');

      if (existing) {
        const { error } = await supabase.from('student_intakes').delete().match(scoped);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('student_intakes')
          .update({ intake_id: target.id })
          .match(scoped);
        if (error) throw error;
      }

      toast({
        title: t('common.success'),
        description: t('crm.transferDone', {
          name: student.full_name ?? '',
          season: toLabel,
          defaultValue: `${student.full_name} moved to ${toLabel}`,
        }),
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('crm.transferTitle', { season: toLabel, defaultValue: `Move to ${toLabel}?` })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {!target
              ? t('crm.transferNoIntake', {
                  season: toLabel,
                  defaultValue: `The ${toLabel} intake does not exist yet. Create it under Manage intakes first.`,
                })
              : t('crm.transferBody', {
                  name: student?.full_name ?? '',
                  from: fromLabel,
                  to: toLabel,
                  defaultValue: `Move ${student?.full_name} from ${fromLabel} to ${toLabel}? Their applications, documents, tasks and scheduled payments move with them. Recorded payments stay in ${fromLabel}.`,
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || !target}
            onClick={(e) => {
              e.preventDefault();
              handleTransfer();
            }}
          >
            {t('common.yes', { defaultValue: 'Yes' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
