import { describe, expect, it } from 'vitest';
import {
  countForTab,
  countHiddenStale,
  filterConversations,
  formatDayMonth,
  formatRowTime,
  isOverdue,
  matchesChannel,
  matchesTab,
  sortConversations,
} from '../queueLogic';
import type { ConversationVM } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-29T10:00:00Z');

function vm(overrides: Partial<ConversationVM> = {}): ConversationVM {
  return {
    threadId: 'th',
    channel: 'telegram',
    senderId: '1',
    name: 'Ali',
    initials: 'AL',
    avatarUrl: null,
    handle: '',
    studentId: null,
    leadId: null,
    kind: 'lead',
    stage: 'Yangi lid',
    preview: 'salom',
    lastAt: now.toISOString(),
    isWaiting: false,
    waitingSince: null,
    waitingMinutes: 0,
    isStale: false,
    isMine: false,
    isAssigned: false,
    isDone: false,
    unreadCount: 0,
    ...overrides,
  };
}

describe('matchesTab', () => {
  it('Waiting is "the person wrote and nobody answered", whoever it is assigned to', () => {
    const waiting = vm({ isWaiting: true, waitingMinutes: 0 });
    expect(matchesTab(waiting, 'waiting')).toBe(true);
    expect(matchesTab(vm({ isWaiting: false }), 'waiting')).toBe(false);
    // Answered by an automatic reply only: the server leaves isWaiting true.
    expect(matchesTab(vm({ isWaiting: true, isAssigned: true }), 'waiting')).toBe(true);
    expect(matchesTab(vm({ isWaiting: true, isDone: true }), 'waiting')).toBe(false);
  });
  it('All hides closed conversations; Done shows only them', () => {
    expect(matchesTab(vm(), 'all')).toBe(true);
    expect(matchesTab(vm({ isDone: true }), 'all')).toBe(false);
    expect(matchesTab(vm({ isDone: true }), 'done')).toBe(true);
  });
});

describe('matchesChannel', () => {
  it('keeps staff, partner and service chats out of every channel but "internal"', () => {
    const staff = vm({ kind: 'staff' });
    expect(matchesChannel(staff, 'all')).toBe(false);
    expect(matchesChannel(staff, 'telegram')).toBe(false);
    expect(matchesChannel(staff, 'internal')).toBe(true);
    expect(matchesChannel(vm(), 'internal')).toBe(false);
    expect(matchesChannel(vm({ channel: 'instagram' }), 'telegram')).toBe(false);
    expect(matchesChannel(vm({ channel: 'instagram' }), 'instagram')).toBe(true);
  });
});

describe('filterConversations + stale rule', () => {
  const fresh = vm({ threadId: 'fresh', isWaiting: true, waitingSince: now.toISOString() });
  const old = vm({
    threadId: 'old',
    isWaiting: true,
    isStale: true,
    lastAt: new Date(now.getTime() - 141 * DAY).toISOString(),
    waitingSince: new Date(now.getTime() - 141 * DAY).toISOString(),
  });
  it('hides 30+ day old waiting rows until asked, and counts them', () => {
    expect(filterConversations([fresh, old], 'waiting', 'all', '').map((c) => c.threadId)).toEqual(['fresh']);
    expect(countHiddenStale([fresh, old], 'all')).toBe(1);
    expect(filterConversations([fresh, old], 'waiting', 'all', '', { includeStale: true }).length).toBe(2);
    // A search looks everywhere.
    expect(filterConversations([fresh, old], 'waiting', 'all', 'ali').length).toBe(2);
    // The tab count shows what the operator will see.
    expect(countForTab([fresh, old], 'waiting')).toBe(1);
  });
  it('matches the handle too', () => {
    const h = vm({ handle: '@malika_ysp', name: 'Malika' });
    expect(filterConversations([h], 'all', 'all', 'malika_').length).toBe(1);
  });
  it('a search ignores the tab and adds what the server found (phone)', () => {
    const closed = vm({ threadId: 'closed', isDone: true, name: 'Lobar' });
    const byPhone = vm({ threadId: 'phone', name: 'Zarina' });
    expect(filterConversations([closed], 'waiting', 'all', 'lobar').length).toBe(1);
    expect(filterConversations([byPhone], 'waiting', 'all', '941643900').length).toBe(0);
    expect(
      filterConversations([byPhone], 'waiting', 'all', '941643900', { serverMatches: new Set(['phone']) }).length,
    ).toBe(1);
  });
});

describe('sortConversations', () => {
  it('Waiting puts the newest unanswered message on top (not the longest wait)', () => {
    const a = vm({ threadId: 'a', isWaiting: true, waitingSince: new Date(now.getTime() - 5 * DAY).toISOString(), waitingMinutes: 5 * 24 * 60 });
    const b = vm({ threadId: 'b', isWaiting: true, waitingSince: new Date(now.getTime() - 60_000).toISOString(), waitingMinutes: 1 });
    expect(sortConversations([a, b], 'waiting').map((c) => c.threadId)).toEqual(['b', 'a']);
  });
  it('other tabs sort by last activity', () => {
    const a = vm({ threadId: 'a', lastAt: new Date(now.getTime() - DAY).toISOString() });
    const b = vm({ threadId: 'b', lastAt: now.toISOString() });
    expect(sortConversations([a, b], 'all').map((c) => c.threadId)).toEqual(['b', 'a']);
  });
});

describe('isOverdue', () => {
  it('is only about a person waiting', () => {
    expect(isOverdue(vm({ isWaiting: true, waitingMinutes: 11 }))).toBe(true);
    expect(isOverdue(vm({ isWaiting: false, waitingMinutes: 11 }))).toBe(false);
    expect(isOverdue(vm({ isWaiting: true, waitingMinutes: 3 }))).toBe(false);
  });
});

describe('dates', () => {
  it('Uzbek month names instead of "M06"', () => {
    expect(formatDayMonth(new Date('2026-06-09T12:00:00Z'), 'uz')).toBe('9 iyn');
    expect(formatDayMonth(new Date('2026-06-09T12:00:00Z'), 'uz', true)).toBe('9 iyun');
  });
  it('row time: today → clock, yesterday → the given word, else day+month', () => {
    const today = new Date(now);
    today.setHours(12, 41);
    expect(formatRowTime(today.toISOString(), 'en', now, 'Kecha')).toMatch(/12:41/);
    const yesterday = new Date(now.getTime() - DAY);
    expect(formatRowTime(yesterday.toISOString(), 'uz', now, 'Kecha')).toBe('Kecha');
    const june = new Date('2026-06-09T12:00:00');
    expect(formatRowTime(june.toISOString(), 'uz', now, 'Kecha')).toBe('9 iyn');
  });
});
