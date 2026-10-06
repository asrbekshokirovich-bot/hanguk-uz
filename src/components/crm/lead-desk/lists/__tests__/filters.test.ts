import { describe, expect, it } from 'vitest';
import { activeFilterCount, buildListFilter, dayRangeToIso, EMPTY_FILTERS } from '../filters';
import { channelsOf, handleOf, lastActionAt, nextActionText, truncate } from '../rowFormat';

describe('dayRangeToIso', () => {
  it('turns inclusive Tashkent days into a [from, to) instant range', () => {
    expect(dayRangeToIso('2026-10-05', '2026-10-06')).toEqual({
      from: '2026-10-04T19:00:00.000Z', // 00:00 UTC+5
      to: '2026-10-06T19:00:00.000Z', // 00:00 on the 7th
    });
  });

  it('a single day covers exactly 24 hours', () => {
    const { from, to } = dayRangeToIso('2026-10-05', '2026-10-05');
    expect(new Date(to!).getTime() - new Date(from!).getTime()).toBe(86_400_000);
  });

  it('leaves an open end open and ignores junk', () => {
    expect(dayRangeToIso('2026-10-05', '')).toEqual({ from: '2026-10-04T19:00:00.000Z', to: null });
    expect(dayRangeToIso('', '2026-10-05')).toEqual({ from: null, to: '2026-10-05T19:00:00.000Z' });
    expect(dayRangeToIso('05.10.2026', 'x')).toEqual({ from: null, to: null });
  });

  it('puts a reversed range the right way round', () => {
    expect(dayRangeToIso('2026-10-06', '2026-10-05')).toEqual(dayRangeToIso('2026-10-05', '2026-10-06'));
  });
});

describe('buildListFilter (filter bar -> fetchAllLeads arguments)', () => {
  it('an empty bar asks for the first page of everything active', () => {
    expect(buildListFilter(EMPTY_FILTERS)).toEqual({
      q: undefined,
      stage: null,
      source: null,
      ownerId: null,
      city: null,
      cert: null,
      lostReason: null,
      from: null,
      to: null,
      limit: 50,
      offset: 0,
    });
  });

  it('maps every filter to its api field', () => {
    const filter = buildListFilter(
      {
        q: '  Dilnoza ',
        stage: 'interested',
        source: 'telegram',
        owner: 'user-1',
        city: "Farg'ona",
        cert: 'TOPIK 3',
        fromDay: '2026-10-01',
        toDay: '2026-10-05',
        lostReason: '',
      },
      2,
    );
    expect(filter).toMatchObject({
      q: 'Dilnoza',
      stage: 'interested',
      source: 'telegram',
      ownerId: 'user-1',
      city: "Farg'ona",
      cert: 'TOPIK 3',
      from: '2026-09-30T19:00:00.000Z',
      to: '2026-10-05T19:00:00.000Z',
      limit: 50,
      offset: 100,
    });
  });

  it('"none" in the owner filter stays "none" (the pool)', () => {
    expect(buildListFilter({ ...EMPTY_FILTERS, owner: 'none' }).ownerId).toBe('none');
  });

  it('counts the filters that are on, not the search box', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: 'x', stage: 'new', city: 'Toshkent' })).toBe(2);
  });
});

describe('row formatting', () => {
  it('lists every channel once', () => {
    expect(channelsOf({ instagram_handle: 'dilnoza_a', telegram_handle: 'dilnoza', phone: '+998901234567', source: 'instagram', contact_channel: null })).toEqual([
      'IG',
      'TG',
      'Tel',
    ]);
    expect(channelsOf({ instagram_handle: null, telegram_handle: null, phone: null, source: 'meta_form', contact_channel: null })).toEqual(['Forma']);
    expect(channelsOf({ instagram_handle: null, telegram_handle: null, phone: null, source: 'learning_center', contact_channel: null })).toEqual([
      "O'quv markaz",
    ]);
  });

  it('shows the @username with one @', () => {
    expect(handleOf({ instagram_handle: '@aziz', telegram_handle: null })).toBe('@aziz');
    expect(handleOf({ instagram_handle: null, telegram_handle: 'aziz' })).toBe('@aziz');
    expect(handleOf({ instagram_handle: null, telegram_handle: null })).toBeNull();
  });

  it('takes the later of the call and the message as the last action', () => {
    expect(lastActionAt({ last_contacted_at: '2026-10-05T09:00:00Z', last_operator_msg_at: '2026-10-05T10:00:00Z' })).toBe('2026-10-05T10:00:00Z');
    expect(lastActionAt({ last_contacted_at: '2026-10-05T09:00:00Z', last_operator_msg_at: null })).toBe('2026-10-05T09:00:00Z');
    expect(lastActionAt({ last_contacted_at: null, last_operator_msg_at: null })).toBeNull();
  });

  it('writes the next action with its kind', () => {
    const now = new Date('2026-10-05T07:00:00Z');
    expect(nextActionText({ next_action_at: '2026-10-07T05:00:00Z', next_action_kind: 'callback' }, now)).toBe("07.10 10:00 · Qo'ng'iroq");
    expect(nextActionText({ next_action_at: null, next_action_kind: null }, now)).toBe('—');
  });

  it('truncates long text with an ellipsis', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde…');
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate(null, 5)).toBe('');
  });
});
