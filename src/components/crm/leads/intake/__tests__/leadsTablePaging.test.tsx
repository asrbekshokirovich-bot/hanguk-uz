import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import i18n from '@/lib/i18n';
import type { Lead } from '@/contexts/LeadsContext';
import { LEADS_PAGE, LeadsTable } from '../LeadsTable';

const lead = (n: number): Lead =>
  ({
    id: `lead-${n}`,
    full_name: `Lid Raqam${n}`,
    phone: `+99890${String(1000000 + n)}`,
    status: 'new',
    source: 'instagram',
    created_at: '2026-11-01T10:00:00Z',
    next_follow_up: null,
    call_result: null,
  }) as unknown as Lead;

const table = (leads: Lead[], listKey = 'all|active||false') => (
  <LeadsTable
    leads={leads}
    onOpen={vi.fn()}
    onOpenProfile={vi.fn()}
    onConvert={vi.fn()}
    onReject={vi.fn()}
    onRestore={vi.fn()}
    onCallResult={vi.fn()}
    busy={false}
    now={new Date('2026-11-12T12:00:00+05:00')}
    listKey={listKey}
  />
);

// By selector, not by role: the accessible-name lookup walks all 3000+ buttons
// of a full table and takes seconds.
const rows = () => document.querySelectorAll('button[aria-label*="Lid Raqam"]').length;
const more = () => [...document.querySelectorAll('button')].find((b) => /ta ko‘rsatish/.test(b.textContent ?? ''));

describe('LeadsTable — a page at a time', () => {
  it('draws the first page and says how many are left', async () => {
    await i18n.changeLanguage('uz');
    const leads = Array.from({ length: 300 }, (_, i) => lead(i));
    render(table(leads));
    expect(rows()).toBe(LEADS_PAGE);
    expect(more()?.textContent).toBe(`Yana ${300 - LEADS_PAGE} ta ko‘rsatish`);

    fireEvent.click(more()!);
    expect(rows()).toBe(LEADS_PAGE * 2);
    expect(more()?.textContent).toBe(`Yana ${300 - LEADS_PAGE * 2} ta ko‘rsatish`);
    fireEvent.click(more()!);
    expect(rows()).toBe(300);
    // Everything is on the page: nothing more to ask for.
    expect(more()).toBeUndefined();
  });

  it('a list that fits has no button', async () => {
    await i18n.changeLanguage('uz');
    render(table(Array.from({ length: LEADS_PAGE }, (_, i) => lead(i))));
    expect(rows()).toBe(LEADS_PAGE);
    expect(more()).toBeUndefined();
  });

  it('rows already shown stay shown while the list is worked, and another list starts from its first page', async () => {
    await i18n.changeLanguage('uz');
    const leads = Array.from({ length: 300 }, (_, i) => lead(i));
    const { rerender } = render(table(leads));
    fireEvent.click(more()!);
    expect(rows()).toBe(LEADS_PAGE * 2);

    // One lead leaves the list (converted, rejected): the same list, one row fewer.
    rerender(table(leads.slice(1)));
    expect(rows()).toBe(LEADS_PAGE * 2);

    // Another tab or a search: its own first page.
    rerender(table(leads, 'all|rejected||false'));
    expect(rows()).toBe(LEADS_PAGE);
  });
});
