import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

const api = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  fetchPromises: vi.fn(),
  setStage: vi.fn(),
  decidePromise: vi.fn(),
}));
const role = vi.hoisted(() => ({ isAdmin: false }));

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: role.isAdmin }) }));
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  fetchSettings: api.fetchSettings,
  fetchPromises: api.fetchPromises,
  setStage: api.setStage,
  decidePromise: api.decidePromise,
}));

import type { LeadPromise, LeadV2 } from '../../types';
import { OfferBlock } from '../OfferBlock';
import { SEED_OFFERS, makeLead, renderWithQuery } from './helpers';

vi.setConfig({ testTimeout: 30_000 });

function setup(over: Partial<LeadV2> = {}, props: { saveField?: ReturnType<typeof vi.fn>; disabled?: boolean } = {}) {
  const saveField = props.saveField ?? vi.fn().mockResolvedValue(true);
  const onRequestPromise = vi.fn();
  const utils = renderWithQuery(
    <OfferBlock lead={makeLead(over)} disabled={props.disabled ?? false} saveField={saveField} onRequestPromise={onRequestPromise} />,
  );
  return { saveField, onRequestPromise, ...utils };
}

const offerCards = () => Array.from(document.querySelectorAll('[data-offer]')).map((el) => el.getAttribute('data-offer'));
const waitForOffers = () => waitFor(() => expect(api.fetchSettings).toHaveBeenCalled());

const promise = (over: Partial<LeadPromise> = {}): LeadPromise => ({
  id: 'p1',
  lead_id: 'lead-1',
  operator_id: 'op',
  kind: 'discount',
  text: '10% chegirma',
  reason: 'Ikki aka-uka',
  status: 'pending',
  decided_by: null,
  decided_at: null,
  created_at: '2026-10-05T09:00:00Z',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  role.isAdmin = false;
  api.fetchSettings.mockResolvedValue({ offers: SEED_OFFERS });
  api.fetchPromises.mockResolvedValue([]);
  api.setStage.mockResolvedValue(undefined);
  api.decidePromise.mockResolvedValue(undefined);
});

