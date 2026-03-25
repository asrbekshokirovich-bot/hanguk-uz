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
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!student) return;

    setLoading(true);

    try {
      // Delete related records first (cascade should handle most, but let's be explicit)
      // Delete student notes
      await supabase
        .from('student_notes')
        .delete()
        .eq('student_id', student.user_id);

      // Delete student comments
      await supabase
        .from('student_comments')
        .delete()
        .eq('student_id', student.user_id);

      // Delete documents
      await supabase
        .from('documents')
        .delete()
        .eq('student_id', student.user_id);

      // Delete payment transactions for this student's payments
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('student_id', student.user_id);

      if (payments && payments.length > 0) {
        const paymentIds = payments.map(p => p.id);
        await supabase
          .from('payment_transactions')
          .delete()
          .in('payment_id', paymentIds);
      }

      // Delete payments
      await supabase
        .from('payments')
        .delete()
        .eq('student_id', student.user_id);

      // Delete applications
      await supabase
        .from('applications')
        .delete()
        .eq('student_id', student.user_id);

      // Delete calls
      await supabase
        .from('calls')
        .delete()
        .eq('student_id', student.user_id);

      // Delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', student.id);

      if (profileError) throw profileError;

      toast({
        title: t('common.success'),
        description: 'Student deleted successfully',
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to delete student',
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
          <AlertDialogTitle>Delete Student</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{student?.full_name}</strong>? 
            This action cannot be undone and will permanently delete all associated data including:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Applications</li>
              <li>Documents</li>
              <li>Payment records</li>
              <li>Call history</li>
              <li>Notes and comments</li>
            </ul>
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
