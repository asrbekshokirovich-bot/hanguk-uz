/* eslint-disable react-refresh/only-export-components */
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { LeadListRow } from '../../api';

// jsdom renders these pages slowly (Radix, big option lists); a loaded CI box needs room
configure({ asyncUtilTimeout: 5000 });

// Radix measures some controls (Switch / Checkbox inside a form); jsdom has no ResizeObserver
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
vi.setConfig({ testTimeout: 30_000 });

/** Shows the router's current location, so a test can assert where a button navigated. */
export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{`${loc.pathname}${loc.search}`}</div>;
}

export function renderWithProviders(ui: ReactElement, opts: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opts.route ?? '/']}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...utils };
}

/*
 * Cheap lookups. `getByRole` styles and names every element it looks at, which costs
 * seconds per query on these pages in jsdom; text / label / selector queries do not.
 */

/** Radix tabs switch on mouse down, not click. */
export function openTab(name: string | RegExp) {
  fireEvent.mouseDown(screen.getByText(name, { selector: '[role="tab"]' }), { button: 0 });
}

/** The <button> whose own text is `text`, inside `root`. */
export const button = (text: string | RegExp, root: HTMLElement = document.body): HTMLElement => within(root).getByText(text, { selector: 'button' });
export const queryButton = (text: string | RegExp, root: HTMLElement = document.body): HTMLElement | null =>
  within(root).queryByText(text, { selector: 'button' });

/** The open dialog (Radix puts role="dialog" on its content). */
export const findDialog = (): Promise<HTMLElement> =>
  waitFor(() => {
    const el = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!el) throw new Error('no dialog is open');
    return el;
  });
export const dialogGone = (): Promise<void> => waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
export const noDialog = (): boolean => document.querySelector('[role="dialog"]') === null;

let seq = 0;

/** A list row with every column filled in; override what the test is about. */
export function listRow(overrides: Partial<LeadListRow> = {}): LeadListRow {
  seq += 1;
  return {
    id: `lead-${seq}`,
    full_name: `Lead ${seq}`,
    phone: null,
    source: 'instagram',
    contact_channel: null,
    stage: 'contacted',
    crm_generation: 'new',
    owner_id: null,
    cert_level: null,
    education_level: null,
    city: null,
    priority_score: null,
    last_operator_msg_at: null,
    last_contacted_at: null,
    next_action_at: null,
    next_action_kind: null,
    ai_summary: null,
    lost_reason: null,
    lost_competitor: null,
    lost_at: null,
    lost_by: null,
    created_at: '2026-10-05T07:00:00.000Z',
    updated_at: '2026-10-05T07:00:00.000Z',
    instagram_handle: null,
    telegram_handle: null,
    campaign_name: null,
    form_name: null,
    pinned_at: null,
    reactivation_queue: null,
    call_result: null,
    ...overrides,
  };
}
