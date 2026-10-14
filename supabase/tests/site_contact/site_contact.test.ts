import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

// public.site_contact_request (20261014190000) on an in-memory Postgres. The
// phone helpers (fn_phone_keys, fn_uz_national_phone, fn_is_student_phone) are
// the real ones, taken from 20260930200000_app_accounts.sql; the tables are a
// stand-in with the columns the function touches.

const mig = (f: string) => readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8');

function helpers(): string {
  const src = mig('20260930200000_app_accounts.sql');
  const fn = (name: string) => {
    const start = src.indexOf(`create or replace function public.${name}(`);
    const end = src.indexOf('$$;', src.indexOf('as $$', start)) + 3;
    if (start < 0 || end < 3) throw new Error(`helper ${name} not found`);
    return src.slice(start, end);
  };
  return [fn('fn_phone_keys'), fn('fn_uz_national_phone'), fn('fn_is_student_phone')].join('\n\n');
}

const STUB = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create table public.profiles (id uuid primary key default gen_random_uuid(), phone text, additional_phone text, magic_code text);
  create table public.student_phones (id uuid primary key default gen_random_uuid(), student_id uuid, phone text, phone_norm text);
  create table public.leads (
    id uuid primary key default gen_random_uuid(),
    full_name text, phone text, email text, source text, status text, contact_channel text, notes text,
    new_lead_at timestamptz, sla_start_at timestamptz, sla_alerted_at timestamptz,
    quick_contact_alerted_at timestamptz, last_contacted_at timestamptz,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
  -- the real one shifts into working hours; the shift is not under test here
  create function public.fn_lead_sla_start(p_at timestamptz) returns timestamptz language sql as $$ select p_at $$;
`;

let db: PGlite;
const call = async (name: string | null, phone: string | null, email: string | null = null, note: string | null = null) => {
  const r = await db.query<{ r: { status: string } }>(
    `select public.site_contact_request($1, $2, $3, $4) as r`, [name, phone, email, note]);
  return r.rows[0].r.status;
};
const leads = async () => (await db.query<any>(`select * from public.leads order by created_at, id`)).rows;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUB);
  await db.exec(helpers());
  await db.exec(mig('20261014190000_site_contact_request.sql'));
});

describe('site_contact_request', () => {
  it('a new number becomes a "site" lead in Yangi lid, phone written the CRM way', async () => {
    expect(await call('Aziza Karimova', '+998 (90) 123-45-67', 'Aziza@Gmail.com', 'TOPIK 3 bor')).toBe('ok');
    const [l] = await leads();
    expect(l.source).toBe('site');
    expect(l.status).toBe('new');
    expect(l.phone).toBe('+998 90 123 45 67');
    expect(l.email).toBe('aziza@gmail.com');
    expect(l.new_lead_at).not.toBeNull();
    expect(l.sla_start_at).not.toBeNull();
    expect(l.notes).toMatch(/^Saytdan murojaat: .*aziza@gmail\.com\nTOPIK 3 bor$/);
  });

  it('a known number brings the existing lead back instead of a duplicate', async () => {
    await db.query(
      `insert into public.leads (full_name, phone, source, status, notes, last_contacted_at, updated_at)
       values ('Old card', '90 123 45 67', 'instagram', 'contacted', 'eski izoh', now() - interval '20 days', now() - interval '20 days')`);
    expect(await call('Aziza', '998901234567', 'a@b.uz')).toBe('ok');
    const all = await leads();
    expect(all).toHaveLength(1);
    expect(all[0].full_name).toBe('Old card');
    expect(all[0].email).toBe('a@b.uz');
    expect(all[0].new_lead_at).not.toBeNull();
    expect(all[0].quick_contact_alerted_at).not.toBeNull(); // answered long ago: no quick-exit watchdog
    expect(all[0].notes).toMatch(/^eski izoh\nSaytdan murojaat: /);
  });

  it('a double click / reload within 10 minutes is the same request', async () => {
    expect(await call('Aziza', '+998901234567')).toBe('ok');
    expect(await call('Aziza', '+998901234567')).toBe('ok');
    const all = await leads();
    expect(all).toHaveLength(1);
    expect((all[0].notes.match(/Saytdan murojaat:/g) ?? []).length).toBe(1);
  });

  it("a student's own number is not a lead", async () => {
    await db.exec(`insert into public.profiles (phone, magic_code) values ('+998 91 555 66 77', 'ABCD1234')`);
    expect(await call('Talaba', '91-555-66-77')).toBe('student');
    expect(await leads()).toHaveLength(0);
  });

  it('an international number is accepted as typed', async () => {
    expect(await call('Ota-ona', '+82 10 1234 5678')).toBe('ok');
    expect((await leads())[0].phone).toBe('+821012345678');
  });

  it('refuses a missing name, a bad phone, a bad e-mail', async () => {
    expect(await call('  ', '+998901234567')).toBe('invalid_name');
    expect(await call(null, '+998901234567')).toBe('invalid_name');
    expect(await call('A', '12345')).toBe('invalid_phone');
    expect(await call('A', null)).toBe('invalid_phone');
    expect(await call('A', '+998901234567', 'not-an-email')).toBe('invalid_email');
    expect(await leads()).toHaveLength(0);
  });

  it('a flood of site requests is cut at 30 in 10 minutes', async () => {
    await db.exec(`insert into public.leads (full_name, source) select 'bot ' || g, 'site' from generate_series(1, 30) g`);
    expect(await call('Real person', '+998901234567')).toBe('busy');
    await db.exec(`update public.leads set created_at = now() - interval '11 minutes'`);
    expect(await call('Real person', '+998901234567')).toBe('ok');
  });

  it('only the service role (the edge function) may call it', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query(`select public.site_contact_request('x', '+998901234567', null, null)`)).rejects.toThrow(/permission denied/);
      await db.exec('reset role');
    }
  });
});
