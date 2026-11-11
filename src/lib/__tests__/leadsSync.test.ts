import { describe, it, expect } from 'vitest';
import { applyLeadChanges, buildLeadLookups, enrichLead, phoneKey } from '../leadsSync';

const lead = (id: string, o: Record<string, unknown> = {}) => ({
  id, full_name: `Lid ${id}`, phone: null as string | null, assigned_to: null as string | null,
  referred_by_student_id: null as string | null, status: 'new', ...o,
});

describe('applyLeadChanges', () => {
  const list = [lead('a'), lead('b'), lead('c')];

  it('replaces a changed row in place', () => {
    const next = applyLeadChanges(list, ['b'], [lead('b', { status: 'lost' })]);
    expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(next[1].status).toBe('lost');
    expect(next[0]).toBe(list[0]);
  });

  it('adds a row that is new to the list', () => {
    const next = applyLeadChanges(list, ['d'], [lead('d')]);
    expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops a row that was asked for and did not come back (deleted, other season, not qualified)', () => {
    const next = applyLeadChanges(list, ['a', 'c'], [lead('c', { status: 'contacted' })]);
    expect(next.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('a change to a row that was never in the list and is still not is nothing', () => {
    const next = applyLeadChanges(list, ['zzz'], []);
    expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not duplicate a row returned twice', () => {
    const next = applyLeadChanges(list, ['b'], [lead('b', { status: 'x' }), lead('b', { status: 'y' })]);
    expect(next.filter((r) => r.id === 'b')).toHaveLength(1);
  });

  it('nothing asked, nothing returned: the same list object', () => {
    expect(applyLeadChanges(list, [], [])).toBe(list);
  });
});

describe('enrichLead', () => {
  const lookups = buildLeadLookups(
    [{ full_name: ' Karimov AZIZ ', phone: '+998 90 123 45 67' }, { full_name: null, phone: null }, { full_name: '', phone: '' }],
    [{ user_id: 'u1', full_name: 'Omina' }, { user_id: 's1', full_name: 'Karimov Aziz' }],
  );

  it('names the assignee and the referring student', () => {
    const e = enrichLead(lead('a', { assigned_to: 'u1', referred_by_student_id: 's1' }), lookups);
    expect(e.assignee).toEqual({ full_name: 'Omina' });
    expect(e.referrer).toEqual({ full_name: 'Karimov Aziz' });
  });

  it('an unknown or missing assignee is null', () => {
    expect(enrichLead(lead('a', { assigned_to: 'nobody' }), lookups).assignee).toBeNull();
    expect(enrichLead(lead('a'), lookups).assignee).toBeNull();
  });

  it('knows a student by phone, however it is written', () => {
    expect(enrichLead(lead('a', { phone: '901234567' }), lookups).isAlreadyStudent).toBe(true);
    expect(enrichLead(lead('a', { phone: '998-90-123-45-67' }), lookups).isAlreadyStudent).toBe(true);
    expect(enrichLead(lead('a', { phone: '+998 90 000 00 00' }), lookups).isAlreadyStudent).toBe(false);
  });

  it('knows a student by full name, case and spaces aside', () => {
    expect(enrichLead(lead('a', { full_name: 'karimov aziz' }), lookups).isAlreadyStudent).toBe(true);
  });

  it('a lead with no name or phone is not "already a student" because some profile has none either', () => {
    expect(enrichLead(lead('a', { full_name: '', phone: null }), lookups).isAlreadyStudent).toBe(false);
    expect(enrichLead(lead('a', { full_name: null, phone: '' }), lookups).isAlreadyStudent).toBe(false);
  });

  it('phoneKey keeps the last nine digits', () => {
    expect(phoneKey('+998 (90) 123-45-67')).toBe('901234567');
    expect(phoneKey(null)).toBe('');
  });
});
