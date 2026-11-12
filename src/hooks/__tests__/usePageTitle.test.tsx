import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { pageTitle, usePageTitle } from '../usePageTitle';

function Page({ title, full }: { title: string | null; full?: boolean }) {
  usePageTitle(title, { full });
  return null;
}

const HOME = 'Hanguk Consulting - Janubiy Koreya universitetlari';

beforeEach(() => {
  document.title = HOME;
});
afterEach(() => {
  document.title = '';
});

describe('usePageTitle', () => {
  it('names the page while it is open and gives the old title back when it closes', () => {
    const { unmount } = render(<Page title="Maxfiylik siyosati" />);
    expect(document.title).toBe('Maxfiylik siyosati — Hanguk Consulting');
    unmount();
    expect(document.title).toBe(HOME);
  });

  it('follows the page when its language changes', () => {
    const { rerender } = render(<Page title="Yordam" />);
    rerender(<Page title="Поддержка" />);
    expect(document.title).toBe('Поддержка — Hanguk Consulting');
  });

  it('a full title is used as it is', () => {
    render(<Page title="Hanguk Consulting — South Korean universities" full />);
    expect(document.title).toBe('Hanguk Consulting — South Korean universities');
    expect(pageTitle('Hanguk Consulting — x', true)).toBe('Hanguk Consulting — x');
  });

  it('no title: the tab is left alone', () => {
    render(<Page title={null} />);
    expect(document.title).toBe(HOME);
  });
});
