import { describe, expect, it } from 'vitest';
import {
  channelBadges,
  detectNewHozir,
  displayName,
  filterGrouped,
  groupByBucket,
  handleText,
  hozirIds,
  hozirTimer,
  isBreached,
  isClaimable,
  KEYIN_PREVIEW,
  ladderLabel,
  laterTimer,
  matchesQuery,
  ownerLabel,
  rowAction,
  sourceText,
} from '../deskModel';
import { deskRow, inSeconds, NOW } from './fixtures';

describe('groupByBucket', () => {
  it('splits rows into the three blocks and keeps the database order inside each', () => {
    const rows = [
      deskRow({ id: 'k1', bucket: 'keyin' }),
      deskRow({ id: 'h1', bucket: 'hozir' }),
      deskRow({ id: 'b1', bucket: 'bugun' }),
      deskRow({ id: 'h2', bucket: 'hozir' }),
      deskRow({ id: 'b2', bucket: 'bugun' }),
    ];
    const g = groupByBucket(rows);
    expect(g.hozir.map((r) => r.id)).toEqual(['h1', 'h2']);
    expect(g.bugun.map((r) => r.id)).toEqual(['b1', 'b2']);
    expect(g.keyin.map((r) => r.id)).toEqual(['k1']);
  });

  it('copes with an empty or missing list and ignores an unknown bucket', () => {
    expect(groupByBucket([])).toEqual({ hozir: [], bugun: [], keyin: [] });
    expect(groupByBucket(undefined)).toEqual({ hozir: [], bugun: [], keyin: [] });
    expect(groupByBucket(null)).toEqual({ hozir: [], bugun: [], keyin: [] });
    const odd = deskRow({ id: 'x', bucket: 'later' as never });
    expect(groupByBucket([odd]).hozir).toHaveLength(0);
  });

  it('shows 40 of a long KEYIN before "Hammasini ko\'rsatish"', () => {
    expect(KEYIN_PREVIEW).toBe(40);
  });
});

describe('search (name, phone, @username)', () => {
  const row = deskRow({ full_name: 'Dilnoza Abdullayeva', phone: '+998 90 123 45 67', handle: 'dilnoza_a' });

  it('matches the name regardless of case, and part of it', () => {
    expect(matchesQuery(row, 'dilnoza')).toBe(true);
    expect(matchesQuery(row, 'ABDULLA')).toBe(true);
    expect(matchesQuery(row, 'Dilnoza Abd')).toBe(true);
    expect(matchesQuery(row, 'sardor')).toBe(false);
  });

  it('matches the @username with or without the @', () => {
    expect(matchesQuery(row, '@dilnoza_a')).toBe(true);
    expect(matchesQuery(row, 'dilnoza_a')).toBe(true);
    expect(matchesQuery(row, '@someone')).toBe(false);
  });

  it('matches the phone by its digits, ignoring spaces and the plus', () => {
    expect(matchesQuery(row, '90 123')).toBe(true);
    expect(matchesQuery(row, '+998901234567')).toBe(true);
    expect(matchesQuery(row, '4567')).toBe(true);
    expect(matchesQuery(row, '99')).toBe(false); // two digits are too loose to mean a phone
    expect(matchesQuery(deskRow({ phone: null }), '1234')).toBe(false);
  });

  it('matches everything for an empty query and filters all three blocks', () => {
    const rows = [
      deskRow({ id: 'a', bucket: 'hozir', full_name: 'Aziz' }),
      deskRow({ id: 'b', bucket: 'bugun', full_name: 'Malika' }),
      deskRow({ id: 'c', bucket: 'keyin', full_name: 'Azamat' }),
    ];
    const g = groupByBucket(rows);
    expect(filterGrouped(g, '  ')).toBe(g);
    const f = filterGrouped(g, 'az');
    expect(f.hozir.map((r) => r.id)).toEqual(['a']);
    expect(f.bugun).toEqual([]);
    expect(f.keyin.map((r) => r.id)).toEqual(['c']);
  });
});

describe('HOZIR timer and its colour (spec §4)', () => {
  it('is green while there is time', () => {
    const t = hozirTimer({ due_at: inSeconds(8 * 60) }, NOW);
    expect(t).toMatchObject({ seconds: 480, text: '08:00', tone: 'ok', late: false, suffix: null });
  });

  it('turns yellow from the last 5 minutes', () => {
    expect(hozirTimer({ due_at: inSeconds(5 * 60) }, NOW).tone).toBe('warn');
    expect(hozirTimer({ due_at: inSeconds(252) }, NOW)).toMatchObject({ text: '04:12', tone: 'warn' });
    expect(hozirTimer({ due_at: inSeconds(5 * 60 + 1) }, NOW).tone).toBe('ok');
  });

  it('is red with a minus sign once overdue: "−02:40 KECHIKDI"', () => {
    const t = hozirTimer({ due_at: inSeconds(-160) }, NOW);
    expect(t).toMatchObject({ seconds: -160, text: '−02:40', tone: 'late', late: true, suffix: 'KECHIKDI' });
  });

  it('a ladder row that is not due yet counts down to its call time', () => {
    // 10 minutes before the call: the row is in HOZIR with 10:00 on the clock
    expect(hozirTimer({ due_at: inSeconds(600) }, NOW)).toMatchObject({ text: '10:00', tone: 'ok' });
  });

  it('has no colour without a deadline', () => {
    expect(hozirTimer({ due_at: null }, NOW)).toMatchObject({ tone: 'idle', late: false, text: '—' });
  });
});

