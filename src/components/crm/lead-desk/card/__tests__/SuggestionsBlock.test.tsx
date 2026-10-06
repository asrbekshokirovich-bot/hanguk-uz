import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

const api = vi.hoisted(() => ({
  fetchSuggestions: vi.fn(),
  applySuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
  fetchSettings: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api')>()), ...api }));

import type { FieldSuggestion } from '../../api';
import type { LeadV2 } from '../../types';
import { SuggestionsBlock } from '../SuggestionsBlock';
import { emptyOnLead, visibleSuggestions } from '../cardLogic';
import { SEED_OFFERS, makeLead, renderWithQuery } from './helpers';

vi.setConfig({ testTimeout: 30_000 });

const suggestion = (over: Partial<FieldSuggestion> = {}): FieldSuggestion => ({
  id: 's1',
  lead_id: 'lead-1',
  field: 'education_level',
  suggested_value: 'Bakalavr',
  confidence: 0.82,
  evidence: 'Bakalavrga topshirmoqchiman',
  evidence_channel: 'instagram',
  status: 'pending',
  ...over,
});

function setup(list: FieldSuggestion[], over: Partial<LeadV2> = {}, disabled = false) {
  api.fetchSuggestions.mockResolvedValue(list);
  return renderWithQuery(<SuggestionsBlock lead={makeLead(over)} disabled={disabled} />);
}

const row = (field: string) => within(document.querySelector(`[data-suggestion="${field}"]`) as HTMLElement);

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({ offers: SEED_OFFERS });
  api.applySuggestion.mockResolvedValue({});
  api.rejectSuggestion.mockResolvedValue({});
});

describe('which suggestions the card shows', () => {
  it('only pending ones, only for card fields that are empty, only with something proposed', () => {
    const lead = makeLead({ city: 'Toshkent', age: null });
    const list = [
      suggestion({ id: 'a', field: 'education_level' }), // empty -> shown
      suggestion({ id: 'b', field: 'city' }), // already filled -> hidden
      suggestion({ id: 'c', field: 'age', suggested_value: '19' }), // empty -> shown
      suggestion({ id: 'd', field: 'cert_level', status: 'accepted' }), // decided -> hidden
      suggestion({ id: 'e', field: 'summary' }), // not a card field -> hidden
      suggestion({ id: 'f', field: 'open_question' }), // work item, not applied by v2 -> hidden
      suggestion({ id: 'g', field: 'decider', suggested_value: '  ' }), // nothing proposed -> hidden
    ];
    expect(visibleSuggestions(list, lead).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('knows a column LeadV2 does not list, and reads 0 / blank correctly', () => {
    expect(emptyOnLead({ exam_type: 'TOPIK' }, 'exam_type')).toBe(false);
    expect(emptyOnLead({}, 'exam_type')).toBe(true);
    expect(emptyOnLead({ city: '  ' }, 'city')).toBe(true);
    expect(emptyOnLead({ age: 0 }, 'age')).toBe(false);
  });

  it('hides the whole block when there is nothing to suggest', async () => {
    setup([]);
    await waitFor(() => expect(api.fetchSuggestions).toHaveBeenCalledWith('lead-1'));
    expect(screen.queryByRole('heading', { name: 'AI taklif qilgan maydonlar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'AI takliflari' })).not.toBeInTheDocument();
  });

  it('hides it when every suggestion is for a field that is already filled', async () => {
    setup([suggestion({ field: 'education_level' })], { education_level: 'Magistr' });
    await waitFor(() => expect(api.fetchSuggestions).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'AI taklif qilgan maydonlar' })).not.toBeInTheDocument();
  });
});

describe('a suggestion row', () => {
  it('shows the field, the suggested value, the evidence and its channel, and the confidence', async () => {
    setup([suggestion()]);
    expect(await screen.findByRole('heading', { name: 'AI taklif qilgan maydonlar' })).toBeInTheDocument();
    const r = row('education_level');
    expect(r.getByText('Maqsad')).toBeInTheDocument();
    expect(r.getByRole('combobox')).toHaveValue('Bakalavr');
    expect(r.getByText(/Bakalavrga topshirmoqchiman/)).toBeInTheDocument();
    expect(r.getByText('IG')).toBeInTheDocument();
    expect(r.getByText('ishonch 82%')).toBeInTheDocument();
  });

  it('copes with no evidence', async () => {
    setup([suggestion({ evidence: null, evidence_channel: null, confidence: null })]);
    await screen.findByRole('heading', { name: 'AI taklif qilgan maydonlar' });
    const r = row('education_level');
    expect(r.queryByText(/ishonch/)).not.toBeInTheDocument();
    expect(r.getByRole('button', { name: 'Qabul qilish' })).toBeEnabled();
  });

  it('offers a fixed list where the field has one, free text where it does not, a number for the age', async () => {
    setup([
      suggestion({ id: 'a', field: 'decider', suggested_value: 'parent' }),
      suggestion({ id: 'b', field: 'budget_range', suggested_value: '3 mln' }),
      suggestion({ id: 'c', field: 'age', suggested_value: '19' }),
    ]);
    await screen.findByRole('list', { name: 'AI takliflari' });
    const decider = row('decider').getByRole('combobox');
    expect(decider).toHaveValue('parent');
    expect(within(decider).getByRole('option', { name: 'Ota-ona' })).toBeInTheDocument();
    expect(row('budget_range').getByRole('textbox')).toHaveValue('3 mln');
    expect(row('age').getByRole('spinbutton')).toHaveValue(19);
  });

  it('keeps the AI\'s own wording selectable when it is not on the list', async () => {
    setup([suggestion({ field: 'city', suggested_value: 'Toshkent shahri' })]);
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    expect(select.value).toBe('Toshkent shahri');
    expect(within(select).getByRole('option', { name: 'Samarqand' })).toBeInTheDocument();
  });
});

describe('Qabul qilish / Rad etish', () => {
  it('accepts the suggestion as it is (no value sent) and refreshes the lead and the suggestions', async () => {
    const { qc } = setup([suggestion()]);
    const spy = vi.spyOn(qc, 'invalidateQueries');

    fireEvent.click(await screen.findByRole('button', { name: 'Qabul qilish' }));

    await waitFor(() => expect(api.applySuggestion).toHaveBeenCalledWith('s1', undefined));
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
    expect(keys).toContain('["lead-v2","lead","lead-1"]');
    expect(keys).toContain('["lead-v2","suggestions","lead-1"]');
    expect(keys).toContain('["lead-v2","desk"]');
  });

  it('the row goes away once the suggestions are refetched', async () => {
    api.fetchSuggestions.mockResolvedValueOnce([suggestion()]).mockResolvedValue([]);
    renderWithQuery(<SuggestionsBlock lead={makeLead()} disabled={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Qabul qilish' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'AI taklif qilgan maydonlar' })).not.toBeInTheDocument());
  });

  it('accepts a corrected value: the edited text is what is sent', async () => {
    setup([suggestion({ id: 's2', field: 'budget_range', suggested_value: '3 mln' })]);
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: ' 5 mln ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Qabul qilish' }));
    await waitFor(() => expect(api.applySuggestion).toHaveBeenCalledWith('s2', '5 mln'));
  });

  it('accepts a value picked from the list instead of the suggested one', async () => {
    setup([suggestion()]);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'Magistr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Qabul qilish' }));
    await waitFor(() => expect(api.applySuggestion).toHaveBeenCalledWith('s1', 'Magistr'));
  });

  it('changing the value and changing it back sends nothing extra', async () => {
    setup([suggestion({ field: 'budget_range', suggested_value: '3 mln' })]);
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: '4 mln' } });
    fireEvent.change(input, { target: { value: '3 mln' } });
    fireEvent.click(screen.getByRole('button', { name: 'Qabul qilish' }));
    await waitFor(() => expect(api.applySuggestion).toHaveBeenCalledWith('s1', undefined));
  });

  it('cannot accept an emptied value', async () => {
    setup([suggestion({ field: 'budget_range', suggested_value: '3 mln' })]);
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Qabul qilish' })).toBeDisabled();
  });

  it('rejects: rejectSuggestion(id), nothing applied, lead and suggestions refreshed', async () => {
    const { qc } = setup([suggestion()]);
    const spy = vi.spyOn(qc, 'invalidateQueries');
    fireEvent.click(await screen.findByRole('button', { name: 'Rad etish' }));
    await waitFor(() => expect(api.rejectSuggestion).toHaveBeenCalledWith('s1'));
    expect(api.applySuggestion).not.toHaveBeenCalled();
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
    expect(keys).toContain('["lead-v2","suggestions","lead-1"]');
    expect(keys).toContain('["lead-v2","lead","lead-1"]');
  });

  it('shows the database\'s refusal through explainError and keeps the row', async () => {
    api.applySuggestion.mockRejectedValue(new Error('not_allowed'));
    setup([suggestion()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Qabul qilish' }));
    expect((await screen.findByRole('alert')).textContent).toBe("Bu amalga ruxsat yo'q");
    expect(row('education_level').getByRole('button', { name: 'Qabul qilish' })).toBeEnabled();
  });

  it('shows a refused rejection too', async () => {
    api.rejectSuggestion.mockRejectedValue(new Error('suggestion_not_found'));
    setup([suggestion()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Rad etish' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('is read-only on a lead somebody else holds', async () => {
    setup([suggestion()], {}, true);
    await screen.findByRole('heading', { name: 'AI taklif qilgan maydonlar' });
    expect(screen.getByRole('button', { name: 'Qabul qilish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rad etish' })).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
