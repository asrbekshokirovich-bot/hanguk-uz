/**
 * The forms hold the database's limits (P47): a field cannot take more than
 * its column keeps (hanguk_ish/supabase: businesses, business_contacts,
 * shifts, shift_notes), so the staff never meet a refusal for a long text.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import type { ReactNode } from 'react';
import uz from '@/locales/uz.json';
import type { IshApi } from '@/lib/ish/api';
import { IshApiProvider } from '../context';
import { IshBusinessDialog } from '../IshEmployers';
import { IshJobDialog } from '../IshJobDialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const api = { businesses: vi.fn(async () => []) } as unknown as IshApi;

function wrap(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <IshApiProvider api={api}>{children}</IshApiProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function maxLengths(ids: string[]): Record<string, number> {
  return Object.fromEntries(
    ids.map((id) => [id, (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.maxLength ?? -1]),
  );
}

describe('the forms hold the database\'s limits', () => {
  it('an employer: name, area, address, contact', () => {
    wrap(<IshBusinessDialog business={null} open onOpenChange={() => {}} onSaved={() => {}} />);
    expect(
      maxLengths(['ish-b-name', 'ish-b-name-uz', 'ish-b-area', 'ish-b-address', 'ish-b-detail',
        'ish-c-name', 'ish-c-phone', 'ish-c-telegram', 'ish-c-source', 'ish-c-notes']),
    ).toEqual({
      'ish-b-name': 80,
      'ish-b-name-uz': 80,
      'ish-b-area': 40,
      'ish-b-address': 200,
      'ish-b-detail': 80,
      'ish-c-name': 80,
      'ish-c-phone': 32,
      'ish-c-telegram': 64,
      'ish-c-source': 300,
      'ish-c-notes': 2000,
    });
  });

  it('a job: title, duties, dress, address, source, notes', () => {
    wrap(<IshJobDialog open onOpenChange={() => {}} onSaved={() => {}} />);
    expect(
      maxLengths(['ish-j-title', 'ish-j-duties', 'ish-j-dress', 'ish-j-address', 'ish-j-source', 'ish-j-notes']),
    ).toEqual({
      'ish-j-title': 80,
      'ish-j-duties': 600,
      'ish-j-dress': 300,
      'ish-j-address': 200,
      'ish-j-source': 300,
      'ish-j-notes': 2000,
    });
  });
});
