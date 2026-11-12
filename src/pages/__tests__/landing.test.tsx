import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/lib/i18n';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isStaff: false, isUniversityStaff: false, isInvestor: false, isLearningCenter: false, loading: false }),
}));

import Index from '../Index';
import { CONTACTS } from '@/lib/contacts';

const open = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Index />
    </MemoryRouter>,
  );

/** Switch the language the way the switcher does, with the page on screen. */
const speak = (lng: string) =>
  act(async () => {
    await i18n.changeLanguage(lng);
  });

beforeEach(async () => {
  await speak('uz');
});

describe('home page', () => {
  it('both app buttons lead to the app page, not to the «install this website» page', () => {
    open();
    // /app is a page of its own (public/app.html): a real link, so the browser
    // loads it — the router has no such route and would show 404.
    for (const name of [/Qanday ishlashini ko'ring/, /Ilovani o'rnatish/]) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe('/app');
    }
    expect(document.querySelector('a[href="/install"]')).toBeNull();
  });

  it('says how to reach the company', () => {
    open();
    const contact = screen.getByRole('navigation', { name: 'Aloqa' });
    const hrefs = within(contact).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([CONTACTS.telegramDirect, CONTACTS.instagram, `tel:${CONTACTS.phone}`]);
    expect(within(contact).getByText(CONTACTS.phoneDisplay)).toBeTruthy();
    // Links that open another site do not hand it this window.
    for (const a of within(contact).getAllByRole('link').filter((x) => x.getAttribute('target') === '_blank')) {
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });

  it('links to support, the privacy policy and the terms', () => {
    open();
    const info = screen.getByRole('navigation', { name: "Ma'lumot" });
    const links = within(info).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/support', '/privacy', '/terms']);
    expect(links.map((a) => a.textContent)).toEqual(['Yordam', 'Maxfiylik siyosati', 'Foydalanish shartlari']);
  });

  it('the example card in the hero speaks the visitor\'s language', async () => {
    const view = open();
    for (const text of ['Seul Milliy Universitetiga ariza', 'Topshirildi', 'Hujjat', 'Tarjima', 'Apostil', 'Topshirish', 'Viza', '4-daraja', 'Hujjatlar']) {
      expect(screen.getByText(text), text).toBeTruthy();
    }
    expect(screen.queryByText('Submitted')).toBeNull();
    view.unmount();

    await speak('ru');
    open();
    for (const text of ['Подано', 'Перевод', 'Апостиль', 'Уровень 4']) {
      expect(screen.getByText(text), text).toBeTruthy();
    }
    expect(screen.queryByText('Docs')).toBeNull();
  });

  it('the tab title and <html lang> follow the language', async () => {
    open();
    expect(document.title).toBe('Hanguk Consulting — Janubiy Koreya universitetlari');
    expect(document.documentElement.lang).toBe('uz');
    await speak('ko');
    expect(document.documentElement.lang).toBe('ko');
    expect(document.title).toBe('Hanguk Consulting — 한국 대학 유학');
  });

  it('the home page\'s new texts are written in every site language', async () => {
    for (const lng of ['uz', 'en', 'ru', 'ko']) {
      for (const key of [
        'footerCity', 'footerContact', 'footerLinks', 'footerSupport', 'footerPrivacy', 'footerTerms',
        'pageTitle', 'mockApplication', 'mockSubmitted', 'mockStepDocs', 'mockStepTranslation', 'mockStepApostille',
        'mockStepSubmit', 'mockStepVisa', 'mockLevel', 'mockDocuments', 'mockAcceptedWho',
      ]) {
        expect(i18n.getResource(lng, 'translation', `landing.${key}`), `${lng}: landing.${key}`).toBeTruthy();
      }
    }
  });
});
