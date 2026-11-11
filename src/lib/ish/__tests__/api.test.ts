import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IshError, ishApi, ishErrorCode, plannedMinutes } from '../api';

/** A client whose rpc answers [result] and records the calls. */
function fakeClient(result: { data?: unknown; error?: { message: string; code?: string } | null } = {}) {
  const rpc = vi.fn(async (_fn: string, _params?: Record<string, unknown>) => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('ishApi', () => {
  it('saves an employer with trimmed fields, the Uzbek name and the contact', async () => {
    const { client, rpc } = fakeClient({ data: 'biz-1' });
    const id = await ishApi(client).saveBusiness({
      id: null,
      name: ' 홍대 이삿짐센터 ',
      nameUz: " Hongdae ko'chish xizmati ",
      category: 'logistics',
      area: '홍대',
      address: '마포구 와우산로 21',
      addressDetail: '',
      district: 'Mapo-gu',
      lat: 37.556,
      lng: 126.923,
      contact: { contact_name: '김사장', phone: ' 010-5555-1234 ', telegram: '@hongdae_move', source: '', notes: '' },
    });
    expect(id).toBe('biz-1');
    expect(rpc).toHaveBeenCalledWith('staff_save_business', {
      p_business: null,
      p_name: '홍대 이삿짐센터',
      p_category: 'logistics',
      p_area: '홍대',
      p_address: '마포구 와우산로 21',
      p_address_detail: '',
      p_district: 'Mapo-gu',
      p_lat: 37.556,
      p_lng: 126.923,
      p_name_i18n: { uz: "Hongdae ko'chish xizmati" },
      p_contact: { contact_name: '김사장', phone: '010-5555-1234', telegram: '@hongdae_move', source: '', notes: '' },
    });
  });

  it('no Uzbek name: no translation sent', async () => {
    const { client, rpc } = fakeClient({ data: 'biz-2' });
    await ishApi(client).saveBusiness({
      id: 'biz-2', name: '가게', nameUz: ' ', category: 'other', area: '', address: '', addressDetail: '',
      district: null, lat: null, lng: null,
      contact: { contact_name: '', phone: '', telegram: '', source: '', notes: '' },
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_business: 'biz-2', p_name_i18n: {} });
  });

  it('saves a job: the shift follows its employer\'s point', async () => {
    const { client, rpc } = fakeClient({ data: 'job-1' });
    await ishApi(client).saveJob({
      id: null,
      businessId: 'biz-1',
      title: '이삿짐 운반 보조',
      startsAt: '2026-11-12T10:00:00+09:00',
      endsAt: '2026-11-12T14:00:00+09:00',
      hourlyWage: 13000,
      slots: 2,
      duties: '짐 나르기',
      dress: '',
      address: '',
      autoConfirm: false,
      inviteOnly: true,
      source: 'https://t.me/koreajobs_uz/1234',
      notes: 'Naqd',
    });
    expect(rpc).toHaveBeenCalledWith('staff_save_shift', expect.objectContaining({
      p_shift: null,
      p_business: 'biz-1',
      p_starts_at: '2026-11-12T10:00:00+09:00',
      p_ends_at: '2026-11-12T14:00:00+09:00',
      p_hourly_wage: 13000,
      p_slots: 2,
      p_lat: null,
      p_lng: null,
      p_invite_only: true,
      p_auto_confirm: false,
      p_source: 'https://t.me/koreajobs_uz/1234',
      p_notes: 'Naqd',
    }));
  });

  it('the board, candidates and offers pass what the functions take', async () => {
    const { client, rpc } = fakeClient({ data: null });
    const api = ishApi(client);
    expect(await api.board(new Date('2026-11-09T00:00:00+09:00'), new Date('2026-11-16T00:00:00+09:00'))).toEqual([]);
    expect(rpc).toHaveBeenLastCalledWith('staff_board', { p_from: '2026-11-08T15:00:00.000Z', p_to: '2026-11-15T15:00:00.000Z' });
    expect(await api.candidates('job-1', null)).toEqual([]);
    expect(rpc).toHaveBeenLastCalledWith('staff_candidates', { p_shift: 'job-1', p_max_km: null, p_limit: 100 });
    await api.sendOffers('job-1', ['w1', 'w2'], '  Ertalab 10 da  ');
    expect(rpc).toHaveBeenLastCalledWith('staff_send_offers', { p_shift: 'job-1', p_workers: ['w1', 'w2'], p_note: 'Ertalab 10 da' });
    await api.markAttendance('app-1', true, 210);
    expect(rpc).toHaveBeenLastCalledWith('staff_mark_attendance', { p_application: 'app-1', p_came: true, p_worked_minutes: 210 });
    await api.markAttendance('app-2', false);
    expect(rpc).toHaveBeenLastCalledWith('staff_mark_attendance', { p_application: 'app-2', p_came: false, p_worked_minutes: null });
  });

  it('a refusal comes back with its code', async () => {
    const { client } = fakeClient({ error: { message: 'FORBIDDEN', code: 'P0001' } });
    await expect(ishApi(client).businesses()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(ishApi(client).businesses()).rejects.toBeInstanceOf(IshError);
  });
});

describe('ishErrorCode', () => {
  it('the function\'s own code first, then the kind of failure', () => {
    expect(ishErrorCode({ message: 'SHIFT_CLOSED' })).toBe('SHIFT_CLOSED');
    expect(ishErrorCode({ message: 'permission denied for function staff_board', code: '42501' })).toBe('FORBIDDEN');
    expect(ishErrorCode({ message: 'new row violates check constraint', code: '23514' })).toBe('INVALID');
    expect(ishErrorCode({ message: 'TypeError: Failed to fetch' })).toBe('OFFLINE');
    expect(ishErrorCode({ message: 'something else' })).toBe('UNKNOWN');
  });

  it('planned minutes of a job', () => {
    expect(plannedMinutes({ starts_at: '2026-11-12T10:00:00+09:00', ends_at: '2026-11-12T14:30:00+09:00' })).toBe(270);
  });
});