describe('OfferBlock — which offers the card shows (spec §11)', () => {
  it('TOPIK 3+ / IELTS 5.5+: Standart and Premium, with their text', async () => {
    setup({ cert_level: 'TOPIK 4' });
    expect(await screen.findByText('2 mln + 5 mln vizadan keyin')).toBeInTheDocument();
    expect(screen.getByText('3 mln + 10 mln vizadan keyin')).toBeInTheDocument();
    expect(offerCards()).toEqual(['standart', 'premium']);
    expect(screen.queryByText("Rahbar tasdig'i bilan")).not.toBeInTheDocument();
  });

  it('IELTS 5.5 gets the same two', async () => {
    setup({ cert_level: 'IELTS 5.5' });
    await waitFor(() => expect(offerCards()).toEqual(['standart', 'premium']));
  });

  it('no certificate: Hanbox', async () => {
    setup({ cert_level: "Yo'q" });
    await waitFor(() => expect(offerCards()).toEqual(['hanbox']));
  });

  it('a school pupil: Hanbox', async () => {
    setup({ study_year: '10-sinf' });
    await waitFor(() => expect(offerCards()).toEqual(['hanbox']));
  });

  it('a documents / finance worry: NO RISK, marked "Rahbar tasdig\'i bilan"', async () => {
    setup({ cert_level: 'TOPIK 3', objection: 'Hujjat / moliya' });
    await waitFor(() => expect(offerCards()).toEqual(['standart', 'premium', 'no_risk']));
    const card = document.querySelector('[data-offer="no_risk"]') as HTMLElement;
    expect(within(card).getByText("Rahbar tasdig'i bilan")).toBeInTheDocument();
    expect(within(document.querySelector('[data-offer="standart"]') as HTMLElement).queryByText("Rahbar tasdig'i bilan")).not.toBeInTheDocument();
  });

  it('a GKS goal: GKS; a vocational goal: Kasbiy', async () => {
    const gks = setup({ education_level: 'GKS' });
    await waitFor(() => expect(offerCards()).toEqual(['gks']));
    gks.unmount();
    setup({ education_level: 'Kasbiy ta’lim' });
    await waitFor(() => expect(offerCards()).toEqual(['kasbiy']));
  });

  it('says what is missing when there is nothing to base an offer on', async () => {
    setup({});
    await waitForOffers();
    expect(offerCards()).toEqual([]);
    expect(screen.getByText(/maqsad, sertifikat va e'tirozni kiriting/)).toBeInTheDocument();
  });

  it('shows the forbidden words from the settings', async () => {
    setup({ cert_level: 'TOPIK 3' });
    expect(await screen.findByText(/kafolat, 100%, bepul noutbuk, bitta narx, sertifikatsiz Koreya/)).toBeInTheDocument();
    expect(screen.getByText('Taqiq:')).toBeInTheDocument();
  });
});

describe('OfferBlock — Taklif turi and the stage buttons', () => {
  it('writes product_fit (the offer key) when a type is picked, and stars the recommended ones', async () => {
    const { saveField } = setup({ cert_level: 'TOPIK 3' });
    const group = await screen.findByRole('group', { name: 'Taklif turi' });
    expect(within(group).getByRole('button', { name: '★ Standart' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Hanbox' })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: '★ Premium' }));
    expect(saveField).toHaveBeenCalledWith({ product_fit: 'premium' });
  });

  it('moves the stage with setStage and shows the server error through explainError', async () => {
    api.setStage.mockRejectedValueOnce(new Error('missing_fields:product_fit'));
    setup({ stage: 'interested' });
    const group = screen.getByRole('group', { name: "Bosqichni o'zgartirish" });
    expect(within(group).getByRole('button', { name: 'Qiziqdi' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(group).getByRole('button', { name: 'Taklif' }));
    expect((await screen.findByRole('alert')).textContent).toBe('To‘ldirilmagan: Taklif turi');
    expect(api.setStage).toHaveBeenCalledWith('lead-1', 'offer', {});

    // the error goes away with the next successful move
    fireEvent.click(within(group).getByRole('button', { name: 'Shartnoma' }));
    await waitFor(() => expect(api.setStage).toHaveBeenCalledWith('lead-1', 'contract', {}));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('sends the chosen product with the move to Taklif', async () => {
    setup({ stage: 'interested', product_fit: 'standart' });
    fireEvent.click(within(screen.getByRole('group', { name: "Bosqichni o'zgartirish" })).getByRole('button', { name: 'Taklif' }));
    await waitFor(() => expect(api.setStage).toHaveBeenCalledWith('lead-1', 'offer', { product_fit: 'standart' }));
  });

  it('surfaces a refusal such as the five fields still missing', async () => {
    api.setStage.mockRejectedValueOnce(new Error('missing_fields:goal,region'));
    setup({ stage: 'contacted' });
    fireEvent.click(within(screen.getByRole('group', { name: "Bosqichni o'zgartirish" })).getByRole('button', { name: 'Qiziqdi' }));
    expect((await screen.findByRole('alert')).textContent).toBe('To‘ldirilmagan: Maqsad, Viloyat');
  });

  it('offers no stage move on a lost lead or when the card is read-only', () => {
    const lost = setup({ stage: 'lost' });
    for (const b of within(screen.getByRole('group', { name: "Bosqichni o'zgartirish" })).getAllByRole('button')) expect(b).toBeDisabled();
    lost.unmount();
    setup({ stage: 'offer' }, { disabled: true });
    for (const b of within(screen.getByRole('group', { name: "Bosqichni o'zgartirish" })).getAllByRole('button')) expect(b).toBeDisabled();
    expect(screen.getByRole('button', { name: "Chegirma / maxsus shart so'rash" })).toBeDisabled();
  });
});

describe('OfferBlock — promises (spec §11)', () => {
  it('opens the request dialog from "Chegirma / maxsus shart so\'rash"', async () => {
    const { onRequestPromise } = setup({});
    fireEvent.click(screen.getByRole('button', { name: "Chegirma / maxsus shart so'rash" }));
    expect(onRequestPromise).toHaveBeenCalledTimes(1);
    await waitForOffers();
  });

  it('lists this lead\'s promises with a status chip each', async () => {
    api.fetchPromises.mockResolvedValue([
      promise({ id: 'a', status: 'pending' }),
      promise({ id: 'b', status: 'approved', text: "Bo'lib to'lash", kind: 'installment' }),
      promise({ id: 'c', status: 'rejected', text: '30% chegirma' }),
    ]);
    setup({});
    const list = await screen.findByRole('list', { name: "Va'dalar" });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('kutilmoqda')).toBeInTheDocument();
    expect(within(items[1]).getByText('tasdiqlandi')).toBeInTheDocument();
    expect(within(items[1]).getByText("Bo'lib to'lash:")).toBeInTheDocument(); // the kind, then the text
    expect(within(items[2]).getByText('rad etildi')).toBeInTheDocument();
  });

  it('an operator cannot approve; the owner / admin approves or rejects the pending ones', async () => {
    api.fetchPromises.mockResolvedValue([promise({ id: 'a', status: 'pending' }), promise({ id: 'b', status: 'approved' })]);
    const operator = setup({});
    await screen.findByText('kutilmoqda');
    expect(screen.queryByRole('button', { name: /Tasdiqlash/ })).not.toBeInTheDocument();
    operator.unmount();

    role.isAdmin = true;
    setup({});
    const approve = await screen.findByRole('button', { name: /Tasdiqlash/ });
    expect(screen.getAllByRole('button', { name: /Tasdiqlash/ })).toHaveLength(1); // only the pending one
    fireEvent.click(approve);
    await waitFor(() => expect(api.decidePromise).toHaveBeenCalledWith('a', true));

    fireEvent.click(screen.getByRole('button', { name: /Rad etish/ }));
    await waitFor(() => expect(api.decidePromise).toHaveBeenCalledWith('a', false));
  });
});
