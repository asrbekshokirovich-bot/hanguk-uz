import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = resolve(here, '../../migrations');

const read = (p: string) => readFileSync(p, 'utf8');

/** The five lead-v2 migrations, in apply order. */
export const V2_FILES = [
  '20261015000000_lead_v2_role_lead_senior.sql',
  '20261015001000_lead_v2_schema.sql',
  '20261015002000_lead_v2_engine.sql',
  '20261015003000_lead_v2_jobs.sql',
  '20261015004000_lead_v2_migrate_old_leads.sql',
];

export interface Harness {
  db: PGlite;
  /** run SQL as the superuser (RLS bypassed) */
  q: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  /** run SQL as a signed-in staff member (auth.uid() = id, role `authenticated`, RLS on) */
  as: <T = Record<string, unknown>>(userId: string, sql: string, params?: unknown[]) => Promise<T[]>;
  addUser: (role: string | null) => Promise<string>;
}

/**
 * A fresh in-memory database with the production stand-in schema and the v2
 * migrations applied. `upTo` stops after that many v2 files (to test a
 * migration against the "before" state, e.g. the old-lead data migration).
 */
export async function createHarness(upTo = V2_FILES.length): Promise<Harness> {
  const db = new PGlite();
  await db.exec(read(resolve(here, 'pre_v2_stub.sql')));
  for (const f of V2_FILES.slice(0, upTo)) {
    await db.exec(read(resolve(migrations, f)));
  }
  await grantAll(db);

  const q: Harness['q'] = async (sql, params) => {
    const r = await db.query(sql, params as never);
    return r.rows as never;
  };

  const as: Harness['as'] = async (userId, sql, params) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
    try {
      const r = await db.query(sql, params as never);
      return r.rows as never;
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  };

  const addUser = async (role: string | null) => {
    const [{ id }] = await q<{ id: string }>(`insert into auth.users default values returning id`);
    if (role) await q(`insert into public.user_roles (user_id, role) values ($1, $2::public.app_role)`, [id, role]);
    return id;
  };

  return { db, q, as, addUser };
}

async function grantAll(db: PGlite) {
  await db.exec(`
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on auth.users to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
    grant execute on all functions in schema public to service_role;
  `);
}

/** Apply some of the v2 files later (e.g. to test the data migration on pre-existing rows). */
export async function applyV2(h: Harness, from: number, to = V2_FILES.length) {
  for (const f of V2_FILES.slice(from, to)) {
    await h.db.exec(read(resolve(migrations, f)));
  }
  await grantAll(h.db);
}

/** Insert a lead and return its row (superuser: RLS bypassed). */
export async function addLead(h: Harness, fields: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = { full_name: 'Test Lead', source: 'manual', status: 'new', ...fields };
  const cols = Object.keys(base);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const [row] = await h.q<Record<string, any>>(
    `insert into public.leads (${cols.join(', ')}) values (${vals.join(', ')}) returning *`,
    Object.values(base),
  );
  return row;
}

export const getLead = async (h: Harness, id: string) =>
  (await h.q<Record<string, any>>(`select * from public.leads where id = $1`, [id]))[0];

/** An incoming / outgoing chat message on a channel. */
export async function addMessage(
  h: Harness,
  m: { source?: string; sender: string; direction: 'incoming' | 'outgoing'; content?: string; at?: string; by?: string | null; meta?: object },
) {
  await h.q(
    `insert into public.messages (source, sender_id, direction, content, created_at, replied_by, metadata)
     values ($1, $2, $3, $4, coalesce($5::timestamptz, now()), $6, $7::jsonb)`,
    [m.source ?? 'instagram', m.sender, m.direction, m.content ?? 'salom', m.at ?? null, m.by ?? null, JSON.stringify(m.meta ?? {})],
  );
}
