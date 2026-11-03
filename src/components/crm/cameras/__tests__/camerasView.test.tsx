import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import uz from '@/locales/uz.json';
import ru from '@/locales/ru.json';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import type { CameraSessionState } from '@/hooks/useCameraSession';
import type { CameraSession } from '@/lib/cameraSession';
import { CamerasView } from '../CamerasView';

function i18nFor(lng: 'uz' | 'ru') {
  const i18n = createInstance();
  i18n.use(initReactI18next).init({
    lng,
    fallbackLng: 'uz',
    resources: { uz: { translation: uz }, ru: { translation: ru } },
    interpolation: { escapeValue: false },
  });
  return i18n;
}

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>;
}

function renderView(state: Partial<CameraSessionState>, isOwner: boolean, lng: 'uz' | 'ru' = 'uz') {
  const full: CameraSessionState = { session: null, error: null, loading: false, reload: vi.fn(), ...state };
  render(
    <MemoryRouter initialEntries={['/crm/cameras']}>
      <I18nextProvider i18n={i18nFor(lng)}>
        <Routes>
          <Route path="/crm/cameras" element={<CamerasView state={full} isOwner={isOwner} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </I18nextProvider>
    </MemoryRouter>,
  );
  return full;
}

const session: CameraSession = {
  gate: 'https://cam.hanguk.uz',
  token: 'v1.a.b',
  expires_at: '2099-01-01T00:00:00.000Z',
  ttl: 300,
  cameras: [
    { id: 'kirish', name: 'Kirish' },
    { id: 'zal', name: 'Zal' },
  ],
};

describe('«Kameralar» sahifasi', () => {
  it('kameralar: sarlavha, son, rejim tugmalari, har kamera kartasi', () => {
    renderView({ session }, false);
    expect(screen.getByRole('heading', { name: 'Ofis kameralari' })).toBeInTheDocument();
    expect(screen.getByText('2 ta kamera · 0 tasi onlayn')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Rasmlar' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Hammasi jonli' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirish: jonli videoni ochish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zal: jonli videoni ochish' })).toBeInTheDocument();
    expect(screen.getByText(/Har bir ko'rish jurnalga yoziladi/)).toBeInTheDocument();
  });

  it("ruscha: ko'plik shakli", () => {
    renderView({ session }, false, 'ru');
    expect(screen.getByText('2 камеры · в сети: 0')).toBeInTheDocument();
  });

  it("ruxsat yo'q: faqat matn, tugma yo'q", () => {
    renderView({ error: 'forbidden' }, false);
    expect(screen.getByText("Kameralarni ko'rishga ruxsatingiz yo'q. Ruxsatni owner beradi.")).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("kamera yo'q: owner'ga izoh va Sozlamalar → Kameralar tugmasi", () => {
    renderView({ error: 'no_cameras' }, true);
    expect(screen.getByText("Hozircha kamera qo'shilmagan.")).toBeInTheDocument();
    expect(screen.getByText(/Sozlamalar → Kameralar bo'limida qo'shing/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sozlamalar → Kameralar' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/crm/settings?tab=cameras');
  });

  it("kamera yo'q: xodimga tugma ko'rinmaydi", () => {
    renderView({ error: 'no_cameras' }, false);
    expect(screen.queryByRole('button', { name: 'Sozlamalar → Kameralar' })).toBeNull();
  });

  it('yuklab bo\'lmadi: «Qayta urinish»', () => {
    const state = renderView({ error: 'load_failed' }, false);
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(state.reload).toHaveBeenCalledTimes(1);
  });
});
