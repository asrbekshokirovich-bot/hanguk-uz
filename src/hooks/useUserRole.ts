import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

// 'investor' was added to public.app_role by migration 20260729_0001 and is not
// in the generated Database type yet, so it is matched as a plain string.
const INVESTOR_ROLE = 'investor';

/** What a «is this user named in table X» read answers. */
type AccessRow = { data: unknown; error?: unknown };

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  // Whose roles the state below holds: undefined until the first answer.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  // The same, readable from inside the effect.
  const loadedForRef = useRef<string | null | undefined>(undefined);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLearningCenter, setIsLearningCenter] = useState(false);
  const [hasFinanceAccess, setHasFinanceAccess] = useState(false);
  const [isDocumentApprover, setIsDocumentApprover] = useState(false);
  const [hasApplicationFeeAccess, setHasApplicationFeeAccess] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [hasPaymentDeleteAccess, setHasPaymentDeleteAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchRoles = async () => {
      if (!userId) {
        setRoles([]);
        setIsLearningCenter(false);
        setHasFinanceAccess(false);
        setIsDocumentApprover(false);
        setHasApplicationFeeAccess(false);
        setHasCameraAccess(false);
        setHasPaymentDeleteAccess(false);
        loadedForRef.current = null;
        setLoadedFor(null);
        return;
      }

      // A learning center holds no app_role (see migration
      // 20260923120000_learning_centers.sql): its learning_centers row is what
      // makes it one. learning_centers is not in the generated types yet.
      // A finance_access row opens "Moliya" to someone who is not an owner
      // (migration 20260930180000_finance_access.sql); it is not in the
      // generated types yet either. Nor is document_approvers (migration
      // 20261014120000_document_approvers.sql), which names who besides the
      // owners approves documents. Nor is application_fee_access (migration
      // 20261026120100_application_fee_access.sql), which opens "Application fee"
      // to named staff without the document_handler role. Nor is camera_access
      // (migration 20261103120000_cameras.sql): whom the owner let watch the
      // office cameras.
      const [
        { data, error },
        center,
        finance,
        approver,
        feeAccess,
        cameraAccess,
        paymentDeleteAccess,
      ] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as unknown as { from: (n: string) => any })
          .from('learning_centers')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle() as Promise<AccessRow>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as unknown as { from: (n: string) => any })
          .from('finance_access')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle() as Promise<AccessRow>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as unknown as { from: (n: string) => any })
          .from('document_approvers')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle() as Promise<AccessRow>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as unknown as { from: (n: string) => any })
          .from('application_fee_access')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle() as Promise<AccessRow>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as unknown as { from: (n: string) => any })
          .from('camera_access')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle() as Promise<AccessRow>,
        // payment_delete_access (migration 20261109090000): who besides
        // owner/admin may delete a payment installment and its receipt.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as unknown as { from: (n: string) => any })
          .from('payment_delete_access')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle() as Promise<AccessRow>,
      ]);

      // An answer for an account that is no longer the one signed in.
      if (cancelled) return;
      // A read that failed says nothing. For the person whose answers are
      // already here (a re-read after a new token) what is known stays; for
      // anyone else it is «none» — never the previous account's.
      const known = loadedForRef.current === userId;
      const flag = (row: AccessRow) => (prev: boolean) => (row.error ? known && prev : Boolean(row.data));
      setRoles((prev) => (!error && data ? data.map((r) => r.role) : known ? prev : []));
      setIsLearningCenter(flag(center));
      setHasFinanceAccess(flag(finance));
      setIsDocumentApprover(flag(approver));
      setHasApplicationFeeAccess(flag(feeAccess));
      setHasCameraAccess(flag(cameraAccess));
      setHasPaymentDeleteAccess(flag(paymentDeleteAccess));
      loadedForRef.current = userId;
      setLoadedFor(userId);
    };

    fetchRoles();
    return () => {
      cancelled = true;
    };
    // On every auth event, as before: a refreshed token hands out a new `user`
    // object, and that is when a role granted or taken away meanwhile shows up.
    // `loading` below goes by the id, so the same person is not «loading» again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Loading until the roles in hand are THIS account's. On a reload the
  // session is restored a moment after the first render; this hook used to
  // answer «loaded, no roles» for that first, signed-out moment and keep saying
  // it when the user appeared — so CRMPortal took a member of staff for «not
  // staff» and sent every reload and every link to a CRM page to the landing
  // page, which sent them on to the dashboard.
  const loading = Boolean(authLoading) || loadedFor !== userId;

  const hasRole = (role: AppRole) => roles.includes(role);

  const isInvestor = (roles as string[]).includes(INVESTOR_ROLE);

  // "Staff" means holding a role that is NOT investor.
  //
  // This used to be `roles.length > 0`. CRMPortal gates the entire CRM on it,
  // so under the old definition the moment Dilrabo's user_roles row was
  // inserted she would have been admitted to every staff screen - students,
  // documents, finance, settings. The database would still have refused her the
  // rows, but the app would have tried, and she would have seen the shell of a
  // CRM she is not supposed to know exists.
  const isStaff = (roles as string[]).some((r) => r !== INVESTOR_ROLE);

  const isOwner = hasRole('owner');
  const isAdmin = hasRole('owner') || hasRole('admin');
  const isCallOperator = hasRole('call_operator') || isAdmin;
  const isDocumentHandler = hasRole('document_handler') || isAdmin;
  const isUniversityStaff = hasRole('university_staff');
  // The "Moliya" section: every owner, plus whoever finance_access names.
  const canSeeFinance = isOwner || hasFinanceAccess;
  // Approving documents, and uploading/replacing/deleting a student's file from
  // the CRM: every owner, plus whoever document_approvers names.
  const canApproveDocuments = isOwner || isDocumentApprover;
  // The "Application fee" section: owner, admin and document handler (the
  // roles can_edit_application_fees() admits), plus whoever
  // application_fee_access names. Must match has_application_fee_access().
  const canSeeApplicationFees = isDocumentHandler || hasApplicationFeeAccess;
  // "Kameralar": every owner, plus whoever camera_access names (admins are not
  // added automatically — owner's decision 2026-11-03). Must match has_camera_access().
  const canSeeCameras = isOwner || hasCameraAccess;
  // Deleting a payment installment (bo'lak) and its receipt: owner, admin,
  // plus whoever payment_delete_access names. Must match can_delete_payment_installments().
  const canDeletePaymentInstallments = isAdmin || hasPaymentDeleteAccess;

  return {
    roles,
    loading,
    hasRole,
    isStaff,
    isInvestor,
    isOwner,
    isAdmin,
    isCallOperator,
    isDocumentHandler,
    isUniversityStaff,
    isLearningCenter,
    canSeeFinance,
    canApproveDocuments,
    canSeeApplicationFees,
    canSeeCameras,
    canDeletePaymentInstallments,
  };
}