describe('breached leads and "Olish"', () => {
  const late = { bucket: 'hozir', due_at: inSeconds(-30), owner_id: 'op-2' } as const;

  it('is breached only in HOZIR and past due_at', () => {
    expect(isBreached(late, NOW)).toBe(true);
    expect(isBreached({ ...late, due_at: inSeconds(30) }, NOW)).toBe(false);
    expect(isBreached({ ...late, bucket: 'bugun' }, NOW)).toBe(false);
  });

  it('is claimable when breached and owned by somebody else', () => {
    expect(isClaimable(late, 'op-1', NOW)).toBe(true);
  });

  it('is not claimable by its owner, when nobody owns it, when not yet late, or when the viewer is unknown', () => {
    expect(isClaimable(late, 'op-2', NOW)).toBe(false);
    expect(isClaimable({ ...late, owner_id: null }, 'op-1', NOW)).toBe(false);
    expect(isClaimable({ ...late, due_at: inSeconds(60) }, 'op-1', NOW)).toBe(false);
    expect(isClaimable(late, null, NOW)).toBe(false);
  });
});

describe('the time cell of BUGUN and KEYIN', () => {
  it('shows "Mijoz yozdi HH:MM" and counts down to the jump to HOZIR for a reply timer', () => {
    const row = deskRow({
      bucket: 'bugun',
      timer_kind: 'reply',
      last_client_msg_at: '2026-10-06T04:41:00Z', // 09:41 Tashkent
      timer_start_at: inSeconds(190),
      due_at: inSeconds(190),
    });
    expect(laterTimer(row, NOW)).toEqual({ primary: 'Mijoz yozdi 09:41', countdownTo: inSeconds(190) });
  });

  it('shows the call time for a ladder or callback row, a plain clock time today', () => {
    const row = deskRow({
      bucket: 'bugun',
      timer_kind: 'ladder',
      timer_start_at: '2026-10-06T12:50:00Z',
      due_at: '2026-10-06T13:00:00Z', // 18:00 Tashkent
    });
    expect(laterTimer(row, NOW)).toEqual({ primary: '18:00', countdownTo: null });
  });

  it('shows date and time in KEYIN', () => {
    const row = deskRow({ bucket: 'keyin', timer_kind: 'ladder', timer_start_at: '2026-10-07T04:50:00Z', due_at: '2026-10-07T05:00:00Z' });
    expect(laterTimer(row, NOW).primary).toBe('Ertaga 10:00');
    const far = deskRow({ bucket: 'keyin', next_action_at: '2026-10-12T05:00:00Z', next_action_kind: 'wait_end' });
    expect(laterTimer(far, NOW).primary).toBe('12.10 10:00');
  });

  it('says so when an item from an earlier day is still open', () => {
    const row = deskRow({ bucket: 'bugun', next_action_at: '2026-10-05T05:00:00Z', next_action_kind: 'callback' });
    expect(laterTimer(row, NOW).primary).toBe('Kecha 10:00');
  });

  it('is a dash when there is nothing to date', () => {
    expect(laterTimer(deskRow({ bucket: 'bugun' }), NOW)).toEqual({ primary: '—', countdownTo: null });
  });
});

