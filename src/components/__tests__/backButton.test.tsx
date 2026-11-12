import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/lib/i18n';
import { BackButton } from '../BackButton';

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

/** The site with a support page that links to the privacy page. */
const open = (start: string) =>
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/support" element={<><Link to="/privacy">to privacy</Link><Where /></>} />
        <Route path="/privacy" element={<><BackButton /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('uz');
  });
});

describe('BackButton', () => {
  it('opened straight on the page (a store listing, the app): the arrow leads to the home page', () => {
    open('/privacy');
    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }));
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('reached from another page of the site: the arrow goes back there', () => {
    open('/support');
    fireEvent.click(screen.getByText('to privacy'));
    expect(screen.getByTestId('where').textContent).toBe('/privacy');
    fireEvent.click(screen.getByRole('button', { name: 'Orqaga' }));
    expect(screen.getByTestId('where').textContent).toBe('/support');
  });

  it('has a name in every site language', async () => {
    for (const [lng, name] of [['en', 'Back'], ['ru', 'Назад'], ['ko', '뒤로']] as const) {
      await act(async () => {
        await i18n.changeLanguage(lng);
      });
      const view = open('/privacy');
      expect(screen.getByRole('button', { name })).toBeTruthy();
      view.unmount();
    }
  });
});
