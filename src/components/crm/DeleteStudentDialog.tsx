import { useState, useEffect } from 'react';
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

interface DeleteStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProfile | null;
  onSuccess: () => void;
}

export function DeleteStudentDialog({ open, onOpenChange, student, onSuccess }: DeleteStudentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeIntakeId, season, year } = useActiveIntake();
  const [loading, setLoading] = useState(false);
  // How many seasons this student belongs to. >1 => delete only the active
  // season's data; otherwise remove the student entirely.
  const [intakeCount, setIntakeCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !student) {
      setIntakeCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('student_intakes')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.user_id);
      if (!cancelled) setIntakeCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, student]);

  const seasonScoped = (intakeCount ?? 0) > 1 && !!activeIntakeId;
  const seasonLabel = season ? `${t(`intake.season.${season}`)} ${year ?? ''}`.trim() : '';

  const deleteSeasonOnly = async () => {
    if (!student || !activeIntakeId) return;
    // Remove only the active season's pipeline data, keeping the profile and
    // any other season the student belongs to.
    const { data: payments } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', student.user_id)
      .eq('intake_id', activeIntakeId);

    if (payments && payments.length > 0) {
      await supabase
        .from('payment_transactions')
        .delete()
        .in('payment_id', payments.map((p) => p.id));
    }

    await supabase.from('payments').delete().eq('student_id', student.user_id).eq('intake_id', activeIntakeId);
    await supabase.from('documents').delete().eq('student_id', student.user_id).eq('intake_id', activeIntakeId);
    await supabase.from('applications').delete().eq('student_id', student.user_id).eq('intake_id', activeIntakeId);
    await supabase.from('student_budgets').delete().eq('student_id', student.user_id).eq('intake_id', activeIntakeId);
    await supabase.from('scheduled_payments').delete().eq('student_id', student.user_id).eq('intake_id', activeIntakeId);

    const { error } = await supabase
      .from('student_intakes')
      .delete()
      .eq('student_id', student.user_id)
      .eq('intake_id', activeIntakeId);
    if (error) throw error;
  };

  const deleteEntireStudent = async () => {
    if (!student) return;
    // Delete related records first (cascade should handle most, but let's be explicit)
    await supabase.from('student_notes').delete().eq('student_id', student.user_id);
    await supabase.from('student_comments').delete().eq('student_id', student.user_id);
    await supabase.from('documents').delete().eq('student_id', student.user_id);

    const { data: payments } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', student.user_id);

    if (payments && payments.length > 0) {
      await supabase
        .from('payment_transactions')
        .delete()
        .in('payment_id', payments.map((p) => p.id));
    }

    await supabase.from('payments').delete().eq('student_id', student.user_id);
    await supabase.from('applications').delete().eq('student_id', student.user_id);
    await supabase.from('calls').delete().eq('student_id', student.user_id);
    await supabase.from('student_intakes').delete().eq('student_id', student.user_id);

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', student.id);
    if (profileError) throw profileError;
  };

  const handleDelete = async () => {
    if (!student) return;

    setLoading(true);

    try {
      if (seasonScoped) {
        await deleteSeasonOnly();
        toast({
          title: t('common.success'),
          description: `Removed ${student.full_name} from ${seasonLabel}`,
        });
      } else {
        await deleteEntireStudent();
        toast({
          title: t('common.success'),
          description: 'Student deleted successfully',
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Failed to delete student',
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
          <AlertDialogTitle>{seasonScoped ? `Remove from ${seasonLabel}` : 'Delete Student'}</AlertDialogTitle>
          <AlertDialogDescription>
            {seasonScoped ? (
              <>
                <strong>{student?.full_name}</strong> is enrolled in more than one season. This will
                remove them and their data <strong>from {seasonLabel} only</strong>, keeping their
                profile and other seasons intact:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Applications, documents and payments in {seasonLabel}</li>
                  <li>Budgets and scheduled payments in {seasonLabel}</li>
                </ul>
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>{student?.full_name}</strong>?
                This action cannot be undone and will permanently delete all associated data including:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Applications</li>
                  <li>Documents</li>
                  <li>Payment records</li>
                  <li>Call history</li>
                  <li>Notes and comments</li>
                </ul>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? t('common.loading') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