describe('the action cell', () => {
  it('names a ladder attempt "N-urinish" from attempt_no + 1, and the step "zinapoya N/5"', () => {
    const row = deskRow({ bucket: 'hozir', timer_kind: 'ladder', ladder_state: 'running', attempt_no: 1, due_at: inSeconds(300) });
    expect(rowAction(row, NOW).label).toBe('2-urinish');
    expect(ladderLabel(row)).toBe('zinapoya 2/5');
    expect(ladderLabel({ ...row, attempt_no: 3 })).toBe('zinapoya 4/5');
    expect(ladderLabel({ ...row, attempt_no: 9 })).toBe('zinapoya 5/5');
  });

  it('has no ladder label for a lead that is not on the ladder', () => {
    expect(ladderLabel(deskRow({ timer_kind: 'first', ladder_state: 'idle' }))).toBeNull();
  });

  it('names the timer kind for the other clocks', () => {
    expect(rowAction(deskRow({ timer_kind: 'first', due_at: inSeconds(60) }), NOW).label).toBe('Yangi lid');
    expect(rowAction(deskRow({ timer_kind: 'reply', due_at: inSeconds(-60) }), NOW).label).toBe('Mijoz yozdi');
    expect(rowAction(deskRow({ timer_kind: 'callback', due_at: inSeconds(60) }), NOW).label).toBe("Qayta qo'ng'iroq");
  });

  it('uses the next action (label + when) when there is no running clock', () => {
    const row = deskRow({
      bucket: 'bugun',
      next_action_kind: 'wait_end',
      next_action_at: '2026-10-06T13:00:00Z',
      next_action_note: 'TOPIK natijasi',
    });
    expect(rowAction(row, NOW)).toEqual({
      label: 'Kutish tugadi',
      detail: 'TOPIK natijasi',
      title: 'Kutish tugadi · Bugun 18:00 · TOPIK natijasi',
    });
  });

  it('falls back to drafts, then to the stage', () => {
    expect(rowAction(deskRow({ pending_drafts: 2 }), NOW)).toMatchObject({ label: 'Qoralama', detail: '2 ta' });
    expect(rowAction(deskRow({ stage: 'contract' }), NOW).label).toBe('Shartnoma');
    expect(rowAction(deskRow({ stage: 'offer' }), NOW).label).toBe('Taklif');
    expect(rowAction(deskRow({ stage: 'interested' }), NOW).label).toBe('—');
  });
});

describe('the name cell', () => {
  it('shows the channels once each, from `channels`, falling back to contact_channel then source', () => {
    expect(channelBadges(deskRow({ channels: ['instagram', 'telegram', 'instagram'] }))).toEqual(['IG', 'TG']);
    expect(channelBadges(deskRow({ channels: [], contact_channel: 'telegram' }))).toEqual(['TG']);
    expect(channelBadges(deskRow({ channels: null, contact_channel: null, source: 'meta_form' }))).toEqual(['Forma']);
    expect(channelBadges(deskRow({ channels: null, contact_channel: null, source: '' }))).toEqual([]);
  });

  it('puts an @ on the handle and names a nameless lead by what we know', () => {
    expect(handleText(deskRow({ handle: 'sardor_k' }))).toBe('@sardor_k');
    expect(handleText(deskRow({ handle: '@sardor_k' }))).toBe('@sardor_k');
    expect(handleText(deskRow({ handle: null }))).toBeNull();
    expect(displayName(deskRow({ full_name: '  ', handle: 'sardor_k' }))).toBe('sardor_k');
    expect(displayName(deskRow({ full_name: '', handle: null, phone: null }))).toBe('Nomsiz lid');
  });

  it('prefers the form, then the ad, then the campaign as the source', () => {
    expect(sourceText(deskRow({ form_name: 'Hanbox 10-sent', ad_name: 'A', campaign_name: 'C' }))).toBe('Hanbox 10-sent');
    expect(sourceText(deskRow({ ad_name: 'A', campaign_name: 'C' }))).toBe('A');
    expect(sourceText(deskRow({ campaign_name: 'C' }))).toBe('C');
    expect(sourceText(deskRow())).toBeNull();
  });

  it('shows "Hovuz" for an unowned lead, "Siz" for the viewer, otherwise the name', () => {
    const names = { 'op-1': 'Omina', 'op-2': 'Sardor' };
    expect(ownerLabel(null, names, 'op-1')).toBe('Hovuz');
    expect(ownerLabel('op-1', names, 'op-1')).toBe('Siz');
    expect(ownerLabel('op-2', names, 'op-1')).toBe('Sardor');
    expect(ownerLabel('op-9', names, 'op-1')).toBe('Operator');
  });
});

describe('detecting a lead that NEWLY reached HOZIR', () => {
  const a = deskRow({ id: 'a', bucket: 'hozir' });
  const b = deskRow({ id: 'b', bucket: 'hozir' });
  const c = deskRow({ id: 'c', bucket: 'bugun' });

  it('never reports anything on the first load', () => {
    expect(detectNewHozir(null, [a, b])).toEqual([]);
  });

  it('reports the HOZIR ids that were not there at the previous refresh', () => {
    expect(detectNewHozir(hozirIds([a]), [a, b]).map((r) => r.id)).toEqual(['b']);
  });

  it('reports a lead that moved up from BUGUN, but not one that merely sits in BUGUN', () => {
    const before = hozirIds([a, c]); // c was in BUGUN
    const promoted = { ...c, bucket: 'hozir' as const };
    expect(detectNewHozir(before, [a, promoted]).map((r) => r.id)).toEqual(['c']);
    expect(detectNewHozir(before, [a, c])).toEqual([]);
  });

  it('does not report the same lead twice, nor one that was already there', () => {
    const before = hozirIds([a, b]);
    expect(detectNewHozir(before, [a, b])).toEqual([]);
  });

  it('collects only HOZIR ids', () => {
    expect([...hozirIds([a, b, c])].sort()).toEqual(['a', 'b']);
  });
});
