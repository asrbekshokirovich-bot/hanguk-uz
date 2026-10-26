/**
 * Roles that already carry the CRM "Application fee" section — the same roles
 * public.has_application_fee_access() admits before it looks at
 * application_fee_access (migration 20261026120000_application_fee_access.sql).
 */
export const APPLICATION_FEE_ROLES = ['owner', 'admin', 'document_handler'] as const;

export function hasApplicationFeeRole(roles: readonly string[]): boolean {
  return roles.some((r) => (APPLICATION_FEE_ROLES as readonly string[]).includes(r));
}
