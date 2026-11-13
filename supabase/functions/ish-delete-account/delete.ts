// ish-delete-account: what deleting a Hanguk Ish account does (Google Play's
// account-deletion rule, 2026-11-13). No network here: the store is passed in
// so the steps can be tested with a fake.
//
//   1. The businesses the account owns go — with their shifts, templates,
//      applications, chats, ratings and offers (ON DELETE CASCADE in ish.*;
//      Asrbek, 2026-11-13: «Korxona va smenalar ham o'chsin»).
//   2. Its photos in the «ish-avatars» bucket (<user id>/…) go.
//   3. The auth user goes; ish.profiles and everything keyed to it
//      (worker profile, applications, messages, ratings, notifications, push
//      tokens, favorites, reports) follow by ON DELETE CASCADE.
// Only Hanguk Ish's own accounts (app_metadata.app = 'hanguk_ish' or
// anonymous) can be deleted here — never a hanguk.uz staff, student or guest
// account, and never Hanguk Ish staff (ish.staff_members).

export type DeleteStore = {
  isStaff(userId: string): Promise<boolean>;
  ownedBusinesses(userId: string): Promise<string[]>;
  deleteBusinesses(ids: string[]): Promise<void>;
  avatarPaths(userId: string): Promise<string[]>;
  removeAvatars(paths: string[]): Promise<void>;
  deleteUser(userId: string): Promise<void>;
};

export type DeleteResult =
  | { ok: true; businesses: number; photos: number }
  | { ok: false; status: number; error: string };

type AuthUser = { id: string; is_anonymous?: boolean | null; app_metadata?: Record<string, unknown> | null };

export function isIshAccount(user: AuthUser | null | undefined): user is AuthUser {
  return !!user && (user.is_anonymous === true || user.app_metadata?.app === "hanguk_ish");
}

export async function deleteAccount(user: AuthUser | null | undefined, store: DeleteStore): Promise<DeleteResult> {
  if (!user) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  if (!isIshAccount(user)) return { ok: false, status: 403, error: "NOT_ISH_ACCOUNT" };
  if (await store.isStaff(user.id)) return { ok: false, status: 403, error: "STAFF" };

  const businesses = await store.ownedBusinesses(user.id);
  if (businesses.length > 0) await store.deleteBusinesses(businesses);

  const photos = await store.avatarPaths(user.id);
  if (photos.length > 0) await store.removeAvatars(photos);

  await store.deleteUser(user.id);
  return { ok: true, businesses: businesses.length, photos: photos.length };
}
