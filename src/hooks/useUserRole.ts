import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

// 'investor' was added to public.app_role by migration 20260729_0001 and is not
// in the generated Database type yet, so it is matched as a plain string.
const INVESTOR_ROLE = 'investor';

/** What a «is this user named in table X» read answers. */
type AccessRow = { data: unknown; error?: unknown };

/** What is known about the signed-in account's roles and named accesses. */
interface RoleState {
  /** Whose answers these are: undefined until the first answer, null = signed out. */
  loadedFor: string | null | undefined;
  roles: AppRole[];
  isLearningCenter: boolean;
  hasFinanceAccess: boolean;
  isDocumentApprover: boolean;
  hasApplicationFeeAccess: boolean;
  hasCameraAccess: boolean;
  hasPaymentDeleteAccess: boolean;
}

const NOTHING: Omit<RoleState, 'loadedFor'> = {
  roles: [],
  isLearningCenter: false,
  hasFinanceAccess: false,
  isDocumentApprover: false,
  hasApplicationFeeAccess: false,
  hasCameraAccess: false,
  hasPaymentDeleteAccess: false,
};

// One answer for the whole page. A CRM page mounts this hook in seven places
// (the portal, the sidebar, the header, the page itself…); each used to read
// user_roles and six access tables on its own — 49 requests for one question,
// again on every token refresh. They now share one read.
let state: RoleState = { loadedFor: undefined, ...NOTHING };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getState = () => state;
const same = (a: RoleState, b: RoleState) =>
  a.loadedFor === b.loadedFor &&
  a.roles.length === b.roles.length &&
  a.roles.every((r, i) => r === b.roles[i]) &&
  a.isLearningCenter === b.isLearningCenter &&
  a.hasFinanceAccess === b.hasFinanceAccess &&
  a.isDocumentApprover === b.isDocumentApprover &&
  a.hasApplicationFeeAccess === b.hasApplicationFeeAccess &&
  a.hasCameraAccess === b.hasCameraAccess &&
  a.hasPaymentDeleteAccess === b.hasPaymentDeleteAccess;
const setState = (next: RoleState) => {
  // A re-read that found nothing new renders nothing.
  if (same(state, next)) return;
  state = next;
  listeners.forEach((l) => l());
};

/** The latest read: the `user` object it was asked for, and whether it is still out. */
let asked: { user: unknown; userId: string | null; inFlight: boolean } | null = null;
let readNo = 0;

async function readRoles(userId: string) {
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
  // office cameras. Nor payment_delete_access (migration 20261109090000): who
  // besides owner/admin may delete a payment installment and its receipt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untyped = supabase as unknown as { from: (n: string) => any };
  const named = (table: string) =>
    untyped.from(table).select('user_id').eq('user_id', userId).maybeSingle() as Promise<AccessRow>;

  const [roles, center, finance, approver, feeAccess, cameraAccess, paymentDeleteAccess] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId),
    untyped.from('learning_centers').select('id').eq('user_id', userId).eq('is_active', true).maybeSingle() as Promise<AccessRow>,
    named('finance_access'),
    named('document_approvers'),
    named('application_fee_access'),
    named('camera_access'),
    named('payment_delete_access'),
  ]);
  return { roles, center, finance, approver, feeAccess, cameraAccess, paymentDeleteAccess };
}

/**
 * Makes sure the store holds this account's answers. Called by every mounted
 * hook on every auth event (a refreshed token hands out a new `user` object,
 * and that is when a role granted or taken away meanwhile shows up). All the
 * hooks on a page are handed the same object: the first call reads, the others
 * find the read already asked for. So does a second event for the same person
 * while the read is still out (the session is announced twice at start-up).
 */
function ensureRoles(user: { id: string } | null) {
  const userId = user?.id ?? null;
  if (asked && (asked.user === user || (asked.userId === userId && asked.inFlight))) return;
  const request = { user, userId, inFlight: userId !== null };
  asked = request;
  const mine = ++readNo;

  if (!userId) {
    setState({ loadedFor: null, ...NOTHING });
    return;
  }
  // Another account: what is here is not theirs, and must not look like it
  // while their own answers are on the way.
  if (state.loadedFor !== undefined && state.loadedFor !== userId) {
    setState({ loadedFor: undefined, ...NOTHING });
  }

  void readRoles(userId)
    .then((r) => {
      request.inFlight = false;
      // An answer for an account that is no longer the one signed in.
      if (mine !== readNo) return;
      // A read that failed says nothing. For the person whose answers are
      // already here (a re-read after a new token) what is known stays; for
      // anyone else it is «none» — never the previous account's.
      const known = state.loadedFor === userId;
      const flag = (row: AccessRow, prev: boolean) => (row.error ? known && prev : Boolean(row.data));
      setState({
        loadedFor: userId,
        roles: !r.roles.error && r.roles.data ? r.roles.data.map((x) => x.role) : known ? state.roles : [],
        isLearningCenter: flag(r.center, state.isLearningCenter),
        hasFinanceAccess: flag(r.finance, state.hasFinanceAccess),
        isDocumentApprover: flag(r.approver, state.isDocumentApprover),
        hasApplicationFeeAccess: flag(r.feeAccess, state.hasApplicationFeeAccess),
        hasCameraAccess: flag(r.cameraAccess, state.hasCameraAccess),
        hasPaymentDeleteAccess: flag(r.paymentDeleteAccess, state.hasPaymentDeleteAccess),
      });
    })
    .catch(() => {
      request.inFlight = false;
      // The request itself could not be made (offline): the same as a read
      // that failed — keep what is known about this person, «none» otherwise.
      if (mine !== readNo) return;
      if (state.loadedFor !== userId) setState({ loadedFor: userId, ...NOTHING });
    });
}

/** For tests: forget everything, as a newly opened page would. */
export function resetUserRoleStore() {
  asked = null;
  readNo++;
  state = { loadedFor: undefined, ...NOTHING };
  listeners.forEach((l) => l());
}

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const known = useSyncExternalStore(subscribe, getState, getState);

  useEffect(() => {
    // While the session is still being restored there is nobody to ask about.
    if (authLoading) return;
    ensureRoles(user ?? null);
    // On every auth event, as before: `user` is a new object each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Loading until the roles in hand are THIS account's. On a reload the
  // session is restored a moment after the first render; this hook used to
  // answer «loaded, no roles» for that first, signed-out moment and keep saying
  // it when the user appeared — so CRMPortal took a member of staff for «not
  // staff» and sent every reload and every link to a CRM page to the landing
  // page, which sent them on to the dashboard.
  const mine = known.loadedFor === userId;
  const loading = Boolean(authLoading) || !mine;

  // Never another account's answers, not even for the one render before the
  // store is told who signed in.
  const roles = mine ? known.roles : NOTHING.roles;
  const isLearningCenter = mine && known.isLearningCenter;
  const hasFinanceAccess = mine && known.hasFinanceAccess;
  const isDocumentApprover = mine && known.isDocumentApprover;
  const hasApplicationFeeAccess = mine && known.hasApplicationFeeAccess;
  const hasCameraAccess = mine && known.hasCameraAccess;
  const hasPaymentDeleteAccess = mine && known.hasPaymentDeleteAccess;

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
