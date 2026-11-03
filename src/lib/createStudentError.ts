/**
 * Map a create-student failure to an i18n key (+ params) the operator can act on.
 *
 * The edge function answers in English (`{ error: "..." }`, sometimes with
 * HTTP 200 + success:false for duplicates). Unknown messages fall back to
 * `generic` with the raw detail so nothing is hidden.
 */
export interface CreateStudentErrorInfo {
  key:
    | 'sessionExpired'
    | 'noPermission'
    | 'phoneExists'
    | 'phoneStaff'
    | 'nameExists'
    | 'missingFields'
    | 'generic';
  params?: Record<string, string>;
}

export function createStudentErrorInfo(
  message: string | null | undefined,
  status: number | null,
): CreateStudentErrorInfo {
  const msg = (message ?? '').trim();

  if (status === 401 || /^unauthorized$|authorization header required/i.test(msg)) {
    return { key: 'sessionExpired' };
  }
  if (status === 403 || /insufficient permissions/i.test(msg)) {
    return { key: 'noPermission' };
  }

  const staffPhone = msg.match(/phone number (.+?) belongs to a staff account/i);
  if (staffPhone) return { key: 'phoneStaff', params: { phone: staffPhone[1] } };

  const dupPhone = msg.match(/student with phone number (.+?) already exists/i);
  if (dupPhone) return { key: 'phoneExists', params: { phone: dupPhone[1] } };

  if (/student with this name already exists/i.test(msg)) return { key: 'nameExists' };

  if (/missing required field/i.test(msg)) return { key: 'missingFields' };

  return { key: 'generic', params: { detail: msg } };
}
